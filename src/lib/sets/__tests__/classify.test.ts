import { describe, it, expect } from "vitest";
import { classifyItem } from "../classify";

const row = (over: Partial<Parameters<typeof classifyItem>[0]>) =>
  classifyItem({ kind: "CARD", number: null, rarity: null, name: "Thing", ...over });

describe("classifyItem", () => {
  it("calls a numbered card a card, whatever its rarity", () => {
    expect(row({ number: "025/088", rarity: "Common" })).toBe("card");
    expect(row({ number: "TG05/TG30", rarity: "Rare Holo" })).toBe("card");
    expect(row({ number: "124/088", rarity: "Mega Hyper Rare" })).toBe("card");
  });

  it("keeps tcgapi.dev's sealed products as sealed", () => {
    expect(row({ kind: "SEALED", name: "Perfect Order Booster Box" })).toBe("sealed");
    expect(row({ kind: "SEALED", number: "001" })).toBe("sealed");
  });

  it("recognises the collection boxes filed under Cards (unnumbered, blank rarity) as sealed", () => {
    expect(row({ name: "First Partner Illustration Collection (Series 1)", rarity: null })).toBe("sealed");
    expect(row({ name: "First Partner Illustration Collection Case (Series 1)", rarity: "" })).toBe("sealed");
  });

  it("sets code cards aside: not cards you collect, not products you open", () => {
    expect(row({ rarity: "Code Card", name: "Code Card - Perfect Order Booster Pack" })).toBe("other");
    expect(row({ name: "Code Card - First Partner Illustration Collection (Series 2)" })).toBe("other");
    expect(row({ number: "001", rarity: "Code Card" })).toBe("other");
  });

  it("treats unnumbered promos and anything else without a number as other", () => {
    expect(row({ rarity: "Promo", name: "Some Promo" })).toBe("other");
  });
});
