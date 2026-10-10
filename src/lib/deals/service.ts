// Deals on cards a person is missing, from prices already saved in the database. Spends no tcgapi.dev
// requests: the numbers are as fresh as the last time each set's prices were fetched (up to 12 hours,
// and the background fill keeps the sets people collect freshest — see lib/sets/backfill.ts).

import { prisma } from "@/lib/prisma";
import { cardKey } from "@/lib/collection/numbers";
import { loadPokemon } from "@/lib/pokedex/service";
import { classifyItem } from "@/lib/sets/classify";
import { tcgplayerUrl } from "@/lib/sets/setsView";
import { DEFAULT_THRESHOLDS, bestPerCard, dealOf, isNewDeal, rankDeals } from "./compute";
import type { DealCandidate, DealThresholds } from "./compute";
import type { DealDTO, DealScope, DealsPayload } from "./types";

const DEFAULT_LIMIT = 60;
/** At most this many new deals go into one Discord digest. */
export const DIGEST_DEAL_LIMIT = 5;

interface LoadOptions {
  scope?: DealScope;
  thresholds?: DealThresholds;
  limit?: number;
}

/**
 * Deals for one person. `mine` looks at the sets they've started and the Pokémon they follow;
 * `all` looks at every set that has saved prices.
 */
export async function loadDeals(profileId: string, opts: LoadOptions = {}): Promise<DealsPayload> {
  const scope = opts.scope ?? "mine";
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), 500);

  const ownedRows = await prisma.ownedCard.findMany({ where: { profileId }, select: { setId: true, numberKey: true } });
  const ownedKeys = new Set(ownedRows.map((o) => `${o.setId}|${o.numberKey}`));
  const ownedInSet = new Map<number, number>();
  for (const o of ownedRows) ownedInSet.set(o.setId, (ownedInSet.get(o.setId) ?? 0) + 1);

  // The cards worth looking at: everything in the sets you've started, plus every card of the
  // Pokémon you follow (in any set that has prices).
  const followedKeys = new Set<string>();
  const wantedSetIds = new Set(ownedInSet.keys());
  if (scope === "mine") {
    const followed = await prisma.followedPokemon.findMany({ where: { profileId }, select: { dexId: true } });
    for (const { dexId } of followed) {
      const page = await loadPokemon(profileId, dexId, { fetch: false });
      for (const c of page?.cards ?? []) {
        if (c.setId == null) continue;
        followedKeys.add(`${c.setId}|${c.key.split("|")[1]}`);
        wantedSetIds.add(c.setId);
      }
    }
    if (wantedSetIds.size === 0) {
      return {
        scope,
        deals: [],
        found: 0,
        setsConsidered: 0,
        pricesAsOf: null,
        note: "Mark a few cards as owned, or follow a Pokémon, and deals on the cards you're missing will show up here. Or look at everything.",
      };
    }
  }

  const rows = await prisma.setItem.findMany({
    where: {
      kind: "CARD",
      marketPriceCents: { gt: 0 },
      lowPriceCents: { gt: 0 },
      ...(scope === "mine" ? { setId: { in: [...wantedSetIds] } } : {}),
    },
    select: { setId: true, name: true, number: true, rarity: true, kind: true, imageUrl: true, tcgplayerId: true, marketPriceCents: true, lowPriceCents: true, priceUpdatedAt: true },
  });

  const setsConsidered = new Set<number>();
  const candidates: DealCandidate[] = [];
  for (const r of rows) {
    if (classifyItem(r) !== "card") continue;
    const key = cardKey(r.number);
    if (key == null) continue;
    const trackKey = `${r.setId}|${key}`;
    if (ownedKeys.has(trackKey)) continue; // you have it
    if (scope === "mine" && !ownedInSet.has(r.setId) && !followedKeys.has(trackKey)) continue;
    setsConsidered.add(r.setId);
    candidates.push({
      setId: r.setId,
      key,
      name: r.name,
      number: r.number,
      rarity: r.rarity,
      imageUrl: r.imageUrl,
      tcgplayerUrl: tcgplayerUrl(r.tcgplayerId, r.name),
      marketCents: r.marketPriceCents!,
      lowCents: r.lowPriceCents!,
      priceUpdatedAt: r.priceUpdatedAt?.toISOString() ?? null,
    });
  }

  const deals = rankDeals(
    bestPerCard(candidates)
      .map((c) => dealOf(c, thresholds))
      .filter((d): d is NonNullable<typeof d> => d != null),
    ownedInSet,
  );
  const shown = deals.slice(0, limit);

  // Names for display: the official name where the set is paired, else tcgapi.dev's.
  const setIds = [...new Set(shown.map((d) => d.setId))];
  const [cardSets, officials] = setIds.length
    ? await Promise.all([
        prisma.cardSet.findMany({ where: { id: { in: setIds } }, select: { id: true, name: true, slug: true } }),
        prisma.officialSet.findMany({ where: { cardSetId: { in: setIds } }, select: { cardSetId: true, name: true } }),
      ])
    : [[], []];
  const slugOf = new Map(cardSets.map((s) => [s.id, s]));
  const officialName = new Map(officials.map((o) => [o.cardSetId as number, o.name]));

  const dtos: DealDTO[] = shown.map((d) => ({
    ...d,
    setName: officialName.get(d.setId) ?? slugOf.get(d.setId)?.name ?? `Set ${d.setId}`,
    setSlug: slugOf.get(d.setId)?.slug ?? "",
    ownedInSet: ownedInSet.get(d.setId) ?? 0,
  }));

  const dates = dtos.map((d) => d.priceUpdatedAt).filter((x): x is string => x != null).sort();
  return {
    scope,
    deals: dtos,
    found: deals.length,
    setsConsidered: setsConsidered.size,
    pricesAsOf: dates[0] ?? null,
    note: null,
  };
}

/**
 * The deals this person hasn't been told about yet (or that have got cheaper), best first, for the
 * Discord digest. Suspiciously low listings are left out: they stay on the Deals page, flagged, but
 * aren't worth a notification.
 */
export async function newDealsForDigest(profileId: string, now: Date = new Date()): Promise<DealDTO[]> {
  const { deals: all } = await loadDeals(profileId, { scope: "mine", limit: 200 });
  const deals = all.filter((d) => !d.suspicious);
  if (deals.length === 0) return [];
  const notices = await prisma.dealNotice.findMany({
    where: { profileId, setId: { in: [...new Set(deals.map((d) => d.setId))] } },
  });
  const last = new Map(notices.map((n) => [`${n.setId}|${n.numberKey}`, n]));
  return deals.filter((d) => isNewDeal(last.get(`${d.setId}|${d.key}`), d, now)).slice(0, DIGEST_DEAL_LIMIT);
}

/** Remembers what was just mentioned, so the next digest doesn't repeat it. */
export async function markDealsNoticed(profileId: string, deals: Pick<DealDTO, "setId" | "key" | "lowCents">[], now: Date = new Date()): Promise<void> {
  for (const d of deals) {
    await prisma.dealNotice.upsert({
      where: { profileId_setId_numberKey: { profileId, setId: d.setId, numberKey: d.key } },
      create: { profileId, setId: d.setId, numberKey: d.key, lowCents: d.lowCents, noticedAt: now },
      update: { lowCents: d.lowCents, noticedAt: now },
    });
  }
}
