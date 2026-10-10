import type { CardPriceProvider } from "@/generated/prisma/client";

/** One priced card+printing as reported by a provider's search results. */
export interface CardPriceCandidate {
  provider: CardPriceProvider;
  externalId: string;
  name: string;
  setName: string;
  variant: string | null;
  priceCents: number | null;
  lowPriceCents: number | null;
  imageUrl: string | null;
  url: string;
}

export type CardSearchResult =
  | { ok: true; candidates: CardPriceCandidate[] }
  | { ok: false; error: string };

export type CardPriceCheckResult =
  | {
      ok: true;
      priceCents: number | null;
      lowPriceCents: number | null;
      /** Omitted when the provider doesn't hand back a link on this call — caller keeps the stored one. */
      url?: string | null;
      imageUrl?: string | null;
    }
  | { ok: false; error: string };

/**
 * A card pricing provider can search by free-text name (to let the user pick
 * the exact printing) and re-check a specific previously-found card+printing
 * by its externalId (for the background poller).
 */
export interface CardPriceChecker {
  provider: CardPriceProvider;
  search(query: string): Promise<CardSearchResult>;
  checkPrice(externalId: string, variant: string | null): Promise<CardPriceCheckResult>;
}

/** Converts a dollar-amount float (or null/undefined) to integer cents. */
export function toCents(n: number | null | undefined): number | null {
  return typeof n === "number" ? Math.round(n * 100) : null;
}

/** Best-effort "view this card" link — neither provider returns a direct buy URL from search. */
export function tcgplayerSearchUrl(name: string, setName?: string): string {
  const q = setName ? `${name} ${setName}` : name;
  return `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(q)}`;
}
