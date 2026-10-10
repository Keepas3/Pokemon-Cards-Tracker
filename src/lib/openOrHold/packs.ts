// How many booster packs are inside a sealed product. Read from the name when
// it says ("(6 Packs)", "3 Pack Blister"); otherwise a default for the product
// type — only for types whose contents I could source. Anything else is left
// unknown rather than guessed, and the panel asks for the number.
//
// Sources: TCGplayer's "Pitch Black Quick Facts" (seller.tcgplayer.com/blog/
// pitch-black-quick-facts): Booster Box 36 packs, Elite Trainer Box 9, Booster
// Bundle 6, Build & Battle Box 4. TCGplayer's "Buyer's Guide to Pokémon TCG:
// 30th Celebration" (Sep 2026): the Pokémon Center Elite Trainer Box has 11
// packs instead of 9.

import type { PacksSource } from "./types";

export interface PacksGuess {
  packs: number | null;
  source: PacksSource | null;
  /** Why there's no number, or what it was based on. */
  note: string | null;
}

const WORDS: Record<string, number> = { single: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** A pack count the product's own name states, e.g. "(6 Packs)", "3 Pack Blister", "2-Pack Blister". */
export function parsePacksFromName(name: string): number | null {
  const n = fold(name);
  const digits = n.match(/\b(\d{1,3})\s*-?\s*packs?\b/);
  if (digits) {
    const v = Number(digits[1]);
    return v > 0 ? v : null;
  }
  const word = n.match(/\b(single|one|two|three|four|five|six)\s*-?\s*packs?\b/);
  return word ? WORDS[word[1]] : null;
}

/** Cases and displays hold several products; a pack count for them would be a different calculation. */
export function isMultiProduct(name: string): boolean {
  return /\b(case|display|half booster box(es)?)\b/i.test(fold(name));
}

function typeDefault(name: string): { packs: number; label: string } | null {
  const n = fold(name);
  if (/pokemon center elite trainer box/.test(n)) return { packs: 11, label: "Pokémon Center Elite Trainer Box" };
  if (/elite trainer box/.test(n)) return { packs: 9, label: "Elite Trainer Box" };
  if (/booster box/.test(n)) return { packs: 36, label: "Booster Box" };
  if (/booster bundle/.test(n)) return { packs: 6, label: "Booster Bundle" };
  if (/build (and|&) battle box/.test(n)) return { packs: 4, label: "Build & Battle Box" };
  // A bare booster pack (sleeved or not) — but not "Booster Pack Art Bundle", "3 Pack Blister", etc.
  if (/(^|\s)(sleeved )?booster pack$/.test(n)) return { packs: 1, label: "Booster Pack" };
  return null;
}

/**
 * The pack count to use for a sealed product: your override, else the number in
 * a name (a retail listing and its market row can each state one), else the
 * type default of the first name that has one.
 */
export function guessPacks(nameOrNames: string | string[], override?: number | null): PacksGuess {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
  if (override != null && override > 0) return { packs: override, source: "override", note: "set by you" };
  if (names.some(isMultiProduct)) {
    return {
      packs: null,
      source: null,
      note: "This is a case or display of several products — pick a single product, or enter its total packs yourself.",
    };
  }
  for (const name of names) {
    const fromName = parsePacksFromName(name);
    if (fromName) return { packs: fromName, source: "name", note: "from the product name" };
  }
  for (const name of names) {
    const def = typeDefault(name);
    if (def) return { packs: def.packs, source: "type", note: `standard for the ${def.label}` };
  }
  return { packs: null, source: null, note: "Couldn't tell how many packs this contains — enter it." };
}
