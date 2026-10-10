import { AUTO_FILL_MAX_ITEMS, ITEMS_TTL_MS, REFILL_AFTER_MS } from "./freshness";
import { MAX_SET_ROWS } from "./setsView";

// Decides which set the background price fill fetches next. Pure on purpose:
// the interesting behaviour (ordering, skipping, refilling) is all here, and
// the service/scheduler around it just carry out the answer.

export interface FillCandidate {
  id: number;
  cardCount: number;
  releaseDate: Date | null;
  /** When this set's prices were last fetched; null = never. */
  itemsFetchedAt: Date | null;
}

/** Why a set was chosen — the service uses it to pick how much budget it may spend. */
export type FillTier = "watched" | "first" | "refill";

/**
 * 1. **watched**: sets that have an enabled smart alert, or that anyone is
 *    collecting (see prioritySetIds), and whose prices are missing or older than
 *    ITEMS_TTL_MS, stalest first. Alerts and deals on the cards people are
 *    chasing must not be judged on stale prices. (Allowed up to the fetch cap,
 *    not just AUTO_FILL_MAX_ITEMS.)
 * 2. **first**: sets never loaded, newest release first (undated last) — the
 *    sets people look at most fill in first.
 * 3. **refill**: once every eligible set has prices, the one whose saved prices
 *    are the oldest, if older than REFILL_AFTER_MS.
 * Sets above AUTO_FILL_MAX_ITEMS (odd "bin" collections) are never picked for
 * tiers 2–3, empty sets are never picked, and sets still cooling off after a
 * failed fetch (`skipUntil`: set id -> epoch ms) are skipped in every tier.
 * Returns null when there's nothing worth fetching.
 */
export function pickSetToFill<T extends FillCandidate>(
  sets: T[],
  opts: { now: Date; skipUntil: Map<number, number>; watchedSetIds?: Set<number> },
): { set: T; tier: FillTier } | null {
  const nowMs = opts.now.getTime();
  const notCoolingOff = (s: T) => (opts.skipUntil.get(s.id) ?? 0) <= nowMs;
  const available = sets.filter((s) => s.cardCount > 0 && notCoolingOff(s));

  const watched = available
    .filter(
      (s) =>
        opts.watchedSetIds?.has(s.id) &&
        s.cardCount <= MAX_SET_ROWS &&
        (s.itemsFetchedAt == null || nowMs - s.itemsFetchedAt.getTime() > ITEMS_TTL_MS),
    )
    .sort((a, b) => (a.itemsFetchedAt?.getTime() ?? -Infinity) - (b.itemsFetchedAt?.getTime() ?? -Infinity));
  if (watched.length > 0) return { set: watched[0], tier: "watched" };

  const eligible = available.filter((s) => s.cardCount <= AUTO_FILL_MAX_ITEMS);

  const releaseTime = (s: T) => (s.releaseDate ? s.releaseDate.getTime() : -Infinity);
  const neverLoaded = eligible
    .filter((s) => s.itemsFetchedAt == null)
    .sort((a, b) => releaseTime(b) - releaseTime(a));
  if (neverLoaded.length > 0) return { set: neverLoaded[0], tier: "first" };

  const stale = eligible
    .filter((s) => s.itemsFetchedAt != null && nowMs - s.itemsFetchedAt.getTime() > REFILL_AFTER_MS)
    .sort((a, b) => a.itemsFetchedAt!.getTime() - b.itemsFetchedAt!.getTime());
  return stale[0] ? { set: stale[0], tier: "refill" } : null;
}
