// When to spend an API request versus serve what's already in SQLite.
// tcgapi.dev's free tier is ~100 requests/day, so the defaults lean hard
// toward the cache: set lists barely change, and market prices move slowly
// enough that half a day old is fine for browsing.

export const SETS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ITEMS_TTL_MS = 12 * 60 * 60 * 1000;
/** A manual "Refresh" click can't re-spend budget on data fetched less than this ago. */
export const MIN_MANUAL_REFRESH_MS = 60 * 60 * 1000;
/** Requests always left unspent, for card-price checks and anything else sharing the budget. */
export const BUDGET_RESERVE = 5;

// --- Background price fill (see backfill.ts and fillNextSetPrices) ---

/** One set is fetched this often, at most. */
export const FILL_INTERVAL_MS = 15 * 60 * 1000;
/**
 * The background fill only spends requests while at least this many of the
 * day's would remain afterwards — the rest is for card price checks and for
 * the user opening sets, which can dig deeper (they only keep BUDGET_RESERVE back).
 */
export const FILL_BUDGET_FLOOR = 50;
/**
 * Sets that have a smart alert are refreshed ahead of everything else (see
 * pickSetToFill), and may dig deeper into the day's budget than the general
 * fill — the user asked for those alerts, so they shouldn't judge stale prices.
 */
export const WATCHED_BUDGET_FLOOR = 15;
/** Once every set has prices, one whose saved prices are older than this gets re-fetched. */
export const REFILL_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Bigger sets (odd "bin" collections of 700+ items) are only loaded when the user asks. */
export const AUTO_FILL_MAX_ITEMS = 700;
/** After a failed fetch, that set sits out this long so it can't block the queue. */
export const SKIP_AFTER_FAILURE_MS = 6 * 60 * 60 * 1000;

export function shouldRefresh(opts: {
  fetchedAt: Date | null;
  ttlMs: number;
  /** The user clicked Refresh. */
  forced: boolean;
  now?: Date;
}): boolean {
  if (!opts.fetchedAt) return true;
  const age = (opts.now ?? new Date()).getTime() - opts.fetchedAt.getTime();
  if (age > opts.ttlMs) return true;
  return opts.forced && age > MIN_MANUAL_REFRESH_MS;
}

/**
 * Why the background fill should wait instead of spending `needed` requests, or
 * null if it can go ahead. Unknown budget (fresh server start) is allowed — the
 * response teaches the app the real number for next time.
 */
export function fillBudgetReason(
  budget: { dailyRemaining: number | null } | null,
  needed: number,
  floor: number = FILL_BUDGET_FLOOR,
): string | null {
  if (!budget || budget.dailyRemaining == null) return null;
  if (budget.dailyRemaining - needed >= floor) return null;
  return `${budget.dailyRemaining} request${budget.dailyRemaining === 1 ? "" : "s"} left today and the fill keeps ${floor} in reserve`;
}

/**
 * A human-readable reason NOT to spend `needed` requests, or null if it's fine.
 * An unknown budget (nothing seen yet since the server started) is allowed
 * through — the API's own error is handled if it turns out to be exhausted.
 */
export function budgetBlockReason(
  budget: { dailyRemaining: number | null } | null,
  needed: number,
): string | null {
  if (!budget || budget.dailyRemaining == null) return null;
  if (budget.dailyRemaining >= needed + BUDGET_RESERVE) return null;
  return (
    `Only ${budget.dailyRemaining} tcgapi.dev request${budget.dailyRemaining === 1 ? "" : "s"} left today ` +
    `(this needs about ${needed}, and a few are held back for price checks). The free tier resets daily at 00:00 UTC — ` +
    `showing saved data.`
  );
}
