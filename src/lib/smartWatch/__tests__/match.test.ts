import { describe, it, expect } from "vitest";
import { describeRule, diffMatches, itemKey, matchItems } from "../match";
import type { MatchableItem, RuleCriteria } from "../match";

const item = (over: Partial<MatchableItem> & { externalId: number }): MatchableItem => ({
  printing: "Holofoil",
  name: "Card",
  number: null,
  rarity: "Common",
  kind: "CARD",
  marketPriceCents: 100,
  tcgplayerId: null,
  ...over,
});

const rule = (over: Partial<RuleCriteria> = {}): RuleCriteria => ({
  kind: null,
  rarity: null,
  query: null,
  maxPriceCents: 4000,
  ...over,
});

describe("matchItems", () => {
  const items = [
    item({ externalId: 1, name: "Mew ex - 152/128", number: "152/128", rarity: "Special Illustration Rare", marketPriceCents: 3900 }),
    item({ externalId: 2, name: "Gengar ex - 154/128", number: "154/128", rarity: "Special Illustration Rare", marketPriceCents: 7000 }),
    item({ externalId: 3, name: "Pikachu", number: "10/128", rarity: "Common", marketPriceCents: 25 }),
    item({ externalId: 4, name: "Booster Box", kind: "SEALED", rarity: null, marketPriceCents: 3500 }),
    item({ externalId: 5, name: "No price yet", marketPriceCents: null }),
    item({ externalId: 6, name: "Free?", marketPriceCents: 0 }),
  ];

  it("matches everything at or under the price, and never unpriced or $0 items", () => {
    expect(matchItems(rule(), items).map((i) => i.externalId)).toEqual([1, 3, 4]);
  });

  it("treats the limit as inclusive", () => {
    expect(matchItems(rule({ maxPriceCents: 3900 }), items).map((i) => i.externalId)).toEqual([1, 3, 4]);
    expect(matchItems(rule({ maxPriceCents: 3899 }), items).map((i) => i.externalId)).toEqual([3, 4]);
  });

  it("filters by kind", () => {
    expect(matchItems(rule({ kind: "SEALED" }), items).map((i) => i.externalId)).toEqual([4]);
    expect(matchItems(rule({ kind: "CARD" }), items).map((i) => i.externalId)).toEqual([1, 3]);
  });

  it("filters by rarity, ignoring case", () => {
    const sir = matchItems(rule({ rarity: "special illustration rare", maxPriceCents: 10000 }), items);
    expect(sir.map((i) => i.externalId)).toEqual([1, 2]);
  });

  it("filters by text against the name or the number", () => {
    expect(matchItems(rule({ query: "mew" }), items).map((i) => i.externalId)).toEqual([1]);
    expect(matchItems(rule({ query: "10/128" }), items).map((i) => i.externalId)).toEqual([3]);
  });

  it("combines every filter", () => {
    const r = rule({ kind: "CARD", rarity: "Special Illustration Rare", query: "ex", maxPriceCents: 5000 });
    expect(matchItems(r, items).map((i) => i.externalId)).toEqual([1]);
  });
});

describe("diffMatches", () => {
  const a = item({ externalId: 1 });
  const b = item({ externalId: 2 });
  const c = item({ externalId: 3 });

  it("reports only items that weren't already known as added", () => {
    const { added } = diffMatches([itemKey(a)], [a, b]);
    expect(added.map((i) => i.externalId)).toEqual([2]);
  });

  it("reports known items that no longer match as removed, so a later dip alerts again", () => {
    const { added, removedKeys } = diffMatches([itemKey(a), itemKey(b)], [a]);
    expect(added).toEqual([]);
    expect(removedKeys).toEqual([itemKey(b)]);
  });

  it("does nothing when nothing changed", () => {
    expect(diffMatches([itemKey(a), itemKey(b)], [a, b])).toEqual({ added: [], removedKeys: [] });
  });

  it("treats a different printing of the same product as a different item", () => {
    const normal = item({ externalId: 9, printing: "Normal" });
    const holo = item({ externalId: 9, printing: "Holofoil" });
    expect(diffMatches([itemKey(normal)], [normal, holo]).added).toEqual([holo]);
  });

  it("alerts on everything the first time", () => {
    expect(diffMatches([], [a, b, c]).added).toHaveLength(3);
  });
});

describe("describeRule", () => {
  it("builds a readable default name", () => {
    expect(describeRule(rule({ rarity: "Special Illustration Rare", kind: "CARD" }), "ME: 30th Celebration")).toBe(
      "Special Illustration Rare cards ≤ $40.00 in ME: 30th Celebration",
    );
    expect(describeRule(rule({ kind: "SEALED", query: "case", maxPriceCents: 150000 }), "Set")).toBe(
      "sealed products matching “case” ≤ $1500.00 in Set",
    );
    expect(describeRule(rule(), "Set")).toBe("items ≤ $40.00 in Set");
  });
});

describe("onlyMissing (cards you don't own yet)", () => {
  const cards = [
    item({ externalId: 1, name: "Pikachu", number: "025/088", printing: "Normal", marketPriceCents: 100 }),
    item({ externalId: 2, name: "Pikachu", number: "025/088", printing: "Reverse Holofoil", marketPriceCents: 150 }),
    item({ externalId: 3, name: "Mew", number: "151/088", marketPriceCents: 300 }),
    item({ externalId: 4, name: "Code Card", kind: "OTHER", number: null, rarity: "Code Card", marketPriceCents: 20 }),
    item({ externalId: 5, name: "Box", kind: "SEALED", number: null, rarity: null, marketPriceCents: 100 }),
  ];
  const missingRule = rule({ onlyMissing: true });
  const none = { ownedKeys: new Set<string>() };

  it("without any collection, every real card counts as missing — and nothing that isn't a card", () => {
    expect(matchItems(missingRule, cards, none).map((i) => i.externalId)).toEqual([1, 2, 3]);
    expect(matchItems(missingRule, cards).map((i) => i.externalId)).toEqual([1, 2, 3]);
  });

  it("skips every printing of a card number you own", () => {
    const owned = { ownedKeys: new Set(["25"]) }; // cardKey("025/088")
    expect(matchItems(missingRule, cards, owned).map((i) => i.externalId)).toEqual([3]);
  });

  it("recognises a number however it is written (leading zeros, padding)", () => {
    const owned = { ownedKeys: new Set(["151"]) };
    const spaced = [item({ externalId: 9, number: " 151/088 ", marketPriceCents: 10 })];
    expect(matchItems(missingRule, spaced, owned)).toEqual([]);
  });

  it("never matches a code card or a box, owned or not", () => {
    expect(matchItems(missingRule, [cards[3], cards[4]], none)).toEqual([]);
  });

  it("leaves ordinary rules alone", () => {
    const owned = { ownedKeys: new Set(["25"]) };
    expect(matchItems(rule(), cards, owned).map((i) => i.externalId)).toEqual([1, 2, 3, 4, 5]);
    expect(matchItems(rule({ kind: "CARD" }), cards, owned).map((i) => i.externalId)).toEqual([1, 2, 3]);
    expect(matchItems(rule({ kind: "SEALED" }), cards, owned).map((i) => i.externalId)).toEqual([5]);
  });

  it("is described in the rule's name", () => {
    expect(describeRule(rule({ onlyMissing: true, kind: "CARD", rarity: "Special Illustration Rare", maxPriceCents: 4000 }), "ME03")).toBe(
      "Special Illustration Rare cards I don't own ≤ $40.00 in ME03",
    );
  });
});
