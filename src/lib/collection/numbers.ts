// Card numbers, the unit set completion and ownership are counted in.
// Client-safe and dependency-free so the smart-alert matcher can share it.

/**
 * The identity of a card within its set: the numerator of its number,
 * lower-cased, with leading zeros dropped when it's all digits.
 *
 *   "025/088" → "25"      "25" → "25"      TCGdex's "025" → "25"
 *   "TG05/TG30" → "tg05"  "R/RGB" → "r"
 *
 * null when there's no number at all (boxes, code cards): such rows aren't cards
 * and can't be owned. The same rule is written in SQL in the migration
 * `…_official_catalog_and_number_ownership`, so the two must stay in step.
 */
export function cardKey(number: string | null | undefined): string | null {
  const numerator = (number ?? "").split("/")[0].trim().toLowerCase();
  if (!numerator) return null;
  return /^\d+$/.test(numerator) ? String(parseInt(numerator, 10)) : numerator;
}

export interface NumberParts {
  /** Letters before the digits, lower-cased: "tg" in "TG05/TG30". */
  prefix: string;
  /** The first run of digits with leading zeros dropped: "25" in "025/088". */
  digits: string;
}

/** Splits "TG05/TG30" → { prefix: "tg", digits: "5" }; null if there are no digits at all. */
export function numberParts(number: string | null | undefined): NumberParts | null {
  const numerator = (number ?? "").split("/")[0].trim().toLowerCase();
  const m = numerator.match(/^([a-z\-\s]*?)0*(\d+)\D*$/);
  if (!m) return null;
  return { prefix: m[1].replace(/[\s-]+/g, ""), digits: m[2] };
}
