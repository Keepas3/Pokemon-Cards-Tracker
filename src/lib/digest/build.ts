import { prisma } from "@/lib/prisma";
import { cardPriceProviderLabels } from "@/lib/labels";
import type { CardPriceProvider } from "@/lib/clientTypes";
import { tcgplayerUrl } from "@/lib/sets/setsView";
import { collapseMoves } from "./pure";
import { newDealsForDigest } from "@/lib/deals/service";
import type { CardMove, Digest, DigestDeal, SmartAlertGroup } from "./types";

/** Net price moves on cards one person has an alert on (one per price source, not one per check). */
async function cardMovesSince(profileId: string, since: Date, until: Date): Promise<CardMove[]> {
  const events = await prisma.cardPriceEvent.findMany({
    where: {
      createdAt: { gte: since, lte: until },
      cardPriceSource: { card: { watchlistEntries: { some: { profileId, thresholdCents: { not: null } } } } },
    },
    include: { cardPriceSource: { include: { card: { include: { watchlistEntries: { where: { profileId } } } } } } },
  });

  const moves = collapseMoves(
    events.map((e) => ({
      sourceId: e.cardPriceSourceId,
      oldPriceCents: e.oldPriceCents,
      newPriceCents: e.newPriceCents,
      createdAt: e.createdAt,
    })),
  );

  const out: CardMove[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    const move = moves.get(e.cardPriceSourceId);
    if (!move || seen.has(e.cardPriceSourceId)) continue;
    seen.add(e.cardPriceSourceId);
    const { card } = e.cardPriceSource;
    const provider = cardPriceProviderLabels[e.cardPriceSource.provider as CardPriceProvider];
    out.push({
      cardName: `${card.name} (${provider})`,
      setName: card.setName,
      fromCents: move.fromCents,
      toCents: move.toCents,
      thresholdCents: card.watchlistEntries[0]?.thresholdCents ?? null,
    });
  }
  // Biggest drops first: that's the news.
  return out.sort((a, b) => (a.toCents - a.fromCents) / a.fromCents - (b.toCents - b.fromCents) / b.fromCents);
}

/** One person's new smart-alert matches (not the silent baseline taken when a rule is created). */
async function smartAlertsSince(profileId: string, since: Date, until: Date): Promise<SmartAlertGroup[]> {
  const matches = await prisma.smartWatchMatch.findMany({
    where: { baseline: false, createdAt: { gte: since, lte: until }, smartWatch: { profileId } },
    include: { smartWatch: { include: { set: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (matches.length === 0) return [];

  // Real product links need the TCGplayer id, which lives on the cached set rows.
  const setIds = [...new Set(matches.map((m) => m.smartWatch.setId))];
  const externalIds = [...new Set(matches.map((m) => m.itemExternalId))];
  const items = await prisma.setItem.findMany({
    where: { setId: { in: setIds }, externalId: { in: externalIds } },
    select: { setId: true, externalId: true, printing: true, tcgplayerId: true },
  });
  const tcgId = new Map(items.map((i) => [`${i.setId}|${i.externalId}|${i.printing}`, i.tcgplayerId]));

  const groups = new Map<string, SmartAlertGroup>();
  for (const m of matches) {
    const group = groups.get(m.smartWatchId) ?? {
      watchName: m.smartWatch.name,
      setName: m.smartWatch.set.name,
      items: [],
    };
    group.items.push({
      name: m.name,
      priceCents: m.priceCents,
      url: tcgplayerUrl(tcgId.get(`${m.smartWatch.setId}|${m.itemExternalId}|${m.printing}`) ?? null, m.name),
    });
    groups.set(m.smartWatchId, group);
  }
  return [...groups.values()];
}

/** The cards you're missing that are newly cheap (or got cheaper), as the digest shows them. */
async function dealsFor(profileId: string, until: Date): Promise<DigestDeal[]> {
  return (await newDealsForDigest(profileId, until)).map((d) => ({
    setId: d.setId,
    key: d.key,
    name: d.name,
    setName: d.setName,
    number: d.number,
    lowCents: d.lowCents,
    marketCents: d.marketCents,
    savingsPct: d.savingsPct,
    suspicious: d.suspicious,
    url: d.tcgplayerUrl,
  }));
}

/**
 * Everything worth saying to one person about the window [since, until]: moves on their watched
 * cards, new matches on their alert rules and — for the Discord digest — new deals on cards
 * they're missing (the Today page shows its own, fuller deals list, so it leaves these out).
 */
export async function buildDigest(
  profileId: string,
  since: Date,
  until: Date = new Date(),
  opts: { deals?: boolean } = {},
): Promise<Digest> {
  const [cardMoves, smartAlerts, deals] = await Promise.all([
    cardMovesSince(profileId, since, until),
    smartAlertsSince(profileId, since, until),
    opts.deals ? dealsFor(profileId, until) : Promise.resolve([]),
  ]);
  return { since: since.toISOString(), until: until.toISOString(), cardMoves, smartAlerts, deals };
}
