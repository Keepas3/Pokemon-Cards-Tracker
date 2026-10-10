// Joining the official card list with tcgapi.dev's priced rows into one entry per
// card number. Pure and client-safe.

import { compareCardNumbers } from "@/lib/sets/setsView";
import { cardKey } from "@/lib/collection/numbers";
import type { CollectionCard } from "@/lib/collection/progress";

export interface OfficialCardRow {
  key: string;
  localId: string;
  name: string;
  imageUrl: string | null;
}

/** A tcgapi.dev row already classified as a card. */
export interface PricedRow {
  number: string | null;
  name: string;
  rarity: string | null;
  marketPriceCents: number | null;
  lowPriceCents: number | null;
  tcgplayerUrl: string;
  imageUrl: string | null;
}

/** Below this share of overlapping card numbers the two lists aren't numbering the same way. */
export const MIN_OVERLAP = 0.5;

const priced = (r: PricedRow) => r.marketPriceCents != null && r.marketPriceCents > 0;

function pickBest(rows: PricedRow[]): PricedRow {
  const withPrice = rows.filter(priced);
  if (withPrice.length === 0) return rows[0];
  return withPrice.reduce((a, b) => ((a.marketPriceCents as number) <= (b.marketPriceCents as number) ? a : b));
}

export interface JoinResult {
  cards: CollectionCard[];
  /** False when the official list was ignored (none given, or it didn't line up with tcgapi's numbering). */
  usedOfficial: boolean;
}

/**
 * One CollectionCard per card number. With an official list, its cards come first
 * in print order and any numbered tcgapi card it doesn't list (an odd secret-rare
 * numbering) follows. If the two lists barely overlap they number cards
 * differently, and mixing them would double-count — then only tcgapi's is used.
 * A number with several rows (printings, pattern variants) is one card, priced at
 * its cheapest priced row.
 */
export function joinCards(
  official: OfficialCardRow[] | null,
  rows: PricedRow[],
  owned: ReadonlyMap<string, number>,
): JoinResult {
  const byKey = new Map<string, PricedRow[]>();
  for (const r of rows) {
    const key = cardKey(r.number);
    if (key == null) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }

  let useOfficial = official != null && official.length > 0;
  if (useOfficial && byKey.size > 0) {
    const shared = official!.filter((c) => byKey.has(c.key)).length;
    if (shared / Math.min(official!.length, byKey.size) < MIN_OVERLAP) useOfficial = false;
  }

  const build = (key: string, off: OfficialCardRow | null): CollectionCard => {
    const items = byKey.get(key) ?? [];
    const best = items.length ? pickBest(items) : null;
    const withSlash = items.find((i) => i.number?.includes("/"))?.number ?? items[0]?.number ?? null;
    const name = off?.name ?? items.reduce((a, b) => (b.name.length < a.length ? b.name : a), items[0]?.name ?? "");
    return {
      key,
      number: withSlash ?? off?.localId ?? key,
      name,
      imageUrl: off?.imageUrl ?? best?.imageUrl ?? null,
      rarity: best?.rarity ?? items.find((i) => i.rarity)?.rarity ?? null,
      priceCents: best && priced(best) ? best.marketPriceCents : null,
      lowPriceCents: best?.lowPriceCents ?? null,
      tcgplayerUrl: best?.tcgplayerUrl ?? null,
      owned: owned.get(key) ?? 0,
      official: off != null,
    };
  };

  const cards: CollectionCard[] = [];
  if (useOfficial) {
    const seen = new Set<string>();
    for (const off of official!) {
      if (seen.has(off.key)) continue;
      seen.add(off.key);
      cards.push(build(off.key, off));
    }
    const extras = [...byKey.keys()].filter((k) => !seen.has(k)).map((k) => build(k, null));
    extras.sort((a, b) => compareCardNumbers(a.number, b.number));
    cards.push(...extras);
  } else {
    const all = [...byKey.keys()].map((k) => build(k, null));
    all.sort((a, b) => compareCardNumbers(a.number, b.number));
    cards.push(...all);
  }
  return { cards, usedOfficial: useOfficial };
}
