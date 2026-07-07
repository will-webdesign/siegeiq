import { CURRENT_SEASON_ID, RANK_TIERS, type Platform } from "@siegeiq/shared";
import { hash32, mulberry32, slugify } from "@siegeiq/shared";
import operatorsData from "@siegeiq/game-data/operators.json";
import weaponsData from "@siegeiq/game-data/weapons.json";
import mapsData from "@siegeiq/game-data/maps.json";
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

/**
 * DemoProvider — deterministic sample data seeded from username+platform so
 * every page is fully navigable with zero credentials. The UI shows a demo
 * banner whenever this provider served the data; it must NEVER be mistaken
 * for real stats (source badge = "demo").
 */

function rng(profileKey: string, salt: string) {
  return mulberry32(hash32(`${profileKey}:${salt}`));
}

function demoProfileId(platform: Platform, username: string): string {
  const h = hash32(`${platform}:${username.toLowerCase()}`).toString(16).padStart(8, "0");
  const h2 = hash32(`${username.toLowerCase()}:${platform}`).toString(16).padStart(8, "0");
  return `demo0000-${h.slice(0, 4)}-4${h.slice(4, 7)}-a${h2.slice(0, 3)}-${h2}0000`.slice(0, 36);
}

/** Skill anchor 0..1 per player — everything correlates with it. */
function skillOf(key: string): number {
  return rng(key, "skill")();
}

export function isDemoProfileId(id: string): boolean {
  return id.startsWith("demo0000");
}

const OPS = operatorsData as Array<{
  slug: string;
  name: string;
  side: "attacker" | "defender";
}>;
const WEAPONS = weaponsData as Array<{ slug: string; name: string }>;
const MAPS = mapsData as Array<{ slug: string; name: string }>;

export const demoProvider: FullProvider = {
  id: "demo",
  label: "Demo data",
  official: false,
  configured: () => true,

  async searchByUsername(platform, username): Promise<PlayerIdentity[]> {
    const name = username.trim();
    if (!name) return [];
    return [
      {
        profileId: demoProfileId(platform, name),
        userId: demoProfileId(platform, name),
        platform,
        username: name,
        avatarUrl: "",
      },
    ];
  },

  async getBoards(profileId, family): Promise<SeasonBoards> {
    const skill = skillOf(profileId);
    const r = rng(profileId, "boards");
    const rp = Math.round(1200 + skill * 3400 + r() * 200); // 1200..~4800
    const maxRp = rp + Math.round(r() * 250);
    const matches = 40 + Math.round(r() * 260);
    const wr = 0.42 + skill * 0.14 + (r() - 0.5) * 0.04;
    const wins = Math.round(matches * wr);
    const kd = 0.75 + skill * 0.75 + (r() - 0.5) * 0.1;
    const deaths = Math.round(matches * 6.2);
    return {
      profileId,
      family,
      seasonId: CURRENT_SEASON_ID,
      boards: [
        {
          board: "ranked",
          seasonId: CURRENT_SEASON_ID,
          rankPoints: rp,
          maxRankPoints: maxRp,
          kills: Math.round(deaths * kd),
          deaths,
          wins,
          losses: matches - wins - Math.round(r() * 3),
          abandons: Math.round(r() * 3),
          updatedAt: new Date(Date.now() - r() * 86400_000).toISOString(),
        },
        {
          board: "standard",
          seasonId: CURRENT_SEASON_ID,
          rankPoints: Math.round(rp * 0.92),
          maxRankPoints: Math.round(maxRp * 0.92),
          kills: Math.round(deaths * kd * 0.5),
          deaths: Math.round(deaths * 0.5),
          wins: Math.round(wins * 0.6),
          losses: Math.round((matches - wins) * 0.6),
          abandons: Math.round(r() * 2),
          updatedAt: new Date(Date.now() - r() * 86400_000 * 3).toISOString(),
        },
      ],
    };
  },

  async getSummary(q: StatsQuery): Promise<SummaryStats> {
    const skill = skillOf(q.profileId);
    const r = rng(q.profileId, `summary:${q.gameMode ?? "all"}`);
    const matches = 120 + Math.round(r() * 400);
    const rounds = matches * 7;
    const kpr = 0.55 + skill * 0.35 + (r() - 0.5) * 0.06;
    const kills = Math.round(rounds * kpr);
    const deaths = Math.round(rounds * (0.72 - skill * 0.12));
    const hsp = 0.28 + skill * 0.3 + (r() - 0.5) * 0.05;
    const wr = 0.44 + skill * 0.12;
    return {
      seasonId: CURRENT_SEASON_ID,
      gameMode: q.gameMode ?? "all",
      matchesPlayed: matches,
      roundsPlayed: rounds,
      kills,
      deaths,
      assists: Math.round(kills * 0.35),
      headshots: Math.round(kills * hsp),
      headshotPct: hsp,
      wins: Math.round(matches * wr),
      losses: matches - Math.round(matches * wr),
      openingKills: Math.round(rounds * (0.08 + skill * 0.07)),
      openingDeaths: Math.round(rounds * (0.11 - skill * 0.04)),
      plants: Math.round(rounds * 0.06),
      defuses: Math.round(rounds * 0.02),
      aces: Math.round(matches * 0.02 * (0.5 + skill)),
      clutches: Math.round(matches * 0.05 * (0.5 + skill)),
      timePlayedSeconds: matches * 1800,
      accuracy: 0.35 + skill * 0.12,
    };
  },

  async getOperators(q: StatsQuery): Promise<OperatorStat[]> {
    const skill = skillOf(q.profileId);
    const r = rng(q.profileId, "operators");
    // pick a stable subset the player "plays"
    const pool = [...OPS].sort(
      (a, b) => hash32(q.profileId + a.slug) % 997 - (hash32(q.profileId + b.slug) % 997),
    );
    const played = pool.slice(0, 14 + Math.round(r() * 10));
    return played.map((op, i) => {
      const affinity = rng(q.profileId, `op:${op.slug}`)();
      const rounds = Math.round(15 + affinity * 220 * (1 - i / played.length));
      const wr = 0.42 + skill * 0.1 + affinity * 0.1 - 0.05;
      const kpr = 0.5 + skill * 0.35 + affinity * 0.15;
      const kills = Math.round(rounds * kpr);
      return {
        operatorSlug: op.slug,
        operatorName: op.name,
        side: op.side,
        seasonId: q.seasonId ?? CURRENT_SEASON_ID,
        roundsPlayed: rounds,
        roundsWon: Math.round(rounds * wr),
        roundsLost: rounds - Math.round(rounds * wr),
        kills,
        deaths: Math.round(rounds * (0.7 - skill * 0.1)),
        headshotPct: 0.25 + skill * 0.3 + (affinity - 0.5) * 0.08,
        timePlayedSeconds: rounds * 210,
      };
    });
  },

  async getWeapons(q: StatsQuery): Promise<WeaponStat[]> {
    const skill = skillOf(q.profileId);
    const r = rng(q.profileId, "weapons");
    const pool = [...WEAPONS].sort(
      (a, b) => hash32(q.profileId + a.slug) % 997 - (hash32(q.profileId + b.slug) % 997),
    );
    const used = pool.slice(0, 10 + Math.round(r() * 8));
    return used.map((w, i) => {
      const affinity = rng(q.profileId, `wp:${w.slug}`)();
      const kills = Math.round(30 + affinity * 900 * (1 - i / used.length));
      const hsp = 0.25 + skill * 0.32 + (affinity - 0.5) * 0.1;
      return {
        weaponSlug: w.slug,
        weaponName: w.name,
        seasonId: q.seasonId ?? CURRENT_SEASON_ID,
        kills,
        headshots: Math.round(kills * hsp),
        headshotPct: hsp,
        roundsPlayed: Math.round(kills / (0.5 + skill * 0.3)),
      };
    });
  },

  async getMaps(q: StatsQuery): Promise<MapStat[]> {
    const skill = skillOf(q.profileId);
    return MAPS.map((m) => {
      const affinity = rng(q.profileId, `map:${m.slug}`)();
      const rounds = Math.round(20 + affinity * 160);
      const wr = 0.38 + skill * 0.12 + affinity * 0.14;
      const matches = Math.round(rounds / 7);
      return {
        mapSlug: m.slug,
        mapName: m.name,
        seasonId: q.seasonId ?? CURRENT_SEASON_ID,
        side: "all" as const,
        roundsPlayed: rounds,
        roundsWon: Math.round(rounds * wr),
        roundsLost: rounds - Math.round(rounds * wr),
        matchesWon: Math.round(matches * wr),
        matchesLost: matches - Math.round(matches * wr),
        kills: Math.round(rounds * (0.55 + skill * 0.3)),
        deaths: Math.round(rounds * 0.68),
      };
    }).filter((m) => m.roundsPlayed > 25);
  },

  async getProgression(profileId): Promise<ProgressionInfo> {
    const r = rng(profileId, "prog");
    return {
      level: 60 + Math.round(r() * 340),
      totalTimePlayedSeconds: Math.round((200 + r() * 1800) * 3600),
    };
  },

  async getStatus(): Promise<PlatformStatus[]> {
    return [
      { platform: "PC", status: "online", impactedFeatures: [] },
      { platform: "PlayStation", status: "online", impactedFeatures: [] },
      { platform: "Xbox", status: "online", impactedFeatures: [] },
    ];
  },
};

/** Demo rank-history series for the rank graph (deterministic random walk). */
export function demoRankHistory(profileId: string): { t: number; rp: number }[] {
  const r = rng(profileId, "history");
  const skill = skillOf(profileId);
  const start = 1400 + Math.round(skill * 2200);
  const points: { t: number; rp: number }[] = [];
  let rp = start;
  const days = 60;
  for (let i = days; i >= 0; i--) {
    const drift = (skill - 0.45) * 8;
    rp = Math.max(1000, Math.round(rp + (r() - 0.5) * 60 + drift));
    points.push({ t: Date.now() - i * 86400_000, rp });
  }
  return points;
}

export function demoRankName(rp: number): string {
  const tier = [...RANK_TIERS].reverse().find((t) => rp >= t.minRp);
  return tier?.name ?? "Unranked";
}

export const demoSlugify = slugify;
