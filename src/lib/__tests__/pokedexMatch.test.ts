import { describe, expect, it } from "vitest";
import { dexIdFromCardName } from "@/lib/pokedex/match";

describe("dexIdFromCardName", () => {
  it("finds the Pokémon in a card name", () => {
    expect(dexIdFromCardName("Vulpix")).toBe(37);
    expect(dexIdFromCardName("Alolan Vulpix")).toBe(37);
    expect(dexIdFromCardName("Mega Charizard X ex")).toBe(6);
    expect(dexIdFromCardName("Lillie's Clefairy ex")).toBe(35);
  });
  it("handles accents, punctuation and multi-word names", () => {
    expect(dexIdFromCardName("Mr. Mime")).toBe(122);
    expect(dexIdFromCardName("Flabébé")).toBe(669);
    expect(dexIdFromCardName("Ho-Oh ex")).toBe(250);
  });
  it("prefers the longer species name", () => {
    expect(dexIdFromCardName("Mime Jr.")).toBe(439);
  });
  it("is null for trainers and energy", () => {
    expect(dexIdFromCardName("Professor's Research")).toBeNull();
    expect(dexIdFromCardName("Basic Fire Energy")).toBeNull();
  });
});
