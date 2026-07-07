import { z } from "zod";
import { UBI, type Platform, type PlatformFamily } from "@siegeiq/shared";
import { logger } from "@siegeiq/shared";
import { HttpError, withRetry } from "@siegeiq/server/retry";
import { bucketFor } from "@siegeiq/server/ratelimit";
import { authHeaders, getSession } from "./auth";

const log = logger("ubisoft:client");

/**
 * Outbound budget — DELIBERATELY CONSERVATIVE because every request in this
 * process goes through ONE shared Ubisoft "burner" account (see docs/RESEARCH.md
 * §2.1). There is no second account to fail over to, so if Ubisoft rate-limits or
 * bans this account for unusual traffic, live data goes down for every user at
 * once. We therefore cap the *global* (process-wide, all-users) outbound rate,
 * not a per-user/per-IP rate.
 *
 * Budget: burst 5, sustained 2 req/s ≈ 120 req/min hard ceiling to Ubisoft
 * across the whole app. This is well under what a single logged-in human browsing
 * the Ubisoft stats site would generate, which is the traffic profile we want to
 * blend into. Combined with aggressive response caching (cache.ts) the effective
 * upstream call volume is far lower than the visible request volume. Tune DOWN,
 * not up, if we ever see 429s. The single shared bucket key ("ubisoft") is what
 * makes this a true global ceiling rather than per-caller.
 */
function takeBudget() {
  const bucket = bucketFor("ubisoft", 5, 2);
  if (!bucket.tryTake()) {
    const wait = bucket.msUntilAvailable();
    return new Promise<void>((resolve) => setTimeout(resolve, wait)).then(() => undefined);
  }
  return Promise.resolve();
}

async function ubiFetch<T>(
  url: string,
  schema: z.ZodType<T>,
  opts: { appId?: string } = {},
): Promise<T> {
  await takeBudget();
  let session = await getSession();

  const doFetch = async () => {
    const r = await fetch(url, {
      headers: authHeaders(session, opts.appId),
      signal: AbortSignal.timeout(12_000),
    });
    if (r.status === 401) {
      // ticket expired mid-flight → force refresh once, then retry via thrower
      session = await getSession(true);
      throw new HttpError(401, "unauthorized (session refreshed)");
    }
    if (!r.ok) throw new HttpError(r.status, `${r.status} for ${url}`, await r.text());
    return r.json();
  };

  const json = await withRetry(doFetch, {
    retries: 3,
    isRetryable: (e) =>
      e instanceof HttpError
        ? e.status === 401 || e.status === 429 || e.status >= 500
        : e instanceof TypeError || (e instanceof Error && e.name === "AbortError"),
    onRetry: (attempt, delay, err) =>
      log.warn("retrying", { url, attempt, delay: Math.round(delay), error: String(err) }),
  });

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    log.error("schema drift detected", { url, issues: parsed.error.issues.slice(0, 3) });
    throw new Error(`Ubisoft response schema drift at ${url}`);
  }
  return parsed.data;
}

/** ── Schemas (tolerant: unknown extra fields pass through) ─────────── */

const ProfilesSchema = z.object({
  profiles: z.array(
    z.object({
      profileId: z.string(),
      userId: z.string(),
      platformType: z.string(),
      nameOnPlatform: z.string(),
    }),
  ),
});

const FullProfilesSchema = z.object({
  platform_families_full_profiles: z.array(
    z.object({
      platform_family: z.string(),
      board_ids_full_profiles: z.array(
        z.object({
          board_id: z.string(),
          full_profiles: z.array(
            z.object({
              profile: z.object({
                board_id: z.string(),
                id: z.string().optional(),
                max_rank: z.number(),
                max_rank_points: z.number(),
                platform_family: z.string().optional(),
                rank: z.number(),
                rank_points: z.number(),
                season_id: z.number(),
                top_rank_position: z.number().optional(),
              }),
              season_statistics: z.object({
                deaths: z.number(),
                kills: z.number(),
                match_outcomes: z.object({
                  abandons: z.number(),
                  losses: z.number(),
                  wins: z.number(),
                }),
              }),
            }),
          ),
        }),
      ),
    }),
  ),
});

/**
 * datadev playerstats — shape varies by aggregation; validated loosely here
 * and normalized in provider.ts. Top-level: profileData[profileId].platforms
 * .{PC|PS4|XONE}.gameModes.{all|ranked|casual|unranked}.teamRoles
 * .{all|attacker|defender}[] with statsDetail per operator/map/weapon.
 */
const PlayerStatsLoose = z.object({
  profileData: z.record(z.string(), z.unknown()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const PlaytimeSchema = z.object({
  profiles: z.array(
    z.object({
      profileId: z.string(),
      stats: z.record(
        z.string(),
        z.object({ value: z.coerce.number(), startDate: z.string().optional() }),
      ),
    }),
  ),
});

const StatusSchema = z.array(
  z.object({
    AppID: z.string().optional(),
    appId: z.string().optional(),
    Name: z.string().optional(),
    name: z.string().optional(),
    Platform: z.string().optional(),
    platform: z.string().optional(),
    Status: z.string().optional(),
    status: z.string().optional(),
    ImpactedFeatures: z.array(z.string()).optional(),
    impactedFeatures: z.array(z.string()).optional(),
  }),
);

/** ── Public client functions ───────────────────────────────────────── */

export async function searchProfiles(platform: Platform, name: string) {
  const url = `${UBI.BASE}/v3/profiles?namesOnPlatform=${encodeURIComponent(name)}&platformType=${platform}`;
  return ubiFetch(url, ProfilesSchema);
}

export async function fetchFullProfiles(profileId: string, family: PlatformFamily) {
  const spaceId = UBI.SPACES.pc; // ranked 2.0 boards are cross-play; PC space serves both families
  const url = `${UBI.BASE}/v2/spaces/${spaceId}/title/r6s/skill/full_profiles?profile_ids=${profileId}&platform_families=${family}`;
  return ubiFetch(url, FullProfilesSchema);
}

export async function fetchPlayerStats(params: {
  profileId: string;
  spaceId: string;
  platform: "PC" | "PS4" | "XONE";
  aggregation: "summary" | "operators" | "maps" | "weapons";
  gameMode: string;
  seasonIds?: string; // e.g. "Y9S3" style not used; datadev takes from/to dates or seasons list
}) {
  const { profileId, spaceId, platform, aggregation, gameMode } = params;
  const url =
    `${UBI.DATADEV}/v1/profiles/${profileId}/playerstats?spaceId=${spaceId}` +
    `&view=seasonal&aggregation=${aggregation}&gameMode=${gameMode}` +
    `&platform=${platform}&teamRole=all,attacker,defender`;
  return ubiFetch(url, PlayerStatsLoose, { appId: UBI.APP_ID_V2 });
}

export async function fetchPlaytime(profileId: string, spaceId: string) {
  const stats = "PPvPTimePlayed,PPvETimePlayed,PTotalTimePlayed,PClearanceLevel";
  const url = `${UBI.BASE}/v1/profiles/stats?profileIds=${profileId}&spaceId=${spaceId}&statsName=${stats}`;
  return ubiFetch(url, PlaytimeSchema);
}

export async function fetchServiceStatus() {
  const appIds = [
    "e3d5ea9e-50bd-43b7-88bf-39794f4e3d40", // PC
    "fb4cc4c9-2063-461d-a1e8-84a7d36525fc", // PS4
    "6e3c99c9-6c3f-43f4-b4f6-f1a3143f2764", // PS5
    "4008612d-3baf-49e4-957a-33066726a7bc", // XB1
    "76f580d5-7f50-47cc-bbc1-152d000bfe59", // XSX
  ].join(",");
  // Public endpoint — no auth required.
  const r = await fetch(`${UBI.STATUS}?appIds=${appIds}`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) throw new HttpError(r.status, "status endpoint failed");
  return StatusSchema.parse(await r.json());
}
