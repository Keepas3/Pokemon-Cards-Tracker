import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS, bestPerCard, dealOf, isNewDeal, rankDeals } from "../compute";
import type { DealCandidate } from "../compute";

const cand = (over: Partial<DealCandidate> = {}): DealCandidate => ({
  setId: 1,
  key: "1",
  name: "Card",
  number: "001/100",
  rarity: "Rare",
  imageUrl: null,
  tcgplayerUrl: "https://tcg/1",
  marketCents: 1000,
  lowCents: 600,
  priceUpdatedAt: null,
  ...over,
});

describe("dealOf", () => {
  it("is a deal when the lowest listing is far enough under market, and says how much you'd save", () => {
    expect(dealOf(cand())).toMatchObject({ savingsCents: 400, savingsPct: 0.4, suspicious: false });
  });

  it("needs both a real percentage and a real amount: a cheap card 30% off isn't news", () => {
    expect(dealOf(cand({ marketCents: 100, lowCents: 70 }))).toBeNull(); // 30% but only 30¢
    expect(dealOf(cand({ marketCents: 10000, lowCents: 9500 }))).toBeNull(); // $5 but only 5%
    expect(dealOf(cand({ marketCents: 1000, lowCents: 800 }))).toBeNull(); // 20% < 25%
    expect(dealOf(cand({ marketCents: 1000, lowCents: 750 }))).not.toBeNull(); // exactly 25% and $2.50
  });

  it("ignores rows without usable prices or where the 'low' isn't actually lower", () => {
    expect(dealOf(cand({ marketCents: 0 }))).toBeNull();
    expect(dealOf(cand({ lowCents: 0 }))).toBeNull();
    expect(dealOf(cand({ lowCents: 1000 }))).toBeNull();
    expect(dealOf(cand({ lowCents: 1500 }))).toBeNull();
  });

  it("flags an extreme gap as probably damaged or a mistake, but still reports it", () => {
    expect(dealOf(cand({ marketCents: 5000, lowCents: 200 }))).toMatchObject({ suspicious: true });
    expect(dealOf(cand({ marketCents: 1000, lowCents: 300 }))).toMatchObject({ suspicious: true }); // exactly 70%
    expect(dealOf(cand({ marketCents: 1000, lowCents: 310 }))).toMatchObject({ suspicious: false });
  });

  it("can be tuned", () => {
    const strict = { minPct: 0.5, minSavingsCents: 1000 };
    expect(dealOf(cand({ marketCents: 5000, lowCents: 2000 }), strict)).not.toBeNull();
    expect(dealOf(cand({ marketCents: 5000, lowCents: 3000 }), strict)).toBeNull();
    expect(DEFAULT_THRESHOLDS).toEqual({ minPct: 0.25, minSavingsCents: 200 });
  });
});

describe("bestPerCard", () => {
  it("keeps one printing per card: the one with the biggest saving", () => {
    const rows = [
      cand({ marketCents: 1000, lowCents: 900 }),
      cand({ marketCents: 1200, lowCents: 600 }), // reverse holo, much cheaper than its market
      cand({ key: "2", marketCents: 500, lowCents: 300 }),
      cand({ setId: 2, key: "1", marketCents: 400, lowCents: 100 }), // same number, different set
    ];
    const kept = bestPerCard(rows);
    expect(kept).toHaveLength(3);
    expect(kept.find((c) => c.setId === 1 && c.key === "1")).toMatchObject({ marketCents: 1200, lowCents: 600 });
  });
});

describe("rankDeals", () => {
  const d = (name: string, setId: number, market: number, low: number) => dealOf(cand({ name, setId, key: name, marketCents: market, lowCents: low }))!;

  it("puts the biggest saving first", () => {
    const ranked = rankDeals([d("small", 1, 1000, 600), d("big", 1, 5000, 2000), d("mid", 1, 2000, 1200)], new Map());
    expect(ranked.map((x) => x.name)).toEqual(["big", "mid", "small"]);
  });

  it("nudges sets you've started above ones you haven't, without letting a tiny saving win", () => {
    const started = new Map([[1, 4]]);
    // $5.00 saving in a started set vs $5.50 in an untouched one: the started set wins (×1.25).
    const near = rankDeals([d("other", 2, 1550, 1000), d("mine", 1, 1500, 1000)], started);
    expect(near.map((x) => x.name)).toEqual(["mine", "other"]);
    // …but $20 in an untouched set still beats $5 in a started one.
    const far = rankDeals([d("mine", 1, 1500, 1000), d("other", 2, 4000, 2000)], started);
    expect(far.map((x) => x.name)).toEqual(["other", "mine"]);
  });

  it("puts suspiciously low listings after every believable one, however big the 'saving'", () => {
    const real = d("real", 1, 1000, 600); // $4, 40%
    const glitch = d("glitch", 1, 130000, 498); // $1,295 'saving', 100% off: a data error, not a deal
    const ranked = rankDeals([glitch, real], new Map());
    expect(glitch.suspicious).toBe(true);
    expect(ranked.map((x) => x.name)).toEqual(["real", "glitch"]);
  });

  it("is stable on ties and doesn't change its input", () => {
    const input = [d("b", 1, 1000, 600), d("a", 1, 1000, 600)];
    const ranked = rankDeals(input, new Map());
    expect(ranked.map((x) => x.name)).toEqual(["a", "b"]);
    expect(input.map((x) => x.name)).toEqual(["b", "a"]);
  });
});

describe("isNewDeal", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const told = (lowCents: number, daysAgo: number) => ({ lowCents, noticedAt: new Date(now.getTime() - daysAgo * 86400000) });

  it("is new when the person has never been told about it", () => {
    expect(isNewDeal(undefined, { lowCents: 500 }, now)).toBe(true);
  });

  it("isn't new again while it stays the same price", () => {
    expect(isNewDeal(told(500, 1), { lowCents: 500 }, now)).toBe(false);
    expect(isNewDeal(told(500, 1), { lowCents: 480 }, now)).toBe(false); // 4% cheaper isn't news
    expect(isNewDeal(told(500, 1), { lowCents: 520 }, now)).toBe(false); // dearer isn't either
  });

  it("is new again when it gets 10%+ cheaper, or after a fortnight", () => {
    expect(isNewDeal(told(500, 1), { lowCents: 450 }, now)).toBe(true);
    expect(isNewDeal(told(500, 13), { lowCents: 500 }, now)).toBe(false);
    expect(isNewDeal(told(500, 15), { lowCents: 500 }, now)).toBe(true);
  });
});
