import { env } from "@siegeiq/server/env";
import { logger } from "@siegeiq/shared";
import { tryDb } from "@siegeiq/server/db";
import { getBoards } from "@siegeiq/server/services/player-service";
import type { Platform } from "@siegeiq/shared";

const log = logger("queues");

/**
 * Background jobs (BullMQ when Redis is available, in-process timers as a
 * degraded fallback so single-box deployments still refresh).
 *
 * refresh-tracked : re-snapshot TrackedPlayers (drives rank history + match
 *                   inference even when nobody is viewing the profile)
 * season-archive  : near season rollover, sweep all known players so final
 *                   season stats are preserved (Ubisoft deletes them — see
 *                   docs/RESEARCH.md §3)
 */
export async function startQueues(): Promise<void> {
  if (!env().REDIS_URL) {
    log.warn("REDIS_URL not set — using in-process interval fallback");
    setInterval(() => void refreshTrackedBatch(), 5 * 60_000);
    return;
  }

  const { Queue, Worker } = await import("bullmq");
  const { default: Redis } = await import("ioredis");
  // BullMQ takes ioredis options/instances, not URL strings in options.
  const connection = new Redis(env().REDIS_URL, { maxRetriesPerRequest: null });

  const refreshQueue = new Queue("refresh-tracked", { connection });
  await refreshQueue.upsertJobScheduler("refresh-cron", { every: 5 * 60_000 });

  new Worker(
    "refresh-tracked",
    async () => {
      await refreshTrackedBatch();
    },
    { connection, concurrency: 1 },
  );

  const archiveQueue = new Queue("season-archive", { connection });
  await archiveQueue.upsertJobScheduler("archive-cron", { every: 24 * 3600_000 });

  new Worker(
    "season-archive",
    async () => {
      await archiveSeasonSnapshots();
    },
    { connection, concurrency: 1 },
  );

  log.info("queues started");
}

async function refreshTrackedBatch(): Promise<void> {
  const players = await tryDb((db) =>
    db.trackedPlayer.findMany({
      orderBy: [{ priority: "desc" }, { lastQueuedAt: "asc" }],
      take: 25,
      include: { player: true },
    }),
  );
  if (!players?.length) return;
  for (const t of players) {
    try {
      await getBoards(t.profileId, t.player.platform as Platform);
      await tryDb((db) =>
        db.trackedPlayer.update({
          where: { profileId: t.profileId },
          data: { lastQueuedAt: new Date() },
        }),
      );
    } catch (e) {
      log.warn("tracked refresh failed", { profileId: t.profileId, error: String(e) });
    }
  }
  log.info("tracked refresh batch done", { count: players.length });
}

async function archiveSeasonSnapshots(): Promise<void> {
  // Copy each player's latest snapshot per (season, board) into SeasonArchive.
  await tryDb(async (db) => {
    const latest = await db.profileSnapshot.findMany({
      distinct: ["profileId", "seasonId", "board"],
      orderBy: { takenAt: "desc" },
      take: 5_000,
    });
    for (const s of latest) {
      await db.seasonArchive.upsert({
        where: {
          profileId_seasonId_board: {
            profileId: s.profileId,
            seasonId: s.seasonId,
            board: s.board,
          },
        },
        update: {
          rankPoints: s.rankPoints,
          maxRankPoints: s.maxRankPoints,
          kills: s.kills,
          deaths: s.deaths,
          wins: s.wins,
          losses: s.losses,
          abandons: s.abandons,
        },
        create: {
          profileId: s.profileId,
          seasonId: s.seasonId,
          board: s.board,
          rankPoints: s.rankPoints,
          maxRankPoints: s.maxRankPoints,
          kills: s.kills,
          deaths: s.deaths,
          wins: s.wins,
          losses: s.losses,
          abandons: s.abandons,
        },
      });
    }
    log.info("season archive sweep complete", { rows: latest.length });
  });
}
