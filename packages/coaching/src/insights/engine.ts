import type { MapStat, OperatorStat, SummaryStats, MatchRow } from "@siegeiq/shared";
import { pct } from "@siegeiq/shared";
import { provenanceFrom, type Provenance } from "@siegeiq/shared";

/**
 * Evidence-gated insights engine (docs/ARCHITECTURE.md §8, docs/PHASE1_PLAN.md §2).
 * Hard rule: every insight carries the evidence that produced it, and every
 * rule declares minimum sample sizes. If the data can't support the sentence,
 * the sentence does not exist. No generative model is involved.
 *
 * Every Insight also carries full provenance (source/timestamp/dataType/
 * freshness) — the V3 universal provenance requirement. Every rule in this
 * file reads recorded aggregates (never predicts), so they are all
 * `dataType: "calculated"`; `"inferred"` is reserved for the goals/coaching
 * layer that extrapolates beyond raw numbers.
 */
export interface Insight extends Provenance {
  id: string;
  severity: "positive" | "neutral" | "warning";
  text: string;
}

/** Provenance context for the stats this engine reasons over — supplied by
 *  the caller, which knows which provider answered and when. */
export interface InsightContext {
  source: string;
  fetchedAt: number;
}

function insightProvenance(
  ctx: InsightContext,
  confidence: Provenance["confidence"],
  evidence: Record<string, string | number>,
): Provenance {
  return provenanceFrom(ctx.fetchedAt, ctx.source, "calculated", confidence, evidence);
}

export const MIN_SAMPLES = {
  mapRounds: 15,
  operatorRounds: 20,
  matches: 10,
  weaponKills: 50,
} as const;

export function profileInsights(input: {
  summary: SummaryStats | null;
  operators: OperatorStat[];
  maps: MapStat[];
  matches: MatchRow[];
  ctx?: InsightContext;
}): Insight[] {
  const out: Insight[] = [];
  const { summary, operators, maps, matches } = input;
  const ctx: InsightContext = input.ctx ?? { source: "unknown", fetchedAt: Date.now() };
  const prov = (confidence: Provenance["confidence"], evidence: Record<string, string | number>) =>
    insightProvenance(ctx, confidence, evidence);

  // ── Entry duel differential ──────────────────────────────────────────
  if (summary && summary.roundsPlayed >= 50) {
    const diff = summary.openingKills - summary.openingDeaths;
    const rate = summary.openingKills / Math.max(1, summary.roundsPlayed);
    if (diff > summary.roundsPlayed * 0.02) {
      out.push({
        id: "entry-positive",
        severity: "positive",
        text: `You win the opening duel more than you lose it (+${diff} over ${summary.roundsPlayed} rounds). Keep taking first contact — it's statistically your job.`,
        ...prov("high", {
          openingKills: summary.openingKills,
          openingDeaths: summary.openingDeaths,
          rounds: summary.roundsPlayed,
          openingKillRate: pct(rate),
        }),
      });
    } else if (diff < -summary.roundsPlayed * 0.02) {
      out.push({
        id: "entry-negative",
        severity: "warning",
        text: `You die first ${summary.openingDeaths} times vs ${summary.openingKills} opening kills. Consider droning for a teammate before committing, or default to second-contact roles.`,
        ...prov("high", {
          openingKills: summary.openingKills,
          openingDeaths: summary.openingDeaths,
          rounds: summary.roundsPlayed,
        }),
      });
    }
  }

  // ── Headshot discipline ──────────────────────────────────────────────
  if (summary && summary.kills >= 100) {
    if (summary.headshotPct >= 0.45) {
      out.push({
        id: "hs-high",
        severity: "positive",
        text: `${pct(summary.headshotPct)} headshot rate over ${summary.kills} kills — elite crosshair placement. High-RPM, low-damage guns still reward you.`,
        ...prov("high", { headshotPct: pct(summary.headshotPct), kills: summary.kills }),
      });
    } else if (summary.headshotPct < 0.25) {
      out.push({
        id: "hs-low",
        severity: "warning",
        text: `Headshot rate is ${pct(summary.headshotPct)} across ${summary.kills} kills. Warm up with headshot-only drills; favor forgiving high-damage weapons meanwhile.`,
        ...prov("high", { headshotPct: pct(summary.headshotPct), kills: summary.kills }),
      });
    }
  }

  // ── Best / worst maps ────────────────────────────────────────────────
  const rankedMaps = maps.filter((m) => m.roundsPlayed >= MIN_SAMPLES.mapRounds);
  if (rankedMaps.length >= 3) {
    const withWr = rankedMaps.map((m) => ({
      ...m,
      wr: m.roundsWon / Math.max(1, m.roundsWon + m.roundsLost),
    }));
    const best = withWr.reduce((a, b) => (b.wr > a.wr ? b : a));
    const worst = withWr.reduce((a, b) => (b.wr < a.wr ? b : a));
    if (best.wr - worst.wr > 0.08) {
      out.push({
        id: "map-best",
        severity: "positive",
        text: `${best.mapName} is your best map: ${pct(best.wr)} round win rate over ${best.roundsPlayed} rounds.`,
        ...prov(best.roundsPlayed >= 40 ? "high" : "medium", {
          map: best.mapName,
          winRate: pct(best.wr),
          rounds: best.roundsPlayed,
        }),
      });
      out.push({
        id: "map-worst",
        severity: "warning",
        text: `You lose most on ${worst.mapName} (${pct(worst.wr)} over ${worst.roundsPlayed} rounds). Consider banning it or reviewing site defaults there.`,
        ...prov(worst.roundsPlayed >= 40 ? "high" : "medium", {
          map: worst.mapName,
          winRate: pct(worst.wr),
          rounds: worst.roundsPlayed,
        }),
      });
    }
  }

  // ── Operator over/under-performance ──────────────────────────────────
  const opsRanked = operators.filter((o) => o.roundsPlayed >= MIN_SAMPLES.operatorRounds);
  if (opsRanked.length >= 3) {
    const withWr = opsRanked.map((o) => ({
      ...o,
      wr: o.roundsWon / Math.max(1, o.roundsWon + o.roundsLost),
      kd: o.kills / Math.max(1, o.deaths),
    }));
    const best = [...withWr].sort((a, b) => b.wr - a.wr)[0]!;
    out.push({
      id: "op-best",
      severity: "positive",
      text: `Your most winning operator is ${best.operatorName}: ${pct(best.wr)} over ${best.roundsPlayed} rounds (K/D ${best.kd.toFixed(2)}).`,
      ...prov(best.roundsPlayed >= 60 ? "high" : "medium", {
        operator: best.operatorName,
        winRate: pct(best.wr),
        rounds: best.roundsPlayed,
        kd: best.kd.toFixed(2),
      }),
    });
    const mostPlayed = [...withWr].sort((a, b) => b.roundsPlayed - a.roundsPlayed)[0]!;
    if (mostPlayed.wr < 0.47 && mostPlayed.operatorSlug !== best.operatorSlug) {
      out.push({
        id: "op-overplayed",
        severity: "warning",
        text: `You play ${mostPlayed.operatorName} the most (${mostPlayed.roundsPlayed} rounds) but win only ${pct(mostPlayed.wr)} with them — ${best.operatorName} wins you more.`,
        ...prov("high", {
          operator: mostPlayed.operatorName,
          rounds: mostPlayed.roundsPlayed,
          winRate: pct(mostPlayed.wr),
          alternative: best.operatorName,
        }),
      });
    }
  }

  // ── Streak / tilt from recent matches ────────────────────────────────
  if (matches.length >= MIN_SAMPLES.matches) {
    let streak = 0;
    for (const m of matches) {
      if (m.outcome === "win" && streak >= 0) streak++;
      else if (m.outcome === "loss" && streak <= 0) streak--;
      else break;
    }
    if (streak <= -3) {
      out.push({
        id: "tilt",
        severity: "warning",
        text: `${Math.abs(streak)} losses in a row. Historical data across playerbases says queue-break time — RP recovery is easier tomorrow.`,
        ...prov("high", { streak }),
      });
    } else if (streak >= 3) {
      out.push({
        id: "hot",
        severity: "positive",
        text: `${streak}-win streak — momentum is real, mechanics are warm.`,
        ...prov("high", { streak }),
      });
    }
    const abandons = matches.filter((m) => m.outcome === "abandon").length;
    if (abandons / matches.length > 0.08) {
      out.push({
        id: "abandon",
        severity: "warning",
        text: `${abandons} abandons in your last ${matches.length} matches — abandon penalties cost more RP than most losses.`,
        ...prov("high", { abandons, matches: matches.length }),
      });
    }
  }

  // ── Side balance ─────────────────────────────────────────────────────
  const atk = operators.filter((o) => o.side === "attacker");
  const def = operators.filter((o) => o.side === "defender");
  const atkRounds = atk.reduce((s, o) => s + o.roundsPlayed, 0);
  const defRounds = def.reduce((s, o) => s + o.roundsPlayed, 0);
  if (atkRounds + defRounds >= 200) {
    const atkWr =
      atk.reduce((s, o) => s + o.roundsWon, 0) / Math.max(1, atkRounds);
    const defWr =
      def.reduce((s, o) => s + o.roundsWon, 0) / Math.max(1, defRounds);
    if (Math.abs(atkWr - defWr) > 0.07) {
      const better = atkWr > defWr ? "attack" : "defense";
      out.push({
        id: "side-skew",
        severity: "neutral",
        text: `You win ${pct(Math.max(atkWr, defWr))} of rounds on ${better} vs ${pct(Math.min(atkWr, defWr))} on the other side — worth reviewing your weaker-side operator pool.`,
        ...prov("medium", { attackWinRate: pct(atkWr), defenseWinRate: pct(defWr) }),
      });
    }
  }

  return out;
}

/** Composite 0–100 performance score with transparent weighting. */
export function performanceScore(summary: SummaryStats | null): {
  score: number;
  parts: Record<string, number>;
} {
  if (!summary || summary.roundsPlayed < 20) return { score: 0, parts: {} };
  const kd = summary.kills / Math.max(1, summary.deaths);
  const wr = summary.wins / Math.max(1, summary.wins + summary.losses);
  const entry =
    (summary.openingKills - summary.openingDeaths) / Math.max(1, summary.roundsPlayed);
  const kdPart = Math.min(1, kd / 1.5) * 35;
  const wrPart = Math.min(1, wr / 0.6) * 35;
  const hsPart = Math.min(1, summary.headshotPct / 0.5) * 15;
  const entryPart = Math.min(1, Math.max(0, entry + 0.05) / 0.12) * 15;
  const score = Math.round(kdPart + wrPart + hsPart + entryPart);
  return {
    score,
    parts: {
      "K/D": Math.round(kdPart),
      "Win rate": Math.round(wrPart),
      Headshots: Math.round(hsPart),
      "Entry duels": Math.round(entryPart),
    },
  };
}
