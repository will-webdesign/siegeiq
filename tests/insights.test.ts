import { describe, expect, it } from "vitest";
import { profileInsights, performanceScore, MIN_SAMPLES } from "@siegeiq/coaching/insights/engine";
import type { MapStat, OperatorStat, SummaryStats } from "@siegeiq/shared";

const testCtx = { source: "test-provider", fetchedAt: Date.now() - 5_000 };

const summary = (over: Partial<SummaryStats> = {}): SummaryStats => ({
  seasonId: 42,
  gameMode: "all",
  matchesPlayed: 100,
  roundsPlayed: 700,
  kills: 500,
  deaths: 450,
  assists: 150,
  headshots: 200,
  headshotPct: 0.4,
  wins: 55,
  losses: 45,
  openingKills: 70,
  openingDeaths: 50,
  plants: 40,
  defuses: 12,
  aces: 3,
  clutches: 8,
  timePlayedSeconds: 180000,
  accuracy: null,
  ...over,
});

const mapStat = (name: string, rounds: number, won: number): MapStat => ({
  mapSlug: name.toLowerCase(),
  mapName: name,
  seasonId: 42,
  side: "all",
  roundsPlayed: rounds,
  roundsWon: won,
  roundsLost: rounds - won,
  matchesWon: 0,
  matchesLost: 0,
  kills: 0,
  deaths: 0,
});

const opStat = (name: string, rounds: number, won: number): OperatorStat => ({
  operatorSlug: name.toLowerCase(),
  operatorName: name,
  side: "attacker",
  seasonId: 42,
  roundsPlayed: rounds,
  roundsWon: won,
  roundsLost: rounds - won,
  kills: rounds,
  deaths: Math.round(rounds * 0.7),
  headshotPct: 0.3,
  timePlayedSeconds: rounds * 200,
});

describe("profileInsights — evidence gating", () => {
  it("says nothing about maps below the sample floor", () => {
    const out = profileInsights({
      summary: null,
      operators: [],
      maps: [mapStat("Bank", MIN_SAMPLES.mapRounds - 1, 2)],
      matches: [],
      ctx: testCtx,
    });
    expect(out.find((i) => i.id.startsWith("map-"))).toBeUndefined();
  });

  it("emits best/worst map with evidence when samples suffice", () => {
    const out = profileInsights({
      summary: null,
      operators: [],
      maps: [mapStat("Bank", 60, 40), mapStat("Border", 60, 22), mapStat("Chalet", 60, 30)],
      matches: [],
      ctx: testCtx,
    });
    const best = out.find((i) => i.id === "map-best");
    expect(best).toBeDefined();
    expect(best!.evidence.map).toBe("Bank");
    expect(best!.text).toContain("Bank");
    const worst = out.find((i) => i.id === "map-worst");
    expect(worst!.evidence.map).toBe("Border");
  });

  it("flags overplayed underperforming operator", () => {
    const out = profileInsights({
      summary: null,
      operators: [opStat("Ash", 200, 80), opStat("Ace", 60, 40), opStat("Iana", 30, 15)],
      maps: [],
      matches: [],
      ctx: testCtx,
    });
    const flag = out.find((i) => i.id === "op-overplayed");
    expect(flag).toBeDefined();
    expect(flag!.evidence.operator).toBe("Ash");
    expect(flag!.evidence.alternative).toBe("Ace");
  });

  it("every insight carries evidence", () => {
    const out = profileInsights({
      summary: summary(),
      operators: [opStat("Ash", 100, 60)],
      maps: [mapStat("Bank", 60, 40), mapStat("Border", 60, 20), mapStat("Oregon", 40, 22)],
      matches: Array.from({ length: 12 }, (_, i) => ({
        playedAt: Date.now() - i * 3600e3,
        board: "ranked",
        outcome: (i < 4 ? "win" : i % 2 ? "win" : "loss") as "win" | "loss",
        rpDelta: i < 4 ? 30 : i % 2 ? 25 : -28,
        kills: 6,
        deaths: 5,
        confidence: "high" as const,
      })),
      ctx: testCtx,
    });
    expect(out.length).toBeGreaterThan(0);
    for (const i of out) {
      expect(Object.keys(i.evidence).length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(i.confidence);
      // Universal provenance (V3 trust principle): every insight must be
      // fully traceable — source, timestamp, dataType, freshness.
      expect(i.source).toBe(testCtx.source);
      expect(i.timestamp).toBe(testCtx.fetchedAt);
      expect(i.dataType).toBe("calculated");
      expect(["fresh", "cached", "stale"]).toContain(i.freshness);
    }
  });
});

describe("performanceScore", () => {
  it("returns 0 without minimum rounds", () => {
    expect(performanceScore(summary({ roundsPlayed: 10 })).score).toBe(0);
  });
  it("stays within 0..100 and exposes parts", () => {
    const { score, parts } = performanceScore(summary());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(Object.keys(parts)).toContain("K/D");
  });
});
