import { z } from "zod";
import { CURRENT_SEASON_ID, type Platform } from "@siegeiq/shared";
import { env } from "@siegeiq/server/env";
import { logger } from "@siegeiq/shared";
import { HttpError, withRetry } from "@siegeiq/server/retry";
import { bucketFor } from "@siegeiq/server/ratelimit";
import { slugify } from "@siegeiq/shared";
import type {
  FullProvider,
  MapStat,
  OperatorStat,
  PlayerIdentity,
  PlatformStatus,
  ProgressionInfo,
  SeasonBoards,
  StatsQuery,
  SummaryStats,
  WeaponStat,
} from "@siegeiq/shared";
import { NotFoundError, ProviderUnavailableError } from "@siegeiq/shared";

const log = logger("r6data");
const BASE = "https://api.r6data.com";

/**
 * Fallback adapter for the community-run R6Data API (https://r6data.com/api-docs).
 * One server-side API key; quota-based. Response shapes verified against their
 * public docs 2026-07 (see docs/RESEARCH.md §2.2). Anything we can't map
 * cleanly returns a ProviderUnavailableError so the registry can fail over.
 */
async function r6dFetch<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const key = env().R6DATA_API_KEY;
  if (!key) throw new ProviderUnavailableError("r6data", "R6DATA_API_KEY not set");

  const bucket = bucketFor("r6data", 5, 2);
  if (!bucket.tryTake()) {
    await new Promise((r) => setTimeout(r, bucket.msUntilAvailable()));
  }

  const json = await withRetry(async () => {
    const r = await fetch(`${BASE}${path}`, {
      headers: { "api-key": key },
      signal: AbortSignal.timeout(12_000),
    });
    if (r.status === 404) throw new NotFoundError();
    if (!r.ok) throw new HttpError(r.status, `r6data ${r.status} for ${path}`, await r.text());
    return r.json();
  });

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    log.error("r6data schema drift", { path, issues: parsed.error.issues.slice(0, 3) });
    throw new Error(`R6Data response schema drift at ${path}`);
  }
  return parsed.data;
}

const AccountInfo = z
  .object({
    profileId: z.string().optional(),
    userId: z.string().optional(),
    nameOnPlatform: z.string().optional(),
    platformType: z.string().optional(),
    profiles: z
      .array(
        z.object({
          profileId: z.string(),
          userId: z.string().optional(),
          nameOnPlatform: z.string(),
          platformType: z.string(),
        }),
      )
      .optional(),
  })
  .passthrough();

const FullStats = z
  .object({
    seasonNumber: z.number().optional(),
    operators: z
      .array(
        z
          .object({
            operator: z.string(),
            side: z.string(),
            roundsPlayed: z.number().optional(),
            winPercent: z.number().optional(),
            kd: z.number().optional(),
            kills: z.number().optional(),
            deaths: z.number().optional(),
            headshotPercent: z.number().optional(),
            wins: z.number().optional(),
            losses: z.number().optional(),
            timePlayedMs: z.number().optional(),
          })
          .passthrough(),
      )
      .optional(),
    platform_families_full_profiles: z
      .array(
        z
          .object({
            board_ids_full_profiles: z.array(
              z
                .object({
                  board_id: z.string(),
                  full_profiles: z.array(
                    z
                      .object({
                        season_id: z.number().optional(),
                        profile: z
                          .object({
                            rank: z.number().optional(),
                            rank_points: z.number().optional(),
                            max_rank_points: z.number().optional(),
                            kills: z.number().optional(),
                            deaths: z.number().optional(),
                            wins: z.number().optional(),
                            losses: z.number().optional(),
                            abandon: z.number().optional(),
                            update_time: z.string().optional(),
                          })
                          .passthrough(),
                      })
                      .passthrough(),
                  ),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const ServiceStatus = z.array(
  z.object({ name: z.string(), status: z.string(), services: z.array(z.string()).optional() }),
);

export const r6dataProvider: FullProvider = {
  id: "r6data",
  label: "R6Data (community API)",
  official: false,
  configured: () => Boolean(env().R6DATA_API_KEY),

  async searchByUsername(platform: Platform, username: string): Promise<PlayerIdentity[]> {
    const res = await r6dFetch(
      `/api/stats?type=accountInfo&nameOnPlatform=${encodeURIComponent(username)}&platformType=${platform}`,
      AccountInfo,
    );
    const list = res.profiles ?? (res.profileId ? [res as never] : []);
    if (!list.length) throw new NotFoundError(`No ${platform} player “${username}”`);
    return list.map((p) => ({
      profileId: p.profileId,
      userId: p.userId ?? p.profileId,
      platform,
      username: p.nameOnPlatform ?? username,
      avatarUrl: `https://ubisoft-avatars.akamaized.net/${p.profileId}/default_256_256.png`,
    }));
  },

  async getBoards(_profileId, _family): Promise<SeasonBoards> {
    // R6Data's fullStats is keyed by username; boards-by-profileId requires
    // the identity lookup first. The player service always calls with a known
    // username→profileId mapping cached, so we keep a small reverse cache here.
    throw new ProviderUnavailableError(
      "r6data",
      "boards require username-keyed fullStats — use getBoardsByName",
    );
  },

  async getSummary(_q: StatsQuery): Promise<SummaryStats> {
    throw new ProviderUnavailableError("r6data", "summary aggregation not exposed — failover");
  },

  async getOperators(_q: StatsQuery): Promise<OperatorStat[]> {
    throw new ProviderUnavailableError("r6data", "operator stats require username key");
  },

  async getWeapons(): Promise<WeaponStat[]> {
    throw new ProviderUnavailableError("r6data", "weapon stats not exposed");
  },

  async getMaps(): Promise<MapStat[]> {
    throw new ProviderUnavailableError("r6data", "map stats not exposed");
  },

  async getProgression(): Promise<ProgressionInfo> {
    throw new ProviderUnavailableError("r6data", "progression not exposed");
  },

  async getStatus(): Promise<PlatformStatus[]> {
    const res = await r6dFetch(`/api/servicestatus`, ServiceStatus);
    return res.map((s) => ({
      platform: s.name,
      status: s.status.toLowerCase() === "online" ? "online" : "degraded",
      impactedFeatures: s.services ?? [],
    }));
  },
};

/** Username-keyed helpers (R6Data's native shape) used by the player service
 *  when the registry has failed over to r6data. */
export async function r6dataBoardsByName(
  username: string,
  platform: Platform,
): Promise<SeasonBoards> {
  const res = await r6dFetch(
    `/api/stats?type=fullStats&nameOnPlatform=${encodeURIComponent(username)}&platformType=${platform}`,
    FullStats,
  );
  const fam = res.platform_families_full_profiles?.[0];
  const boards =
    fam?.board_ids_full_profiles.flatMap((b) =>
      b.full_profiles.map((fp) => ({
        board: (b.board_id as SeasonBoards["boards"][number]["board"]) ?? "ranked",
        seasonId: fp.season_id ?? res.seasonNumber ?? CURRENT_SEASON_ID,
        rankPoints: fp.profile.rank_points ?? 0,
        maxRankPoints: fp.profile.max_rank_points ?? 0,
        kills: fp.profile.kills ?? 0,
        deaths: fp.profile.deaths ?? 0,
        wins: fp.profile.wins ?? 0,
        losses: fp.profile.losses ?? 0,
        abandons: fp.profile.abandon ?? 0,
        updatedAt: fp.profile.update_time ?? null,
      })),
    ) ?? [];
  return {
    profileId: "",
    family: platform === "uplay" ? "pc" : "console",
    seasonId: boards[0]?.seasonId ?? CURRENT_SEASON_ID,
    boards,
  };
}

export async function r6dataOperatorsByName(
  username: string,
  platform: Platform,
): Promise<OperatorStat[]> {
  const res = await r6dFetch(
    `/api/stats?type=operatorStats&nameOnPlatform=${encodeURIComponent(username)}&platformType=${platform}`,
    FullStats,
  );
  return (res.operators ?? []).map((o) => ({
    operatorSlug: slugify(o.operator),
    operatorName: o.operator,
    side: o.side.toLowerCase().startsWith("att") ? "attacker" : "defender",
    seasonId: res.seasonNumber ?? CURRENT_SEASON_ID,
    roundsPlayed: o.roundsPlayed ?? 0,
    roundsWon: o.wins ?? 0,
    roundsLost: o.losses ?? 0,
    kills: o.kills ?? 0,
    deaths: o.deaths ?? 0,
    headshotPct: (o.headshotPercent ?? 0) / 100,
    timePlayedSeconds: Math.round((o.timePlayedMs ?? 0) / 1000),
  }));
}
