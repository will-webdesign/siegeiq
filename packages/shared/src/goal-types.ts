import type { Provenance } from "./provenance";

/** Only one goal type exists today. Adding another later is a new string
 *  value plus a new engine rule — not a schema migration (see
 *  LearningGoal.goalType in prisma/schema.prisma). */
export type GoalType = "reduce_early_deaths";

export const GOAL_LABELS: Record<GoalType, string> = {
  reduce_early_deaths: "Reduce early deaths",
};

export interface RoundRecordInput {
  profileId: string;
  playedAt: Date;
  map: string;
  side: "attacker" | "defender";
  operatorSlug: string | null;
  survivedSeconds: number;
  died: boolean;
  source: "companion" | "demo";
}

export interface GoalProgress extends Provenance {
  goalType: GoalType;
  createdAt: number;
  previousAverageSeconds: number | null;
  currentAverageSeconds: number | null;
  improvementSeconds: number | null;
  sampleSize: number;
  baselineSampleSize: number;
}

export interface SessionFinding extends Provenance {
  kind: "strength" | "weakness" | "recommendation";
  title: string;
  reason?: string;
}
