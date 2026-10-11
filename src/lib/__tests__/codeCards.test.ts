import { describe, expect, it } from "vitest";
import { isBulkLot, isCodeCard } from "@/lib/sets/classify";
import { parseItems } from "@/lib/sets/tcgapiSets";

describe("bulk lots", () => {
  it("are cases and displays, not single products", () => {
    expect(isBulkLot("Ascended Heroes Elite Trainer Box Case")).toBe(true);
    expect(isBulkLot("Ascended Heroes Mini Tin Display")).toBe(true);
    expect(isBulkLot("Surging Sparks Booster Box")).toBe(false);
    expect(isBulkLot("Journey Together Booster Pack")).toBe(false);
  });
});

describe("code cards", () => {
  it("are recognised by name or rarity", () => {
    expect(isCodeCard({ name: "Code Card - 30th Celebration Booster Pack", rarity: null })).toBe(true);
    expect(isCodeCard({ name: "Booster Pack (digital)", rarity: "Code Card" })).toBe(true);
    expect(isCodeCard({ name: "30th Celebration Booster Pack", rarity: null })).toBe(false);
    expect(isCodeCard({ name: "Pikachu", rarity: "Common" })).toBe(false);
  });

  it("are left out of what gets saved", () => {
    const rows = [
      { id: 1, name: "Code Card - 30th Celebration Elite Trainer Box", product_type: "Cards", rarity: "Code Card" },
      { id: 2, name: "30th Celebration Booster Pack", product_type: "Sealed Products" },
      { id: 3, name: "Pikachu", product_type: "Cards", number: "001/100", rarity: "Common" },
    ];
    expect(parseItems(rows as never).map((i) => i.externalId)).toEqual([2, 3]);
  });
});
