// One set's collection, assembled from the database: the card list (official where
// we have it, tcgapi.dev's otherwise) joined to prices, what you own, and a summary.
// Shared by the Browse set page, the Collection pages and every ownership change.

import { prisma } from "@/lib/prisma";
import type { CardSet, OfficialSet, SetItem } from "@/generated/prisma/client";
import { classifyItem } from "@/lib/sets/classify";
import { tcgplayerUrl } from "@/lib/sets/setsView";
import { joinCards } from "@/lib/official/join";
import type { PricedRow } from "@/lib/official/join";
import { officialForSet } from "@/lib/official/service";
import type { OfficialForSet } from "@/lib/official/service";
import { summarize } from "./progress";
import type { CollectionCard, SetSummary } from "./progress";

/** How long a page waits on the card catalog before settling for what's cached. */
const CATALOG_WAIT_MS = 6000;

export interface SetCollection {
  items: SetItem[];
  /** Copies owned, by card key. */
  owned: Map<string, number>;
  cards: CollectionCard[];
  summary: SetSummary;
  officialSet: OfficialSet | null;
  usedOfficial: boolean;
  /** A problem reaching the card catalog, or null. */
  error: string | null;
}

export const toPricedRow = (i: SetItem): PricedRow => ({
  number: i.number,
  name: i.name,
  rarity: i.rarity,
  marketPriceCents: i.marketPriceCents,
  lowPriceCents: i.lowPriceCents,
  tcgplayerUrl: tcgplayerUrl(i.tcgplayerId, i.name),
  imageUrl: i.imageUrl,
});

async function officialWithin(cardSetId: number, fetchMissing: boolean): Promise<OfficialForSet> {
  if (!fetchMissing) return officialForSet(cardSetId, { fetch: false });
  // The fetch keeps going in the background (its result is cached and shared); the
  // page just doesn't wait on a slow catalog.
  const slow = new Promise<OfficialForSet>((resolve) =>
    setTimeout(async () => {
      const cached = await officialForSet(cardSetId, { fetch: false });
      resolve({ ...cached, error: cached.error ?? "The card catalog is slow to respond — showing what's saved." });
    }, CATALOG_WAIT_MS),
  );
  return Promise.race([officialForSet(cardSetId, { fetch: true }), slow]);
}

/**
 * Loads a set's cards and one person's collection. With `fetchOfficial`, fetches the card list if
 * it isn't cached.
 */
export async function loadSetCollection(
  set: CardSet,
  opts: { fetchOfficial: boolean; profileId: string },
): Promise<SetCollection> {
  const [items, ownedRows, official] = await Promise.all([
    prisma.setItem.findMany({ where: { setId: set.id } }),
    prisma.ownedCard.findMany({ where: { setId: set.id, profileId: opts.profileId } }),
    officialWithin(set.id, opts.fetchOfficial),
  ]);
  const owned = new Map(ownedRows.map((o) => [o.numberKey, o.quantity]));
  const cardRows = items.filter((i) => classifyItem(i) === "card").map(toPricedRow);
  const { cards, usedOfficial } = joinCards(official.rows, cardRows, owned);
  return {
    items,
    owned,
    cards,
    summary: summarize(cards, usedOfficial ? "official" : "tcgapi"),
    officialSet: official.officialSet,
    usedOfficial,
    error: official.error,
  };
}
