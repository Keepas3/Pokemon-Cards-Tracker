// Pairing our tcgapi.dev sets with the official catalog's sets. tcgapi names carry
// a code prefix ("ME03: Perfect Order") and the catalog doesn't ("Perfect Order");
// a handful differ more than that and are listed in aliases.ts. A wrong pairing
// is worse than none (it would show another set's card list), so every rule here
// is conservative and one-to-one.

import { normalizeSetName } from "@/lib/openOrHold/matching";
import { SET_ALIASES } from "./aliases";
import type { OfficialSetInfo } from "./types";

export interface OurSet {
  id: number;
  slug: string;
  name: string;
}

/** Our names carry a series word the catalog leaves off the old EX sets: "EX Power Keepers" is "Power Keepers". */
const matchName = (name: string) => normalizeSetName(name).replace(/^ex /, "");
const tokens = (name: string) => matchName(name).split(" ").filter(Boolean);

function dice(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bs = new Set(b);
  const shared = new Set(a.filter((t) => bs.has(t))).size;
  return (2 * shared) / (new Set(a).size + new Set(b).size);
}

/** True when either name has a word containing a digit ("151", "2023", "30th") the other lacks. */
function numberMismatch(a: string[], b: string[]): boolean {
  const digits = (ts: string[]) => ts.filter((t) => /\d/.test(t));
  const as = new Set(a);
  const bs = new Set(b);
  return digits(a).some((t) => !bs.has(t)) || digits(b).some((t) => !as.has(t));
}

/**
 * Our set id → official set id. Rules, in order, each only using official sets
 * not already taken:
 *   1. an alias for our set's slug;
 *   2. the same normalised name, when exactly one official set has it;
 *   3. a near-identical name (word overlap ≥ 0.85) that is clearly the best candidate.
 */
export function matchSets(
  ours: OurSet[],
  theirs: OfficialSetInfo[],
  aliases: Record<string, string> = SET_ALIASES,
): Map<number, string> {
  const byId = new Map(theirs.map((s) => [s.id, s]));
  const taken = new Set<string>();
  const result = new Map<number, string>();

  // 1. Aliases win: they were checked by hand.
  for (const o of ours) {
    const id = aliases[o.slug];
    if (id && byId.has(id) && !taken.has(id)) {
      result.set(o.id, id);
      taken.add(id);
    }
  }

  // 2. Exact normalised name, only when unambiguous on both sides. Tried twice: first with the
  //    names as they are, then with the "EX " prefix dropped. tcgapi.dev lists some sets under
  //    both names ("Power Keepers" and "EX Power Keepers", same cards); the plain name pairs with
  //    the catalog's set first, and the prefixed duplicate is then left alone instead of making
  //    both ambiguous.
  const byName = (keyOf: (name: string) => string) => {
    const theirsByName = new Map<string, OfficialSetInfo[]>();
    for (const t of theirs) {
      const k = keyOf(t.name);
      theirsByName.set(k, [...(theirsByName.get(k) ?? []), t]);
    }
    const oursByName = new Map<string, OurSet[]>();
    for (const o of ours) {
      if (result.has(o.id)) continue;
      const k = keyOf(o.name);
      oursByName.set(k, [...(oursByName.get(k) ?? []), o]);
    }
    for (const [name, mine] of oursByName) {
      const candidates = (theirsByName.get(name) ?? []).filter((t) => !taken.has(t.id));
      if (mine.length === 1 && candidates.length === 1) {
        result.set(mine[0].id, candidates[0].id);
        taken.add(candidates[0].id);
      }
    }
  };
  byName(normalizeSetName);
  byName(matchName);

  const theirsByName = new Map<string, OfficialSetInfo[]>();
  for (const t of theirs) {
    const k = matchName(t.name);
    theirsByName.set(k, [...(theirsByName.get(k) ?? []), t]);
  }
  const oursByName = new Map<string, OurSet[]>();
  for (const o of ours) {
    const k = matchName(o.name);
    oursByName.set(k, [...(oursByName.get(k) ?? []), o]);
  }

  // 3. Near-identical names ("… Black Star Promos" vs "… Promos"), best candidate must stand clear.
  //    Never when the exact name exists but was ambiguous (twins), and never across a number
  //    that only one side has: "Scarlet & Violet 151" is not "Scarlet & Violet".
  for (const o of ours) {
    if (result.has(o.id)) continue;
    const key = matchName(o.name);
    if (theirsByName.has(key) || (oursByName.get(key)?.length ?? 0) > 1) continue;
    const mine = tokens(o.name);
    const scored = theirs
      .filter((t) => !taken.has(t.id) && !numberMismatch(mine, tokens(t.name)))
      .map((t) => ({ t, score: dice(mine, tokens(t.name)) }))
      .sort((a, b) => b.score - a.score);
    const [best, second] = scored;
    if (best && best.score >= 0.85 && (!second || best.score - second.score >= 0.1)) {
      result.set(o.id, best.t.id);
      taken.add(best.t.id);
    }
  }
  return result;
}
