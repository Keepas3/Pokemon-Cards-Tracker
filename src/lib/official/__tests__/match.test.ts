import { describe, it, expect } from "vitest";
import { matchSets } from "../match";
import type { OfficialSetInfo } from "../types";

const theirs = (id: string, name: string): OfficialSetInfo => ({
  id,
  name,
  seriesId: "s",
  seriesName: "S",
  releaseDate: null,
  logoUrl: null,
  symbolUrl: null,
  totalCards: 1,
  officialCards: 1,
});

const ours = (id: number, slug: string, name: string) => ({ id, slug, name });
const ours_ = ours;

describe("matchSets", () => {
  const official = [
    theirs("me03", "Perfect Order"),
    theirs("30th", "30th Celebration"),
    theirs("30th-c", "30th Classic Collection"),
    theirs("sv03.5", "151"),
    theirs("sv01", "Scarlet & Violet"),
  ];

  it("pairs sets whose names agree once the code prefix is dropped", () => {
    const m = matchSets([ours(1, "me03-perfect-order", "ME03: Perfect Order"), ours(2, "me-30th", "ME: 30th Celebration")], official, {});
    expect(m.get(1)).toBe("me03");
    expect(m.get(2)).toBe("30th");
  });

  it("uses a hand-checked alias for names that differ too much", () => {
    const sets = [ours(4, "sv-scarlet-and-violet-151", "SV: Scarlet & Violet 151")];
    expect(matchSets(sets, official, {}).get(4)).toBeUndefined();
    expect(matchSets(sets, official, { "sv-scarlet-and-violet-151": "sv03.5" }).get(4)).toBe("sv03.5");
  });

  it("pairs a near-identical name but keeps the Classic Collection apart from the main set", () => {
    const m = matchSets(
      [ours(2, "a", "ME: 30th Celebration"), ours(3, "b", "ME: 30th Celebration Classic Collection")],
      official,
      {},
    );
    expect(m.get(2)).toBe("30th");
    expect(m.get(3)).toBe("30th-c");
  });

  it("never gives the main set the Classic Collection's list when the main set is missing", () => {
    const m = matchSets([ours(3, "b", "ME: 30th Celebration Classic Collection")], [theirs("30th", "30th Celebration")], {});
    expect(m.size).toBe(0);
  });

  it("is one-to-one: an official set is used by one of ours at most", () => {
    const m = matchSets(
      [ours(1, "a", "ME03: Perfect Order"), ours(9, "b", "Perfect Order (Pokémon Center)")],
      official,
      {},
    );
    expect([...m.values()].filter((v) => v === "me03")).toHaveLength(1);
  });

  it("leaves a set alone when the same name appears twice on either side", () => {
    const twin = [theirs("a1", "Promos"), theirs("a2", "Promos")];
    expect(matchSets([ours(1, "p", "Promos")], twin, {}).size).toBe(0);
    expect(matchSets([ours(1, "p", "Promos"), ours(2, "q", "Promos")], [theirs("a1", "Promos")], {}).size).toBe(0);
  });

  it("ignores an alias that points at a set the catalog doesn't have", () => {
    expect(matchSets([ours(1, "x", "Unknown Set")], official, { x: "does-not-exist" }).size).toBe(0);
  });

  it("doesn't pair unrelated sets", () => {
    const m = matchSets([ours(1, "x", "Trick or Trade BOOster Bundle 2023")], official, {});
    expect(m.size).toBe(0);
  });
});

describe("sets tcgapi.dev lists twice", () => {
  const official = [theirs("ex16", "Power Keepers"), theirs("ex15", "Dragon Frontiers")];

  it("pairs the plainly named row and leaves its 'EX …' duplicate unpaired, whatever order they come in", () => {
    const ours = [ours_(1, "ex-power-keepers", "EX Power Keepers"), ours_(2, "power-keepers", "Power Keepers")];
    for (const list of [ours, [...ours].reverse()]) {
      const m = matchSets(list, official, {});
      expect(m.get(2)).toBe("ex16");
      expect(m.has(1)).toBe(false);
    }
  });

  it("still pairs an 'EX …' row when there's no plain duplicate", () => {
    const m = matchSets([ours_(1, "ex-dragon-frontiers", "EX Dragon Frontiers")], official, {});
    expect(m.get(1)).toBe("ex15");
  });
});

describe("SET_ALIASES", () => {
  it("point each of our sets at a different official set", async () => {
    const { SET_ALIASES } = await import("../aliases");
    const ids = Object.values(SET_ALIASES);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(SET_ALIASES).every((slug) => /^[a-z0-9-]+$/.test(slug))).toBe(true);
  });

  it("pairs the older EX sets that tcgapi.dev prefixes with 'EX'", () => {
    const m = matchSets([ours(1, "ex-power-keepers", "EX Power Keepers")], [theirs("ex16", "Power Keepers")], {});
    expect(m.get(1)).toBe("ex16");
  });
});
