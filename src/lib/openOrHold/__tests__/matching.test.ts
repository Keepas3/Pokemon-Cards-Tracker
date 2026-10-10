import { describe, it, expect } from "vitest";
import { matchSealed, matchSet, normalizeSetName, productKind } from "../matching";

describe("normalizeSetName", () => {
  it("drops set codes and punctuation so retail and market names line up", () => {
    expect(normalizeSetName("ME: 30th Celebration")).toBe("30th celebration");
    expect(normalizeSetName("ME03: Perfect Order")).toBe("perfect order");
    expect(normalizeSetName("SV: Scarlet & Violet 151")).toBe("scarlet and violet 151");
    expect(normalizeSetName("Scarlet & Violet-151")).toBe("scarlet and violet 151");
  });
});

describe("matchSet", () => {
  const sets = [
    { id: 1, name: "ME: 30th Celebration Classic Collection" },
    { id: 2, name: "ME: 30th Celebration" },
    { id: 3, name: "SV: Scarlet & Violet 151" },
    { id: 4, name: "ME03: Perfect Order" },
  ];

  it("prefers the exact set over one whose name merely contains it", () => {
    expect(matchSet("30th Celebration", sets)?.id).toBe(2);
  });

  it("matches across code prefixes and punctuation", () => {
    expect(matchSet("Scarlet & Violet 151", sets)?.id).toBe(3);
    expect(matchSet("Scarlet & Violet—151", sets)?.id).toBe(3);
    expect(matchSet("Perfect Order", sets)?.id).toBe(4);
  });

  it("says nothing rather than guess a different set", () => {
    expect(matchSet("Totally Unknown Set", sets)).toBeNull();
    expect(matchSet("", sets)).toBeNull();
  });
});

describe("productKind", () => {
  it("tells apart the products that must not be confused", () => {
    expect(productKind("30th Celebration Elite Trainer Box")).toBe("etb");
    expect(productKind("30th Celebration Pokemon Center Elite Trainer Box")).toBe("pokemon-center-etb");
    expect(productKind("Pokémon Center Elite Trainer Box")).toBe("pokemon-center-etb");
    expect(productKind("Perfect Order Booster Box")).toBe("booster-box");
    expect(productKind("Perfect Order Booster Box Case")).toBe("case");
    expect(productKind("Perfect Order Booster Bundle")).toBe("booster-bundle");
    expect(productKind("Perfect Order Build & Battle Box")).toBe("build-and-battle");
    expect(productKind("30th Celebration Ultra-Premium Collection [Day]")).toBe("other");
  });
});

describe("matchSealed", () => {
  const sealed = [
    { externalId: 1, printing: "Normal", name: "30th Celebration Booster Bundle" },
    { externalId: 2, printing: "Normal", name: "30th Celebration Booster Bundle Case" },
    { externalId: 3, printing: "Normal", name: "30th Celebration Elite Trainer Box" },
    { externalId: 4, printing: "Normal", name: "30th Celebration Pokemon Center Elite Trainer Box" },
    { externalId: 5, printing: "Normal", name: "30th Celebration Booster Pack" },
  ];

  it("finds the same product under a retail name, ignoring prefixes and pack counts", () => {
    const m = matchSealed("Pokémon TCG: 30th Celebration Booster Bundle (6 Packs)", sealed);
    expect(m?.item.externalId).toBe(1); // not the Case
  });

  it("keeps a Pokémon Center ETB and a regular ETB apart", () => {
    expect(matchSealed("Pokémon Center: 30th Celebration Pokémon Center Elite Trainer Box", sealed)?.item.externalId).toBe(4);
    expect(matchSealed("Pokémon TCG: 30th Celebration Elite Trainer Box", sealed)?.item.externalId).toBe(3);
  });

  it("won't match a product to a different kind of product", () => {
    expect(matchSealed("Pokémon TCG: 30th Celebration Booster Box", sealed)).toBeNull();
    expect(matchSealed("30th Celebration Ultra-Premium Collection", sealed)).toBeNull();
  });

  it("declines when two candidates are equally good", () => {
    const blisters = [
      { externalId: 10, printing: "Normal", name: "Perfect Order 3 Pack Blister [Chikorita]" },
      { externalId: 11, printing: "Normal", name: "Perfect Order 3 Pack Blister [Tepig]" },
    ];
    expect(matchSealed("Perfect Order 3 Pack Blister", blisters)).toBeNull();
  });

  it("can pick one blister out when the name says which", () => {
    const blisters = [
      { externalId: 10, printing: "Normal", name: "Perfect Order 3 Pack Blister [Chikorita]" },
      { externalId: 11, printing: "Normal", name: "Perfect Order 3 Pack Blister [Tepig]" },
    ];
    expect(matchSealed("Perfect Order 3 Pack Blister [Tepig]", blisters)?.item.externalId).toBe(11);
  });
});
