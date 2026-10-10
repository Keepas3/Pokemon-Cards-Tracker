import type { SetDTO, SetItemDTO, SetItemSort, SetSort } from "@/lib/clientTypes";
import { formatPrice } from "@/lib/labels";

// Pure sort/filter helpers for the set pages. Client-safe on purpose (no
// Prisma imports) — the browser filters and sorts what the API already cached.

/** Sort comparator that always puts missing values last, whichever direction. */
function nullsLast(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

/**
 * Orders card numbers the way a person would: "2" before "10", "001/094"
 * numerically, and non-numeric ones ("R/RGB", "SWSH123") after the numeric ones.
 */
export function compareCardNumbers(a: string | null, b: string | null): number {
  const lead = (s: string | null) => {
    const m = s?.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };
  const byNumber = nullsLast(lead(a), lead(b), 1);
  if (byNumber !== 0) return byNumber;
  // Same leading number (or neither has one): a missing number still goes
  // after a present one, then fall back to a natural string compare.
  if (a == null && b != null) return 1;
  if (a != null && b == null) return -1;
  return (a ?? "").localeCompare(b ?? "", undefined, { numeric: true });
}

export function isUpcoming(set: Pick<SetDTO, "releaseDate">, now: Date = new Date()): boolean {
  return set.releaseDate != null && new Date(set.releaseDate).getTime() > now.getTime();
}

export function filterSets(sets: SetDTO[], query: string): SetDTO[] {
  const q = query.trim().toLowerCase();
  if (!q) return sets;
  return sets.filter((s) => s.name.toLowerCase().includes(q));
}

export function sortSets(sets: SetDTO[], sort: SetSort): SetDTO[] {
  const time = (s: SetDTO) => (s.releaseDate ? new Date(s.releaseDate).getTime() : null);
  const copy = [...sets];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => nullsLast(time(a), time(b), -1));
    case "oldest":
      return copy.sort((a, b) => nullsLast(time(a), time(b), 1));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "cards":
      return copy.sort((a, b) => b.cardCount - a.cardCount);
  }
}

export interface ItemFilter {
  query: string;
  /** "" = any rarity. */
  rarity: string;
  /** Cards, or products: sealed items plus the other rows (code cards, promos). */
  view: "cards" | "products";
}

export function filterItems(items: SetItemDTO[], f: ItemFilter): SetItemDTO[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((i) => {
    if ((i.group === "card") !== (f.view === "cards")) return false;
    if (f.rarity && i.rarity !== f.rarity) return false;
    if (q && !i.name.toLowerCase().includes(q) && !(i.number ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}

export function sortItems(items: SetItemDTO[], sort: SetItemSort): SetItemDTO[] {
  const copy = [...items];
  switch (sort) {
    case "price_desc":
      return copy.sort((a, b) => nullsLast(a.marketPriceCents, b.marketPriceCents, -1));
    case "price_asc":
      return copy.sort((a, b) => nullsLast(a.marketPriceCents, b.marketPriceCents, 1));
    case "number":
      return copy.sort((a, b) => compareCardNumbers(a.number, b.number) || a.name.localeCompare(b.name));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/** Distinct rarities in a set's items, most common first — feeds the rarity filter dropdown. */
export function rarityOptions(items: SetItemDTO[]): string[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    if (i.rarity) counts.set(i.rarity, (counts.get(i.rarity) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([rarity]) => rarity);
}

/**
 * Cheapest and most expensive priced item. Items with no price (or a $0 one)
 * are left out — a missing price isn't the cheapest card, it's an unknown.
 */
export function priceRangeOf(
  items: Array<{ marketPriceCents: number | null }>,
): { minCents: number; maxCents: number } | null {
  let min: number | null = null;
  let max: number | null = null;
  for (const { marketPriceCents: p } of items) {
    if (p == null || p <= 0) continue;
    if (min == null || p < min) min = p;
    if (max == null || p > max) max = p;
  }
  return min == null || max == null ? null : { minCents: min, maxCents: max };
}

/** "$0.03 – $6,000.27", or a single price when the set only has one. */
export function formatPriceRange(range: { minCents: number; maxCents: number }): string {
  return range.minCents === range.maxCents
    ? formatPrice(range.minCents)
    : `${formatPrice(range.minCents)} – ${formatPrice(range.maxCents)}`;
}

/**
 * The most rows we fetch for one set (10 requests' worth). A few "bin" sets
 * (World Championship Decks, Miscellaneous Cards & Products) hold more than
 * this, so fetching them would be both costly and incomplete.
 */
export const MAX_SET_ROWS = 1000;

/** True when a set has more items than we fetch — its prices (and any range) would be partial. */
export function isOversized(set: Pick<SetDTO, "cardCount">): boolean {
  return set.cardCount > MAX_SET_ROWS;
}

/** How many sets one "Load prices" click fetches. */
export const PRICE_LOAD_BATCH = 6;

/**
 * Sets whose prices haven't been fetched yet, in the order given. Oversized
 * sets are left out: they can never show a complete range, so they're not
 * "missing" one.
 */
export function setsMissingPrices(sets: SetDTO[]): SetDTO[] {
  return sets.filter((s) => !s.itemsFetchedAt && !isOversized(s));
}

/** API requests needed to fetch these sets' prices (100 rows per request, at least one each). */
export function estimateRequests(sets: Array<Pick<SetDTO, "cardCount">>): number {
  return sets.reduce((n, s) => n + Math.max(1, Math.ceil(s.cardCount / 100)), 0);
}

/** The TCGplayer product page for an item, or a search link when we have no product id. */
export function tcgplayerUrl(tcgplayerId: number | null, name: string): string {
  return tcgplayerId != null
    ? `https://www.tcgplayer.com/product/${tcgplayerId}`
    : `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(name)}`;
}
