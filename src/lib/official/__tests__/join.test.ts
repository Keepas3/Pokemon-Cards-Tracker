import { describe, it, expect } from "vitest";
import { joinCards } from "../join";
import type { OfficialCardRow, PricedRow } from "../join";
import { cardKey } from "@/lib/collection/numbers";
import { summarize } from "@/lib/collection/progress";

const off = (localId: string, name: string): OfficialCardRow => ({
  key: cardKey(localId) as string,
  localId,
  name,
  imageUrl: `https://img/${localId}`,
});

const row = (number: string | null, over: Partial<PricedRow> = {}): PricedRow => ({
  number,
  name: `Card ${number}`,
  rarity: "Common",
  marketPriceCents: 100,
  lowPriceCents: 50,
  tcgplayerUrl: `https://tcg/${number}`,
  imageUrl: null,
  ...over,
});

const none = new Map<string, number>();

describe("joinCards", () => {
  it("lists the official cards in print order, priced from tcgapi.dev where it has them", () => {
    const { cards, usedOfficial } = joinCards(
      [off("001", "Spinarak"), off("002", "Ariados"), off("003", "Shaymin")],
      [row("002/088", { marketPriceCents: 250, rarity: "Uncommon" }), row("001/088", { marketPriceCents: 40 })],
      none,
    );
    expect(usedOfficial).toBe(true);
    expect(cards.map((c) => c.name)).toEqual(["Spinarak", "Ariados", "Shaymin"]);
    expect(cards.map((c) => c.priceCents)).toEqual([40, 250, null]);
    expect(cards[1].rarity).toBe("Uncommon");
    expect(cards[0].imageUrl).toBe("https://img/001"); // official art wins
  });

  it("shows a card tcgapi.dev doesn't list, with no price, under its printed number", () => {
    const { cards } = joinCards([off("001", "A"), off("002", "B")], [row("001/088")], none);
    expect(cards[1]).toMatchObject({ key: "2", number: "002", priceCents: null, tcgplayerUrl: null, official: true });
  });

  it("uses the printed number with its set size when tcgapi.dev has it", () => {
    const { cards } = joinCards([off("001", "A")], [row("001/088")], none);
    expect(cards[0].number).toBe("001/088");
  });

  it("collapses printings and pattern variants of one number into one card, at the cheapest price", () => {
    const { cards } = joinCards(
      [off("001", "Erika's Oddish")],
      [
        row("001/217", { name: "Erika's Oddish", marketPriceCents: 108 }),
        row("001/217", { name: "Erika's Oddish (Poke Ball)", marketPriceCents: 26 }),
        row("001/217", { name: "Erika's Oddish (Energy Symbol Pattern)", marketPriceCents: 23 }),
      ],
      none,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].priceCents).toBe(23);
    expect(cards[0].name).toBe("Erika's Oddish"); // the official, plain name
  });

  it("ignores a zero or missing price when picking the cheapest", () => {
    const { cards } = joinCards(
      [off("1", "A")],
      [row("1/9", { marketPriceCents: 0 }), row("1/9", { marketPriceCents: null }), row("1/9", { marketPriceCents: 75 })],
      none,
    );
    expect(cards[0].priceCents).toBe(75);
  });

  it("appends numbered tcgapi.dev cards the official list lacks, so a secret-rare numbering still counts", () => {
    const { cards } = joinCards(
      [off("001", "A"), off("002", "B")],
      [row("001/088"), row("002/088"), row("R/RGB", { name: "Mew", marketPriceCents: 600000 })],
      none,
    );
    expect(cards).toHaveLength(3);
    expect(cards[2]).toMatchObject({ number: "R/RGB", official: false, priceCents: 600000 });
  });

  it("applies what you own, by card key", () => {
    const { cards } = joinCards([off("001", "A"), off("025", "B")], [row("025/088")], new Map([["25", 2]]));
    expect(cards.map((c) => c.owned)).toEqual([0, 2]);
  });

  it("falls back to tcgapi.dev's list when the two don't number cards the same way", () => {
    const { cards, usedOfficial } = joinCards(
      [off("001", "A"), off("002", "B"), off("003", "C")],
      [row("SWSH001"), row("SWSH002"), row("SWSH003")],
      none,
    );
    expect(usedOfficial).toBe(false);
    expect(cards.map((c) => c.number)).toEqual(["SWSH001", "SWSH002", "SWSH003"]);
  });

  it("uses tcgapi.dev's list, sorted by number, when there's no official list", () => {
    const { cards, usedOfficial } = joinCards(null, [row("010/100"), row("002/100"), row("100/100")], none);
    expect(usedOfficial).toBe(false);
    expect(cards.map((c) => c.number)).toEqual(["002/100", "010/100", "100/100"]);
  });

  it("lists the official cards even before any tcgapi.dev prices are loaded", () => {
    const { cards, usedOfficial } = joinCards([off("001", "A"), off("002", "B")], [], none);
    expect(usedOfficial).toBe(true);
    expect(cards).toHaveLength(2);
  });

  it("never turns an unnumbered row into a card", () => {
    const { cards } = joinCards(null, [row(null), row("")], none);
    expect(cards).toEqual([]);
  });

  it("feeds a summary whose total is the official count, not what tcgapi.dev lists", () => {
    const { cards, usedOfficial } = joinCards(
      Array.from({ length: 10 }, (_, i) => off(String(i + 1), `Card ${i + 1}`)),
      [row("1/10"), row("2/10")],
      new Map([["1", 1]]),
    );
    const s = summarize(cards, usedOfficial ? "official" : "tcgapi");
    expect(s).toMatchObject({ totalCards: 10, ownedCards: 1, percent: 10, unpricedMissing: 8 });
  });
});
