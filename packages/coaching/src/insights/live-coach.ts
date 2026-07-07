import operatorsData from "@siegeiq/game-data/operators.json";
import mapsData from "@siegeiq/game-data/maps.json";
import type { LiveMatchState, MapStat, OperatorStat } from "@siegeiq/shared";
import type { Insight } from "./engine";
import { pct } from "@siegeiq/shared";
import { provenanceFrom, type DataType, type Provenance } from "@siegeiq/shared";

interface OperatorMeta {
  slug: string;
  name: string;
  side: "attacker" | "defender";
  tags: string[];
  counters: string[];
  counteredBy: string[];
}

const OPS = operatorsData as unknown as OperatorMeta[];
const opBySlug = new Map(OPS.map((o) => [o.slug, o]));

/**
 * Live coach — same evidence-gating philosophy as the profile engine
 * (docs/ARCHITECTURE.md §8). Inputs are ONLY: the live roster reported by the
 * companion, the static counter/utility tables (versioned data), and the
 * viewer's own recorded per-map/per-operator stats. Team-comp checks need a
 * full roster; personal-stat advice needs minimum samples. Nothing else is
 * ever asserted.
 */
export function liveCoachInsights(input: {
  live: LiveMatchState;
  myMaps: MapStat[];
  myOperators: OperatorStat[];
}): Insight[] {
  const { live, myMaps, myOperators } = input;
  const out: Insight[] = [];
  const liveProv = (dataType: DataType, confidence: Provenance["confidence"], evidence: Record<string, string | number>) =>
    provenanceFrom(live.updatedAt, "siegeiq-live-coach", dataType, confidence, evidence);

  const allies = live.roster.filter((r) => r.team === "ally");
  const enemies = live.roster.filter((r) => r.team === "enemy");
  const allyOps = allies
    .map((a) => (a.operatorSlug ? opBySlug.get(a.operatorSlug) : undefined))
    .filter((o): o is OperatorMeta => Boolean(o));
  const enemyOps = enemies
    .map((a) => (a.operatorSlug ? opBySlug.get(a.operatorSlug) : undefined))
    .filter((o): o is OperatorMeta => Boolean(o));

  const rosterKnown = allyOps.length === 5;

  // ── Team composition checks (attack side, full roster only) ──────────
  if (rosterKnown && live.side === "attacker") {
    const has = (tag: string) => allyOps.some((o) => o.tags.includes(tag));
    if (!has("hardBreach")) {
      out.push({
        id: "no-hard-breach",
        severity: "warning",
        text: "Your team has no hard breach (Thermite, Hibana, Ace, Maverick). Reinforced walls will stand all round.",
        ...liveProv("calculated", "high", { allies: allyOps.map((o) => o.name).join(", ") }),
      });
    }
    if (!has("antiGadget")) {
      out.push({
        id: "no-anti-gadget",
        severity: "warning",
        text: "No EMP or gadget-clear on your team (Thatcher, Kali, Flores, Brava, Zero). Expect bandit tricking and intact defender utility.",
        ...liveProv("calculated", "high", { allies: allyOps.map((o) => o.name).join(", ") }),
      });
    }
    if (!has("intel")) {
      out.push({
        id: "no-intel",
        severity: "neutral",
        text: "No dedicated intel operator — drone discipline will have to carry (keep drones alive for post-plant).",
        ...liveProv("calculated", "medium", { allies: allyOps.map((o) => o.name).join(", ") }),
      });
    }
  }

  // ── Enemy-composition counters (needs at least 3 known enemy ops) ────
  if (enemyOps.length >= 3 && live.side === "attacker") {
    const counterCounts = new Map<string, string[]>();
    for (const e of enemyOps) {
      for (const c of e.counteredBy) {
        if (!opBySlug.has(c)) continue;
        const arr = counterCounts.get(c) ?? [];
        arr.push(e.name);
        counterCounts.set(c, arr);
      }
    }
    const ranked = [...counterCounts.entries()]
      .filter(([, hits]) => hits.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 2);
    for (const [slug, hits] of ranked) {
      const op = opBySlug.get(slug)!;
      out.push({
        id: `counter-${slug}`,
        severity: "neutral",
        text: `They have ${hits.join(" and ")} — ${op.name} counters ${hits.length} of their picks.`,
        ...liveProv("inferred", "high", { recommend: op.name, counters: hits.join(", ") }),
      });
    }
  }

  // ── Your own history on this map ─────────────────────────────────────
  if (live.map) {
    const mapMeta = (mapsData as Array<{ slug: string; name: string }>).find(
      (m) => m.name.toLowerCase() === live.map!.toLowerCase(),
    );
    const mine = myMaps.find(
      (m) =>
        m.mapName.toLowerCase() === live.map!.toLowerCase() ||
        (mapMeta && m.mapSlug === mapMeta.slug),
    );
    if (mine && mine.roundsPlayed >= 15) {
      const wr = mine.roundsWon / Math.max(1, mine.roundsWon + mine.roundsLost);
      out.push({
        id: "my-map-wr",
        severity: wr >= 0.5 ? "positive" : "warning",
        text: `You historically win ${pct(wr)} of rounds on ${mine.mapName} (${mine.roundsPlayed} rounds recorded).`,
        ...liveProv("calculated", mine.roundsPlayed >= 40 ? "high" : "medium", {
          map: mine.mapName,
          winRate: pct(wr),
          rounds: mine.roundsPlayed,
        }),
      });
    }
    // Best personal operator for the current side (min 20 rounds)
    const side = live.side;
    if (side) {
      const pool = myOperators
        .filter((o) => o.side === side && o.roundsPlayed >= 20)
        .map((o) => ({ ...o, wr: o.roundsWon / Math.max(1, o.roundsWon + o.roundsLost) }))
        .sort((a, b) => b.wr - a.wr);
      const top = pool[0];
      if (top) {
        out.push({
          id: "my-best-op-side",
          severity: "positive",
          text: `Your highest win-rate ${side} this season is ${top.operatorName} (${pct(top.wr)} over ${top.roundsPlayed} rounds).`,
          ...liveProv("calculated", top.roundsPlayed >= 50 ? "high" : "medium", {
            operator: top.operatorName,
            winRate: pct(top.wr),
            rounds: top.roundsPlayed,
          }),
        });
      }
    }
  }

  if (!out.length) {
    out.push({
      id: "insufficient",
      severity: "neutral",
      text: "Not enough verified data for coaching yet — roster incomplete or below minimum sample sizes. SiegeIQ never guesses.",
      ...liveProv("calculated", "high", {
        rosterKnown: String(rosterKnown),
        enemiesKnown: enemyOps.length,
      }),
    });
  }
  return out;
}

/**
 * Win-probability estimate from average RP differential — logistic curve
 * calibrated so 500 RP ≈ 68/32. Only computed when both teams have known
 * ranks; always displayed with its confidence.
 */
export function winProbability(
  allyAvgRp: number | null,
  enemyAvgRp: number | null,
  sampleSizes: { allies: number; enemies: number },
): { probability: number; confidence: "high" | "medium" | "low" } | null {
  if (allyAvgRp === null || enemyAvgRp === null) return null;
  if (sampleSizes.allies < 3 || sampleSizes.enemies < 3) return null;
  const diff = allyAvgRp - enemyAvgRp;
  // divisor 663 ⇒ a 500 RP average advantage maps to ~68% — deliberately
  // conservative; rank alone is a weak predictor and the UI shows confidence.
  const p = 1 / (1 + Math.exp(-diff / 663));
  const confidence =
    sampleSizes.allies === 5 && sampleSizes.enemies === 5
      ? "high"
      : sampleSizes.allies >= 4 && sampleSizes.enemies >= 4
        ? "medium"
        : "low";
  return { probability: p, confidence };
}
