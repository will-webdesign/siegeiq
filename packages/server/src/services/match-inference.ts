import type { BoardProfile } from "@siegeiq/shared";

export interface SnapshotLike {
  takenAt: Date;
  board: string;
  seasonId: number;
  rankPoints: number;
  kills: number;
  deaths: number;
  wins: number;
  losses: number;
  abandons: number;
}

export interface InferredMatchResult {
  playedAt: Date;
  board: string;
  seasonId: number;
  outcome: "win" | "loss" | "abandon";
  rpDelta: number;
  kills: number;
  deaths: number;
  /** high = exactly one match between snapshots; low = averaged across a session */
  confidence: "high" | "low";
}

/**
 * Infer matches from two consecutive board snapshots (docs/ARCHITECTURE.md §6).
 * Ubisoft exposes only counters, so between snapshots we know exactly how many
 * wins/losses/abandons happened and the total RP change — the same technique
 * every tracker uses for web-only players. One match → exact numbers
 * (confidence high). Several → per-match values are averages (confidence low)
 * and the UI must label them as a session.
 */
export function inferMatches(prev: SnapshotLike, curr: SnapshotLike): InferredMatchResult[] {
  if (prev.board !== curr.board || prev.seasonId !== curr.seasonId) return [];

  const wins = Math.max(0, curr.wins - prev.wins);
  const losses = Math.max(0, curr.losses - prev.losses);
  const abandons = Math.max(0, curr.abandons - prev.abandons);
  const total = wins + losses + abandons;
  if (total === 0) return [];

  const rpDelta = curr.rankPoints - prev.rankPoints;
  const kills = Math.max(0, curr.kills - prev.kills);
  const deaths = Math.max(0, curr.deaths - prev.deaths);
  const confidence: "high" | "low" = total === 1 ? "high" : "low";

  const out: InferredMatchResult[] = [];
  const span = curr.takenAt.getTime() - prev.takenAt.getTime();

  // Losses/abandons typically lose RP, wins gain. Apportion RP so signs make
  // sense when mixed; with a single match this is exact.
  let winShare = 0;
  let lossShare = 0;
  if (total === 1) {
    winShare = rpDelta;
    lossShare = rpDelta;
  } else {
    // Assume symmetric ±avg magnitude around the net delta.
    const avgMagnitude =
      wins + losses > 0 ? Math.abs(rpDelta - abandons * -30) / Math.max(1, wins + losses) : 0;
    winShare = Math.round(avgMagnitude);
    lossShare = -Math.round(avgMagnitude);
  }

  const emit = (outcome: InferredMatchResult["outcome"], count: number, rp: number) => {
    for (let i = 0; i < count; i++) {
      const idx = out.length;
      out.push({
        playedAt: new Date(prev.takenAt.getTime() + (span * (idx + 1)) / (total + 1)),
        board: curr.board,
        seasonId: curr.seasonId,
        outcome,
        rpDelta: rp,
        kills: Math.round(kills / total),
        deaths: Math.round(deaths / total),
        confidence,
      });
    }
  };

  emit("win", wins, winShare);
  emit("loss", losses, lossShare);
  emit("abandon", abandons, total === 1 ? rpDelta : -30);
  return out;
}

export function boardToSnapshot(b: BoardProfile, takenAt = new Date()): SnapshotLike {
  return {
    takenAt,
    board: b.board,
    seasonId: b.seasonId,
    rankPoints: b.rankPoints,
    kills: b.kills,
    deaths: b.deaths,
    wins: b.wins,
    losses: b.losses,
    abandons: b.abandons,
  };
}
