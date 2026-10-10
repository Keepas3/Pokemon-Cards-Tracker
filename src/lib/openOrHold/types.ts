// Shared shapes for Open or hold. No Prisma imports, so the UI can use them too.

/** The editable assumptions every number on the panel rests on. */
export interface Assumptions {
  /** Marketplace + payment fees taken off whatever you sell, in percent. */
  feePct: number;
  /** A card worth less than this isn't worth listing one by one — counted as bulk. */
  bulkThresholdCents: number;
  /** What the rest of one pack (commons, bulk) is worth to you, if anything. */
  bulkPerPackCents: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  feePct: 13,
  bulkThresholdCents: 100,
  bulkPerPackCents: 0,
};

// --- Pull-rate profiles ---

export interface HitDef {
  /** The rarity as TCGplayer / tcgapi.dev spell it. */
  rarity: string;
  /** Chance that one pack holds a card of this rarity. null = no published figure. */
  perPack: number | null;
  /** Name of another set that holds these cards (30th Celebration's Classic Collection). */
  poolSet?: string;
}

/** One position in a pack. Its hits are mutually exclusive: a slot holds at most one of them. */
export interface SlotDef {
  label: string;
  hits: HitDef[];
}

export interface ProfileSource {
  title: string;
  url: string;
  /** ISO date the article was published (or last updated). */
  published: string;
  /** How many packs were opened to measure it, as the article words it. */
  packsOpened: string;
}

export interface PullProfile {
  id: string;
  /** tcgapi.dev set names this profile describes. */
  setNames: string[];
  slots: SlotDef[];
  source: ProfileSource;
  /** Caveats that belong next to the numbers. */
  notes: string[];
}

// --- What the API returns to the panel ---

export type PacksSource = "name" | "type" | "override";

export interface RateRow {
  rarity: string;
  /** Which pack position it's in; "Your rate" for ones added by hand. */
  slot: string;
  /** The rate in use: your override, else the published one. null = none, so not counted. */
  perPack: number | null;
  published: number | null;
  overridden: boolean;
  /** How many distinct cards of this rarity are in the pool. */
  cards: number;
  /** Expected sale value of one such card after fees and the bulk cut-off. */
  avgNetCents: number | null;
  /** The most expensive card of this rarity, at its market price. */
  maxMarketCents: number | null;
  /** Set the cards come from, when it isn't this one. */
  poolSetName: string | null;
}

export interface UnmodeledRarity {
  rarity: string;
  cards: number;
  avgMarketCents: number | null;
  maxMarketCents: number | null;
}

export interface RarityContribution {
  rarity: string;
  perPack: number;
  cards: number;
  avgNetCents: number;
  /** Expected value this rarity adds to one opened product. */
  evCents: number;
}

export type Verdict = "open" | "hold" | "toss-up";

export interface SensitivityPoint {
  /** Every hit rate multiplied by this. */
  scale: number;
  evCents: number;
  probBeatsSealed: number | null;
}

export interface AnalysisResult {
  packs: number;
  /** Sealed market price after fees — what holding (and later selling) sealed is worth. */
  sealedNetCents: number | null;
  /** Expected value of opening, after fees and the bulk cut-off. */
  evCents: number;
  hitsEvCents: number;
  bulkEvCents: number;
  byRarity: RarityContribution[];
  /** The 10th / 50th / 90th percentile of what an opened product actually returns. */
  spread: { p10: number; p50: number; p90: number };
  /** Chance an opened product returns more than the sealed value. */
  probBeatsSealed: number | null;
  /** Chance an opened product returns more than the retail price. */
  probBeatsPaid: number | null;
  sensitivity: SensitivityPoint[];
  /** The hit-rate multiplier at which expected value would equal the sealed value. */
  breakEvenScale: number | null;
  verdict: Verdict | null;
}

export interface OpenHoldItemInfo {
  id: string;
  name: string;
  setId: number;
  setName: string;
  setSlug: string;
  externalId: number;
  printing: string;
  marketPriceCents: number | null;
}

export interface OpenHoldDTO {
  item: OpenHoldItemInfo;
  packs: { value: number | null; source: PacksSource | null; note: string | null; defaultValue: number | null };
  /** Sealed market price (TCGplayer market). */
  sealedPriceCents: number | null;
  /** What it costs at retail, for a tracked retail product. */
  retailPriceCents: number | null;
  assumptions: Assumptions;
  profile: { title: string; url: string; published: string; packsOpened: string; notes: string[] } | null;
  rates: RateRow[];
  unmodeled: UnmodeledRarity[];
  result: AnalysisResult | null;
  /** Why there's no result, when there isn't. */
  blockers: string[];
  warnings: string[];
  /** When the cards' prices were last fetched. */
  pricesFetchedAt: string | null;
}

