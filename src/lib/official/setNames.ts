// Set names disagree between the price data (tcgapi.dev) and the card catalog (TCGdex): accents,
// "ME03:" style codes, "&" versus "and", punctuation. Comparing normalised names lines them up.

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
