import { tryDb } from "@siegeiq/server/db";
import { logger } from "@siegeiq/shared";
import { provenanceFrom } from "@siegeiq/shared";
import { isDemoProfileId } from "@siegeiq/server/providers/demo";
import { demoGoalProgress } from "@siegeiq/coaching/goals/demo-data";
import type { GoalProgress, GoalType, RoundRecordInput } from "@siegeiq/shared/goal-types";

const log = logger("goals");

/** Same evidence-gating floor as the profile insights engine's MIN_SAMPLES
 *  (docs/ARCHITECTURE.md §8) — a baseline or progress read below this many
 *  rounds is not trustworthy enough to show as a number. */
export const MIN_ROUND_SAMPLES = 15;

function average(rounds: { survivedSeconds: number }[]): number {
  if (!rounds.length) return 0;
  return rounds.reduce((s, r) => s + r.survivedSeconds, 0) / rounds.length;
}

/** Persist one round of real companion telemetry. Best-effort, non-fatal —
 *  same pattern as every other write in this codebase. Never called with
 *  synthesized data; demo rounds are generated on read, never stored. */
export async function recordRound(input: RoundRecordInput): Promise<void> {
  await tryDb((db) =>
    db.roundRecord.create({
      data: {
        profileId: input.profileId,
        playedAt: input.playedAt,
        map: input.map,
        side: input.side,
        operatorSlug: input.operatorSlug,
        survivedSeconds: input.survivedSeconds,
        died: input.died,
        source: input.source,
      },
    }),
  );
}

/** Creates the goal if it doesn't exist yet. Baseline is computed from
 *  whatever RoundRecords already exist — null (not zero, not guessed) below
 *  MIN_ROUND_SAMPLES. Demo profiles never persist a row; their "goal" is
 *  synthesized on every read by demoGoalProgress. */
export async function createGoal(profileId: string, goalType: GoalType): Promise<void> {
  if (isDemoProfileId(profileId)) return;
  await tryDb(async (db) => {
    const existing = await db.learningGoal.findUnique({
      where: { profileId_goalType: { profileId, goalType } },
    });
    if (existing) return existing;
    const rounds = await db.roundRecord.findMany({
      where: { profileId },
      orderBy: { playedAt: "asc" },
      take: 500,
    });
    const enough = rounds.length >= MIN_ROUND_SAMPLES;
    return db.learningGoal.create({
      data: {
        profileId,
        goalType,
        baselineSeconds: enough ? average(rounds) : null,
        baselineSampleSize: rounds.length,
        baselineComputedAt: enough ? new Date() : null,
      },
    });
  });
  log.info("goal created (or already existed)", { profileId, goalType });
}

export async function getGoalProgress(
  profileId: string,
  goalType: GoalType,
): Promise<GoalProgress | null> {
  if (isDemoProfileId(profileId)) return demoGoalProgress(profileId, goalType);

  return tryDb(async (db) => {
    const goal = await db.learningGoal.findUnique({
      where: { profileId_goalType: { profileId, goalType } },
    });
    if (!goal) return null;

    const since = goal.baselineComputedAt ?? goal.createdAt;
    const recent = await db.roundRecord.findMany({
      where: { profileId, playedAt: { gt: since } },
      orderBy: { playedAt: "desc" },
      take: 300,
    });
    const sampleSize = recent.length;
    const currentAvg = sampleSize ? average(recent) : null;
    const baselineSampleSize = goal.baselineSampleSize ?? 0;

    const confidence: "high" | "medium" | "low" =
      baselineSampleSize >= MIN_ROUND_SAMPLES && sampleSize >= MIN_ROUND_SAMPLES
        ? "high"
        : sampleSize >= Math.ceil(MIN_ROUND_SAMPLES / 2)
          ? "medium"
          : "low";

    const improvement =
      goal.baselineSeconds !== null && currentAvg !== null ? currentAvg - goal.baselineSeconds : null;

    const progress: GoalProgress = {
      goalType,
      createdAt: goal.createdAt.getTime(),
      previousAverageSeconds: goal.baselineSeconds,
      currentAverageSeconds: currentAvg,
      improvementSeconds: improvement,
      sampleSize,
      baselineSampleSize,
      ...provenanceFrom(Date.now(), "siegeiq-goals", "calculated", sampleSize ? confidence : "low", {
        roundsThisPeriod: sampleSize,
        baselineRounds: baselineSampleSize,
      }),
    };
    return progress;
  });
}
