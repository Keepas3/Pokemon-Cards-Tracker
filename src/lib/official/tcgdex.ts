// TCGdex (tcgdex.dev) as the official catalog: free, no key, community-run.
//   GET /v2/en/series            → every series
//   GET /v2/en/series/{id}       → that series' sets, with logo, symbol and card counts
//   GET /v2/en/sets/{id}         → one set: release date, series, and its full card list
// Card art is `{image}/low.webp`; logo and symbol URLs have no extension and need `.png`.

import type { OfficialCardInfo, OfficialCatalog, OfficialSetInfo } from "./types";

const BASE = process.env.TCGDEX_BASE_URL ?? "https://api.tcgdex.net/v2/en";
const TIMEOUT_MS = 15_000;
/** TCG Pocket is a phone game; none of its sets exist as cards or products. */
const SKIP_SERIES = new Set(["tcgp"]);

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

const withExt = (url: unknown, ext: string) => {
  const s = str(url);
  return s ? (/\.[a-z]{3,4}$/i.test(s) ? s : `${s}.${ext}`) : null;
};

// --- Pure parsers (tested against trimmed real responses) ---

/** The ids of the series worth listing. */
export function parseSeriesList(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((s) => (isObj(s) ? str(s.id) : null))
    .filter((id): id is string => id != null && !SKIP_SERIES.has(id));
}

function parseSetBrief(raw: unknown, seriesId: string, seriesName: string): OfficialSetInfo | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const counts = isObj(raw.cardCount) ? raw.cardCount : {};
  const total = int(counts.total);
  return {
    id,
    name,
    seriesId,
    seriesName,
    releaseDate: null,
    logoUrl: withExt(raw.logo, "png"),
    symbolUrl: withExt(raw.symbol, "png"),
    totalCards: total,
    officialCards: int(counts.official) || total,
  };
}

/** One series' sets (without release dates — those live on each set's own page). */
export function parseSeries(json: unknown): OfficialSetInfo[] {
  if (!isObj(json)) return [];
  const id = str(json.id);
  if (!id || SKIP_SERIES.has(id)) return [];
  const name = str(json.name) ?? id;
  const sets = Array.isArray(json.sets) ? json.sets : [];
  return sets.map((s) => parseSetBrief(s, id, name)).filter((s): s is OfficialSetInfo => s != null);
}

/** A set's own page: release date plus the whole card list, in print order, de-duplicated by localId. */
export function parseSetDetail(json: unknown): { set: OfficialSetInfo; cards: OfficialCardInfo[] } | null {
  if (!isObj(json)) return null;
  const serie = isObj(json.serie) ? json.serie : {};
  const set = parseSetBrief(json, str(serie.id) ?? "", str(serie.name) ?? "");
  if (!set) return null;
  const date = str(json.releaseDate);
  set.releaseDate = date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null;

  const seen = new Set<string>();
  const cards: OfficialCardInfo[] = [];
  for (const raw of Array.isArray(json.cards) ? json.cards : []) {
    if (!isObj(raw)) continue;
    const localId = str(raw.localId);
    const name = str(raw.name);
    if (!localId || !name || seen.has(localId)) continue;
    seen.add(localId);
    const image = str(raw.image);
    cards.push({ localId, name, imageUrl: image ? `${image}/low.webp` : null });
  }
  if (set.totalCards === 0) set.totalCards = cards.length;
  return { set, cards };
}

// --- The adapter ---

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`TCGdex returned ${res.status} for ${path}`);
  return res.json();
}

/** Every card that shows one Pokémon (by Pokédex number), across all sets: { name, cards: [{ id, localId, name, image? }] }. */
export async function getDexCardsJson(dexId: number): Promise<unknown> {
  return getJson(`/dex-ids/${Math.trunc(dexId)}`);
}

export const tcgdex: OfficialCatalog = {
  async listSets() {
    const ids = parseSeriesList(await getJson("/series"));
    const out: OfficialSetInfo[] = [];
    // A few at a time: polite to a free community service, still quick.
    for (let i = 0; i < ids.length; i += 4) {
      const batch = await Promise.all(ids.slice(i, i + 4).map((id) => getJson(`/series/${encodeURIComponent(id)}`)));
      for (const json of batch) out.push(...parseSeries(json));
    }
    return out;
  },

  async getSet(id) {
    const parsed = parseSetDetail(await getJson(`/sets/${encodeURIComponent(id)}`));
    if (!parsed) throw new Error(`TCGdex returned an unreadable set for ${id}`);
    return parsed;
  },
};
