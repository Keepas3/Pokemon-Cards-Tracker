import { describe, it, expect } from "vitest";
import { MAX_RULE_PRICE_CENTS, parseCreate, parsePatch } from "../input";

describe("parseCreate", () => {
  const ok = { setSlug: "me-30th-celebration", maxPriceCents: 4000 };

  it("accepts a minimal rule and fills the rest with 'any'", () => {
    const r = parseCreate(ok);
    expect(r).toEqual({
      ok: true,
      value: {
        setSlug: "me-30th-celebration",
        name: null,
        kind: null,
        onlyMissing: false,
        rarity: null,
        query: null,
        maxPriceCents: 4000,
      },
    });
  });

  it("trims text and treats blanks as not set", () => {
    const r = parseCreate({ ...ok, rarity: "  Rare Holo ", query: "   ", kind: "", name: " My rule " });
    expect(r).toMatchObject({ ok: true, value: { rarity: "Rare Holo", query: null, kind: null, name: "My rule" } });
  });

  it("requires a set and a sensible whole-cent price", () => {
    expect(parseCreate({ maxPriceCents: 100 })).toMatchObject({ ok: false });
    expect(parseCreate({ ...ok, maxPriceCents: 0 })).toMatchObject({ ok: false });
    expect(parseCreate({ ...ok, maxPriceCents: -5 })).toMatchObject({ ok: false });
    expect(parseCreate({ ...ok, maxPriceCents: 12.5 })).toMatchObject({ ok: false });
    expect(parseCreate({ ...ok, maxPriceCents: "4000" })).toMatchObject({ ok: false });
    expect(parseCreate({ ...ok, maxPriceCents: MAX_RULE_PRICE_CENTS + 1 })).toMatchObject({ ok: false });
  });

  it("rejects an unknown kind and non-object bodies", () => {
    expect(parseCreate({ ...ok, kind: "BOX" })).toMatchObject({ ok: false });
    expect(parseCreate(null)).toMatchObject({ ok: false });
    expect(parseCreate("nope")).toMatchObject({ ok: false });
  });
});

describe("parsePatch", () => {
  it("only reports the fields that were sent", () => {
    expect(parsePatch({ enabled: false })).toEqual({ ok: true, value: { criteria: {}, enabled: false } });
    expect(parsePatch({ maxPriceCents: 900 })).toEqual({ ok: true, value: { criteria: { maxPriceCents: 900 } } });
  });

  it("lets a filter be cleared with null or blank", () => {
    expect(parsePatch({ rarity: null, query: "" })).toEqual({
      ok: true,
      value: { criteria: { rarity: null, query: null } },
    });
  });

  it("distinguishes 'regenerate the name' (blank) from 'leave it' (absent)", () => {
    expect(parsePatch({ name: "" })).toMatchObject({ ok: true, value: { name: null } });
    expect(parsePatch({})).toMatchObject({ ok: true, value: { criteria: {} } });
    expect((parsePatch({}) as { value: { name?: unknown } }).value.name).toBeUndefined();
  });

  it("validates what it is given", () => {
    expect(parsePatch({ enabled: "yes" })).toMatchObject({ ok: false });
    expect(parsePatch({ maxPriceCents: 0 })).toMatchObject({ ok: false });
    expect(parsePatch({ kind: "BOX" })).toMatchObject({ ok: false });
  });
});

describe("onlyMissing", () => {
  const ok = { setSlug: "me03", maxPriceCents: 4000 };

  it("makes the rule about cards", () => {
    expect(parseCreate({ ...ok, onlyMissing: true })).toMatchObject({ ok: true, value: { onlyMissing: true, kind: "CARD" } });
    expect(parseCreate({ ...ok, onlyMissing: true, kind: "CARD" })).toMatchObject({ ok: true, value: { kind: "CARD" } });
  });

  it("can't be combined with sealed products", () => {
    expect(parseCreate({ ...ok, onlyMissing: true, kind: "SEALED" })).toMatchObject({ ok: false });
  });

  it("defaults to off and must be a boolean", () => {
    expect(parseCreate(ok)).toMatchObject({ ok: true, value: { onlyMissing: false, kind: null } });
    expect(parseCreate({ ...ok, onlyMissing: "yes" })).toMatchObject({ ok: false });
    expect(parsePatch({ onlyMissing: true })).toEqual({ ok: true, value: { criteria: { onlyMissing: true } } });
    expect(parsePatch({ onlyMissing: 1 })).toMatchObject({ ok: false });
  });
});
