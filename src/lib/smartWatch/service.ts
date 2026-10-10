import { prisma } from "@/lib/prisma";
import type { SetItem, SmartWatch } from "@/generated/prisma/client";
import { postDiscord } from "@/lib/notify/discord";
import { allowedWebhook } from "@/lib/notify/config";
import { tcgplayerUrl } from "@/lib/sets/setsView";
import { diffMatches, itemKey, matchItems } from "./match";
import type { MatchableItem, OwnedContext, RuleCriteria } from "./match";
import { classifyItem } from "@/lib/sets/classify";
import { formatSmartWatchAlert } from "./format";

// Keeps every statement under SQLite's bound-variable limit.
const CHUNK = 50;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function criteriaOf(
  watch: Pick<SmartWatch, "kind" | "rarity" | "query" | "maxPriceCents" | "onlyMissing">,
): RuleCriteria {
  return {
    kind: watch.kind,
    rarity: watch.rarity,
    query: watch.query,
    maxPriceCents: watch.maxPriceCents,
    onlyMissing: watch.onlyMissing,
  };
}

/** What one person owns in a set, so their rules with "only cards I'm missing" can skip it. */
async function loadOwnedContext(setId: number, profileId: string): Promise<OwnedContext> {
  const owned = await prisma.ownedCard.findMany({ where: { setId, profileId }, select: { numberKey: true } });
  return { ownedKeys: new Set(owned.map((o) => o.numberKey)) };
}

function toMatchable(i: SetItem): MatchableItem {
  return {
    externalId: i.externalId,
    printing: i.printing,
    name: i.name,
    number: i.number,
    rarity: i.rarity,
    // A numbered card, a sealed product, or something else (code cards, promos) — not tcgapi.dev's "Cards" label.
    kind: ({ card: "CARD", sealed: "SEALED", other: "OTHER" } as const)[classifyItem(i)],
    marketPriceCents: i.marketPriceCents,
    tcgplayerId: i.tcgplayerId,
  };
}

/**
 * Brings one rule's saved matches in line with a set's current items. New
 * matches are saved (unnotified, or already-seen for a silent `baseline`);
 * matches that no longer apply are forgotten so a later dip alerts again. Then,
 * unless this is a baseline, every match still waiting for an alert is sent in
 * one batched message — which also retries earlier ones held back by quiet
 * hours or a failed send.
 */
async function syncWatch(
  watch: SmartWatch,
  setName: string,
  items: MatchableItem[],
  opts: { notify: boolean; owned?: OwnedContext },
): Promise<{ matches: number; added: number; notified: number }> {
  const current = matchItems(criteriaOf(watch), items, opts.owned);
  const known = await prisma.smartWatchMatch.findMany({ where: { smartWatchId: watch.id } });
  const idByKey = new Map(known.map((k) => [itemKey({ externalId: k.itemExternalId, printing: k.printing }), k.id]));
  const { added, removedKeys } = diffMatches(idByKey.keys(), current);

  const now = new Date();
  const removedIds = removedKeys.map((k) => idByKey.get(k)!).filter(Boolean);
  await prisma.$transaction([
    ...chunks(removedIds, 500).map((ids) => prisma.smartWatchMatch.deleteMany({ where: { id: { in: ids } } })),
    ...chunks(added).map((group) =>
      prisma.smartWatchMatch.createMany({
        data: group.map((i) => ({
          smartWatchId: watch.id,
          itemExternalId: i.externalId,
          printing: i.printing,
          name: i.name,
          priceCents: i.marketPriceCents!,
          // A silent baseline counts as already seen; otherwise null = alert owed.
          notifiedAt: opts.notify ? null : now,
          baseline: !opts.notify,
        })),
      }),
    ),
  ]);

  if (!opts.notify) return { matches: current.length, added: added.length, notified: 0 };

  const pending = await prisma.smartWatchMatch.findMany({ where: { smartWatchId: watch.id, notifiedAt: null } });
  if (pending.length === 0) return { matches: current.length, added: added.length, notified: 0 };

  // Each rule alerts its owner, through their own webhook and quiet hours.
  const webhook = await allowedWebhook(watch.profileId);
  if (!webhook) return { matches: current.length, added: added.length, notified: 0 };

  const byKey = new Map(items.map((i) => [itemKey(i), i]));
  const alertItems = pending.map((p) => {
    const item = byKey.get(itemKey({ externalId: p.itemExternalId, printing: p.printing }));
    return {
      name: p.name,
      number: item?.number ?? null,
      priceCents: p.priceCents,
      url: tcgplayerUrl(item?.tcgplayerId ?? null, p.name),
    };
  });

  const result = await postDiscord(webhook, formatSmartWatchAlert({ watchName: watch.name, setName, items: alertItems }));
  if (!result.ok) return { matches: current.length, added: added.length, notified: 0 };

  const ids = pending.map((p) => p.id);
  await prisma.$transaction(
    chunks(ids, 500).map((group) =>
      prisma.smartWatchMatch.updateMany({ where: { id: { in: group } }, data: { notifiedAt: new Date() } }),
    ),
  );
  return { matches: current.length, added: added.length, notified: pending.length };
}

/**
 * Re-checks every enabled rule for a set against its freshly saved prices.
 * Called after each successful fetch of the set, whichever path triggered it.
 */
export async function evaluateSmartWatchesForSet(setId: number): Promise<void> {
  const watches = await prisma.smartWatch.findMany({ where: { setId, enabled: true } });
  if (watches.length === 0) return;

  const set = await prisma.cardSet.findUnique({ where: { id: setId } });
  if (!set) return;
  const rows = await prisma.setItem.findMany({ where: { setId } });
  const items = rows.map(toMatchable);
  // Collections are only loaded for people whose rules actually ask about what they own.
  const ownedByProfile = new Map<string, OwnedContext>();
  for (const profileId of new Set(watches.filter((w) => w.onlyMissing).map((w) => w.profileId))) {
    ownedByProfile.set(profileId, await loadOwnedContext(setId, profileId));
  }

  for (const watch of watches) {
    await syncWatch(watch, set.name, items, { notify: true, owned: ownedByProfile.get(watch.profileId) });
  }
}

/**
 * Quietly records what a rule matches right now, so only *later* changes alert.
 * Used when a rule is created or edited. Also clears any alerts still owed
 * under the old settings. Returns what currently matches, for the UI to show.
 */
export async function baselineSmartWatch(watchId: string): Promise<{ matches: number }> {
  const watch = await prisma.smartWatch.findUnique({ where: { id: watchId }, include: { set: true } });
  if (!watch) return { matches: 0 };

  await prisma.smartWatchMatch.updateMany({
    where: { smartWatchId: watchId, notifiedAt: null },
    data: { notifiedAt: new Date() },
  });
  const rows = await prisma.setItem.findMany({ where: { setId: watch.setId } });
  const owned = watch.onlyMissing ? await loadOwnedContext(watch.setId, watch.profileId) : undefined;
  const { matches } = await syncWatch(watch, watch.set.name, rows.map(toMatchable), { notify: false, owned });
  return { matches };
}
