/**
 * Universal data-provenance shape (V3 trust principle — docs/PHASE1_PLAN.md §2).
 * Any value SiegeIQ presents as meaningful — a stat, a recommendation, a
 * prediction — should be traceable back to one of these. Nothing renders a
 * number or a sentence without being able to answer: where did this come
 * from, how sure are we, what evidence backs it, when was it true, and is it
 * a fact, a computation, or an extrapolation.
 */

/** observed = read directly from a provider/telemetry stream, unmodified.
 *  calculated = arithmetic over recorded aggregates (win rate, K/D, averages).
 *  inferred = extrapolation beyond raw numbers (a recommendation, a predicted
 *  weakness, a suggested operator) — the one category that can be wrong in a
 *  way "calculated" can't, so it must never be presented with unwarranted
 *  confidence. */
export type DataType = "observed" | "calculated" | "inferred";

/** fresh = under a minute old. cached = under the staleness threshold.
 *  stale = old enough the UI should say so plainly rather than imply "now". */
export type Freshness = "fresh" | "cached" | "stale";

export type Confidence = "high" | "medium" | "low";

export interface Provenance {
  source: string;
  confidence: Confidence;
  evidence: Record<string, string | number>;
  /** epoch ms — when the underlying data was true, not when we're rendering it. */
  timestamp: number;
  dataType: DataType;
  freshness: Freshness;
}

/** Default staleness threshold: 15 minutes, matching the detailed-stats cache TTL. */
export function freshnessOf(ageMs: number, staleAfterMs = 15 * 60_000): Freshness {
  if (ageMs < 60_000) return "fresh";
  if (ageMs < staleAfterMs) return "cached";
  return "stale";
}

export function provenanceFrom(
  fetchedAt: number,
  source: string,
  dataType: DataType,
  confidence: Confidence,
  evidence: Record<string, string | number>,
): Provenance {
  return {
    source,
    confidence,
    evidence,
    timestamp: fetchedAt,
    dataType,
    freshness: freshnessOf(Date.now() - fetchedAt),
  };
}
