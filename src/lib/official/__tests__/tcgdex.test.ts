import { describe, it, expect } from "vitest";
import { parseSeries, parseSeriesList, parseSetDetail } from "../tcgdex";

// Trimmed from real TCGdex responses (api.tcgdex.net/v2/en).
const SERIES_LIST = [
  { id: "sv", name: "Scarlet & Violet", logo: "https://assets.tcgdex.net/univ/sv/logo" },
  { id: "tcgp", name: "Pokémon TCG Pocket" },
  { id: "me", name: "Mega Evolution", logo: "https://assets.tcgdex.net/univ/me/logo" },
];

const SERIES_ME = {
  id: "me",
  name: "Mega Evolution",
  sets: [
    { id: "mee", name: "Mega Evolution Energy", cardCount: { official: 8, total: 8 } },
    {
      id: "me03",
      name: "Perfect Order",
      logo: "https://assets.tcgdex.net/en/me/me03/logo",
      symbol: "https://assets.tcgdex.net/univ/me/me03/symbol",
      cardCount: { official: 88, total: 124 },
    },
  ],
};

const SET_ME03 = {
  id: "me03",
  name: "Perfect Order",
  releaseDate: "2026-03-27",
  serie: { id: "me", name: "Mega Evolution" },
  logo: "https://assets.tcgdex.net/en/me/me03/logo",
  symbol: "https://assets.tcgdex.net/univ/me/me03/symbol",
  cardCount: { official: 88, total: 124, normal: 87 },
  cards: [
    { id: "me03-001", localId: "001", name: "Spinarak", image: "https://assets.tcgdex.net/en/me/me03/001" },
    { id: "me03-002", localId: "002", name: "Ariados", image: "https://assets.tcgdex.net/en/me/me03/002" },
    { id: "me03-124", localId: "124", name: "Mega Zygarde ex", image: "https://assets.tcgdex.net/en/me/me03/124" },
  ],
};

describe("parseSeriesList", () => {
  it("returns series ids, leaving out the phone game", () => {
    expect(parseSeriesList(SERIES_LIST)).toEqual(["sv", "me"]);
  });
  it("copes with junk", () => {
    expect(parseSeriesList(null)).toEqual([]);
    expect(parseSeriesList({})).toEqual([]);
    expect(parseSeriesList([1, "x", { name: "no id" }])).toEqual([]);
  });
});

describe("parseSeries", () => {
  const sets = parseSeries(SERIES_ME);

  it("lists the series' sets with their series, counts and logos", () => {
    expect(sets.map((s) => s.id)).toEqual(["mee", "me03"]);
    expect(sets[1]).toMatchObject({
      name: "Perfect Order",
      seriesId: "me",
      seriesName: "Mega Evolution",
      totalCards: 124,
      officialCards: 88,
      releaseDate: null, // not in the series listing
    });
  });

  it("adds the missing extension to logo and symbol URLs, and tolerates sets without art", () => {
    expect(sets[1].logoUrl).toBe("https://assets.tcgdex.net/en/me/me03/logo.png");
    expect(sets[1].symbolUrl).toBe("https://assets.tcgdex.net/univ/me/me03/symbol.png");
    expect(sets[0].logoUrl).toBeNull();
  });

  it("returns nothing for the phone-game series or junk", () => {
    expect(parseSeries({ id: "tcgp", name: "Pocket", sets: [{ id: "a", name: "A" }] })).toEqual([]);
    expect(parseSeries(null)).toEqual([]);
    expect(parseSeries({ id: "me", sets: [null, { id: "x" }, 5] })).toEqual([]);
  });

  it("takes the printed count as the total when only one is given", () => {
    const [s] = parseSeries({ id: "x", name: "X", sets: [{ id: "s", name: "S", cardCount: { total: 10 } }] });
    expect(s).toMatchObject({ totalCards: 10, officialCards: 10 });
  });
});

describe("parseSetDetail", () => {
  it("reads the release date, series and the full card list in order", () => {
    const parsed = parseSetDetail(SET_ME03)!;
    expect(parsed.set).toMatchObject({ id: "me03", releaseDate: "2026-03-27", seriesId: "me", seriesName: "Mega Evolution" });
    expect(parsed.cards.map((c) => c.localId)).toEqual(["001", "002", "124"]);
    expect(parsed.cards[2]).toEqual({
      localId: "124",
      name: "Mega Zygarde ex",
      imageUrl: "https://assets.tcgdex.net/en/me/me03/124/low.webp",
    });
  });

  it("copes with cards without art, duplicates and a missing date", () => {
    const parsed = parseSetDetail({
      id: "x",
      name: "X",
      cardCount: { total: 2, official: 2 },
      cards: [
        { localId: "1", name: "One" },
        { localId: "1", name: "One again" },
        { localId: "2", name: "Two", image: "https://a/b" },
        { name: "no id" },
      ],
    })!;
    expect(parsed.set.releaseDate).toBeNull();
    expect(parsed.cards.map((c) => c.name)).toEqual(["One", "Two"]);
    expect(parsed.cards[0].imageUrl).toBeNull();
  });

  it("falls back to the card count when the set gives no total", () => {
    const parsed = parseSetDetail({ id: "x", name: "X", cards: [{ localId: "1", name: "A" }, { localId: "2", name: "B" }] })!;
    expect(parsed.set.totalCards).toBe(2);
  });

  it("returns null for something that is not a set", () => {
    expect(parseSetDetail(null)).toBeNull();
    expect(parseSetDetail({ name: "no id" })).toBeNull();
  });
});
