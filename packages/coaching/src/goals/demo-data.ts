import { hash32, mulberry32 } from "@siegeiq/shared";
import { provenanceFrom } from "@siegeiq/shared";
import mapsData from "@siegeiq/game-data/maps.json";
import type { GoalProgress, GoalType } from "@siegeiq/shared/goal-types";

/**
 * Deterministic demo data for goals/session-reports — same seeding pattern
 * as src/lib/providers/demo.ts. Keeps the standing rule intact: demo mode
 * must exercise the full UI with zero credentials and zero companion, always
 * clearly source-tagged "demo" so it's never mistaken for real telemetry.
 *
 * Both demoSessionRounds and demoGoalProgress are built on the same
 * skill/death-chance model so the two demo surfaces stay numerically
 * consistent with each other — even synthetic data shouldn't contradict
 * itself (the V3 "no fake precision" principle applies to demo mode too).
 */

function rng(profileId: string, salt: string) {
  return mulberry32(hash32(`${profileId}:${salt}`));
}

const MAPS = mapsData as Array<{ slug: string; name: string }>;
const ROUND_LENGTH_SECONDS = 180;

export interface DemoRound {
  map: string;
  side: "attacker" | "defender";
  survivedSeconds: number;
  died: boolean;
  playedAt: number;
}

/** One synthetic round: dies with some probability (skill-correlated, plus a
 *  bias so "before" and "after" samples can differ), survives to full round
 *  length otherwise. Mirrors how a real RoundRecord's survivedSeconds is
 *  produced — never just an early-death number with no survivals mixed in. */
function syntheticRound(
  r: () => number,
  skill: number,
  deathChanceBias: number,
): { survivedSeconds: number; died: boolean } {
  const deathChance = Math.max(0.15, Math.min(0.8, 0.55 - skill * 0.3 + deathChanceBias + (r() - 0.5) * 0.1));
  const died = r() < deathChance;
  const survivedSeconds = died
    ? Math.max(3, Math.round(15 + skill * 35 + (r() - 0.4) * 25))
    : ROUND_LENGTH_SECONDS;
  return { survivedSeconds, died };
}

/** A deterministic "today's session" of rounds for the session-report card. */
export function demoSessionRounds(profileId: string, count = 24): DemoRound[] {
  const r = rng(profileId, "session-rounds");
  const skill = rng(profileId, "skill")();
  const out: DemoRound[] = [];
  for (let i = 0; i < count; i++) {
    const map = MAPS[Math.floor(r() * MAPS.length)] ?? MAPS[0]!;
    const side: "attacker" | "defender" = r() > 0.5 ? "attacker" : "defender";
    const { survivedSeconds, died } = syntheticRound(r, skill, 0);
    out.push({
      map: map.name,
      side,
      survivedSeconds,
      died,
      playedAt: Date.now() - (count - i) * 9 * 60_000,
    });
  }
  return out;
}

function average(rounds: { survivedSeconds: number }[]): number {
  return rounds.reduce((s, x) => s + x.survivedSeconds, 0) / rounds.length;
}

export function demoGoalProgress(profileId: string, goalType: GoalType): GoalProgress {
  const skill = rng(profileId, "skill")();
  const rBaseline = rng(profileId, "goal-baseline");
  const rCurrent = rng(profileId, "goal-current");
  // Baseline sampled with a worse (higher) death chance than the current
  // period — a modest, plausible improvement, not a dramatic one.
  const baselineRounds = Array.from({ length: 40 }, () => syntheticRound(rBaseline, skill, 0.08));
  const currentRounds = Array.from({ length: 32 }, () => syntheticRound(rCurrent, skill, -0.06));
  const baseline = average(baselineRounds);
  const current = average(currentRounds);

  return {
    goalType,
    createdAt: Date.now() - 9 * 86_400_000,
    previousAverageSeconds: Math.round(baseline),
    currentAverageSeconds: Math.round(current),
    improvementSeconds: Math.round(current - baseline),
    sampleSize: currentRounds.length,
    baselineSampleSize: baselineRounds.length,
    ...provenanceFrom(Date.now(), "demo", "calculated", "medium", {
      roundsThisPeriod: currentRounds.length,
      baselineRounds: baselineRounds.length,
    }),
  };
}
