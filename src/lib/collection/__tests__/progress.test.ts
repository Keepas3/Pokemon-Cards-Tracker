import { describe, it, expect } from "vitest";
import { matchPull, missingCards, summarize } from "../progress";
import type { CollectionCard } from "../progress";
import { cardKey, numberParts } from "../numbers";
import { MAX_QUANTITY, parseOwned } from "../input";

const card = (number: string, over: Partial<CollectionCard> = {}): CollectionCard => ({
  key: cardKey(number) as string,
  number,
  name: `Card ${number}`,
  imageUrl: null,
  rarity: null,
  priceCents: 100,
  lowPriceCents: null,
  tcgplayerUrl: null,
  owned: 0,
  official: true,
  ...over,
});

describe("cardKey", () => {
  it("is the numerator, lower-cased, without leading zeros on plain numbers", () => {
    expect(cardKey("025/088")).toBe("25");
    expect(cardKey("25")).toBe("25");
    expect(cardKey("025")).toBe("25"); // the official catalog's form
    expect(cardKey(" 001/217 ")).toBe("1");
    expect(cardKey("000")).toBe("0");
  });

  it("keeps lettered numbers whole", () => {
    expect(cardKey("TG05/TG30")).toBe("tg05");
    expect(cardKey("R/RGB")).toBe("r");
    expect(cardKey("SWSH101")).toBe("swsh101");
  });

  it("has no key for rows that aren't numbered cards", () => {
    expect(cardKey(null)).toBeNull();
    expect(cardKey("")).toBeNull();
    expect(cardKey("   ")).toBeNull();
  });
});

describe("numberParts", () => {
  it("splits prefix and digits, ignoring zeros and the set size", () => {
    expect(numberParts("025/088")).toEqual({ prefix: "", digits: "25" });
    expect(numberParts("TG05/TG30")).toEqual({ prefix: "tg", digits: "5" });
    expect(numberParts("R/RGB")).toBeNull();
    expect(numberParts(null)).toBeNull();
  });
});

describe("summarize", () => {
  it("counts a set's cards, what you own, and the percentage", () => {
    const s = summarize([card("1/3", { owned: 1 }), card("2/3"), card("3/3")], "official");
    expect(s).toMatchObject({ source: "official", totalCards: 3, ownedCards: 1, percent: 33.3, copies: 1 });
  });

  it("values owned copies at quantity x price, and counts unpriced ones separately", () => {
    const s = summarize(
      [
        card("1/4", { owned: 3, priceCents: 200 }),
        card("2/4", { owned: 1, priceCents: 1500 }),
        card("3/4", { owned: 2, priceCents: null }),
        card("4/4"),
      ],
      "tcgapi",
    );
    expect(s.copies).toBe(6);
    expect(s.valueCents).toBe(3 * 200 + 1500);
    expect(s.unpricedOwned).toBe(2);
  });

  it("prices the cost to finish from the missing cards, and does not treat an unpriced one as free", () => {
    const s = summarize(
      [
        card("1/4", { owned: 1, priceCents: 9999 }),
        card("2/4", { priceCents: 300 }),
        card("3/4", { priceCents: 1200 }),
        card("4/4", { priceCents: null }),
      ],
      "official",
    );
    expect(s.costToCompleteCents).toBe(1500);
    expect(s.unpricedMissing).toBe(1);
  });

  it("handles an empty set and a complete one", () => {
    expect(summarize([], "tcgapi")).toMatchObject({ totalCards: 0, percent: 0, ownedCards: 0 });
    const done = summarize([card("1/2", { owned: 1 }), card("2/2", { owned: 2 })], "official");
    expect(done.percent).toBe(100);
    expect(done.costToCompleteCents).toBe(0);
  });
});

describe("missingCards", () => {
  it("lists what you do not own in card-number order", () => {
    const cards = [card("010/100"), card("002/100", { owned: 1 }), card("100/100"), card("005/100"), card("R/RGB")];
    expect(missingCards(cards).map((c) => c.number)).toEqual(["005/100", "010/100", "100/100", "R/RGB"]);
  });
});

describe("matchPull", () => {
  const set: CollectionCard[] = [
    card("025/088", { name: "Pikachu" }),
    card("005/088", { name: "Charmander" }),
    card("150/088", { name: "Mew ex" }),
    card("TG05/TG30", { name: "Pikachu V" }),
    card("R/RGB", { name: "Mew" }),
  ];

  it("finds a card by number however it is typed", () => {
    for (const q of ["25", "025", "025/088", "25/88", " 025 "]) {
      expect(matchPull(q, set).cards.map((c) => c.number), q).toContain("025/088");
    }
  });

  it("lists a plain number's match ahead of a prefixed one, and only matches a prefix when it is typed", () => {
    expect(matchPull("5", set).cards.map((c) => c.number)).toEqual(["005/088", "TG05/TG30"]);
    expect(matchPull("tg05", set).cards.map((c) => c.number)).toEqual(["TG05/TG30"]);
  });

  it("falls back to a name search where every word must match, in card-number order", () => {
    expect(matchPull("pikachu", set).cards.map((c) => c.number)).toEqual(["TG05/TG30", "025/088"]);
    expect(matchPull("mew ex", set).cards.map((c) => c.name)).toEqual(["Mew ex"]);
    expect(matchPull("PIKACHU V", set).cards).toHaveLength(1);
  });

  it("returns nothing for an empty or unmatched entry", () => {
    for (const q of ["", "   ", "zzz", "999"]) expect(matchPull(q, set).cards, q).toEqual([]);
  });

  it("caps the list and says how many more there are", () => {
    const many = Array.from({ length: 12 }, (_, i) => card(`${i + 1}/99`, { name: "Rattata" }));
    const r = matchPull("rattata", many, 5);
    expect(r.cards).toHaveLength(5);
    expect(r.more).toBe(7);
  });
});

describe("parseOwned", () => {
  it("accepts a card number and a total, including 0 to remove", () => {
    expect(parseOwned({ setId: 1, number: " 025/088 ", quantity: 3 })).toEqual({
      ok: true,
      value: { setId: 1, number: "025/088", quantity: 3 },
    });
    expect(parseOwned({ setId: 1, number: "25", quantity: 0 })).toMatchObject({ ok: true });
  });

  it("rejects what cannot be a card count or a card number", () => {
    expect(parseOwned({ setId: 1, number: "25", quantity: -1 })).toMatchObject({ ok: false });
    expect(parseOwned({ setId: 1, number: "25", quantity: 1.5 })).toMatchObject({ ok: false });
    expect(parseOwned({ setId: 1, number: "25", quantity: MAX_QUANTITY + 1 })).toMatchObject({ ok: false });
    expect(parseOwned({ setId: 1, number: "", quantity: 1 })).toMatchObject({ ok: false });
    expect(parseOwned({ setId: 1, quantity: 1 })).toMatchObject({ ok: false });
    expect(parseOwned({ number: "25", quantity: 1 })).toMatchObject({ ok: false });
    expect(parseOwned(null)).toMatchObject({ ok: false });
  });
});
