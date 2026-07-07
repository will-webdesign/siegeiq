import { tryDb } from "@siegeiq/server/db";
import { provenanceFrom } from "@siegeiq/shared";
import { isDemoProfileId } from "@siegeiq/server/providers/demo";
import { demoSessionRounds, type DemoRound } from "@siegeiq/coaching/goals/demo-data";
import type { SessionFinding } from "@siegeiq/shared/goal-types";

/** Rounds older than this don't count as "this session" — matches the
 *  in-memory live-state staleness window used elsewhere in spirit (a session
 *  break resets context). */
const SESSION_WINDOW_MS = 4 * 3600_000;
/** Below this many rounds this session, there's nothing honest to say. */
const MIN_SESSION_ROUNDS = 8;
/** A death this early is what "reduce early deaths" is built around. */
const EARLY_DEATH_SECONDS = 60;

/**
 * Session report: strengths, weaknesses, and a recommendation, every one
 * evidence-linked to this session's actual rounds (docs/PHASE1_PLAN.md §Phase 3).
 * Never generic — if there isn't enough data this session, this returns null
 * and the UI says so plainly rather than filling the gap.
 */
export async function getSessionReport(profileId: string): Promise<SessionFinding[] | null> {
  const isDemo = isDemoProfileId(profileId);
  const rounds: DemoRound[] = isDemo ? demoSessionRounds(profileId) : await loadRealRounds(profileId);
  if (rounds.length < MIN_SESSION_ROUNDS) return null;

  const source = isDemo ? "demo" : "siegeiq-telemetry";
  const now = Date.now();
  const findings: SessionFinding[] = [];

  const byMap = new Map<string, DemoRound[]>();
  for (const r of rounds) {
    const arr = byMap.get(r.map) ?? [];
    arr.push(r);
    byMap.set(r.map, arr);
  }

  let best: { map: string; deathRate: number; n: number } | null = null;
  let worst: { map: string; deathRate: number; n: number } | null = null;
  for (const [map, rs] of byMap) {
    if (rs.length < 4) continue; // too few rounds on this map alone to say anything
    const deathRate = rs.filter((r) => r.died).length / rs.length;
    if (!best || deathRate < best.deathRate) best = { map, deathRate, n: rs.length };
    if (!worst || deathRate > worst.deathRate) worst = { map, deathRate, n: rs.length };
  }

  if (best && best.deathRate < 0.4) {
    findings.push({
      kind: "strength",
      title: `Your rounds on ${best.map} went well this session.`,
      reason: `You survived ${Math.round((1 - best.deathRate) * 100)}% of rounds played there.`,
      ...provenanceFrom(now, source, "calculated", best.n >= 8 ? "high" : "medium", {
        roundsAnalysed: best.n,
        map: best.map,
      }),
    });
  }

  if (worst && worst.deathRate > 0.55 && worst.map !== best?.map) {
    findings.push({
      kind: "weakness",
      title: `Early deaths cluster on ${worst.map}.`,
      reason: `${Math.round(worst.deathRate * 100)}% of your rounds there ended in death.`,
      ...provenanceFrom(now, source, "calculated", worst.n >= 8 ? "high" : "medium", {
        roundsAnalysed: worst.n,
        map: worst.map,
      }),
    });
  }

  const earlyDeaths = rounds.filter((r) => r.died && r.survivedSeconds < EARLY_DEATH_SECONDS);
  if (earlyDeaths.length / rounds.length > 0.3) {
    const avgFirstDeath = Math.round(
      earlyDeaths.reduce((s, r) => s + r.survivedSeconds, 0) / earlyDeaths.length,
    );
    findings.push({
      kind: "recommendation",
      title: "Delay your first engagement.",
      reason: `${earlyDeaths.length} of ${rounds.length} rounds ended in a death within ${EARLY_DEATH_SECONDS}s (average ${avgFirstDeath}s). Drone before committing to the first duel.`,
      ...provenanceFrom(now, source, "inferred", earlyDeaths.length >= 6 ? "medium" : "low", {
        earlyDeaths: earlyDeaths.length,
        roundsThisSession: rounds.length,
        averageFirstDeathSeconds: avgFirstDeath,
      }),
    });
  }

  return findings;
}

async function loadRealRounds(profileId: string): Promise<DemoRound[]> {
  const rows = await tryDb((db) =>
    db.roundRecord.findMany({
      where: { profileId, playedAt: { gt: new Date(Date.now() - SESSION_WINDOW_MS) } },
      orderBy: { playedAt: "desc" },
      take: 200,
    }),
  );
  return (rows ?? []).map((r) => ({
    map: r.map,
    side: r.side as "attacker" | "defender",
    survivedSeconds: r.survivedSeconds,
    died: r.died,
    playedAt: r.playedAt.getTime(),
  }));
}
