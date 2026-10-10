// "Deals on cards you're missing": a card whose lowest listing on TCGplayer is well under its market
// price. Pure — the service feeds it rows from the database, and the thresholds are plain numbers.
//
// The lowest listing is the cheapest copy for sale in any condition, so a deal is a lead worth a
// look, not a promise: the page says so, and an extreme gap is flagged as probably damaged or a typo.

export interface DealCandidate {
  setId: number;
  /** cardKey(number): the card's identity within its set. */
  key: string;
  name: string;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  tcgplayerUrl: string;
  /** Market price of this printing, in cents. */
  marketCents: number;
  /** Lowest listing of this printing, in cents. */
  lowCents: number;
  priceUpdatedAt: string | null;
}

export interface Deal extends DealCandidate {
  savingsCents: number;
  /** 0–1: the share of the market price you'd save. */
  savingsPct: number;
  /** A gap this big is more often a damaged copy or a mistake than a bargain. */
  suspicious: boolean;
}

export interface DealThresholds {
  /** Smallest discount, 0–1. */
  minPct: number;
  /** Smallest saving worth mentioning, in cents. */
  minSavingsCents: number;
}

export const DEFAULT_THRESHOLDS: DealThresholds = { minPct: 0.25, minSavingsCents: 200 };

/** Above this share off, the listing is flagged as unusually low. */
export const SUSPICIOUS_PCT = 0.7;

/** The deal in a candidate, or null if it isn't one (not cheaper enough, no real prices). */
export function dealOf(c: DealCandidate, t: DealThresholds = DEFAULT_THRESHOLDS): Deal | null {
  if (!(c.marketCents > 0) || !(c.lowCents > 0) || c.lowCents >= c.marketCents) return null;
  const savingsCents = c.marketCents - c.lowCents;
  const savingsPct = savingsCents / c.marketCents;
  if (savingsPct < t.minPct || savingsCents < t.minSavingsCents) return null;
  return { ...c, savingsCents, savingsPct, suspicious: savingsPct >= SUSPICIOUS_PCT };
}

/**
 * A card has several printings with their own prices, but you only need one: keep the printing
 * with the biggest saving for each card.
 */
export function bestPerCard(candidates: DealCandidate[]): DealCandidate[] {
  const best = new Map<string, DealCandidate>();
  for (const c of candidates) {
    const k = `${c.setId}|${c.key}`;
    const current = best.get(k);
    if (!current || c.marketCents - c.lowCents > current.marketCents - current.lowCents) best.set(k, c);
  }
  return [...best.values()];
}

/**
 * Biggest saving first, with a nudge for sets you've already started: those are the ones you're
 * actually trying to finish, so a $5 saving there outranks a $6 saving in a set you haven't touched.
 * Listings flagged as suspiciously low go after all the believable ones: on real prices the very
 * biggest "savings" are nearly always a damaged copy, a mislabeled card or a typo, and they'd bury
 * the real finds if ranked by dollars.
 */
export function rankDeals(deals: Deal[], ownedInSet: ReadonlyMap<number, number>): Deal[] {
  const weight = (d: Deal) => d.savingsCents * ((ownedInSet.get(d.setId) ?? 0) > 0 ? 1.25 : 1);
  return [...deals].sort(
    (a, b) =>
      Number(a.suspicious) - Number(b.suspicious) ||
      weight(b) - weight(a) ||
      b.savingsPct - a.savingsPct ||
      a.name.localeCompare(b.name),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Someone who was told about a deal hears about it again if it got this much cheaper… */
const CHEAPER_BY = 0.9;
/** …or if this long has passed and it's still there. */
const REMIND_AFTER_MS = 14 * DAY_MS;

/** Whether a deal is worth mentioning to someone, given what they were last told about it. */
export function isNewDeal(
  previous: { lowCents: number; noticedAt: Date } | undefined,
  deal: Pick<Deal, "lowCents">,
  now: Date = new Date(),
): boolean {
  if (!previous) return true;
  if (deal.lowCents <= previous.lowCents * CHEAPER_BY) return true;
  return now.getTime() - previous.noticedAt.getTime() > REMIND_AFTER_MS;
}
