import { describe, it, expect } from "vitest";
import { pickSetToFill } from "../backfill";
import type { FillCandidate } from "../backfill";
import { AUTO_FILL_MAX_ITEMS, ITEMS_TTL_MS, REFILL_AFTER_MS } from "../freshness";
import { MAX_SET_ROWS } from "../setsView";

const now = new Date("2026-10-08T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const noSkips = () => new Map<number, number>();
const ago = (ms: number) => new Date(now.getTime() - ms);

const set = (over: Partial<FillCandidate> & { id: number }): FillCandidate => ({
  cardCount: 100,
  releaseDate: new Date("2025-01-01T00:00:00Z"),
  itemsFetchedAt: null,
  ...over,
});

const pick = (sets: FillCandidate[], extra: { skipUntil?: Map<number, number>; watched?: number[]; at?: Date } = {}) =>
  pickSetToFill(sets, {
    now: extra.at ?? now,
    skipUntil: extra.skipUntil ?? noSkips(),
    watchedSetIds: new Set(extra.watched ?? []),
  });

describe("pickSetToFill", () => {
  it("fills never-loaded sets newest release first, undated last", () => {
    const sets = [
      set({ id: 1, releaseDate: new Date("2020-01-01") }),
      set({ id: 2, releaseDate: new Date("2026-09-16") }),
      set({ id: 3, releaseDate: null }),
    ];
    expect(pick(sets)?.set.id).toBe(2);
    expect(pick(sets.filter((s) => s.id !== 2))?.set.id).toBe(1);
    expect(pick(sets.filter((s) => s.id === 3))?.set.id).toBe(3);
    expect(pick(sets)?.tier).toBe("first");
  });

  it("never auto-fills oversized or empty sets", () => {
    const sets = [
      set({ id: 1, cardCount: AUTO_FILL_MAX_ITEMS + 1 }),
      set({ id: 2, cardCount: 0 }),
      set({ id: 3, cardCount: AUTO_FILL_MAX_ITEMS }),
    ];
    expect(pick(sets)?.set.id).toBe(3);
    expect(pick(sets.slice(0, 2))).toBeNull();
  });

  it("skips a set that is cooling off after a failure, then retries once it has passed", () => {
    const sets = [set({ id: 1, releaseDate: new Date("2026-09-16") }), set({ id: 2, releaseDate: new Date("2025-01-01") })];
    const skipUntil = new Map([[1, now.getTime() + 1000]]);
    expect(pick(sets, { skipUntil })?.set.id).toBe(2);
    expect(pick(sets, { skipUntil, at: new Date(now.getTime() + 2000) })?.set.id).toBe(1);
  });

  it("only refills a set once its saved prices are older than the refill age", () => {
    const fresh = set({ id: 1, itemsFetchedAt: ago(2 * day) });
    expect(pick([fresh])).toBeNull();

    const stale = set({ id: 2, itemsFetchedAt: ago(REFILL_AFTER_MS + 1000) });
    expect(pick([fresh, stale])).toMatchObject({ set: { id: 2 }, tier: "refill" });
  });

  it("refills the stalest set first", () => {
    const a = set({ id: 1, itemsFetchedAt: ago(9 * day) });
    const b = set({ id: 2, itemsFetchedAt: ago(20 * day) });
    const c = set({ id: 3, itemsFetchedAt: ago(12 * day) });
    expect(pick([a, b, c])?.set.id).toBe(2);
  });

  it("finishes first-time loads before refreshing anything stale", () => {
    const stale = set({ id: 1, itemsFetchedAt: ago(30 * day) });
    const never = set({ id: 2, releaseDate: new Date("2010-01-01") });
    expect(pick([stale, never])?.set.id).toBe(2);
  });

  it("returns null when there is nothing to do", () => {
    expect(pick([])).toBeNull();
  });
});

describe("pickSetToFill — sets with a smart alert", () => {
  it("puts a watched set ahead of newer never-loaded sets", () => {
    const newest = set({ id: 1, releaseDate: new Date("2026-09-16") });
    const watched = set({ id: 2, releaseDate: new Date("2019-01-01"), itemsFetchedAt: ago(ITEMS_TTL_MS + 1000) });
    expect(pick([newest, watched], { watched: [2] })).toMatchObject({ set: { id: 2 }, tier: "watched" });
  });

  it("leaves a watched set alone while its prices are still fresh", () => {
    const watched = set({ id: 2, itemsFetchedAt: ago(ITEMS_TTL_MS / 2) });
    const other = set({ id: 1 });
    expect(pick([other, watched], { watched: [2] })).toMatchObject({ set: { id: 1 }, tier: "first" });
  });

  it("loads a watched set that has no prices yet", () => {
    expect(pick([set({ id: 5 })], { watched: [5] })).toMatchObject({ set: { id: 5 }, tier: "watched" });
  });

  it("refreshes the stalest watched set first", () => {
    const a = set({ id: 1, itemsFetchedAt: ago(ITEMS_TTL_MS + 1000) });
    const b = set({ id: 2, itemsFetchedAt: ago(3 * day) });
    expect(pick([a, b], { watched: [1, 2] })?.set.id).toBe(2);
  });

  it("allows a watched set bigger than the automatic limit, but not past the fetch cap", () => {
    const big = set({ id: 1, cardCount: AUTO_FILL_MAX_ITEMS + 100 });
    expect(pick([big], { watched: [1] })).toMatchObject({ tier: "watched" });
    expect(pick([big])).toBeNull(); // not watched -> still excluded

    const huge = set({ id: 2, cardCount: MAX_SET_ROWS + 1 });
    expect(pick([huge], { watched: [2] })).toBeNull();
  });

  it("still skips a watched set that is cooling off after a failure", () => {
    const watched = set({ id: 1 });
    const skipUntil = new Map([[1, now.getTime() + 1000]]);
    expect(pick([watched], { watched: [1], skipUntil })).toBeNull();
  });
});
