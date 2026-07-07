import { RANK_TIERS, type RankTier } from "./constants";

export interface RankInfo extends RankTier {
  next: RankTier | null;
  progress: number; // 0..1 within current tier
}

export function rankFromRp(rp: number): RankInfo {
  if (rp < RANK_TIERS[0]!.minRp) {
    const first = RANK_TIERS[0]!;
    return {
      name: "Unranked",
      short: "—",
      minRp: 0,
      color: "#6b7280",
      next: first,
      progress: Math.max(0, Math.min(1, rp / first.minRp)),
    };
  }
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (rp >= RANK_TIERS[i]!.minRp) idx = i;
  }
  const tier = RANK_TIERS[idx]!;
  const next = RANK_TIERS[idx + 1] ?? null;
  const span = next ? next.minRp - tier.minRp : 500;
  return {
    ...tier,
    next,
    progress: Math.max(0, Math.min(1, (rp - tier.minRp) / span)),
  };
}
