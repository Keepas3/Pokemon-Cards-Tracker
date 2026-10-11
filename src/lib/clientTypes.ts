import type { SetSummary } from "./collection/progress";
import type { DealDTO } from "./deals/types";
import type { Digest } from "./digest/types";
import type { ItemGroup } from "./sets/classify";

// Plain client-safe mirrors of the Prisma schema enums. Client components
// must NOT import enum values from "@/generated/prisma/client" — that pulls
// the whole (Node-only, native-binding-using) generated Prisma client into
// the browser bundle and breaks the build. Keep these in sync with
// prisma/schema.prisma; server code continues to import the real enums.
export interface NotificationConfigDTO {
  id: string;
  /** The profile these settings belong to. */
  name: string;
  /** Whether a Discord webhook is saved. The URL itself is a secret and never sent to the browser. */
  discordWebhookSet: boolean;
  /** e.g. "discord.com webhook ending …x7Qa", for display. */
  discordWebhookHint: string | null;
  enabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  digestEnabled: boolean;
  /** Local hour (0–23) the morning digest goes out. */
  digestHour: number;
  lastDigestAt: string | null;
}

// --- Card singles ---

export const CardPriceProvider = {
  JUSTTCG: "JUSTTCG",
  TCGAPI_DEV: "TCGAPI_DEV",
} as const;
export type CardPriceProvider = (typeof CardPriceProvider)[keyof typeof CardPriceProvider];

export interface CardPriceSourceDTO {
  id: string;
  cardId: string;
  provider: CardPriceProvider;
  externalId: string;
  variant: string | null;
  url: string;
  lastPriceCents: number | null;
  lastLowPriceCents: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface CardWatchlistEntryDTO {
  id: string;
  cardId: string;
  thresholdCents: number;
}

export interface CardDTO {
  id: string;
  name: string;
  setName: string;
  number: string | null;
  imageUrl: string | null;
  priceSources: CardPriceSourceDTO[];
  watchlist?: CardWatchlistEntryDTO | null;
}

/** One result row from a live /api/cards/search — not yet a tracked Card. */
export interface CardCandidateDTO {
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

export interface CardPriceEventDTO {
  id: string;
  oldPriceCents: number | null;
  newPriceCents: number | null;
  notified: boolean;
  createdAt: string;
  cardPriceSource: CardPriceSourceDTO & { card: CardDTO };
}

// --- Browse by set (TCGplayer-style collections) ---

export type SetItemKind = "CARD" | "SEALED";

export interface SetDTO {
  id: number;
  name: string;
  slug: string;
  releaseDate: string | null;
  cardCount: number;
  iconUrl: string | null;
  imageUrl: string | null;
  itemsFetchedAt: string | null;
  /**
   * Cheapest and most expensive priced item (cards and sealed) in the set, from
   * the saved prices — null until the set's prices have been loaded.
   */
  priceRange: { minCents: number; maxCents: number } | null;
}

export interface SetItemDTO {
  id: string;
  externalId: number;
  name: string;
  number: string | null;
  rarity: string | null;
  /** What tcgapi.dev calls it. Use `group` to decide what to show it as. */
  kind: SetItemKind;
  /** What it really is: a numbered card, a sealed product, or something else (code cards, promos). */
  group: ItemGroup;
  printing: string;
  marketPriceCents: number | null;
  lowPriceCents: number | null;
  imageUrl: string | null;
  tcgplayerUrl: string;
  /** Copies you own of this card, any printing (always 0 for anything that isn't a card). */
  owned: number;
  /** Set when this exact printing is already a tracked Card; thresholdCents is null if not watched. */
  tracked: { cardId: string; thresholdCents: number | null } | null;
}

/** The free tier's remaining daily request budget, as last reported by the API. */
export interface ApiBudgetDTO {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  resetAt: string | null;
}

export interface SetsPayload {
  sets: SetDTO[];
  /** When the sets list was last pulled from the API (null = never). */
  fetchedAt: string | null;
  /** A refresh problem (missing key, budget, network) — cached data is still returned. */
  error: string | null;
  budget: ApiBudgetDTO | null;
}

export interface SetDetailPayload {
  set: SetDTO;
  items: SetItemDTO[];
  /** Your completion of the set (null when there are no cards to count). */
  collection: SetSummary | null;
  error: string | null;
  budget: ApiBudgetDTO | null;
}

export type SetSort = "newest" | "oldest" | "name" | "cards";
export type SetItemSort = "price_desc" | "price_asc" | "number" | "name";

// --- Smart alerts and the Today page ---

/** A saved rule: alert when anything in a set matching these filters is at or under a price. */
export interface SmartWatchDTO {
  id: string;
  name: string;
  setId: number;
  setName: string;
  setSlug: string;
  kind: SetItemKind | null;
  rarity: string | null;
  query: string | null;
  /** Cards only, and only ones whose number you don't own yet. */
  onlyMissing: boolean;
  maxPriceCents: number;
  enabled: boolean;
  /** How many items match the rule right now. */
  matchCount: number;
  /** When the set's prices were last fetched — alerts can only be as fresh as this. */
  setItemsFetchedAt: string | null;
}

export interface SmartWatchInput {
  setSlug: string;
  name?: string | null;
  kind?: SetItemKind | null;
  rarity?: string | null;
  query?: string | null;
  onlyMissing?: boolean;
  maxPriceCents: number;
}

export interface TodayPayload {
  digest: Digest;
  /** The best deals right now on cards the person is missing (their sets and followed Pokémon). */
  deals: DealDTO[];
  /** How many deals there are in all (the list above is cut short). */
  dealsFound: number;
  /** The best deals on sealed products (booster packs, tins, boxes) in the person's sets and followed Pokémon. */
  productDeals: DealDTO[];
  productDealsFound: number;
  smartWatches: SmartWatchDTO[];
  digestEnabled: boolean;
  digestHour: number;
  lastDigestAt: string | null;
  hasWebhook: boolean;
  budget: ApiBudgetDTO | null;
}
