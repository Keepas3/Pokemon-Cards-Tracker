import type { Deal } from "./compute";

/** A deal as the pages show it: the card, where it's from, and what you already have of that set. */
export interface DealDTO extends Deal {
  setName: string;
  /** Collection page of the set. */
  setSlug: string;
  /** Different cards you own in this set. */
  ownedInSet: number;
}

export type DealScope = "mine" | "all";

export interface DealsPayload {
  scope: DealScope;
  deals: DealDTO[];
  /** How many deals there were before the list was cut to its limit. */
  found: number;
  /** How many sets had saved prices to look at. */
  setsConsidered: number;
  /** The oldest price among the deals shown, so the page can say how fresh they are. */
  pricesAsOf: string | null;
  /** Why a list is empty when it's not simply that nothing is cheap right now. */
  note: string | null;
}
