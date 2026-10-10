import { describe, it, expect } from "vitest";
import { guessPacks, isMultiProduct, parsePacksFromName } from "../packs";

describe("parsePacksFromName", () => {
  it("reads counts the name states", () => {
    expect(parsePacksFromName("Pokémon TCG: 30th Celebration Booster Bundle (6 Packs)")).toBe(6);
    expect(parsePacksFromName("Perfect Order 3 Pack Blister [Chikorita]")).toBe(3);
    expect(parsePacksFromName("30th Celebration 2-Pack Blister")).toBe(2);
    expect(parsePacksFromName("Perfect Order Single Pack Blister [Makuhita]")).toBe(1);
  });

  it("doesn't mistake a set name or a 'set of' for a pack count", () => {
    expect(parsePacksFromName("30th Celebration Booster Pack")).toBeNull();
    expect(parsePacksFromName("Perfect Order Booster Pack Art Bundle [Set of 4]")).toBeNull();
    expect(parsePacksFromName("Scarlet & Violet 151 Elite Trainer Box")).toBeNull();
  });
});

describe("guessPacks", () => {
  it("uses the standard contents of products whose contents are sourced", () => {
    expect(guessPacks("Perfect Order Booster Box")).toMatchObject({ packs: 36, source: "type" });
    expect(guessPacks("Perfect Order Elite Trainer Box")).toMatchObject({ packs: 9, source: "type" });
    expect(guessPacks("Perfect Order Booster Bundle")).toMatchObject({ packs: 6, source: "type" });
    expect(guessPacks("Perfect Order Build & Battle Box")).toMatchObject({ packs: 4, source: "type" });
    expect(guessPacks("Perfect Order Sleeved Booster Pack")).toMatchObject({ packs: 1, source: "type" });
    expect(guessPacks("Perfect Order Booster Pack")).toMatchObject({ packs: 1, source: "type" });
  });

  it("knows a Pokémon Center ETB holds more than a regular one", () => {
    expect(guessPacks("30th Celebration Pokemon Center Elite Trainer Box").packs).toBe(11);
    expect(guessPacks("Pokémon Center Elite Trainer Box").packs).toBe(11);
  });

  it("prefers the number in the name over the type default", () => {
    expect(guessPacks("Pokémon TCG: 30th Celebration Booster Bundle (8 Packs)")).toMatchObject({ packs: 8, source: "name" });
  });

  it("lets you override, whatever the name says", () => {
    expect(guessPacks("Perfect Order Elite Trainer Box", 10)).toMatchObject({ packs: 10, source: "override" });
  });

  it("doesn't guess for products it can't source", () => {
    for (const name of [
      "Perfect Order Premium Checklane Blister [Meganium Line]",
      "30th Celebration Mini Tin [Mew]",
      "Perfect Order Booster Pack Art Bundle [Set of 4]",
    ]) {
      const g = guessPacks(name);
      expect(g.packs).toBeNull();
      expect(g.note).toBeTruthy();
    }
  });

  it("refuses cases and displays instead of treating them as one product", () => {
    expect(isMultiProduct("Perfect Order Booster Box Case")).toBe(true);
    expect(isMultiProduct("Perfect Order Build & Battle Box Display")).toBe(true);
    expect(isMultiProduct("Perfect Order Half Booster Boxes")).toBe(true);
    expect(guessPacks("Perfect Order Booster Box Case").packs).toBeNull();
    // ...unless you say how many packs it holds.
    expect(guessPacks("Perfect Order Booster Box Case", 216).packs).toBe(216);
  });
});
