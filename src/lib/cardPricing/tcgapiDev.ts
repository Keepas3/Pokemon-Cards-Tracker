import { CardPriceProvider } from "@/generated/prisma/client";
import { tcgApiFetch } from "@/lib/tcgapiDev/client";
import { toCents, tcgplayerSearchUrl } from "./types";
import type { CardPriceCandidate, CardPriceChecker, CardPriceCheckResult, CardSearchResult } from "./types";

// tcgapi.dev — free-tier API, no application required, sources "every game on
// TCGPlayer." Endpoint shapes below are taken from their published docs
// (tcgapi.dev/api/cards/, tcgapi.dev/introduction/), not guessed. Requests go
// through the shared client so they count toward the tracked daily budget.

interface SearchRow {
  id: number;
  name: string;
  set_name?: string;
  printing?: string;
  market_price?: number;
  low_price?: number;
  image_url?: string;
}

interface SearchResponse {
  data?: SearchRow[];
  error?: string;
}

interface PriceRow {
  printing?: string;
  market_price?: number;
  low_price?: number;
}

interface PricesResponse {
  data?: PriceRow | PriceRow[]; // a single card with one printing returns an object, not an array
  error?: string;
}

export const tcgApiDevChecker: CardPriceChecker = {
  provider: CardPriceProvider.TCGAPI_DEV,

  async search(query: string): Promise<CardSearchResult> {
    const params = new URLSearchParams({ q: query, game: "pokemon" });
    const result = await tcgApiFetch<SearchResponse>(`/search?${params.toString()}`);
    if (!result.ok) return result;

    const candidates: CardPriceCandidate[] = (result.json.data ?? []).map((row) => ({
      provider: CardPriceProvider.TCGAPI_DEV,
      externalId: String(row.id),
      name: row.name,
      setName: row.set_name ?? "",
      variant: row.printing ?? null,
      priceCents: toCents(row.market_price),
      lowPriceCents: toCents(row.low_price),
      imageUrl: row.image_url ?? null,
      // Search rows don't include a direct tcgplayer_url (only /v1/cards/:id
      // does) — a second request per candidate just to get a link isn't worth
      // it against a 100 req/day free tier, so fall back to a search link.
      url: tcgplayerSearchUrl(row.name, row.set_name),
    }));

    return { ok: true, candidates };
  },

  async checkPrice(externalId: string, variant: string | null): Promise<CardPriceCheckResult> {
    const query = variant ? `?${new URLSearchParams({ printing: variant }).toString()}` : "";
    const result = await tcgApiFetch<PricesResponse>(`/cards/${encodeURIComponent(externalId)}/prices${query}`);
    if (!result.ok) return result;

    const data = result.json.data;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { ok: false, error: `no price data found for card id ${externalId}` };
    }

    return {
      ok: true,
      priceCents: toCents(row.market_price),
      lowPriceCents: toCents(row.low_price),
    };
  },
};
