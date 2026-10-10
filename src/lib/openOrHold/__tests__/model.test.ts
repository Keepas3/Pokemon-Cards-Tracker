import { describe, it, expect } from "vitest";
import {
  analyze,
  buildPool,
  distinctCards,
  expectedPerPack,
  isBulkRarity,
  makeRng,
  netValue,
  rarityKey,
  scaleSlots,
  simulate,
  verdictOf,
} from "../model";
import type { CardRow, ModelSlot } from "../model";
import { DEFAULT_ASSUMPTIONS } from "../types";
import type { Assumptions } from "../types";

const A: Assumptions = { feePct: 10, bulkThresholdCents: 100, bulkPerPackCents: 0 };
const card = (externalId: number, number: string | null, rarity: string | null, marketPriceCents: number | null): CardRow => ({
  externalId,
  number,
  rarity,
  marketPriceCents,
});

describe("rarity helpers", () => {
  it("treats tcgapi.dev's 'RBG Rare' typo and TCGplayer's 'RGB Rare' as the same rarity", () => {
    expect(rarityKey("RBG Rare")).toBe(rarityKey("RGB Rare"));
    expect(rarityKey("  Special  Illustration Rare ")).toBe("special illustration rare");
  });

  it("knows which rarities are filler", () => {
    for (const r of ["Common", "Uncommon", "Rare", "Code Card", "", null]) expect(isBulkRarity(r)).toBe(true);
    for (const r of ["Double Rare", "Illustration Rare", "Mega Hyper Rare"]) expect(isBulkRarity(r)).toBe(false);
  });
});

describe("netValue", () => {
  it("takes fees off, and zeroes anything under the bulk cut-off or without a price", () => {
    expect(netValue(10_000, A)).toBe(9_000);
    expect(netValue(100, A)).toBe(90); // exactly at the cut-off still counts
    expect(netValue(99, A)).toBe(0);
    expect(netValue(null, A)).toBe(0);
    expect(netValue(0, A)).toBe(0);
  });
});

describe("pools", () => {
  it("counts a card once however many printings it has, at their average price", () => {
    const rows = [
      card(1, "5", "Rare", 200),
      card(2, "5", "Rare", 400), // same number, other printing
      card(3, "6", "Rare", 1000),
    ];
    const cards = distinctCards(rows);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.priceCents).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([300, 1000]);
  });

  it("builds a pool for one rarity, with values after fees and the cut-off", () => {
    const rows = [
      card(1, "1", "Illustration Rare", 5000),
      card(2, "2", "Illustration Rare", 50), // bulk
      card(3, "3", "Illustration Rare", null), // unpriced
      card(4, "4", "Special Illustration Rare", 90000),
    ];
    const pool = buildPool(rows, "illustration rare", A);
    expect(pool.cards).toBe(3);
    expect(pool.unpriced).toBe(1);
    expect(pool.values.sort((a, b) => a - b)).toEqual([0, 0, 4500]);
    expect(pool.avgMarketCents).toBe(2525);
    expect(pool.maxMarketCents).toBe(5000);
  });

  it("can pool every card in a set (a subset set like Classic Collection)", () => {
    const rows = [card(1, "CC1", null, 10000), card(2, "CC2", "Whatever", 20000)];
    expect(buildPool(rows, null, A).cards).toBe(2);
  });
});

describe("expectedPerPack", () => {
  it("is rate × average value, summed over every hit", () => {
    const slots: ModelSlot[] = [
      { label: "A", hits: [{ rarity: "X", perPack: 0.1, values: [1000, 3000] }] },
      { label: "B", hits: [{ rarity: "Y", perPack: 0.5, values: [200] }] },
    ];
    expect(expectedPerPack(slots).total).toBeCloseTo(0.1 * 2000 + 0.5 * 200, 9);
  });
});

describe("scaleSlots", () => {
  it("multiplies rates but never lets a slot exceed one card per pack", () => {
    const slots: ModelSlot[] = [
      { label: "A", hits: [{ rarity: "X", perPack: 0.4, values: [1] }, { rarity: "Y", perPack: 0.4, values: [1] }] },
    ];
    const half = scaleSlots(slots, 0.5);
    expect(half[0].hits.map((h) => h.perPack)).toEqual([0.2, 0.2]);
    const triple = scaleSlots(slots, 3);
    expect(triple[0].hits.reduce((n, h) => n + h.perPack, 0)).toBeCloseTo(1, 9);
  });
});

describe("simulate", () => {
  const slots: ModelSlot[] = [
    { label: "Rare", hits: [{ rarity: "DR", perPack: 0.2, values: [100, 300] }, { rarity: "UR", perPack: 0.08, values: [1000] }] },
    { label: "Reverse", hits: [{ rarity: "SIR", perPack: 0.012, values: [9000, 3000, 6000] }] },
  ];

  it("is repeatable: the same seed gives the same answer", () => {
    const a = simulate(slots, 36, 0, 5000, 7);
    const b = simulate(slots, 36, 0, 5000, 7);
    expect(a.mean).toBe(b.mean);
    expect(a.quantile(0.5)).toBe(b.quantile(0.5));
  });

  it("converges on the exact expected value", () => {
    const exact = expectedPerPack(slots).total * 36;
    const sim = simulate(slots, 36, 0, 40_000, 3);
    expect(Math.abs(sim.mean - exact) / exact).toBeLessThan(0.03);
  });

  it("never puts two cards from one slot in a pack", () => {
    // One slot, two hits that together fill it: every pack has exactly one, worth 10 or 20.
    const full: ModelSlot[] = [{ label: "S", hits: [{ rarity: "A", perPack: 0.5, values: [10] }, { rarity: "B", perPack: 0.5, values: [20] }] }];
    const sim = simulate(full, 1, 0, 2000, 1);
    expect(sim.quantile(0)).toBeGreaterThanOrEqual(10);
    expect(sim.quantile(0.999)).toBeLessThanOrEqual(20);
  });

  it("adds the bulk value of every pack", () => {
    expect(simulate([], 9, 25, 100, 1).mean).toBe(225);
  });

  it("fractionAbove counts strictly greater", () => {
    const sure: ModelSlot[] = [{ label: "S", hits: [{ rarity: "A", perPack: 1, values: [500] }] }];
    const sim = simulate(sure, 2, 0, 100, 1); // always exactly 1000
    expect(sim.fractionAbove(999)).toBe(1);
    expect(sim.fractionAbove(1000)).toBe(0);
  });
});

describe("makeRng", () => {
  it("stays in [0,1) and differs by seed", () => {
    const r = makeRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});

describe("analyze", () => {
  // Two ways a box can be worth more sealed or opened, with the same fee.
  const slots: ModelSlot[] = [{ label: "S", hits: [{ rarity: "Chase", perPack: 0.05, values: [20000] }] }];

  it("reports expected value, the sealed value after fees, and the odds of beating it", () => {
    const r = analyze({ packs: 10, sealedCents: 5000, retailCents: 4000, slots, assumptions: A });
    expect(r.evCents).toBeCloseTo(0.05 * 20000 * 10, 6); // 10,000¢
    expect(r.sealedNetCents).toBeCloseTo(4500, 6); // 5000 less 10%
    expect(r.probBeatsSealed).not.toBeNull();
    // Opening wins only if at least one of 10 packs hits: 1 - 0.95^10 ≈ 40%.
    expect(r.probBeatsSealed!).toBeGreaterThan(0.36);
    expect(r.probBeatsSealed!).toBeLessThan(0.45);
    expect(r.probBeatsPaid!).toBeCloseTo(r.probBeatsSealed!, 2);
  });

  it("calls an expectation carried by rare hits a toss-up, not an easy win", () => {
    const r = analyze({ packs: 10, sealedCents: 5000, retailCents: null, slots, assumptions: A });
    expect(r.evCents).toBeGreaterThan(r.sealedNetCents!); // average says open...
    expect(r.probBeatsSealed!).toBeLessThan(0.5); // ...but most boxes lose
    expect(r.verdict).toBe("toss-up");
  });

  it("works out the hit-rate multiplier that would break even", () => {
    const r = analyze({ packs: 10, sealedCents: 5000, retailCents: null, slots, assumptions: A });
    expect(r.breakEvenScale).toBeCloseTo(4500 / 10000, 6);
  });

  it("shows how the answer moves if hit rates are off by half", () => {
    const r = analyze({ packs: 10, sealedCents: 5000, retailCents: null, slots, assumptions: A });
    const [low, mid, high] = r.sensitivity;
    expect(low.scale).toBe(0.5);
    expect(mid.evCents).toBeCloseTo(r.evCents, 9);
    expect(low.evCents).toBeLessThan(mid.evCents);
    expect(high.evCents).toBeGreaterThan(mid.evCents);
    expect(low.probBeatsSealed!).toBeLessThan(high.probBeatsSealed!);
  });

  it("breaks the value down by rarity, biggest first", () => {
    const two: ModelSlot[] = [
      { label: "A", hits: [{ rarity: "Small", perPack: 0.5, values: [100] }] },
      { label: "B", hits: [{ rarity: "Big", perPack: 0.1, values: [10000] }] },
    ];
    const r = analyze({ packs: 2, sealedCents: 1000, retailCents: null, slots: two, assumptions: A });
    expect(r.byRarity.map((x) => x.rarity)).toEqual(["Big", "Small"]);
    expect(r.hitsEvCents).toBeCloseTo(r.byRarity.reduce((n, x) => n + x.evCents, 0), 6);
  });

  it("still gives an expected value when the sealed price is unknown", () => {
    const r = analyze({ packs: 6, sealedCents: null, retailCents: null, slots, assumptions: A });
    expect(r.evCents).toBeGreaterThan(0);
    expect(r.sealedNetCents).toBeNull();
    expect(r.probBeatsSealed).toBeNull();
    expect(r.verdict).toBeNull();
    expect(r.breakEvenScale).toBeNull();
  });

  it("is deterministic for a given input", () => {
    const run = () => analyze({ packs: 36, sealedCents: 17000, retailCents: null, slots, assumptions: DEFAULT_ASSUMPTIONS });
    expect(run().probBeatsSealed).toBe(run().probBeatsSealed);
  });
});

describe("verdictOf", () => {
  it("opens only when it wins on average and usually", () => {
    expect(verdictOf(5000, 4000, 0.7)).toBe("open");
    expect(verdictOf(3000, 4000, 0.2)).toBe("hold");
    expect(verdictOf(5000, 4000, 0.3)).toBe("toss-up");
    expect(verdictOf(3000, 4000, 0.6)).toBe("toss-up");
    expect(verdictOf(3000, null, null)).toBeNull();
  });
});
