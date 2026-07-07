import { describe, expect, it } from "vitest";
import operators from "@siegeiq/game-data/operators.json";
import weapons from "@siegeiq/game-data/weapons.json";
import maps from "@siegeiq/game-data/maps.json";
import { rankFromRp } from "@siegeiq/shared";
import { verifyPairingToken, pairingToken } from "../apps/api/src/live/live-server";

interface Op {
  slug: string;
  name: string;
  side: string;
  speed: number;
  health: number;
  counters: string[];
  counteredBy: string[];
  primaries: string[];
  secondaries: string[];
  gadgets: string[];
}

describe("static data integrity", () => {
  const ops = operators as unknown as Op[];
  const slugs = new Set(ops.map((o) => o.slug));

  it("operator slugs are unique and well-formed", () => {
    expect(slugs.size).toBe(ops.length);
    for (const o of ops) expect(o.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("speed/health pairs are valid Siege values", () => {
    for (const o of ops) {
      expect([1, 2, 3]).toContain(o.speed);
      expect([100, 110, 125]).toContain(o.health);
    }
  });

  it("every operator has a non-empty loadout", () => {
    for (const o of ops) {
      expect(o.primaries.length, `${o.slug} primaries`).toBeGreaterThan(0);
      expect(o.secondaries.length, `${o.slug} secondaries`).toBeGreaterThan(0);
      expect(o.gadgets.length, `${o.slug} gadgets`).toBeGreaterThan(0);
    }
  });

  it("counter references point at real operators (or documented pseudo-tags)", () => {
    const pseudo = new Set([
      "vertical",
      "drones",
      "proximityAlarm",
      "impactEmp",
      "firepower",
      "emp",
      "claymores",
      "attackerPush",
    ]);
    for (const o of ops) {
      for (const ref of [...o.counters, ...o.counteredBy]) {
        expect(slugs.has(ref) || pseudo.has(ref), `${o.slug} → ${ref}`).toBe(true);
      }
    }
  });

  it("weapon user references resolve", () => {
    for (const w of weapons as Array<{ slug: string; users: string[] }>) {
      for (const u of w.users) expect(slugs.has(u), `${w.slug} → ${u}`).toBe(true);
    }
  });

  it("map best-operator references resolve", () => {
    for (const m of maps as Array<{ slug: string; bestAttackers: string[]; bestDefenders: string[] }>) {
      for (const s of [...m.bestAttackers, ...m.bestDefenders]) {
        expect(slugs.has(s), `${m.slug} → ${s}`).toBe(true);
      }
    }
  });
});

describe("rank ladder", () => {
  it("maps RP to the ranked 2.0 ladder", () => {
    expect(rankFromRp(500).name).toBe("Unranked");
    expect(rankFromRp(1000).name).toBe("Copper V");
    expect(rankFromRp(2540).name).toBe("Gold V");
    expect(rankFromRp(4499).name).toBe("Diamond I");
    expect(rankFromRp(4800).name).toBe("Champions");
  });
});

describe("pairing tokens", () => {
  it("round-trips and rejects tampering", () => {
    const t = pairingToken("abc12345-0000-0000-0000-000000000000");
    expect(verifyPairingToken(t)).toBe("abc12345-0000-0000-0000-000000000000");
    expect(verifyPairingToken(t.slice(0, -2) + "ff")).toBeNull();
    expect(verifyPairingToken("garbage")).toBeNull();
  });
});
