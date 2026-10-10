// Set completion, collection value and the pull logger's matching. Pure and
// client-safe.
//
// Unit of completion: a card number, in any printing. A set's cards are one
// entry per number (the official list joined to tcgapi.dev prices — see
// lib/official/join.ts); rows that aren't cards (boxes, code cards) never get here.

import { compareCardNumbers } from "@/lib/sets/setsView";
import { numberParts } from "./numbers";

export interface CollectionCard {
  /** cardKey(number): the identity within the set. */
  key: string;
  /** As printed ("025/088"). */
  number: string;
  name: string;
  imageUrl: string | null;
  rarity: string | null;
  /** The cheapest priced printing's market price: what it's worth, and what finishing it costs. */
  priceCents: number | null;
  lowPriceCents: number | null;
  tcgplayerUrl: string | null;
  /** Copies owned, across printings. */
  owned: number;
  /** In the official card list (false = only tcgapi.dev lists it, e.g. an odd secret-rare numbering). */
  official: boolean;
  /** Which set the card is from, when a list mixes sets (the Pokémon pages). */
  setName?: string | null;
}

/** What the set header shows. Computed on the server and returned with every ownership change. */
export interface SetSummary {
  /** Where the card list came from. */
  source: "official" | "tcgapi";
  totalCards: number;
  /** Distinct card numbers owned. */
  ownedCards: number;
  /** 0–100, one decimal. */
  percent: number;
  copies: number;
  valueCents: number;
  /** Owned copies with no market price (counted as $0 in the value). */
  unpricedOwned: number;
  /** Cheapest way to finish: the sum of each missing card's price. */
  costToCompleteCents: number;
  /** Missing cards with no price (left out of that cost). */
  unpricedMissing: number;
}

export function summarize(cards: CollectionCard[], source: SetSummary["source"]): SetSummary {
  let owned = 0;
  let copies = 0;
  let valueCents = 0;
  let unpricedOwned = 0;
  let costToCompleteCents = 0;
  let unpricedMissing = 0;

  for (const c of cards) {
    const priced = c.priceCents != null && c.priceCents > 0;
    if (c.owned > 0) {
      owned++;
      copies += c.owned;
      if (priced) valueCents += c.owned * (c.priceCents as number);
      else unpricedOwned += c.owned;
    } else if (priced) {
      costToCompleteCents += c.priceCents as number;
    } else {
      unpricedMissing++;
    }
  }

  const total = cards.length;
  return {
    source,
    totalCards: total,
    ownedCards: owned,
    percent: total > 0 ? Math.round((owned / total) * 1000) / 10 : 0,
    copies,
    valueCents,
    unpricedOwned,
    costToCompleteCents,
    unpricedMissing,
  };
}

/** The cards you don't own yet, in card-number order. */
export function missingCards(cards: CollectionCard[]): CollectionCard[] {
  return cards.filter((c) => c.owned <= 0).sort((a, b) => compareCardNumbers(a.number, b.number));
}

/**
 * What a smart alert needs to skip cards you already have: the card keys you own.
 * (Only numbered cards can be owned, and only they can be "missing".)
 */
export interface OwnedContext {
  ownedKeys: ReadonlySet<string>;
}

// --- The pull logger ---

/**
 * Finds the cards a typed entry means. A number ("25", "025", "025/088", "TG05")
 * matches by its numerator, ignoring leading zeros and the "/088"; anything else
 * is a name search where every word must appear. A bare "5" lists 005 before TG05.
 */
export function matchPull(query: string, cards: CollectionCard[], limit = 8): { cards: CollectionCard[]; more: number } {
  const q = query.trim().toLowerCase();
  if (!q) return { cards: [], more: 0 };

  const asNumber = /^[a-z\-\s]{0,6}\d+(\s*\/\s*[a-z\-\s]*\d+)?$/.test(q) ? numberParts(q) : null;
  const words = q.split(/\s+/);

  const matches = cards.filter((c) => {
    if (asNumber) {
      const parts = numberParts(c.number);
      return !!parts && parts.digits === asNumber.digits && (asNumber.prefix === "" || parts.prefix === asNumber.prefix);
    }
    const name = c.name.toLowerCase();
    return words.every((w) => name.includes(w));
  });

  const sorted = matches.sort((a, b) => {
    if (asNumber && asNumber.prefix === "") {
      const pa = numberParts(a.number)?.prefix ? 1 : 0;
      const pb = numberParts(b.number)?.prefix ? 1 : 0;
      if (pa !== pb) return pa - pb;
    }
    return compareCardNumbers(a.number, b.number) || a.name.localeCompare(b.name);
  });
  return { cards: sorted.slice(0, limit), more: Math.max(0, sorted.length - limit) };
}
