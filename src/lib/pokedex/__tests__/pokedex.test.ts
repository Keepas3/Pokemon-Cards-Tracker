import { describe, expect, it } from "vitest";
import { GENERATIONS, MAX_DEX_ID, SPECIES_NAMES, generationOf, isDexId, speciesName } from "../species";
import { parseDexCards, setIdOf } from "../parse";
import { assemblePokemonCards, trackKey } from "../assemble";
import type { PriceInfo, SetInfo } from "../assemble";

describe("species list", () => {
  it("is every Pokémon in Pokédex order, so Charizard is #6 and Pikachu #25", () => {
    expect(MAX_DEX_ID).toBe(1025);
    expect(SPECIES_NAMES).toHaveLength(1025);
    expect(speciesName(1)).toBe("Bulbasaur");
    expect(speciesName(6)).toBe("Charizard");
    expect(speciesName(25)).toBe("Pikachu");
    expect(speciesName(1025)).toBe("Pecharunt");
  });

  it("keeps the names that need care", () => {
    expect(speciesName(29)).toBe("Nidoran♀");
    expect(speciesName(32)).toBe("Nidoran♂");
    expect(speciesName(122)).toBe("Mr. Mime");
    expect(speciesName(772)).toBe("Type: Null");
  });

  it("has no blanks or repeats", () => {
    expect(SPECIES_NAMES.every((n) => n.trim() !== "")).toBe(true);
    expect(new Set(SPECIES_NAMES).size).toBe(SPECIES_NAMES.length);
  });

  it("covers the generations without gaps or overlaps", () => {
    expect(GENERATIONS[0].first).toBe(1);
    expect(GENERATIONS.at(-1)!.last).toBe(MAX_DEX_ID);
    GENERATIONS.slice(1).forEach((g, i) => expect(g.first).toBe(GENERATIONS[i].last + 1));
    expect(generationOf(6)).toBe(1);
    expect(generationOf(152)).toBe(2);
    expect(generationOf(1025)).toBe(9);
    expect(generationOf(2000)).toBeNull();
  });

  it("only accepts real Pokédex numbers", () => {
    expect(isDexId(1)).toBe(true);
    expect(isDexId(1025)).toBe(true);
    for (const bad of [0, -1, 1026, 1.5, NaN, "6", null, undefined]) expect(isDexId(bad)).toBe(false);
    expect(speciesName(5000)).toBe("Pokémon #5000");
  });
});

describe("parseDexCards", () => {
  it("reads TCGdex's list and works out each card's set and number key", () => {
    const cards = parseDexCards({
      name: 6,
      cards: [
        { id: "2024sv-1", localId: "1", name: "Charizard" },
        { id: "base1-4", localId: "4", name: "Charizard", image: "https://assets.tcgdex.net/en/base/base1/4" },
        { id: "swsh12.5gg-GG01", localId: "GG01", name: "Charizard V" },
      ],
    });
    expect(cards).toEqual([
      { id: "2024sv-1", setId: "2024sv", localId: "1", numberKey: "1", name: "Charizard", imageUrl: null },
      { id: "base1-4", setId: "base1", localId: "4", numberKey: "4", name: "Charizard", imageUrl: "https://assets.tcgdex.net/en/base/base1/4/low.webp" },
      { id: "swsh12.5gg-GG01", setId: "swsh12.5gg", localId: "GG01", numberKey: "gg01", name: "Charizard V", imageUrl: null },
    ]);
  });

  it("uses the same number key as ownership (leading zeros dropped)", () => {
    expect(parseDexCards([{ id: "sv03.5-006", localId: "006", name: "Charmeleon" }])[0].numberKey).toBe("6");
  });

  it("finds the set even when its own id contains dashes", () => {
    expect(setIdOf("30th-c-001", "001")).toBe("30th-c");
    expect(setIdOf("base1-4", "4")).toBe("base1");
    expect(setIdOf("base1-4", "5")).toBeNull();
    expect(setIdOf("-4", "4")).toBeNull();
  });

  it("skips malformed entries and repeats, and accepts a bare list", () => {
    const cards = parseDexCards([
      { id: "a-1", localId: "1", name: "A" },
      { id: "a-1", localId: "1", name: "A again" },
      { id: "b-2", localId: "9", name: "mismatched id" },
      { id: "c-3", name: "no local id" },
      { localId: "3", name: "no id" },
      "junk",
      null,
    ]);
    expect(cards.map((c) => c.id)).toEqual(["a-1"]);
    expect(parseDexCards(undefined)).toEqual([]);
    expect(parseDexCards({ cards: "nope" })).toEqual([]);
  });
});

describe("assemblePokemonCards", () => {
  const dex = parseDexCards([
    { id: "old-4", localId: "4", name: "Charizard" },
    { id: "new-012", localId: "012", name: "Charizard ex", image: "https://img/12" },
    { id: "new-3", localId: "3", name: "Charmeleon" },
    { id: "pocket-1", localId: "1", name: "Charizard (Pocket)" },
  ]);
  const sets = new Map<string, SetInfo>([
    ["old", { cardSetId: 10, name: "Old Set", slug: "old-set", releaseDate: "1999-01-09" }],
    ["new", { cardSetId: 20, name: "New Set", slug: "new-set", releaseDate: "2026-03-27" }],
    // pocket-* sets aren't paired with one of ours
    ["pocket", { cardSetId: null, name: "Pocket Set", slug: null, releaseDate: "2024-10-30" }],
  ]);
  const price = (cents: number, number: string): PriceInfo => ({ number, rarity: "Rare", priceCents: cents, lowPriceCents: cents - 50, tcgplayerUrl: `https://tcg/${cents}`, imageUrl: null });
  const prices = new Map<string, PriceInfo>([
    [trackKey(10, "4"), price(25000, "004/102")],
    [trackKey(20, "12"), price(1200, "012/124")],
  ]);

  it("separates the cards that can be tracked from those in sets we can't, newest set first", () => {
    const { tracked, untracked } = assemblePokemonCards(dex, sets, prices, new Map());
    expect(tracked.map((c) => `${c.setName}:${c.name}`)).toEqual(["New Set:Charmeleon", "New Set:Charizard ex", "Old Set:Charizard"]);
    expect(untracked.map((c) => c.name)).toEqual(["Charizard (Pocket)"]);
    expect(untracked[0].setId).toBeNull();
  });

  it("gives each tracked card a key ownership can use, the printed number and a price", () => {
    const { tracked } = assemblePokemonCards(dex, sets, prices, new Map());
    const ex = tracked.find((c) => c.name === "Charizard ex")!;
    expect(ex).toMatchObject({ key: "20|12", setId: 20, setSlug: "new-set", number: "012/124", priceCents: 1200, rarity: "Rare", imageUrl: "https://img/12/low.webp", official: true });
    // No price row for #3: the card is still listed, just unpriced, with TCGdex's own number.
    expect(tracked.find((c) => c.name === "Charmeleon")).toMatchObject({ number: "3", priceCents: null });
  });

  it("marks what a person owns, per set and number", () => {
    const owned = new Map([[trackKey(10, "4"), 2]]);
    const { tracked, untracked } = assemblePokemonCards(dex, sets, prices, owned);
    expect(tracked.find((c) => c.name === "Charizard")!.owned).toBe(2);
    expect(tracked.find((c) => c.name === "Charizard ex")!.owned).toBe(0);
    expect(untracked[0].owned).toBe(0); // can't be owned yet
  });

  it("treats an unknown set as untrackable rather than guessing", () => {
    const { tracked, untracked } = assemblePokemonCards(parseDexCards([{ id: "mystery-1", localId: "1", name: "Pikachu" }]), new Map(), new Map(), new Map());
    expect(tracked).toEqual([]);
    expect(untracked[0]).toMatchObject({ setName: "mystery", setId: null });
  });

  it("lists a card once even if the catalog repeats it", () => {
    const twice = [...dex, ...dex];
    expect(assemblePokemonCards(twice, sets, prices, new Map()).tracked).toHaveLength(3);
  });
});
