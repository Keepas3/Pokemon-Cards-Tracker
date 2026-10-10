import type { CollectionCard, SetSummary } from "@/lib/collection/progress";

/** One card of a Pokémon, in whichever set it was printed. Owning it works exactly as on the set page. */
export interface PokemonCardDTO extends CollectionCard {
  /** Our set id, which is what ownership is saved against. Null when the set isn't one we can track yet. */
  setId: number | null;
  setName: string;
  /** Collection page of the set, when we have one. */
  setSlug: string | null;
  releaseDate: string | null;
}

/** One Pokémon's page. */
export interface PokemonPayload {
  dexId: number;
  name: string;
  generation: number | null;
  followed: boolean;
  /** Every card that can be tracked (its set is one of ours), newest set first. */
  cards: PokemonCardDTO[];
  /** Completion over `cards`. */
  summary: SetSummary;
  /** Cards in sets we can't track yet, shown for reference but left out of completion. */
  untracked: PokemonCardDTO[];
  /** A problem reaching TCGdex, or null. The cached list (if any) is still shown. */
  error: string | null;
  /** When the card list was fetched from TCGdex. */
  fetchedAt: string | null;
}

/** One tile on the Pokémon page. Progress only exists for Pokémon the person follows. */
export interface PokemonTileDTO {
  dexId: number;
  name: string;
  generation: number | null;
  followed: boolean;
  totalCards: number | null;
  ownedCards: number | null;
  percent: number | null;
  /** Distinct cards owned in any set, found by card name — counts even when the Pokémon isn't followed. */
  haveCards: number;
  /** A card to show on the tile (followed Pokémon only). */
  imageUrl: string | null;
}

export interface PokemonGalleryPayload {
  species: PokemonTileDTO[];
  totals: { followed: number; collecting: number; cardsOwned: number; complete: number };
}
