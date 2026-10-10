// The morning digest's data shape. Dates are ISO strings so the same object
// can go straight out of an API route to the Today page.

export interface CardMove {
  cardName: string;
  setName: string;
  fromCents: number;
  toCents: number;
  /** The watchlist alert threshold, if one is set. */
  thresholdCents: number | null;
}

export interface SmartAlertGroup {
  watchName: string;
  setName: string;
  items: { name: string; priceCents: number; url: string }[];
}

/** A deal on a card the person is missing, for the Discord digest. */
export interface DigestDeal {
  setId: number;
  key: string;
  name: string;
  setName: string;
  number: string | null;
  lowCents: number;
  marketCents: number;
  /** 0–1. */
  savingsPct: number;
  suspicious: boolean;
  url: string;
}

export interface Digest {
  since: string;
  until: string;
  cardMoves: CardMove[];
  smartAlerts: SmartAlertGroup[];
  /** New deals on cards you're missing. Empty when the digest is built just to show the Today page. */
  deals: DigestDeal[];
}

export function digestIsEmpty(d: Digest): boolean {
  return d.cardMoves.length === 0 && d.smartAlerts.length === 0 && d.deals.length === 0;
}
