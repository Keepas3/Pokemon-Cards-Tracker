// Turning TCGdex's list of one Pokémon's cards into what the page shows: which of our sets
// each card belongs to (so it can be owned), its price, and how many copies a person has.
// Pure; the service feeds it rows read from the database.

import { compareCardNumbers } from "@/lib/sets/setsView";
import type { DexCard } from "./parse";
import type { PokemonCardDTO } from "./types";

/** What we know about a TCGdex set: which of our own sets (if any) it is. */
export interface SetInfo {
  /** Our set id (what ownership is saved against). Null when no tcgapi.dev set is paired with it. */
  cardSetId: number | null;
  name: string;
  slug: string | null;
  /** ISO date, or null when unknown. */
  releaseDate: string | null;
}

/** The priced row for one card number in one of our sets. */
export interface PriceInfo {
  /** As tcgapi.dev prints it ("025/088"), which is nicer to show than TCGdex's "025". */
  number: string | null;
  rarity: string | null;
  priceCents: number | null;
  lowPriceCents: number | null;
  tcgplayerUrl: string | null;
  imageUrl: string | null;
}

export const trackKey = (cardSetId: number, numberKey: string) => `${cardSetId}|${numberKey}`;

/**
 * Splits a Pokémon's cards into those that can be tracked (their set is one of ours) and those that
 * can't, each newest set first, then in card-number order. `prices` and `owned` are keyed by
 * trackKey(). A card listed twice is shown once.
 */
export function assemblePokemonCards(
  dexCards: DexCard[],
  sets: ReadonlyMap<string, SetInfo>,
  prices: ReadonlyMap<string, PriceInfo>,
  owned: ReadonlyMap<string, number>,
): { tracked: PokemonCardDTO[]; untracked: PokemonCardDTO[] } {
  const tracked: PokemonCardDTO[] = [];
  const untracked: PokemonCardDTO[] = [];
  const seen = new Set<string>();

  for (const card of dexCards) {
    const set = sets.get(card.setId) ?? { cardSetId: null, name: card.setId, slug: null, releaseDate: null };
    const trackable = set.cardSetId != null;
    const key = trackable ? trackKey(set.cardSetId!, card.numberKey) : `${card.setId}|${card.numberKey}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const price = trackable ? prices.get(key) : undefined;
    const dto: PokemonCardDTO = {
      key,
      number: price?.number ?? card.localId,
      name: card.name,
      imageUrl: card.imageUrl ?? price?.imageUrl ?? null,
      rarity: price?.rarity ?? null,
      priceCents: price?.priceCents ?? null,
      lowPriceCents: price?.lowPriceCents ?? null,
      tcgplayerUrl: price?.tcgplayerUrl ?? null,
      owned: trackable ? (owned.get(key) ?? 0) : 0,
      official: true,
      setName: set.name,
      setId: set.cardSetId,
      setSlug: set.slug,
      releaseDate: set.releaseDate,
    };
    (trackable ? tracked : untracked).push(dto);
  }

  const order = (a: PokemonCardDTO, b: PokemonCardDTO) => {
    const ad = a.releaseDate ? Date.parse(a.releaseDate) : -Infinity;
    const bd = b.releaseDate ? Date.parse(b.releaseDate) : -Infinity;
    if (ad !== bd) return bd - ad; // newest set first
    if (a.setName !== b.setName) return a.setName.localeCompare(b.setName);
    return compareCardNumbers(a.number, b.number);
  };
  return { tracked: tracked.sort(order), untracked: untracked.sort(order) };
}
