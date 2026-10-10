// Linking a retail product ("Pokémon TCG: 30th Celebration Booster Bundle (6
// Packs)") to its row in the market data ("30th Celebration Booster Bundle").
// Names disagree on accents, "Pokémon TCG:" prefixes, punctuation and set
// codes, so both sides are normalised and compared by what kind of product it
// is and how many words they share. A proposal, never a certainty: the user
// can pick a different row.

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** "ME03: Perfect Order" → "perfect order"; "SV: Scarlet & Violet 151" → "scarlet and violet 151". */
export function normalizeSetName(name: string): string {
  return fold(name)
    .replace(/&/g, " and ")
    .replace(/^(me|mee|sv|svp|swsh|sm|xy|bw|hgss|dp|pl|ex|pop)\d*\s*[:\-]\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP = new Set(["pokemon", "tcg", "the", "and", "of", "a", "an", "packs", "pack"]);

function tokens(s: string): string[] {
  return fold(s)
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ") // "(6 Packs)"
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}

function dice(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bs = new Set(b);
  const shared = new Set(a.filter((t) => bs.has(t))).size;
  return (2 * shared) / (new Set(a).size + new Set(b).size);
}

/** The set (by name) a retail product belongs to: an exact normalised match, else the closest by shared words. */
export function matchSet<T extends { name: string }>(productSetName: string, sets: T[]): T | null {
  const want = normalizeSetName(productSetName);
  if (!want) return null;
  const exact = sets.find((s) => normalizeSetName(s.name) === want);
  if (exact) return exact;

  let best: { set: T; score: number } | null = null;
  for (const s of sets) {
    const score = dice(want.split(" "), normalizeSetName(s.name).split(" "));
    if (!best || score > best.score) best = { set: s, score };
  }
  return best && best.score >= 0.8 ? best.set : null;
}

export type ProductKind =
  | "pokemon-center-etb"
  | "etb"
  | "booster-box"
  | "booster-bundle"
  | "booster-pack"
  | "build-and-battle"
  | "blister"
  | "tin"
  | "case"
  | "other";

/** What sort of product a name describes — products only match products of the same sort. */
export function productKind(name: string): ProductKind {
  const n = fold(name).replace(/&/g, " and ").replace(/\s+/g, " ");
  if (/\b(case|display|half booster box(es)?)\b/.test(n)) return "case";
  if (/pokemon center elite trainer box/.test(n)) return "pokemon-center-etb";
  if (/elite trainer box/.test(n)) return "etb";
  if (/booster box/.test(n)) return "booster-box";
  if (/booster bundle/.test(n)) return "booster-bundle";
  if (/build and battle/.test(n)) return "build-and-battle";
  if (/blister/.test(n)) return "blister";
  if (/\btin\b/.test(n)) return "tin";
  if (/booster pack/.test(n)) return "booster-pack";
  return "other";
}

export interface SealedCandidate {
  externalId: number;
  printing: string;
  name: string;
}

/**
 * The sealed row that best matches a product name, among a set's sealed rows.
 * Needs the same product kind and a clear lead over the runner-up.
 */
export function matchSealed<T extends SealedCandidate>(
  productName: string,
  candidates: T[],
): { item: T; score: number } | null {
  const kind = productKind(productName);
  if (kind === "other" || kind === "case") return null;

  const want = tokens(productName);
  const scored = candidates
    .filter((c) => productKind(c.name) === kind)
    .map((c) => ({ item: c, score: dice(want, tokens(c.name)) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.5) return null;
  // Two near-identical candidates (e.g. a set with two blister designs): don't pick one for the user.
  if (scored[1] && best.score - scored[1].score < 0.1) return null;
  return best;
}
