// The official catalog against the database: refresh the set index (series, logos,
// counts) weekly, link each of our tcgapi.dev sets to its official set, and cache a
// set's full card list the first time it's needed. No API key and no shared request
// budget with tcgapi.dev — TCGdex is free — but it's a community service, so
// everything is cached and fetched one set at a time. If it's down, callers get an
// error string and carry on with tcgapi.dev data alone.

import { prisma } from "@/lib/prisma";
import type { OfficialSet } from "@/generated/prisma/client";
import { cardKey } from "@/lib/collection/numbers";
import { matchSets } from "./match";
import { tcgdex } from "./tcgdex";
import type { OfficialCatalog } from "./types";
import type { OfficialCardRow } from "./join";

const DAY_MS = 24 * 60 * 60 * 1000;
const INDEX_TTL_MS = 7 * DAY_MS;
const CARDS_TTL_MS = 30 * DAY_MS;
// A newly released set can still gain cards (secret rares), so it's re-checked sooner.
const YOUNG_SET_MS = 30 * DAY_MS;
const YOUNG_CARDS_TTL_MS = 2 * DAY_MS;
const CHUNK = 100;

// Concurrent callers share one in-flight fetch (a page with two tabs open, or a
// gallery and a set page loading together, must not double the requests).
const inflight = globalThis as unknown as { __officialInflight?: Map<string, Promise<unknown>> };
function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const map = (inflight.__officialInflight ??= new Map());
  const existing = map.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => map.delete(key));
  map.set(key, p);
  return p;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Pairs any still-unlinked tcgapi.dev sets with official sets (see match.ts). Existing links are kept. */
export async function linkSets(): Promise<number> {
  const [ours, theirs] = await Promise.all([
    prisma.cardSet.findMany({ where: { official: { is: null } }, select: { id: true, slug: true, name: true } }),
    prisma.officialSet.findMany({ where: { cardSetId: null } }),
  ]);
  if (ours.length === 0 || theirs.length === 0) return 0;
  const pairs = matchSets(ours, theirs.map((t) => ({ ...t, releaseDate: t.releaseDate?.toISOString().slice(0, 10) ?? null })));
  for (const [cardSetId, officialId] of pairs) {
    await prisma.officialSet.update({ where: { id: officialId }, data: { cardSetId } });
  }
  return pairs.size;
}

/**
 * Makes sure the set index exists and is under a week old, then links our sets.
 * Returns an error message when it couldn't refresh (whatever was cached still works).
 */
export async function ensureOfficialIndex(
  opts: { force?: boolean; catalog?: OfficialCatalog; now?: Date } = {},
): Promise<string | null> {
  const now = opts.now ?? new Date();
  const catalog = opts.catalog ?? tcgdex;

  const oldest = await prisma.officialSet.aggregate({ _min: { fetchedAt: true }, _count: true });
  const fresh = oldest._count > 0 && oldest._min.fetchedAt != null && now.getTime() - oldest._min.fetchedAt.getTime() < INDEX_TTL_MS;
  if (fresh && !opts.force) {
    // New tcgapi.dev sets can appear between refreshes; try to link them, but not on every page view.
    const g = globalThis as unknown as { __officialLinkedAt?: number };
    if (!g.__officialLinkedAt || now.getTime() - g.__officialLinkedAt > 10 * 60 * 1000) {
      g.__officialLinkedAt = now.getTime();
      await linkSets();
    }
    return null;
  }

  return dedupe("index", async () => {
    try {
      const sets = await catalog.listSets();
      if (sets.length === 0) return "The official catalog returned no sets.";
      for (const group of chunks(sets, 50)) {
        await prisma.$transaction(
          group.map((s) =>
            prisma.officialSet.upsert({
              where: { id: s.id },
              create: {
                id: s.id,
                name: s.name,
                seriesId: s.seriesId,
                seriesName: s.seriesName,
                logoUrl: s.logoUrl,
                symbolUrl: s.symbolUrl,
                totalCards: s.totalCards,
                officialCards: s.officialCards,
                fetchedAt: now,
              },
              // Keep the release date, link and card-list timestamp already learned.
              update: {
                name: s.name,
                seriesId: s.seriesId,
                seriesName: s.seriesName,
                // Logos never change, so one that was saved is kept even if the catalog stops listing it.
                ...(s.logoUrl ? { logoUrl: s.logoUrl } : {}),
                ...(s.symbolUrl ? { symbolUrl: s.symbolUrl } : {}),
                totalCards: s.totalCards,
                officialCards: s.officialCards,
                fetchedAt: now,
              },
            }),
          ),
        );
      }
      await linkSets();
      return null;
    } catch (err) {
      return `Couldn't reach the card catalog: ${message(err)}`;
    }
  });
}

function cardsAreFresh(set: Pick<OfficialSet, "cardsFetchedAt" | "releaseDate">, now: Date): boolean {
  if (!set.cardsFetchedAt) return false;
  const age = now.getTime() - set.cardsFetchedAt.getTime();
  const young = set.releaseDate != null && now.getTime() - set.releaseDate.getTime() < YOUNG_SET_MS;
  return age < (young ? YOUNG_CARDS_TTL_MS : CARDS_TTL_MS);
}

/** Fetches (if stale) and stores one official set's card list. Returns an error message, or null. */
export async function ensureOfficialCards(
  officialSetId: string,
  opts: { catalog?: OfficialCatalog; now?: Date } = {},
): Promise<string | null> {
  const now = opts.now ?? new Date();
  const catalog = opts.catalog ?? tcgdex;
  const set = await prisma.officialSet.findUnique({ where: { id: officialSetId } });
  if (!set) return "That set isn't in the card catalog.";
  if (cardsAreFresh(set, now)) return null;

  return dedupe(`cards:${officialSetId}`, async () => {
    try {
      const { set: detail, cards } = await catalog.getSet(officialSetId);
      const rows = cards
        .map((c, position) => ({ key: cardKey(c.localId), c, position }))
        .filter((r): r is { key: string; c: (typeof cards)[number]; position: number } => r.key != null);
      const seen = new Set<string>();
      const unique = rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));

      await prisma.$transaction([
        prisma.officialCard.deleteMany({ where: { officialSetId } }),
        ...chunks(unique).map((group) =>
          prisma.officialCard.createMany({
            data: group.map((r) => ({
              officialSetId,
              numberKey: r.key,
              localId: r.c.localId,
              name: r.c.name,
              imageUrl: r.c.imageUrl,
              position: r.position,
            })),
          }),
        ),
        prisma.officialSet.update({
          where: { id: officialSetId },
          data: {
            releaseDate: detail.releaseDate ? new Date(`${detail.releaseDate}T00:00:00.000Z`) : set.releaseDate,
            totalCards: unique.length || detail.totalCards,
            officialCards: detail.officialCards || set.officialCards,
            logoUrl: detail.logoUrl ?? set.logoUrl,
            symbolUrl: detail.symbolUrl ?? set.symbolUrl,
            cardsFetchedAt: now,
          },
        }),
      ]);
      return null;
    } catch (err) {
      return `Couldn't load this set's card list: ${message(err)}`;
    }
  });
}

export interface OfficialForSet {
  officialSet: OfficialSet | null;
  /** The cached card list in print order; null when there's none (no match, or never fetched). */
  rows: OfficialCardRow[] | null;
  error: string | null;
}

/**
 * The official card list for one of our sets. With `fetch`, loads whatever is
 * missing or stale first (index, then this set's cards); without it, only reads
 * the cache — for pages that must not wait on the network.
 */
export async function officialForSet(cardSetId: number, opts: { fetch: boolean }): Promise<OfficialForSet> {
  let error: string | null = null;
  let officialSet = await prisma.officialSet.findUnique({ where: { cardSetId } });

  if (!officialSet && opts.fetch) {
    error = await ensureOfficialIndex();
    officialSet = await prisma.officialSet.findUnique({ where: { cardSetId } });
  }
  if (!officialSet) return { officialSet: null, rows: null, error };

  if (opts.fetch) {
    error = (await ensureOfficialCards(officialSet.id)) ?? error;
    officialSet = (await prisma.officialSet.findUnique({ where: { id: officialSet.id } })) ?? officialSet;
  }
  if (!officialSet.cardsFetchedAt) return { officialSet, rows: null, error };

  const cards = await prisma.officialCard.findMany({ where: { officialSetId: officialSet.id }, orderBy: { position: "asc" } });
  return {
    officialSet,
    rows: cards.map((c) => ({ key: c.numberKey, localId: c.localId, name: c.name, imageUrl: c.imageUrl })),
    error,
  };
}
