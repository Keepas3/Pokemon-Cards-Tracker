import { prisma } from "@/lib/prisma";
import { CardPriceProvider, SetItemKind } from "@/generated/prisma/client";
import type { CardSet, SetItem } from "@/generated/prisma/client";
import { getTcgApiRateLimit } from "@/lib/tcgapiDev/client";
import type {
  ApiBudgetDTO,
  SetDTO,
  SetDetailPayload,
  SetItemDTO,
  SetsPayload,
} from "@/lib/clientTypes";
import { fetchAllSets, fetchSetItems } from "./tcgapiSets";
import type { ParsedItem, ParsedSet } from "./tcgapiSets";
import {
  ITEMS_TTL_MS,
  SETS_TTL_MS,
  FILL_BUDGET_FLOOR,
  SKIP_AFTER_FAILURE_MS,
  WATCHED_BUDGET_FLOOR,
  budgetBlockReason,
  fillBudgetReason,
  shouldRefresh,
} from "./freshness";
import { pickSetToFill } from "./backfill";
import type { FillTier } from "./backfill";
import { evaluateSmartWatchesForSet } from "@/lib/smartWatch/service";
import { trackWithThreshold } from "@/lib/cards/tracking";
import { isOversized, priceRangeOf, tcgplayerUrl } from "./setsView";
import { classifyItem } from "./classify";
import type { ItemGroup } from "./classify";
import { cardKey } from "@/lib/collection/numbers";
import { loadSetCollection } from "@/lib/collection/setData";

// Typical set: 100–250 rows, i.e. 1–3 requests. Used to check the budget
// before starting, since the real page count isn't known until we've fetched.
const SETS_LIST_REQUESTS = 3;
// Rows per createMany — keeps each statement under SQLite's bound-variable limit.
const INSERT_CHUNK = 50;

// Concurrent calls for the same key share one in-flight refresh. Without this,
// a double-mounted React effect (dev StrictMode) or two open tabs would each
// spend a full set's worth of the daily budget on identical requests.
const inflight = (globalThis as unknown as { __setsInflight?: Map<string, Promise<unknown>> });
function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const map = (inflight.__setsInflight ??= new Map());
  const existing = map.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => map.delete(key));
  map.set(key, p);
  return p;
}

export function budgetDTO(): ApiBudgetDTO | null {
  const rl = getTcgApiRateLimit();
  if (!rl) return null;
  return { dailyLimit: rl.dailyLimit, dailyRemaining: rl.dailyRemaining, resetAt: rl.resetAt?.toISOString() ?? null };
}

function toSetDTO(s: CardSet, savedRange: SetDTO["priceRange"]): SetDTO {
  // A set bigger than we fetch is only partly saved, so a range from it would
  // look authoritative without being — show none rather than a misleading one.
  const priceRange = isOversized(s) ? null : savedRange;
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    releaseDate: s.releaseDate?.toISOString() ?? null,
    cardCount: s.cardCount,
    iconUrl: s.iconUrl,
    imageUrl: s.imageUrl,
    itemsFetchedAt: s.itemsFetchedAt?.toISOString() ?? null,
    priceRange,
  };
}

async function saveSets(sets: ParsedSet[]): Promise<void> {
  const now = new Date();
  await prisma.$transaction(
    sets.map((s) =>
      prisma.cardSet.upsert({
        where: { id: s.id },
        // itemsFetchedAt is left alone on update — refreshing the list must not
        // make an already-cached set look unfetched.
        create: { ...s, fetchedAt: now },
        // A set's icon and picture don't change: keep the saved ones if the API stops sending them.
        update: {
          ...s,
          iconUrl: s.iconUrl ?? undefined,
          imageUrl: s.imageUrl ?? undefined,
          fetchedAt: now,
        },
      }),
    ),
  );
}

async function saveItems(setId: number, items: ParsedItem[]): Promise<void> {
  // Card pictures don't change while prices do: when a refresh arrives without a picture, keep the one we had.
  const knownArt = new Map(
    (await prisma.setItem.findMany({ where: { setId, imageUrl: { not: null } }, select: { externalId: true, printing: true, imageUrl: true } })).map((r) => [`${r.externalId}|${r.printing}`, r.imageUrl]),
  );
  items = items.map((i) => (i.imageUrl ? i : { ...i, imageUrl: knownArt.get(`${i.externalId}|${i.printing}`) ?? null }));
  const chunks: ParsedItem[][] = [];
  for (let i = 0; i < items.length; i += INSERT_CHUNK) chunks.push(items.slice(i, i + INSERT_CHUNK));
  // Replace in one transaction, only after every page arrived, so a failure
  // partway through never wipes a good cache.
  await prisma.$transaction([
    prisma.setItem.deleteMany({ where: { setId } }),
    ...chunks.map((chunk) => prisma.setItem.createMany({ data: chunk.map((i) => ({ ...i, setId })) })),
    prisma.cardSet.update({ where: { id: setId }, data: { itemsFetchedAt: new Date() } }),
  ]);
}

/** All cached sets, refreshing from the API first when the list is stale (or the user asked). */
export async function loadSets(opts: { refresh: boolean }): Promise<SetsPayload> {
  const newest = await prisma.cardSet.aggregate({ _max: { fetchedAt: true } });
  const fetchedAt = newest._max.fetchedAt;

  let error: string | null = null;
  if (shouldRefresh({ fetchedAt, ttlMs: SETS_TTL_MS, forced: opts.refresh })) {
    error = await dedupe("sets", async () => {
      const blocked = budgetBlockReason(getTcgApiRateLimit(), SETS_LIST_REQUESTS);
      if (blocked) return blocked;
      const result = await fetchAllSets();
      if (!result.ok) return result.error;
      try {
        await saveSets(result.sets);
      } catch (err) {
        return `couldn't save sets: ${(err as Error).message}`;
      }
      return null;
    });
  }

  const sets = await prisma.cardSet.findMany({ orderBy: { releaseDate: "desc" } });
  // One grouped query gives every set's cheapest/priciest saved price. Sets
  // whose prices were never fetched simply have no row here.
  const ranges = await prisma.setItem.groupBy({
    by: ["setId"],
    where: { marketPriceCents: { gt: 0 } },
    _min: { marketPriceCents: true },
    _max: { marketPriceCents: true },
  });
  const rangeBySet = new Map<number, SetDTO["priceRange"]>();
  for (const r of ranges) {
    if (r._min.marketPriceCents != null && r._max.marketPriceCents != null) {
      rangeBySet.set(r.setId, { minCents: r._min.marketPriceCents, maxCents: r._max.marketPriceCents });
    }
  }
  const latest = sets.reduce<Date | null>((m, s) => (!m || s.fetchedAt > m ? s.fetchedAt : m), null);
  return {
    sets: sets.map((s) => toSetDTO(s, rangeBySet.get(s.id) ?? null)),
    fetchedAt: latest?.toISOString() ?? null,
    error,
    budget: budgetDTO(),
  };
}

export function toItemDTO(
  item: SetItem,
  group: ItemGroup,
  tracked: SetItemDTO["tracked"],
  owned: number,
): SetItemDTO {
  return {
    id: item.id,
    externalId: item.externalId,
    name: item.name,
    number: item.number,
    rarity: item.rarity,
    kind: item.kind,
    group,
    printing: item.printing,
    marketPriceCents: item.marketPriceCents,
    lowPriceCents: item.lowPriceCents,
    imageUrl: item.imageUrl,
    tcgplayerUrl: tcgplayerUrl(item.tcgplayerId, item.name),
    owned,
    tracked,
  };
}

/**
 * Fetches one set's cards and sealed products from the API into the cache.
 * Returns an error message (budget, network, save failure), or null on success.
 * Concurrent calls for the same set share one fetch.
 */
function refreshSetItems(set: CardSet): Promise<string | null> {
  return dedupe(`set:${set.id}`, async () => {
    const needed = Math.max(1, Math.ceil(set.cardCount / 100));
    const blocked = budgetBlockReason(getTcgApiRateLimit(), needed);
    if (blocked) return blocked;
    const result = await fetchSetItems(set.id);
    if (!result.ok) return result.error;
    try {
      await saveItems(set.id, result.items);
    } catch (err) {
      return `couldn't save set items: ${(err as Error).message}`;
    }
    // Fresh prices are saved — check the set's smart alerts against them. This
    // is the one place every fetch path (open a set, manual load, background
    // fill) goes through. A failure here must not turn a good fetch into an error.
    try {
      await evaluateSmartWatchesForSet(set.id);
    } catch (err) {
      console.error(`[smart alerts] couldn't evaluate rules for "${set.name}":`, err);
    }
    return null;
  });
}

/**
 * Loads a set's prices (and the card pictures that come with them) when it has none saved yet. Used by the
 * collection page, so a set whose official list has no art (McDonald's, promos) isn't left blank. Respects
 * the same budget guard as every other fetch; returns an error message or null.
 */
export async function ensureSetItems(set: CardSet): Promise<string | null> {
  if (set.itemsFetchedAt != null) return null;
  return refreshSetItems(set);
}

export interface LoadPricesResult {
  /** Sets whose prices this call fetched. */
  loaded: number;
  /** Requested sets that still have no saved prices afterwards. */
  stillMissing: number;
  /** Why it stopped early (budget, network), if it did. */
  stoppedReason: string | null;
  budget: ApiBudgetDTO | null;
}

/** Hard cap per call, so one click can't drain the day's budget. */
export const MAX_PRICE_LOAD = 10;

/**
 * Fetches prices for up to `limit` of the given sets that have none saved yet,
 * in the order given — the caller passes what the user is looking at, so
 * "load prices" follows their search and sort. Stops at the first problem
 * (typically the budget guard), keeping everything it had already loaded.
 */
export async function loadPricesForSets(slugs: string[], limit: number): Promise<LoadPricesResult> {
  const cap = Math.max(1, Math.min(limit, MAX_PRICE_LOAD));
  const order = new Map(slugs.map((slug, i) => [slug, i]));
  const missing = (await prisma.cardSet.findMany({ where: { slug: { in: slugs }, itemsFetchedAt: null } })).sort(
    (a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0),
  );

  let loaded = 0;
  let stoppedReason: string | null = null;
  for (const set of missing.slice(0, cap)) {
    const error = await refreshSetItems(set);
    if (error) {
      stoppedReason = error;
      break;
    }
    loaded++;
  }

  return { loaded, stillMissing: missing.length - loaded, stoppedReason, budget: budgetDTO() };
}

export type FillResult =
  | { status: "no-key" }
  /** Nothing eligible: every normal-sized set has recent prices. */
  | { status: "idle" }
  /** The budget rule says to hold off until more of the day's requests are unspent. */
  | { status: "waiting"; reason: string; setName: string }
  | { status: "filled"; setName: string; firstLoad: boolean; tier: FillTier }
  | { status: "error"; setName: string; error: string };

/**
 * The sets whose prices matter most: the ones someone has an alert on, and the ones anyone is
 * collecting (has marked a card in). Their prices are what deals and alerts are judged on, so
 * they're refreshed ahead of everything else.
 */
export async function prioritySetIds(): Promise<Set<number>> {
  const [alerts, collecting] = await Promise.all([
    prisma.smartWatch.findMany({ where: { enabled: true }, select: { setId: true } }),
    prisma.ownedCard.findMany({ distinct: ["setId"], select: { setId: true } }),
  ]);
  return new Set([...alerts.map((a) => a.setId), ...collecting.map((c) => c.setId)]);
}

/**
 * One step of the automatic background fill: picks the next set that needs
 * prices (see pickSetToFill) and fetches it — unless the budget rule says to
 * wait. `skipUntil` is the caller's memory of recently failed sets so a broken
 * one can't block the queue; it is updated here on failure.
 */
export async function fillNextSetPrices(skipUntil: Map<number, number>, now: Date = new Date()): Promise<FillResult> {
  if (!process.env.TCGAPI_DEV_API_KEY) return { status: "no-key" };

  // A brand-new database has no sets at all. This spends the list fetch only
  // when the list is empty or a week old, like opening the Browse page would.
  await loadSets({ refresh: false });

  const candidates = await prisma.cardSet.findMany();
  const picked = pickSetToFill(candidates, { now, skipUntil, watchedSetIds: await prioritySetIds() });
  if (!picked) return { status: "idle" };
  const { set: pick, tier } = picked;

  // A set with a smart alert may dig deeper into the day's budget than the
  // general fill: the user asked for it.
  const needed = Math.max(1, Math.ceil(pick.cardCount / 100));
  const floor = tier === "watched" ? WATCHED_BUDGET_FLOOR : FILL_BUDGET_FLOOR;
  const reason = fillBudgetReason(getTcgApiRateLimit(), needed, floor);
  if (reason) return { status: "waiting", reason, setName: pick.name };

  const firstLoad = pick.itemsFetchedAt == null;
  const error = await refreshSetItems(pick);
  if (error) {
    skipUntil.set(pick.id, now.getTime() + SKIP_AFTER_FAILURE_MS);
    return { status: "error", setName: pick.name, error };
  }
  return { status: "filled", setName: pick.name, firstLoad, tier };
}

/**
 * One set with all its cached cards/sealed products, plus one person's collection and tracked
 * cards in it; null if the slug is unknown.
 */
export async function loadSetDetail(
  slug: string,
  opts: { refresh: boolean; profileId: string },
): Promise<SetDetailPayload | null> {
  const found = await prisma.cardSet.findUnique({ where: { slug } });
  if (!found) return null;

  let error: string | null = null;
  if (shouldRefresh({ fetchedAt: found.itemsFetchedAt, ttlMs: ITEMS_TTL_MS, forced: opts.refresh })) {
    error = await refreshSetItems(found);
  }

  const set = (await prisma.cardSet.findUnique({ where: { id: found.id } })) ?? found;
  // Items, what you own, and the card list (the official one, fetched once and cached).
  const collection = await loadSetCollection(set, { fetchOfficial: true, profileId: opts.profileId });
  const items = collection.items;

  // Which of these does this person already track (and watch)? Their list is small, so load
  // their tcgapi.dev sources and match in memory rather than building a huge IN (...) list.
  const sources = await prisma.cardPriceSource.findMany({
    where: {
      provider: CardPriceProvider.TCGAPI_DEV,
      card: { watchlistEntries: { some: { profileId: opts.profileId } } },
    },
    include: { card: { include: { watchlistEntries: { where: { profileId: opts.profileId } } } } },
  });
  const trackedByKey = new Map<string, SetItemDTO["tracked"]>();
  for (const s of sources) {
    trackedByKey.set(`${s.externalId}|${s.variant ?? ""}`, {
      cardId: s.cardId,
      thresholdCents: s.card.watchlistEntries[0]?.thresholdCents ?? null,
    });
  }

  return {
    set: toSetDTO(set, priceRangeOf(items)),
    items: items.map((i) => {
      const group = classifyItem(i);
      const owned = group === "card" ? (collection.owned.get(cardKey(i.number) ?? "") ?? 0) : 0;
      return toItemDTO(i, group, trackedByKey.get(`${i.externalId}|${i.printing}`) ?? null, owned);
    }),
    collection: collection.cards.length > 0 ? collection.summary : null,
    error: error ?? collection.error,
    budget: budgetDTO(),
  };
}

export type WatchSetItemResult = { ok: true; cardId: string } | { ok: false; status: number; error: string };

/**
 * Starts watching a set card's market price for one person: finds or creates the tracked Card
 * for it (a tcgapi.dev price source keyed on the same id the set cache holds, shared with anyone
 * else following it), then sets that person's alert threshold. Sealed products aren't watchable here — the
 * watchlist is for card prices.
 */
export async function watchSetItem(profileId: string, itemId: string, thresholdCents: number): Promise<WatchSetItemResult> {
  const item = await prisma.setItem.findUnique({ where: { id: itemId }, include: { set: true } });
  if (!item) return { ok: false, status: 404, error: "item not found — refresh the set and try again" };
  if (item.kind !== SetItemKind.CARD) {
    return { ok: false, status: 400, error: "only cards can be watched from a set page" };
  }

  const externalId = String(item.externalId);
  const variant = item.printing || null;

  const existing = await prisma.cardPriceSource.findUnique({
    where: { provider_externalId: { provider: CardPriceProvider.TCGAPI_DEV, externalId } },
  });
  if (existing && (existing.variant ?? "") !== item.printing) {
    return {
      ok: false,
      status: 409,
      error: `another printing of this card (${existing.variant ?? "default"}) is already tracked`,
    };
  }

  try {
    let cardId = existing?.cardId;
    if (!cardId) {
      const card = await prisma.card.create({
        data: {
          name: item.name,
          setName: item.set.name,
          number: item.number,
          imageUrl: item.imageUrl,
          priceSources: {
            create: {
              provider: CardPriceProvider.TCGAPI_DEV,
              externalId,
              variant,
              url: tcgplayerUrl(item.tcgplayerId, item.name),
              lastPriceCents: item.marketPriceCents,
              lastLowPriceCents: item.lowPriceCents,
              lastCheckedAt: item.priceUpdatedAt ?? new Date(),
            },
          },
        },
      });
      cardId = card.id;
    }

    await trackWithThreshold(profileId, cardId, thresholdCents);
    return { ok: true, cardId };
  } catch (err) {
    return { ok: false, status: 500, error: (err as Error).message };
  }
}
