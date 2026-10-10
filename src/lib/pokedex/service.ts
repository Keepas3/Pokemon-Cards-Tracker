// Collecting by Pokémon against the database. A Pokémon's card list comes from TCGdex (one request,
// cached a week); which of those cards belong to sets we can track, what they cost and what a person
// owns all come from data we already have, so opening a Pokémon spends no tcgapi.dev requests.

import { prisma } from "@/lib/prisma";
import { summarize } from "@/lib/collection/progress";
import type { CollectionCard } from "@/lib/collection/progress";
import { cardKey } from "@/lib/collection/numbers";
import { getDexCardsJson } from "@/lib/official/tcgdex";
import { classifyItem } from "@/lib/sets/classify";
import { tcgplayerUrl } from "@/lib/sets/setsView";
import { assemblePokemonCards, trackKey } from "./assemble";
import type { PriceInfo, SetInfo } from "./assemble";
import { parseDexCards } from "./parse";
import type { DexCard } from "./parse";
import { dexIdFromCardName } from "./match";
import { SPECIES_NAMES, generationOf, isDexId, speciesName } from "./species";
import type { PokemonGalleryPayload, PokemonPayload, PokemonTileDTO } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** New sets add cards, so a Pokémon's list is re-fetched when it's a week old. */
const TTL_MS = 7 * DAY_MS;
const FETCH_CAP = 40;
const FETCH_PARALLEL = 5;

// Concurrent callers share one in-flight request for the same Pokémon.
const inflight = globalThis as unknown as { __dexInflight?: Map<number, Promise<unknown>> };
function dedupe<T>(dexId: number, fn: () => Promise<T>): Promise<T> {
  const map = (inflight.__dexInflight ??= new Map());
  const existing = map.get(dexId) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => map.delete(dexId));
  map.set(dexId, p);
  return p;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export interface DexList {
  cards: DexCard[];
  fetchedAt: Date | null;
  error: string | null;
}

/**
 * One Pokémon's cards from TCGdex, from the cache unless it's missing or a week old. With
 * `fetch: false` only what's cached is used. A failed fetch falls back to the cached list (even a
 * stale one) with an error message.
 */
export async function ensureDexCards(dexId: number, opts: { fetch: boolean; now?: Date }): Promise<DexList> {
  const now = opts.now ?? new Date();
  const cached = await prisma.dexCache.findUnique({ where: { dexId } });
  const fromCache = (error: string | null): DexList => {
    let cards: DexCard[] = [];
    if (cached) {
      try {
        cards = parseDexCards(JSON.parse(cached.cardsJson));
      } catch {
        cards = [];
      }
    }
    return { cards, fetchedAt: cached?.fetchedAt ?? null, error };
  };

  const fresh = cached != null && now.getTime() - cached.fetchedAt.getTime() < TTL_MS;
  if (!opts.fetch || fresh) return fromCache(null);

  return dedupe(dexId, async () => {
    try {
      const json = await getDexCardsJson(dexId);
      const cards = parseDexCards(json);
      const rawCards = typeof json === "object" && json !== null && Array.isArray((json as { cards?: unknown }).cards) ? (json as { cards: unknown[] }).cards : [];
      await prisma.dexCache.upsert({
        where: { dexId },
        create: { dexId, cardsJson: JSON.stringify(rawCards), fetchedAt: now },
        update: { cardsJson: JSON.stringify(rawCards), fetchedAt: now },
      });
      return { cards, fetchedAt: now, error: null } satisfies DexList;
    } catch (err) {
      return fromCache(`Couldn't reach the card catalog (${message(err)}) — showing ${cached ? "what's saved" : "nothing yet"}.`);
    }
  });
}

/** Everything the assembler needs for a set of cards, read in a few queries. */
async function loadContext(profileId: string, cards: DexCard[]) {
  const officialIds = [...new Set(cards.map((c) => c.setId))];
  const officialSets = officialIds.length ? await prisma.officialSet.findMany({ where: { id: { in: officialIds } } }) : [];
  const linkedIds = officialSets.map((o) => o.cardSetId).filter((id): id is number => id != null);

  const [cardSets, items, ownedRows] = linkedIds.length
    ? await Promise.all([
        prisma.cardSet.findMany({ where: { id: { in: linkedIds } }, select: { id: true, slug: true, name: true, releaseDate: true } }),
        prisma.setItem.findMany({
          where: { setId: { in: linkedIds }, kind: "CARD" },
          select: { setId: true, number: true, rarity: true, kind: true, name: true, printing: true, marketPriceCents: true, lowPriceCents: true, tcgplayerId: true, imageUrl: true },
        }),
        prisma.ownedCard.findMany({ where: { profileId, setId: { in: linkedIds } }, select: { setId: true, numberKey: true, quantity: true } }),
      ])
    : [[], [], []];

  const cardSetById = new Map(cardSets.map((s) => [s.id, s]));
  const sets = new Map<string, SetInfo>();
  for (const o of officialSets) {
    const ours = o.cardSetId != null ? cardSetById.get(o.cardSetId) : undefined;
    sets.set(o.id, {
      // Only a set we actually have a row for can be owned against.
      cardSetId: ours ? ours.id : null,
      name: o.name,
      slug: ours?.slug ?? null,
      releaseDate: (o.releaseDate ?? ours?.releaseDate)?.toISOString().slice(0, 10) ?? null,
    });
  }

  // One price per card number: the cheapest priced printing, as everywhere else.
  const prices = new Map<string, PriceInfo>();
  for (const i of items) {
    if (classifyItem(i) !== "card") continue;
    const key = cardKey(i.number);
    if (key == null) continue;
    const k = trackKey(i.setId, key);
    const priced = i.marketPriceCents != null && i.marketPriceCents > 0;
    const existing = prices.get(k);
    const better = !existing || (priced && (existing.priceCents == null || i.marketPriceCents! < existing.priceCents));
    if (better) {
      prices.set(k, {
        number: i.number,
        rarity: i.rarity,
        priceCents: priced ? i.marketPriceCents : (existing?.priceCents ?? null),
        lowPriceCents: priced ? i.lowPriceCents : (existing?.lowPriceCents ?? null),
        tcgplayerUrl: tcgplayerUrl(i.tcgplayerId, i.name),
        imageUrl: i.imageUrl,
      });
    }
  }

  const owned = new Map(ownedRows.map((o) => [trackKey(o.setId, o.numberKey), o.quantity]));
  return { sets, prices, owned };
}

/** One Pokémon's page for one person. With `fetch`, gets the card list from TCGdex if it isn't cached. */
export async function loadPokemon(profileId: string, dexId: number, opts: { fetch: boolean }): Promise<PokemonPayload | null> {
  if (!isDexId(dexId)) return null;
  const [dex, followedRow] = await Promise.all([
    ensureDexCards(dexId, { fetch: opts.fetch }),
    prisma.followedPokemon.findUnique({ where: { profileId_dexId: { profileId, dexId } } }),
  ]);
  const { sets, prices, owned } = await loadContext(profileId, dex.cards);
  const { tracked, untracked } = assemblePokemonCards(dex.cards, sets, prices, owned);

  return {
    dexId,
    name: speciesName(dexId),
    generation: generationOf(dexId),
    followed: followedRow != null,
    cards: tracked,
    summary: summarize(tracked as CollectionCard[], "official"),
    untracked,
    error: dex.error,
    fetchedAt: dex.fetchedAt?.toISOString() ?? null,
  };
}

/** Starts or stops following a Pokémon. Following also fetches its card list so the page opens ready. */
export async function setFollowed(profileId: string, dexId: number, followed: boolean): Promise<boolean> {
  if (!isDexId(dexId)) return false;
  if (followed) {
    await prisma.followedPokemon.upsert({
      where: { profileId_dexId: { profileId, dexId } },
      create: { profileId, dexId },
      update: {},
    });
    await ensureDexCards(dexId, { fetch: true });
  } else {
    await prisma.followedPokemon.deleteMany({ where: { profileId, dexId } });
  }
  return true;
}

/** Cards owned per Pokémon across every set, by card name (so Vulpix owned in any set counts for Vulpix). */
async function ownedByPokemon(profileId: string): Promise<Map<number, { count: number; image: string | null }>> {
  const rows = await prisma.ownedCard.findMany({ where: { profileId, quantity: { gt: 0 } }, select: { setId: true, numberKey: true } });
  const counts = new Map<number, { count: number; image: string | null }>();
  if (rows.length === 0) return counts;
  const items = await prisma.setItem.findMany({
    where: { setId: { in: [...new Set(rows.map((r) => r.setId))] }, kind: "CARD" },
    select: { setId: true, number: true, name: true, imageUrl: true },
  });
  const nameOf = new Map<string, { name: string; image: string | null }>();
  for (const i of items) {
    const key = cardKey(i.number);
    if (key != null && !nameOf.has(trackKey(i.setId, key))) nameOf.set(trackKey(i.setId, key), { name: i.name, image: i.imageUrl });
  }
  for (const r of rows) {
    const card = nameOf.get(trackKey(r.setId, r.numberKey));
    const dexId = card ? dexIdFromCardName(card.name) : null;
    if (dexId == null || !card) continue;
    const prev = counts.get(dexId);
    counts.set(dexId, { count: (prev?.count ?? 0) + 1, image: prev?.image ?? card.image });
  }
  return counts;
}

/** Every Pokémon in Pokédex order, with progress for the ones this person follows and a count for any they own cards of. */
export async function loadPokemonGallery(profileId: string): Promise<PokemonGalleryPayload> {
  const followedRows = await prisma.followedPokemon.findMany({ where: { profileId }, select: { dexId: true } });
  const followed = new Set(followedRows.map((f) => f.dexId));
  const have = await ownedByPokemon(profileId);

  // Anyone you follow or own a card of gets a progress bar. Their card lists are fetched once (a week cache);
  // at most FETCH_CAP per visit, a few at a time, so a big collection fills in over a couple of visits.
  const collecting = [...new Set([...followed, ...have.keys()])];
  const cached = new Set((await prisma.dexCache.findMany({ where: { dexId: { in: collecting } }, select: { dexId: true } })).map((c) => c.dexId));
  const toFetch = collecting.filter((d) => !cached.has(d)).slice(0, FETCH_CAP);
  for (let i = 0; i < toFetch.length; i += FETCH_PARALLEL) {
    await Promise.all(toFetch.slice(i, i + FETCH_PARALLEL).map((d) => ensureDexCards(d, { fetch: true })));
  }

  const progress = new Map<number, { total: number; owned: number; image: string | null }>();
  for (const dexId of collecting) {
    const p = await loadPokemon(profileId, dexId, { fetch: false });
    if (!p) continue;
    progress.set(dexId, {
      total: p.summary.totalCards,
      owned: p.summary.ownedCards,
      image: p.cards.find((c) => c.imageUrl)?.imageUrl ?? null,
    });
  }

  const species: PokemonTileDTO[] = SPECIES_NAMES.map((name, i) => {
    const dexId = i + 1;
    const p = progress.get(dexId);
    return {
      dexId,
      name,
      generation: generationOf(dexId),
      followed: followed.has(dexId),
      haveCards: have.get(dexId)?.count ?? 0,
      totalCards: p?.total ?? null,
      ownedCards: p?.owned ?? null,
      percent: p && p.total > 0 ? Math.round((p.owned / p.total) * 1000) / 10 : null,
      imageUrl: p?.image ?? have.get(dexId)?.image ?? null,
    };
  });

  const started = [...progress.values()];
  const unfollowedOwned = [...have].filter(([dexId]) => !progress.has(dexId));
  return {
    species,
    totals: {
      followed: followed.size,
      collecting: new Set([...followed, ...have.keys()]).size,
      cardsOwned: started.reduce((n, p) => n + p.owned, 0) + unfollowedOwned.reduce((n, [, c]) => n + c.count, 0),
      complete: started.filter((p) => p.total > 0 && p.owned === p.total).length,
    },
  };
}

