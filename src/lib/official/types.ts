// The "official catalog": which sets exist, how they group into series, and the
// complete card list of each. tcgapi.dev stays the source of prices; this answers
// "what cards are in this set". TCGdex is the adapter today (free, no key); the
// interface is the seam for another source such as Scrydex (paid: an X-Api-Key and
// X-Team-ID header; its expansion fields map straight onto OfficialSetInfo —
// series, logo, symbol, total, printed_total, release_date).

export interface OfficialSetInfo {
  /** The catalog's own id, e.g. "me03". */
  id: string;
  name: string;
  seriesId: string;
  seriesName: string;
  /** ISO date (YYYY-MM-DD) when known. The series listing doesn't carry it; a set's own page does. */
  releaseDate: string | null;
  logoUrl: string | null;
  symbolUrl: string | null;
  /** Cards including secret rares. */
  totalCards: number;
  /** The printed count (the 88 in 025/088). */
  officialCards: number;
}

export interface OfficialCardInfo {
  /** As printed: "001", "TG05". */
  localId: string;
  name: string;
  imageUrl: string | null;
}

export interface OfficialCatalog {
  /** Every set, with series, logo and counts. */
  listSets(): Promise<OfficialSetInfo[]>;
  /** One set's details and its full card list in print order. */
  getSet(id: string): Promise<{ set: OfficialSetInfo; cards: OfficialCardInfo[] }>;
}
