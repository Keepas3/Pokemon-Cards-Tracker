import { SetItemKind } from "@/generated/prisma/client";
import { tcgApiFetch } from "@/lib/tcgapiDev/client";
import { toCents } from "@/lib/cardPricing/types";
import { MAX_SET_ROWS } from "./setsView";

// Set/collection data from tcgapi.dev (TCGplayer's own groups). Shapes below
// come from live responses, not guesses: GET /v1/sets and GET /v1/sets/:id/cards
// both return `{ data, meta: { total, page, per_page, has_more }, rate_limit }`
// with up to 100 rows per page on the free tier.

const PAGE_SIZE = 100;
// Hard caps so a surprising `has_more` can never turn into an unbounded loop
// against a 100-requests/day budget.
const MAX_SET_PAGES = 5; // 500 sets; Pokémon has ~234
const MAX_ITEM_PAGES = Math.ceil(MAX_SET_ROWS / PAGE_SIZE); // 10 pages = 1,000 rows in one set

interface RawSet {
  id: number;
  name: string;
  slug?: string;
  release_date?: string | null;
  card_count?: number | null;
  set_icon_url?: string | null;
  image_url?: string | null;
}

interface RawItem {
  id: number;
  name: string;
  number?: string | null;
  rarity?: string | null;
  tcgplayer_id?: number | null;
  product_type?: string | null;
  printing?: string | null;
  market_price?: number | null;
  low_price?: number | null;
  image_url?: string | null;
  price_updated_at?: string | null;
}

interface Paged<T> {
  data?: T[];
  meta?: { has_more?: boolean };
}

export interface ParsedSet {
  id: number;
  name: string;
  slug: string;
  releaseDate: Date | null;
  cardCount: number;
  iconUrl: string | null;
  imageUrl: string | null;
}

export interface ParsedItem {
  externalId: number;
  tcgplayerId: number | null;
  name: string;
  number: string | null;
  rarity: string | null;
  kind: SetItemKind;
  printing: string;
  marketPriceCents: number | null;
  lowPriceCents: number | null;
  imageUrl: string | null;
  priceUpdatedAt: Date | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseSets(rows: RawSet[]): ParsedSet[] {
  const seenSlugs = new Set<string>();
  const parsed: ParsedSet[] = [];
  for (const row of rows) {
    if (typeof row.id !== "number" || !row.name) continue;
    // Slugs are the URL key, so they must be unique — suffix the id on a clash.
    let slug = row.slug || slugify(row.name) || String(row.id);
    if (seenSlugs.has(slug)) slug = `${slug}-${row.id}`;
    seenSlugs.add(slug);
    parsed.push({
      id: row.id,
      name: row.name,
      slug,
      releaseDate: parseDate(row.release_date),
      cardCount: row.card_count ?? 0,
      iconUrl: row.set_icon_url ?? null,
      imageUrl: row.image_url ?? null,
    });
  }
  return parsed;
}

/** Maps tcgapi.dev's `product_type` onto the two kinds we show; anything else is skipped. */
export function kindFromProductType(productType: string | null | undefined): SetItemKind | null {
  if (!productType) return null;
  if (/sealed/i.test(productType)) return SetItemKind.SEALED;
  if (/^card/i.test(productType)) return SetItemKind.CARD;
  return null;
}

export function parseItems(rows: RawItem[]): ParsedItem[] {
  const seen = new Set<string>();
  const parsed: ParsedItem[] = [];
  for (const row of rows) {
    const kind = kindFromProductType(row.product_type);
    if (typeof row.id !== "number" || !row.name || !kind) continue;
    const printing = row.printing ?? "";
    // Pagination can repeat a row across pages; the DB key is (set, id, printing).
    const key = `${row.id}|${printing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push({
      externalId: row.id,
      tcgplayerId: row.tcgplayer_id ?? null,
      name: row.name,
      number: row.number ?? null,
      rarity: row.rarity ?? null,
      kind,
      printing,
      marketPriceCents: toCents(row.market_price),
      lowPriceCents: toCents(row.low_price),
      imageUrl: row.image_url ?? null,
      priceUpdatedAt: parseDate(row.price_updated_at),
    });
  }
  return parsed;
}

export type FetchSetsResult = { ok: true; sets: ParsedSet[] } | { ok: false; error: string };
export type FetchItemsResult = { ok: true; items: ParsedItem[]; requests: number } | { ok: false; error: string };

/** Every Pokémon set — about 3 requests at 100 per page. */
export async function fetchAllSets(): Promise<FetchSetsResult> {
  const rows: RawSet[] = [];
  for (let page = 1; page <= MAX_SET_PAGES; page++) {
    const params = new URLSearchParams({ game: "pokemon", per_page: String(PAGE_SIZE), page: String(page) });
    const result = await tcgApiFetch<Paged<RawSet>>(`/sets?${params.toString()}`);
    if (!result.ok) return result;
    rows.push(...(result.json.data ?? []));
    if (!result.json.meta?.has_more) break;
  }
  return { ok: true, sets: parseSets(rows) };
}

/** Every card and sealed product in one set — one request per 100 rows. */
export async function fetchSetItems(setId: number): Promise<FetchItemsResult> {
  const rows: RawItem[] = [];
  let requests = 0;
  for (let page = 1; page <= MAX_ITEM_PAGES; page++) {
    const params = new URLSearchParams({ per_page: String(PAGE_SIZE), page: String(page) });
    const result = await tcgApiFetch<Paged<RawItem>>(`/sets/${setId}/cards?${params.toString()}`);
    requests++;
    if (!result.ok) return result;
    rows.push(...(result.json.data ?? []));
    if (!result.json.meta?.has_more) break;
  }
  return { ok: true, items: parseItems(rows), requests };
}
