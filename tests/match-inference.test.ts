import { describe, expect, it } from "vitest";
import { inferMatches, type SnapshotLike } from "@siegeiq/server/services/match-inference";

const base: SnapshotLike = {
  takenAt: new Date("2026-07-01T10:00:00Z"),
  board: "ranked",
  seasonId: 42,
  rankPoints: 3200,
  kills: 100,
  deaths: 90,
  wins: 10,
  losses: 8,
  abandons: 0,
};

describe("inferMatches", () => {
  it("returns nothing when counters are unchanged", () => {
    const next = { ...base, takenAt: new Date("2026-07-01T11:00:00Z") };
    expect(inferMatches(base, next)).toHaveLength(0);
  });

  it("infers a single win with exact RP and high confidence", () => {
    const next: SnapshotLike = {
      ...base,
      takenAt: new Date("2026-07-01T11:00:00Z"),
      rankPoints: 3232,
      kills: 108,
      deaths: 95,
      wins: 11,
    };
    const out = inferMatches(base, next);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      outcome: "win",
      rpDelta: 32,
      kills: 8,
      deaths: 5,
      confidence: "high",
    });
  });

  it("labels multi-match sessions as low confidence and preserves counts", () => {
    const next: SnapshotLike = {
      ...base,
      takenAt: new Date("2026-07-01T14:00:00Z"),
      rankPoints: 3230,
      kills: 130,
      deaths: 120,
      wins: 12,
      losses: 9,
    };
    const out = inferMatches(base, next);
    expect(out).toHaveLength(3);
    expect(out.filter((m) => m.outcome === "win")).toHaveLength(2);
    expect(out.filter((m) => m.outcome === "loss")).toHaveLength(1);
    expect(out.every((m) => m.confidence === "low")).toBe(true);
    // wins get positive shares, losses negative
    expect(out.find((m) => m.outcome === "win")!.rpDelta).toBeGreaterThan(0);
    expect(out.find((m) => m.outcome === "loss")!.rpDelta).toBeLessThan(0);
  });

  it("ignores season/board mismatches (rollover safety)", () => {
    const next = { ...base, seasonId: 43, wins: 12, takenAt: new Date() };
    expect(inferMatches(base, next)).toHaveLength(0);
  });

  it("counts abandons", () => {
    const next: SnapshotLike = {
      ...base,
      takenAt: new Date("2026-07-01T12:00:00Z"),
      rankPoints: 3170,
      abandons: 1,
    };
    const out = inferMatches(base, next);
    expect(out).toHaveLength(1);
    expect(out[0]!.outcome).toBe("abandon");
    expect(out[0]!.rpDelta).toBe(-30);
  });
});
