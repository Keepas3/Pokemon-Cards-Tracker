import { describe, it, expect } from "vitest";
import { PROFILES, findProfile } from "../profiles";

describe("published profiles", () => {
  it("never put more than one card in a slot's worth of probability", () => {
    for (const p of PROFILES) {
      for (const s of p.slots) {
        const sum = s.hits.reduce((n, h) => n + (h.perPack ?? 0), 0);
        expect(sum, `${p.id} / ${s.label}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("only hold rates that are plausible fractions of a pack", () => {
    for (const p of PROFILES) {
      for (const h of p.slots.flatMap((s) => s.hits)) {
        if (h.perPack != null) {
          expect(h.perPack, `${p.id} / ${h.rarity}`).toBeGreaterThan(0);
          expect(h.perPack, `${p.id} / ${h.rarity}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("each cite a TCGplayer article, a date and a sample size", () => {
    for (const p of PROFILES) {
      expect(p.source.url, p.id).toMatch(/^https:\/\/www\.tcgplayer\.com\/content\/article\//);
      expect(p.source.published, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.source.packsOpened, p.id).toMatch(/\d/);
      expect(p.setNames.length, p.id).toBeGreaterThan(0);
    }
  });

  it("have unique ids and no set covered twice", () => {
    expect(new Set(PROFILES.map((p) => p.id)).size).toBe(PROFILES.length);
    const names = PROFILES.flatMap((p) => p.setNames.map((n) => n.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
  });

  it("are found by set name however it's cased or punctuated", () => {
    expect(findProfile("ME03: Perfect Order")?.id).toBe("me03");
    expect(findProfile("me03 perfect order")?.id).toBe("me03");
    expect(findProfile("ME: 30th Celebration")?.id).toBe("30th-celebration");
    expect(findProfile("SV: Scarlet & Violet 151")?.id).toBe("sv-151");
  });

  it("don't confuse the Classic Collection subset with the main 30th Celebration set", () => {
    expect(findProfile("ME: 30th Celebration Classic Collection")).toBeNull();
  });

  it("have no profile for a set nobody has measured yet", () => {
    expect(findProfile("ME06: Delta Reign")).toBeNull();
  });
});

describe("spot checks against the source articles", () => {
  const rate = (id: string, rarity: string) =>
    PROFILES.find((p) => p.id === id)!.slots.flatMap((s) => s.hits).find((h) => h.rarity === rarity)?.perPack;

  it("Perfect Order (3,500+ packs)", () => {
    expect(rate("me03", "Double Rare")).toBe(0.2097);
    expect(rate("me03", "Special Illustration Rare")).toBe(0.0123);
    expect(rate("me03", "Mega Hyper Rare")).toBe(0.0006);
  });

  it("Ascended Heroes uses the summary table's Ultra Rare, not the article's typo", () => {
    expect(rate("ascended-heroes", "Ultra Rare")).toBe(0.0481);
    expect(rate("ascended-heroes", "Mega Attack Rare")).toBe(0.0347);
  });

  it("30th Celebration: a guaranteed Pikachu Rare, Classic Collection from its own set, RGB unknown", () => {
    const p = PROFILES.find((x) => x.id === "30th-celebration")!;
    expect(rate("30th-celebration", "Pikachu Rare")).toBe(1);
    expect(rate("30th-celebration", "Special Illustration Rare")).toBe(0.0488);
    expect(rate("30th-celebration", "RGB Rare")).toBeNull();
    const cc = p.slots.flatMap((s) => s.hits).find((h) => h.rarity === "Classic Collection")!;
    expect(cc.poolSet).toBe("ME: 30th Celebration Classic Collection");
    expect(cc.perPack).toBe(0.1015);
  });
});
