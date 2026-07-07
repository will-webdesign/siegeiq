import { TTL, cached } from "@siegeiq/server/cache";
import { platformFamily, type Platform } from "@siegeiq/shared";
import { tryDb } from "@siegeiq/server/db";
import { logger } from "@siegeiq/shared";
import { withFailover } from "@siegeiq/server/providers/registry";
import { demoRankHistory, isDemoProfileId } from "@siegeiq/server/providers/demo";
import type {
  MapStat,
  OperatorStat,
  PlayerIdentity,
  ProgressionInfo,
  SeasonBoards,
  SummaryStats,
  WeaponStat,
} from "@siegeiq/shared";
import { boardToSnapshot, inferMatches } from "./match-inference";

const log = logger("player-service");

export interface Sourced<T> {
  data: T;
  source: string;
  fetchedAt: number;
  stale: boolean;
}

/** Username search → identities (cached 24 h, aliases persisted). */
export async function searchPlayer(
  platform: Platform,
  username: string,
): Promise<Sourced<PlayerIdentity[]>> {
  const key = `id:${platform}:${username.toLowerCase()}`;
  let source = "cache";
  const hit = await cached(key, TTL.identity, async () => {
    const res = await withFailover("searchByUsername", (p) =>
      p.searchByUsername(platform, username),
    );
    source = res.source;
    // persist identity for alias history + leaderboards (best effort)
    for (const id of res.data) {
      void tryDb((db) =>
        db.player.upsert({
          where: { profileId: id.profileId },
          update: { currentName: id.username, lastRefreshedAt: new Date() },
          create: {
            profileId: id.profileId,
            userId: id.userId,
            platform: id.platform,
            currentName: id.username,
          },
        }),
      );
    }
    return res.data;
  });
  return { data: hit.value, source, fetchedAt: hit.fetchedAt, stale: hit.stale };
}

/** Ranked boards; every real fetch also snapshots + infers matches. */
export async function getBoards(
  profileId: string,
  platform: Platform,
): Promise<Sourced<SeasonBoards>> {
  const family = platformFamily(platform);
  const key = `boards:${profileId}:${family}`;
  let source = "cache";
  const hit = await cached(key, TTL.boards, async () => {
    const res = await withFailover("getBoards", (p) => p.getBoards(profileId, family));
    source = res.source;
    void recordSnapshots(profileId, res.data);
    return res.data;
  });
  return { data: hit.value, source, fetchedAt: hit.fetchedAt, stale: hit.stale };
}

async function recordSnapshots(profileId: string, boards: SeasonBoards): Promise<void> {
  await tryDb(async (db) => {
    for (const b of boards.boards) {
      const prev = await db.profileSnapshot.findFirst({
        where: { profileId, board: b.board, seasonId: b.seasonId },
        orderBy: { takenAt: "desc" },
      });
      const snap = await db.profileSnapshot.create({
        data: {
          profileId,
          board: b.board,
          seasonId: b.seasonId,
          rankPoints: b.rankPoints,
          maxRankPoints: b.maxRankPoints,
          kills: b.kills,
          deaths: b.deaths,
          wins: b.wins,
          losses: b.losses,
          abandons: b.abandons,
        },
      });
      if (prev) {
        const matches = inferMatches(
          { ...prev, takenAt: prev.takenAt },
          boardToSnapshot(b, snap.takenAt),
        );
        if (matches.length) {
          await db.inferredMatch.createMany({
            data: matches.map((m) => ({ profileId, ...m })),
            skipDuplicates: true,
          });
          log.info("inferred matches", { profileId, count: matches.length });
        }
      }
    }
  });
}

export async function getSummary(
  profileId: string,
  platform: Platform,
  gameMode: "all" | "ranked" | "casual" | "unranked" = "all",
): Promise<Sourced<SummaryStats>> {
  const key = `summary:${profileId}:${gameMode}`;
  let source = "cache";
  const hit = await cached(key, TTL.detailedStats, async () => {
    const res = await withFailover("getSummary", (p) =>
      p.getSummary({ profileId, platform, gameMode }),
    );
    source = res.source;
    return res.data;
  });
  return { data: hit.value, source, fetchedAt: hit.fetchedAt, stale: hit.stale };
}

export async function getOperators(
  profileId: string,
  platform: Platform,
): Promise<Sourced<OperatorStat[]>> {
  const key = `ops:${profileId}`;
  let source = "cache";
  const hit = await cached(key, TTL.detailedStats, async () => {
    const res = await withFailover("getOperators", (p) => p.getOperators({ profileId, platform }));
    source = res.source;
    return res.data;
  });
  return { data: hit.value, source, fetchedAt: hit.fetchedAt, stale: hit.stale };
}

export async function getWeapons(
  profileId: string,
  platform: Platform,
): Promise<Sourced<WeaponStat[]>> {
  const key = `weps:${profileId}`;
  let source = "cache";
  const hit = await cached(key, TTL.detailedStats, async () => {
    const res = await withFailover("getWeapons", (p) => p.getWeapons({ profileId, platform }));
    source = res.source;
    return res.data;
  });
  return { data: hit.value, source, fetchedAt: hit.fetchedAt, stale: hit.stale };
}

export async function getMaps(profileId: string, platform: Platform): Promise<Sourced<MapStat[]>> {
  const key = `maps:${profileId}`;
  let source = "cache";
  const hit = await cached(key, TTL.detailedStats, async () => {
    const res = await withFailover("getMaps", (p) => p.getMaps({ profileId, platform }));
    source = res.source;
    return res.data;
  });
  return { data: hit.value, source, fetchedAt: hit.fetchedAt, stale: hit.stale };
}

export async function getProgression(
  profileId: string,
  platform: Platform,
): Promise<Sourced<ProgressionInfo>> {
  const key = `prog:${profileId}`;
  let source = "cache";
  const hit = await cached(key, TTL.detailedStats, async () => {
    const res = await withFailover("getProgression", (p) =>
      p.getProgression(profileId, platform),
    );
    source = res.source;
    return res.data;
  });
  return { data: hit.value, source, fetchedAt: hit.fetchedAt, stale: hit.stale };
}

export interface RankPoint {
  t: number;
  rp: number;
}

/** Rank history: demo → deterministic series; real → recorded snapshots. */
export async function getRankHistory(profileId: string): Promise<RankPoint[]> {
  if (isDemoProfileId(profileId)) return demoRankHistory(profileId);
  const rows = await tryDb((db) =>
    db.profileSnapshot.findMany({
      where: { profileId, board: "ranked" },
      orderBy: { takenAt: "asc" },
      take: 500,
      select: { takenAt: true, rankPoints: true },
    }),
  );
  return (rows ?? []).map((r) => ({ t: r.takenAt.getTime(), rp: r.rankPoints }));
}

export type { MatchRow } from "@siegeiq/shared";
import type { MatchRow } from "@siegeiq/shared";

export async function getMatches(profileId: string): Promise<MatchRow[]> {
  if (isDemoProfileId(profileId)) return demoMatches(profileId);
  const rows = await tryDb((db) =>
    db.inferredMatch.findMany({
      where: { profileId },
      orderBy: { playedAt: "desc" },
      take: 40,
    }),
  );
  return (rows ?? []).map((m) => ({
    playedAt: m.playedAt.getTime(),
    board: m.board,
    outcome: m.outcome as MatchRow["outcome"],
    rpDelta: m.rpDelta,
    kills: m.kills,
    deaths: m.deaths,
    confidence: m.confidence as MatchRow["confidence"],
  }));
}

function demoMatches(profileId: string): MatchRow[] {
  const history = demoRankHistory(profileId);
  const out: MatchRow[] = [];
  for (let i = history.length - 1; i > 0 && out.length < 25; i--) {
    const delta = history[i]!.rp - history[i - 1]!.rp;
    if (Math.abs(delta) < 8) continue;
    out.push({
      playedAt: history[i]!.t,
      board: "ranked",
      outcome: delta >= 0 ? "win" : "loss",
      rpDelta: Math.round(delta),
      kills: Math.max(0, Math.round(5 + delta / 10)),
      deaths: Math.max(1, Math.round(5 - delta / 12)),
      confidence: "high",
    });
  }
  return out;
}
