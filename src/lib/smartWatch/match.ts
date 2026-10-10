// Pure rule-matching for smart watches. No database, no Prisma imports — the
// service feeds it a set's items and the rows it already knows about, and
// carries out whatever it returns.

import { cardKey } from "@/lib/collection/numbers";

export interface RuleCriteria {
  /** null = cards and sealed products both. */
  kind: "CARD" | "SEALED" | null;
  /** Exact rarity (case-insensitive), or null for any. */
  rarity: string | null;
  /** Text matched against an item's name or card number, like the set page's search box. */
  query: string | null;
  /** Matches when the market price is at or below this. */
  maxPriceCents: number;
  /** Cards only, and only ones whose number you don't own yet (in any printing). */
  onlyMissing?: boolean;
}

/** What you own, so a rule can skip it. Built from the collection (see lib/collection/progress.ts). */
export interface OwnedContext {
  /** Card keys (see lib/collection/numbers.ts) you own at least one copy of. */
  ownedKeys: ReadonlySet<string>;
}

export interface MatchableItem {
  externalId: number;
  printing: string;
  name: string;
  number: string | null;
  rarity: string | null;
  /** What it really is (see lib/sets/classify.ts): a numbered card, a sealed product, or something else. */
  kind: "CARD" | "SEALED" | "OTHER";
  marketPriceCents: number | null;
  tcgplayerId: number | null;
}

/** Identity of one priced item inside a set (the same product can have several printings). */
export function itemKey(item: { externalId: number; printing: string }): string {
  return `${item.externalId}|${item.printing}`;
}

/** Whether you already have this card (any printing). Only numbered cards can be owned. */
function isOwned(item: MatchableItem, owned?: OwnedContext): boolean {
  if (!owned) return false;
  const key = cardKey(item.number);
  return key != null && owned.ownedKeys.has(key);
}

/**
 * The items a rule matches. An item with no price (or a $0 one) never matches:
 * a missing price is an unknown, not a bargain.
 */
export function matchItems<T extends MatchableItem>(rule: RuleCriteria, items: T[], owned?: OwnedContext): T[] {
  const query = rule.query?.trim().toLowerCase() || null;
  const rarity = rule.rarity?.trim().toLowerCase() || null;

  return items.filter((i) => {
    if (i.marketPriceCents == null || i.marketPriceCents <= 0) return false;
    if (i.marketPriceCents > rule.maxPriceCents) return false;
    if (rule.kind && i.kind !== rule.kind) return false;
    if (rule.onlyMissing && (i.kind !== "CARD" || isOwned(i, owned))) return false;
    if (rarity && (i.rarity ?? "").toLowerCase() !== rarity) return false;
    if (query && !i.name.toLowerCase().includes(query) && !(i.number ?? "").toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

/**
 * Compares the matches we already know about with the current ones.
 * - `added`: matching now, not known before → these are what alerts are for.
 * - `removedKeys`: known before, no longer matching (price rose, item gone) →
 *   forgetting them means a later dip alerts again.
 */
export function diffMatches<T extends MatchableItem>(
  knownKeys: Iterable<string>,
  current: T[],
): { added: T[]; removedKeys: string[] } {
  const known = new Set(knownKeys);
  const currentKeys = new Set(current.map(itemKey));
  return {
    added: current.filter((i) => !known.has(itemKey(i))),
    removedKeys: [...known].filter((k) => !currentKeys.has(k)),
  };
}

/** A readable default name for a rule, e.g. "Special Illustration Rare cards ≤ $40.00 in ME: 30th Celebration". */
export function describeRule(rule: RuleCriteria, setName: string): string {
  const what = rule.onlyMissing ? "cards I don't own" : rule.kind === "SEALED" ? "sealed products" : rule.kind === "CARD" ? "cards" : "items";
  const rarity = rule.rarity ? `${rule.rarity} ` : "";
  const query = rule.query?.trim() ? ` matching “${rule.query.trim()}”` : "";
  return `${rarity}${what}${query} ≤ $${(rule.maxPriceCents / 100).toFixed(2)} in ${setName}`;
}
