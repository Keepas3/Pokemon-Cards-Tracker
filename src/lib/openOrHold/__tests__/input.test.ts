import { describe, it, expect } from "vitest";
import { parseAssumptions, parsePackCount, parsePullRate } from "../input";

describe("parseAssumptions", () => {
  it("takes any subset", () => {
    expect(parseAssumptions({ feePct: 10 })).toEqual({ ok: true, value: { feePct: 10 } });
    expect(parseAssumptions({})).toEqual({ ok: true, value: {} });
  });

  it("rejects values that make no sense", () => {
    expect(parseAssumptions({ feePct: -1 })).toMatchObject({ ok: false });
    expect(parseAssumptions({ feePct: 80 })).toMatchObject({ ok: false });
    expect(parseAssumptions({ feePct: "13" })).toMatchObject({ ok: false });
    expect(parseAssumptions({ bulkThresholdCents: 1.5 })).toMatchObject({ ok: false });
    expect(parseAssumptions({ bulkPerPackCents: -5 })).toMatchObject({ ok: false });
    expect(parseAssumptions(null)).toMatchObject({ ok: false });
  });
});

describe("parsePullRate", () => {
  it("accepts a share of packs, or null to remove an override", () => {
    expect(parsePullRate({ setId: 5, rarity: " Special Illustration Rare ", perPack: 0.0125 })).toEqual({
      ok: true,
      value: { setId: 5, rarity: "Special Illustration Rare", perPack: 0.0125 },
    });
    expect(parsePullRate({ setId: 5, rarity: "X", perPack: null })).toMatchObject({ ok: true });
    expect(parsePullRate({ setId: 5, rarity: "X", perPack: 0 })).toMatchObject({ ok: true });
  });

  it("rejects rates outside 0–100% and missing fields", () => {
    expect(parsePullRate({ setId: 5, rarity: "X", perPack: 1.2 })).toMatchObject({ ok: false });
    expect(parsePullRate({ setId: 5, rarity: "X", perPack: -0.1 })).toMatchObject({ ok: false });
    expect(parsePullRate({ setId: 5, rarity: "X" })).toMatchObject({ ok: false }); // undefined isn't null
    expect(parsePullRate({ setId: 5, rarity: "  ", perPack: 0.1 })).toMatchObject({ ok: false });
    expect(parsePullRate({ rarity: "X", perPack: 0.1 })).toMatchObject({ ok: false });
  });
});

describe("parsePackCount", () => {
  it("accepts whole packs, or null to remove an override", () => {
    expect(parsePackCount({ setId: 1, itemExternalId: 2, packs: 9 })).toEqual({
      ok: true,
      value: { setId: 1, itemExternalId: 2, printing: "", packs: 9 },
    });
    expect(parsePackCount({ setId: 1, itemExternalId: 2, printing: "Normal", packs: null })).toMatchObject({ ok: true });
  });

  it("rejects nonsense counts", () => {
    expect(parsePackCount({ setId: 1, itemExternalId: 2, packs: 0 })).toMatchObject({ ok: false });
    expect(parsePackCount({ setId: 1, itemExternalId: 2, packs: 2.5 })).toMatchObject({ ok: false });
    expect(parsePackCount({ setId: 1, itemExternalId: 2, packs: 5000 })).toMatchObject({ ok: false });
    expect(parsePackCount({ setId: 1, packs: 9 })).toMatchObject({ ok: false });
  });
});

