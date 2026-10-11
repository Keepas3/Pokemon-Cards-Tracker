// The collection against the saved data: record what you own, and build the
// gallery and set pages. Spends no tcgapi.dev requests; the card catalog (TCGdex)
// is fetched lazily and cached (see lib/official/service.ts).

import { prisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/sets/classify";
import { ensureSetItems, toItemDTO } from "@/lib/sets/setsService";
import { ensureOfficialIndex } from "@/lib/official/service";
import { cardKey } from "./numbers";
import { MAX_ORDER_SETS, applySetOrder } from "./order";
import { summarize } from "./progress";
import { loadSetCollection } from "./setData";
import type { OwnedInput } from "./input";
import type {
  CollectionSetPayload,
  GalleryPayload,
  GallerySeriesDTO,
  GallerySetDTO,
  OwnedResult,
} from "./types";

/**
 * Sets how many copies of one card you own, any printing (0 removes it). Only a
 * card in the set's list can be owned — not a box or a code card. Returns the
 * set's refreshed summary so the page can update without reloading.
 */
export async function setOwned(profileId: string, input: OwnedInput): Promise<{ status: "ok"; result: OwnedResult } | { status: "no-set" } | { status: "no-card" }> {
  const set = await prisma.cardSet.findUnique({ where: { id: input.setId } });
  if (!set) return { status: "no-set" };
  const key = cardKey(input.number);
  if (key == null) return { status: "no-card" };

  let collection = await loadSetCollection(set, { fetchOfficial: false, profileId });
  let card = collection.cards.find((c) => c.key === key);
  if (!card) {
    // The set's official card list may simply not be saved yet (it's fetched when a set page is opened).
    // Get it once (a free TCGdex request, cached for weeks; no tcgapi.dev requests) and look again.
    collection = await loadSetCollection(set, { fetchOfficial: true, profileId });
    card = collection.cards.find((c) => c.key === key);
  }
  if (!card) return { status: "no-card" };

  const where = { profileId_setId_numberKey: { profileId, setId: set.id, numberKey: key } };
  if (input.quantity === 0) {
    await prisma.ownedCard.deleteMany({ where: { profileId, setId: set.id, numberKey: key } });
  } else {
    await prisma.ownedCard.upsert({
      where,
      create: { profileId, setId: set.id, numberKey: key, number: card.number, name: card.name, quantity: input.quantity },
      update: { quantity: input.quantity, number: card.number, name: card.name },
    });
  }

  const cards = collection.cards.map((c) => (c.key === key ? { ...c, owned: input.quantity } : c));
  return {
    status: "ok",
    result: { ok: true, quantity: input.quantity, summary: summarize(cards, collection.usedOfficial ? "official" : "tcgapi") },
  };
}

const OTHER = { id: "other", name: "Other sets" };

/** Every set, grouped by series, with how far along one person is in each. */
export async function loadGallery(profileId: string): Promise<GalleryPayload> {
  const error = await ensureOfficialIndex();

  const [sets, officials, ownedBySet, orderRows] = await Promise.all([
    prisma.cardSet.findMany(),
    prisma.officialSet.findMany({ where: { cardSetId: { not: null } } }),
    prisma.ownedCard.groupBy({ by: ["setId"], where: { profileId }, _count: { _all: true }, _sum: { quantity: true } }),
    prisma.setOrder.findMany({ where: { profileId } }),
  ]);
  const chosen = new Map(orderRows.map((o) => [o.setId, o.position]));
  const officialBySet = new Map(officials.map((o) => [o.cardSetId as number, o]));
  const owned = new Map(ownedBySet.map((o) => [o.setId, { cards: o._count._all, copies: o._sum.quantity ?? 0 }]));

  // Sets you've started get their real summary (total, value); the rest only need a count.
  const summaries = new Map<number, ReturnType<typeof summarize>>();
  for (const set of sets) {
    if (!owned.has(set.id)) continue;
    summaries.set(set.id, (await loadSetCollection(set, { fetchOfficial: false, profileId })).summary);
  }

  const bySeries = new Map<string, { series: GallerySeriesDTO; newest: number; entries: { dto: GallerySetDTO; time: number; id: number }[] }>();
  for (const set of sets) {
    const official = officialBySet.get(set.id) ?? null;
    const started = owned.get(set.id);
    const summary = summaries.get(set.id);
    const total = summary?.totalCards ?? official?.totalCards ?? null;
    const ownedCards = summary?.ownedCards ?? started?.cards ?? 0;

    const dto: GallerySetDTO = {
      slug: set.slug,
      name: official?.name ?? set.name,
      logoUrl: official?.logoUrl ?? null,
      symbolUrl: official?.symbolUrl ?? null,
      artUrl: set.iconUrl ?? set.imageUrl ?? null,
      releaseDate: set.releaseDate?.toISOString() ?? null,
      totalCards: total,
      ownedCards,
      copies: started?.copies ?? 0,
      percent: total ? Math.round((ownedCards / total) * 1000) / 10 : null,
      official: official != null,
    };

    const seriesInfo = official ? { id: official.seriesId, name: official.seriesName } : OTHER;
    const time = set.releaseDate?.getTime() ?? 0;
    const group = bySeries.get(seriesInfo.id) ?? { series: { ...seriesInfo, sets: [] }, newest: 0, entries: [] };
    group.entries.push({ dto, time, id: set.id });
    group.newest = Math.max(group.newest, time);
    bySeries.set(seriesInfo.id, group);
  }

  const series = [...bySeries.values()]
    .sort((a, b) => (a.series.id === OTHER.id ? 1 : b.series.id === OTHER.id ? -1 : b.newest - a.newest))
    .map((g) => ({
      ...g.series,
      sets: applySetOrder(
        g.entries.sort((a, b) => b.time - a.time || a.dto.name.localeCompare(b.dto.name)),
        (e) => chosen.get(e.id),
      ).map((e) => e.dto),
    }));

  const started = [...summaries.values()];
  return {
    series,
    totals: {
      started: started.length,
      complete: started.filter((s) => s.totalCards > 0 && s.ownedCards === s.totalCards).length,
      copies: started.reduce((n, s) => n + s.copies, 0),
      valueCents: started.reduce((n, s) => n + s.valueCents, 0),
    },
    error,
  };
}

/**
 * Saves the order one person chose for some sets (the whole series, in the order shown). Unknown slugs are
 * ignored. Returns how many sets were saved.
 */
export async function saveSetOrder(profileId: string, slugs: string[]): Promise<number> {
  const unique = [...new Set(slugs)].slice(0, MAX_ORDER_SETS);
  const found = await prisma.cardSet.findMany({ where: { slug: { in: unique } }, select: { id: true, slug: true } });
  const idBySlug = new Map(found.map((s) => [s.slug, s.id]));
  const ids = unique.map((slug) => idBySlug.get(slug)).filter((id): id is number => id != null);
  await prisma.$transaction([
    prisma.setOrder.deleteMany({ where: { profileId, setId: { in: ids } } }),
    prisma.setOrder.createMany({ data: ids.map((setId, position) => ({ profileId, setId, position })) }),
  ]);
  return ids.length;
}

/** One set's page: every card with what a person owns, the summary, and the set's other rows. */
export async function loadCollectionSet(profileId: string, slug: string): Promise<CollectionSetPayload | null> {
  let set = await prisma.cardSet.findUnique({ where: { slug } });
  if (!set) return null;
  let collection = await loadSetCollection(set, { fetchOfficial: true, profileId });

  // The official list has no art for some sets (McDonald's, promos); tcgapi.dev's pictures fill the gap, but only
  // once the set's prices are loaded. Do that now, once, rather than leave the cards blank.
  if (set.itemsFetchedAt == null && collection.cards.some((c) => !c.imageUrl)) {
    await ensureSetItems(set);
    set = (await prisma.cardSet.findUnique({ where: { id: set.id } })) ?? set;
    collection = await loadSetCollection(set, { fetchOfficial: false, profileId });
  }

  const products = collection.items
    .map((i) => ({ item: i, group: classifyItem(i) }))
    .filter((x) => x.group !== "card")
    .sort((a, b) => (b.item.marketPriceCents ?? -1) - (a.item.marketPriceCents ?? -1))
    .map((x) => toItemDTO(x.item, x.group, null, 0));

  return {
    set: {
      id: set.id,
      slug: set.slug,
      name: collection.officialSet?.name ?? set.name,
      seriesName: collection.officialSet?.seriesName ?? null,
      logoUrl: collection.officialSet?.logoUrl ?? null,
      releaseDate: set.releaseDate?.toISOString() ?? null,
      official: collection.usedOfficial,
    },
    cards: collection.cards,
    summary: collection.summary,
    products,
    error: collection.error,
  };
}
