// Reading TCGdex's per-Pokémon card list (GET /v2/en/dex-ids/{n}): every card that shows that
// Pokémon, across all sets. Each entry is { id: "<set>-<localId>", localId, name, image? }.
// Pure and tolerant — a malformed entry is skipped, not fatal.

import { cardKey } from "@/lib/collection/numbers";

export interface DexCard {
  /** TCGdex's card id, e.g. "swsh12.5gg-GG01". */
  id: string;
  /** TCGdex's set id, e.g. "swsh12.5gg". */
  setId: string;
  /** The number within the set as TCGdex prints it, e.g. "025" or "GG01". */
  localId: string;
  /** cardKey(localId): the identity of the card within its set, the same one ownership uses. */
  numberKey: string;
  name: string;
  imageUrl: string | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The set part of a card id: "swsh12.5gg-GG01" with local id "GG01" → "swsh12.5gg" (set ids can contain dashes). */
export function setIdOf(id: string, localId: string): string | null {
  const suffix = `-${localId}`;
  return id.length > suffix.length && id.endsWith(suffix) ? id.slice(0, id.length - suffix.length) : null;
}

/** Accepts the whole response ({ cards: [...] }) or just the list, and returns each distinct card once. */
export function parseDexCards(json: unknown): DexCard[] {
  const list = Array.isArray(json) ? json : isObj(json) && Array.isArray(json.cards) ? json.cards : [];
  const seen = new Set<string>();
  const out: DexCard[] = [];

  for (const raw of list) {
    if (!isObj(raw)) continue;
    const id = str(raw.id);
    const localId = str(raw.localId);
    const name = str(raw.name);
    if (!id || !localId || !name || seen.has(id)) continue;
    const setId = setIdOf(id, localId);
    const numberKey = cardKey(localId);
    if (!setId || !numberKey) continue;
    seen.add(id);
    const image = str(raw.image);
    out.push({ id, setId, localId, numberKey, name, imageUrl: image ? `${image}/low.webp` : null });
  }
  return out;
}
