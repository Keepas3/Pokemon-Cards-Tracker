import { describe, it, expect } from "vitest";
import type { SetDTO, SetItemDTO } from "@/lib/clientTypes";
import { formatPrice } from "@/lib/labels";
import {
  compareCardNumbers,
  estimateRequests,
  filterItems,
  filterSets,
  formatPriceRange,
  isOversized,
  isUpcoming,
  MAX_SET_ROWS,
  priceRangeOf,
  rarityOptions,
  setsMissingPrices,
  sortItems,
  sortSets,
  tcgplayerUrl,
} from "../setsView";

const set = (over: Partial<SetDTO>): SetDTO => ({
  id: 1,
  name: "Set",
  slug: "set",
  releaseDate: null,
  cardCount: 0,
  iconUrl: null,
  imageUrl: null,
  itemsFetchedAt: null,
  priceRange: null,
  ...over,
});

const item =(over: Partial<SetItemDTO>): SetItemDTO => ({
  id: "i",
  externalId: 1,
  name: "Card",
  number: null,
  rarity: null,
  kind: "CARD",
  group: "card",
  printing: "Normal",
  marketPriceCents: null,
  lowPriceCents: null,
  imageUrl: null,
  tcgplayerUrl: "",
  owned: 0,
  tracked: null,
  ...over,
});

describe("compareCardNumbers", () => {
  it("orders numerically, not lexically", () => {
    expect(["10", "2", "1"].sort(compareCardNumbers)).toEqual(["1", "2", "10"]);
    expect(["125/094", "009/094", "100/094"].sort(compareCardNumbers)).toEqual(["009/094", "100/094", "125/094"]);
  });

  it("puts non-numeric and missing numbers last", () => {
    expect(["R/RGB", "5", null, "1"].sort(compareCardNumbers)).toEqual(["1", "5", "R/RGB", null]);
  });
});

describe("sets", () => {
  const sets = [
    set({ id: 1, name: "Old", releaseDate: "2020-01-01T00:00:00.000Z", cardCount: 50 }),
    set({ id: 2, name: "New", releaseDate: "2026-09-16T00:00:00.000Z", cardCount: 221 }),
    set({ id: 3, name: "Undated", releaseDate: null, cardCount: 10 }),
  ];

  it("sorts newest/oldest with undated sets last either way", () => {
    expect(sortSets(sets, "newest").map((s) => s.id)).toEqual([2, 1, 3]);
    expect(sortSets(sets, "oldest").map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it("sorts by name and by card count", () => {
    expect(sortSets(sets, "name").map((s) => s.name)).toEqual(["New", "Old", "Undated"]);
    expect(sortSets(sets, "cards").map((s) => s.id)).toEqual([2, 1, 3]);
  });

  it("filters by name, case-insensitively", () => {
    expect(filterSets(sets, "  nEW ").map((s) => s.id)).toEqual([2]);
    expect(filterSets(sets, "")).toHaveLength(3);
  });

  it("flags sets releasing in the future", () => {
    const now = new Date("2026-10-08T00:00:00Z");
    expect(isUpcoming(set({ releaseDate: "2026-11-06T00:00:00.000Z" }), now)).toBe(true);
    expect(isUpcoming(set({ releaseDate: "2026-09-16T00:00:00.000Z" }), now)).toBe(false);
    expect(isUpcoming(set({ releaseDate: null }), now)).toBe(false);
  });
});

describe("items", () => {
  const items = [
    item({ id: "a", name: "Pikachu", number: "10", rarity: "Common", marketPriceCents: 100 }),
    item({ id: "b", name: "Mew", number: "2", rarity: "Rare", marketPriceCents: 6000 }),
    item({ id: "c", name: "Eevee", number: "1", rarity: "Common", marketPriceCents: null }),
    item({ id: "s", name: "Booster Box", kind: "SEALED", group: "sealed", marketPriceCents: 15000 }),
  ];

  it("splits cards from sealed products", () => {
    const f = { query: "", rarity: "", view: "cards" as const };
    expect(filterItems(items, f).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(filterItems(items, { ...f, view: "products" as const }).map((i) => i.id)).toEqual(["s"]);
  });

  it("filters by rarity and by name or number text", () => {
    const f = { query: "", rarity: "Common", view: "cards" as const };
    expect(filterItems(items, f).map((i) => i.id)).toEqual(["a", "c"]);
    expect(filterItems(items, { ...f, rarity: "", query: "mew" }).map((i) => i.id)).toEqual(["b"]);
    expect(filterItems(items, { ...f, rarity: "", query: "10" }).map((i) => i.id)).toEqual(["a"]);
  });

  it("sorts by price with unpriced items always last", () => {
    expect(sortItems(items, "price_desc").map((i) => i.id)).toEqual(["s", "b", "a", "c"]);
    expect(sortItems(items, "price_asc").map((i) => i.id)).toEqual(["a", "b", "s", "c"]);
  });

  it("sorts by number and by name", () => {
    expect(sortItems(items, "number").map((i) => i.id)).toEqual(["c", "b", "a", "s"]);
    expect(sortItems(items, "name").map((i) => i.name)).toEqual(["Booster Box", "Eevee", "Mew", "Pikachu"]);
  });

  it("lists rarities most-common first", () => {
    expect(rarityOptions(items)).toEqual(["Common", "Rare"]);
  });
});

describe("price ranges", () => {
  it("spans the cheapest to the most expensive priced item", () => {
    const items = [{ marketPriceCents: 300 }, { marketPriceCents: 5 }, { marketPriceCents: 600027 }];
    expect(priceRangeOf(items)).toEqual({ minCents: 5, maxCents: 600027 });
  });

  it("ignores unpriced and $0 items rather than treating them as the cheapest", () => {
    const items = [{ marketPriceCents: null }, { marketPriceCents: 0 }, { marketPriceCents: 250 }, { marketPriceCents: 900 }];
    expect(priceRangeOf(items)).toEqual({ minCents: 250, maxCents: 900 });
  });

  it("is null when nothing has a price", () => {
    expect(priceRangeOf([])).toBeNull();
    expect(priceRangeOf([{ marketPriceCents: null }, { marketPriceCents: 0 }])).toBeNull();
  });

  it("formats as a range, collapsing to one price when min equals max", () => {
    expect(formatPriceRange({ minCents: 3, maxCents: 600027 })).toBe("$0.03 – $6,000.27");
    expect(formatPriceRange({ minCents: 1500, maxCents: 1500 })).toBe("$15.00");
  });
});

describe("loading prices for more sets", () => {
  const sets = [
    set({ id: 1, slug: "a", cardCount: 221, itemsFetchedAt: null }),
    set({ id: 2, slug: "b", cardCount: 40, itemsFetchedAt: "2026-10-08T00:00:00.000Z" }),
    set({ id: 3, slug: "c", cardCount: 100, itemsFetchedAt: null }),
    set({ id: 4, slug: "d", cardCount: 0, itemsFetchedAt: null }),
  ];

  it("picks out only sets with no saved prices, keeping the given order", () => {
    expect(setsMissingPrices(sets).map((s) => s.slug)).toEqual(["a", "c", "d"]);
  });

  it("doesn't count oversized sets as missing — they can never show a full range", () => {
    const withHuge = [...sets, set({ id: 5, slug: "huge", cardCount: MAX_SET_ROWS + 500, itemsFetchedAt: null })];
    expect(setsMissingPrices(withHuge).map((s) => s.slug)).toEqual(["a", "c", "d"]);
  });

  it("estimates one request per 100 rows, at least one per set", () => {
    expect(estimateRequests(sets)).toBe(3 + 1 + 1 + 1);
    expect(estimateRequests([])).toBe(0);
  });
});

describe("formatPrice", () => {
  it("adds thousands separators and always shows cents", () => {
    expect(formatPrice(600027)).toBe("$6,000.27");
    expect(formatPrice(5)).toBe("$0.05");
    expect(formatPrice(null)).toBe("—");
  });
});

describe("tcgplayerUrl", () => {
  it("links the product page when the id is known, else a search", () => {
    expect(tcgplayerUrl(704148, "x")).toBe("https://www.tcgplayer.com/product/704148");
    expect(tcgplayerUrl(null, "Mew ex")).toContain("search/pokemon/product?q=Mew%20ex");
  });
});

describe("isOversized", () => {
  it("flags sets with more items than we fetch, with the boundary at the cap", () => {
    expect(isOversized({ cardCount: MAX_SET_ROWS })).toBe(false);
    expect(isOversized({ cardCount: MAX_SET_ROWS + 1 })).toBe(true);
    expect(isOversized({ cardCount: 221 })).toBe(false);
  });
});
