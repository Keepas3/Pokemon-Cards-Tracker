// What the Collection pages get from the API. Client-safe.

import type { SetItemDTO } from "@/lib/clientTypes";
import type { CollectionCard, SetSummary } from "./progress";

export interface GallerySetDTO {
  slug: string;
  name: string;
  logoUrl: string | null;
  symbolUrl: string | null;
  /** A picture for sets the card catalog has no logo for (tcgapi.dev's set icon or box art). */
  artUrl: string | null;
  releaseDate: string | null;
  /** Cards in the set; null when we don't have its card list (unmatched set you haven't started). */
  totalCards: number | null;
  ownedCards: number;
  copies: number;
  /** 0–100 once the total is known. */
  percent: number | null;
  /** Whether the set is paired with the official catalog (logo and full card list). */
  official: boolean;
}

export interface GallerySeriesDTO {
  id: string;
  name: string;
  sets: GallerySetDTO[];
}

export interface GalleryPayload {
  series: GallerySeriesDTO[];
  totals: {
    /** Sets with at least one card owned. */
    started: number;
    complete: number;
    copies: number;
    valueCents: number;
  };
  /** Why the official catalog couldn't be refreshed, if it couldn't (cached data is still shown). */
  error: string | null;
}

export interface CollectionSetPayload {
  set: {
    id: number;
    slug: string;
    name: string;
    seriesName: string | null;
    logoUrl: string | null;
    releaseDate: string | null;
    official: boolean;
  };
  /** Every card in the set, in print order, with what you own. */
  cards: CollectionCard[];
  summary: SetSummary;
  /** The set's other rows from tcgapi.dev — sealed products, collection boxes, code cards. Same shape as Browse. */
  products: SetItemDTO[];
  /** A problem reaching the card catalog (the list falls back to tcgapi.dev's), or null. */
  error: string | null;
}

/** What changing a card's count returns: the new total for it and the set's refreshed summary. */
export interface OwnedResult {
  ok: true;
  quantity: number;
  summary: SetSummary;
}
