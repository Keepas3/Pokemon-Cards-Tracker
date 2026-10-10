import { describe, it, expect } from "vitest";
import {
  BUDGET_RESERVE,
  FILL_BUDGET_FLOOR,
  ITEMS_TTL_MS,
  MIN_MANUAL_REFRESH_MS,
  budgetBlockReason,
  fillBudgetReason,
  shouldRefresh,
} from "../freshness";

const now = new Date("2026-10-08T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("shouldRefresh", () => {
  it("always fetches when nothing is cached", () => {
    expect(shouldRefresh({ fetchedAt: null, ttlMs: ITEMS_TTL_MS, forced: false, now })).toBe(true);
  });

  it("serves the cache while fresh", () => {
    expect(shouldRefresh({ fetchedAt: ago(ITEMS_TTL_MS / 2), ttlMs: ITEMS_TTL_MS, forced: false, now })).toBe(false);
  });

  it("refetches once past the TTL", () => {
    expect(shouldRefresh({ fetchedAt: ago(ITEMS_TTL_MS + 1), ttlMs: ITEMS_TTL_MS, forced: false, now })).toBe(true);
  });

  it("lets a manual refresh through only after the minimum interval", () => {
    expect(shouldRefresh({ fetchedAt: ago(MIN_MANUAL_REFRESH_MS / 2), ttlMs: ITEMS_TTL_MS, forced: true, now })).toBe(false);
    expect(shouldRefresh({ fetchedAt: ago(MIN_MANUAL_REFRESH_MS + 1), ttlMs: ITEMS_TTL_MS, forced: true, now })).toBe(true);
  });
});

describe("budgetBlockReason", () => {
  it("allows spending when the budget is unknown", () => {
    expect(budgetBlockReason(null, 3)).toBeNull();
    expect(budgetBlockReason({ dailyRemaining: null }, 3)).toBeNull();
  });

  it("allows it when enough remains beyond the reserve", () => {
    expect(budgetBlockReason({ dailyRemaining: 3 + BUDGET_RESERVE }, 3)).toBeNull();
  });

  it("blocks with an explanation when it would dip into the reserve", () => {
    const reason = budgetBlockReason({ dailyRemaining: 3 + BUDGET_RESERVE - 1 }, 3);
    expect(reason).toMatch(/left today/);
    expect(reason).toMatch(/saved data/);
  });
});

describe("fillBudgetReason", () => {
  it("lets the background fill run when the budget is unknown", () => {
    expect(fillBudgetReason(null, 3)).toBeNull();
    expect(fillBudgetReason({ dailyRemaining: null }, 3)).toBeNull();
  });

  it("allows a fetch that leaves exactly the floor unspent", () => {
    expect(fillBudgetReason({ dailyRemaining: FILL_BUDGET_FLOOR + 3 }, 3)).toBeNull();
  });

  it("waits when a fetch would dip below the floor, and says why", () => {
    const reason = fillBudgetReason({ dailyRemaining: FILL_BUDGET_FLOOR + 3 - 1 }, 3);
    expect(reason).toMatch(/in reserve/);
  });

  it("is stricter than the manual guard, so the user can always dig deeper", () => {
    const remaining = 3 + BUDGET_RESERVE; // manual is fine here...
    expect(budgetBlockReason({ dailyRemaining: remaining }, 3)).toBeNull();
    expect(fillBudgetReason({ dailyRemaining: remaining }, 3)).not.toBeNull(); // ...the fill is not
  });
});
