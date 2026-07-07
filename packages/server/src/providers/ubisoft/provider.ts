import {
  CURRENT_SEASON_ID,
  UBI,
  platformFamily,
  type BoardId,
  type Platform,
  type PlatformFamily,
} from "@siegeiq/shared";
import { env } from "@siegeiq/server/env";
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
  Side,
} from "@siegeiq/shared";
import { NotFoundError } from "@siegeiq/shared";
import * as client from "./client";

function ubiPlatform(p: Platform): "PC" | "PS4" | "XONE" {
  return p === "uplay" ? "PC" : p === "psn" ? "PS4" : "XONE";
}

function spaceFor(p: Platform): string {
  return p === "uplay" ? UBI.SPACES.pc : p === "psn" ? UBI.SPACES.ps4 : UBI.SPACES.xboxone;
}

/* datadev responses nest per-role arrays of objects keyed by entity name.
 * We walk them defensively: schema drift produces empty arrays + a health
 * warning, never wrong numbers. */
type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

interface RoleEntry {
  statsDetail?: string;
  seasonYear?: string;
  seasonNumber?: number;
  roundsPlayed?: number;
  roundsWon?: number;
  roundsLost?: number;
  kills?: number;
  death?: number;
  headshots?: number;
  headshotAccuracy?: number;
  matchesWon?: number;
  matchesLost?: number;
  matchesPlayed?: number;
  assists?: number;
  roundsWithOpeningKill?: number;
  roundsWithOpeningDeath?: number;
  plant?: number;
  defuser?: number;
  timePlayed?: number;
  winLossRatio?: number;
}

function walkRoles(
  payload: unknown,
  profileId: string,
  platform: "PC" | "PS4" | "XONE",
  gameMode: string,
): { role: string; entries: RoleEntry[] }[] {
  const platforms = rec(rec(rec(payload).profileData)[profileId]);
  const modes = rec(rec(rec(platforms.platforms)[platform]).gameModes);
  const roles = rec(rec(modes[gameMode]).teamRoles);
  const out: { role: string; entries: RoleEntry[] }[] = [];
  for (const [role, arr] of Object.entries(roles)) {
    if (Array.isArray(arr)) out.push({ role, entries: arr as RoleEntry[] });
  }
  return out;
}

function sideOf(role: string): Side | null {
  if (role === "attacker" || role === "Attacker") return "attacker";
  if (role === "defender" || role === "Defender") return "defender";
  return null;
}

export const ubisoftProvider: FullProvider = {
  id: "ubisoft",
  label: "Ubisoft (direct)",
  official: false, // undocumented internal endpoints — see docs/RESEARCH.md
  configured: () => Boolean(env().UBI_EMAIL && env().UBI_PASSWORD),

  async searchByUsername(platform, username): Promise<PlayerIdentity[]> {
    const res = await client.searchProfiles(platform, username);
    if (!res.profiles.length) throw new NotFoundError(`No ${platform} player “${username}”`);
    return res.profiles.map((p) => ({
      profileId: p.profileId,
      userId: p.userId,
      platform,
      username: p.nameOnPlatform,
      avatarUrl: `https://ubisoft-avatars.akamaized.net/${p.profileId}/default_256_256.png`,
    }));
  },

  async getBoards(profileId, family: PlatformFamily): Promise<SeasonBoards> {
    const res = await client.fetchFullProfiles(profileId, family);
    const fam = res.platform_families_full_profiles.find((f) => f.platform_family === family);
    const boards =
      fam?.board_ids_full_profiles.flatMap((b) =>
        b.full_profiles.map((fp) => ({
          board: (b.board_id as BoardId) ?? "ranked",
          seasonId: fp.profile.season_id,
          rankPoints: fp.profile.rank_points,
          maxRankPoints: fp.profile.max_rank_points,
          kills: fp.season_statistics.kills,
          deaths: fp.season_statistics.deaths,
          wins: fp.season_statistics.match_outcomes.wins,
          losses: fp.season_statistics.match_outcomes.losses,
          abandons: fp.season_statistics.match_outcomes.abandons,
          updatedAt: null,
        })),
      ) ?? [];
    const seasonId = boards[0]?.seasonId ?? CURRENT_SEASON_ID;
    return { profileId, family, seasonId, boards };
  },

  async getSummary(q: StatsQuery): Promise<SummaryStats> {
    const platform = ubiPlatform(q.platform);
    const gameMode = q.gameMode ?? "all";
    const res = await client.fetchPlayerStats({
      profileId: q.profileId,
      spaceId: spaceFor(q.platform),
      platform,
      aggregation: "summary",
      gameMode,
    });
    const roles = walkRoles(res, q.profileId, platform, gameMode);
    const all = roles.find((r) => r.role === "all")?.entries ?? roles[0]?.entries ?? [];
    // seasonal view returns one entry per season; latest first entry wins
    const e: RoleEntry = all[0] ?? {};
    const kills = num(e.kills);
    const headshots = num(e.headshots);
    return {
      seasonId: num(e.seasonNumber) || (q.seasonId ?? CURRENT_SEASON_ID),
      gameMode,
      matchesPlayed: num(e.matchesPlayed),
      roundsPlayed: num(e.roundsPlayed),
      kills,
      deaths: num(e.death),
      assists: num(e.assists),
      headshots,
      headshotPct: kills > 0 ? headshots / kills : 0,
      wins: num(e.matchesWon),
      losses: num(e.matchesLost),
      openingKills: num(e.roundsWithOpeningKill),
      openingDeaths: num(e.roundsWithOpeningDeath),
      plants: num(e.plant),
      defuses: num(e.defuser),
      aces: 0,
      clutches: 0,
      timePlayedSeconds: num(e.timePlayed),
      accuracy: null,
    };
  },

  async getOperators(q: StatsQuery): Promise<OperatorStat[]> {
    const platform = ubiPlatform(q.platform);
    const gameMode = q.gameMode ?? "all";
    const res = await client.fetchPlayerStats({
      profileId: q.profileId,
      spaceId: spaceFor(q.platform),
      platform,
      aggregation: "operators",
      gameMode,
    });
    const out: OperatorStat[] = [];
    for (const { role, entries } of walkRoles(res, q.profileId, platform, gameMode)) {
      const side = sideOf(role);
      if (!side) continue;
      for (const e of entries) {
        const name = str(e.statsDetail);
        if (!name) continue;
        const kills = num(e.kills);
        out.push({
          operatorSlug: slugify(name),
          operatorName: name,
          side,
          seasonId: num(e.seasonNumber) || CURRENT_SEASON_ID,
          roundsPlayed: num(e.roundsPlayed),
          roundsWon: num(e.roundsWon),
          roundsLost: num(e.roundsLost),
          kills,
          deaths: num(e.death),
          headshotPct: kills > 0 ? num(e.headshots) / kills : 0,
          timePlayedSeconds: num(e.timePlayed),
        });
      }
    }
    return out;
  },

  async getWeapons(q: StatsQuery): Promise<WeaponStat[]> {
    const platform = ubiPlatform(q.platform);
    const gameMode = q.gameMode ?? "all";
    const res = await client.fetchPlayerStats({
      profileId: q.profileId,
      spaceId: spaceFor(q.platform),
      platform,
      aggregation: "weapons",
      gameMode,
    });
    const out: WeaponStat[] = [];
    for (const { entries } of walkRoles(res, q.profileId, platform, gameMode)) {
      for (const e of entries) {
        const name = str(e.statsDetail);
        if (!name) continue;
        const kills = num(e.kills);
        const headshots = num(e.headshots);
        out.push({
          weaponSlug: slugify(name),
          weaponName: name,
          seasonId: num(e.seasonNumber) || CURRENT_SEASON_ID,
          kills,
          headshots,
          headshotPct: kills > 0 ? headshots / kills : 0,
          roundsPlayed: num(e.roundsPlayed),
        });
      }
    }
    return out;
  },

  async getMaps(q: StatsQuery): Promise<MapStat[]> {
    const platform = ubiPlatform(q.platform);
    const gameMode = q.gameMode ?? "all";
    const res = await client.fetchPlayerStats({
      profileId: q.profileId,
      spaceId: spaceFor(q.platform),
      platform,
      aggregation: "maps",
      gameMode,
    });
    const out: MapStat[] = [];
    for (const { role, entries } of walkRoles(res, q.profileId, platform, gameMode)) {
      const side = sideOf(role) ?? "all";
      for (const e of entries) {
        const name = str(e.statsDetail);
        if (!name) continue;
        out.push({
          mapSlug: slugify(name),
          mapName: name,
          seasonId: num(e.seasonNumber) || CURRENT_SEASON_ID,
          side,
          roundsPlayed: num(e.roundsPlayed),
          roundsWon: num(e.roundsWon),
          roundsLost: num(e.roundsLost),
          matchesWon: num(e.matchesWon),
          matchesLost: num(e.matchesLost),
          kills: num(e.kills),
          deaths: num(e.death),
        });
      }
    }
    return out;
  },

  async getProgression(profileId, platform): Promise<ProgressionInfo> {
    const res = await client.fetchPlaytime(profileId, spaceFor(platform));
    const p = res.profiles.find((x) => x.profileId === profileId);
    const stats = p?.stats ?? {};
    return {
      level: Math.round(stats["PClearanceLevel"]?.value ?? 0),
      totalTimePlayedSeconds: Math.round(stats["PTotalTimePlayed"]?.value ?? 0),
    };
  },

  async getStatus(): Promise<PlatformStatus[]> {
    const res = await client.fetchServiceStatus();
    return res.map((s) => {
      const status = (s.Status ?? s.status ?? "unknown").toLowerCase();
      return {
        platform: s.Platform ?? s.platform ?? s.Name ?? s.name ?? "unknown",
        status:
          status === "online"
            ? "online"
            : status === "maintenance"
              ? "maintenance"
              : status === "degraded" || status === "interrupted"
                ? "degraded"
                : "unknown",
        impactedFeatures: s.ImpactedFeatures ?? s.impactedFeatures ?? [],
      };
    });
  },
};

export { platformFamily };
