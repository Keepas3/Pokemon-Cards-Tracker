import { prisma } from "@/lib/prisma";
import { cardKey } from "@/lib/collection/numbers";
import { setThreshold, trackCard } from "@/lib/cards/tracking";
import { baselineSmartWatch } from "@/lib/smartWatch/service";
import { EXPORT_APP, EXPORT_VERSION } from "./profileData";
import type { ProfileExport } from "./profileData";

const CHUNK = 200;
const chunks = <T>(list: T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/** Everything of one person's that the app keeps, as a downloadable backup. */
export async function buildExport(profile: { id: string; name: string }, now: Date = new Date()): Promise<ProfileExport> {
  const [owned, followed, entries, rules] = await Promise.all([
    prisma.ownedCard.findMany({ where: { profileId: profile.id }, include: { set: { select: { name: true } } }, orderBy: [{ setId: "asc" }, { numberKey: "asc" }] }),
    prisma.followedPokemon.findMany({ where: { profileId: profile.id }, orderBy: { dexId: "asc" } }),
    prisma.cardWatchlistEntry.findMany({ where: { profileId: profile.id }, include: { card: { include: { priceSources: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.smartWatch.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    profile: profile.name,
    owned: owned.map((o) => ({ setId: o.setId, setName: o.set.name, number: o.number ?? o.numberKey, name: o.name, quantity: o.quantity })),
    followedPokemon: followed.map((f) => f.dexId),
    watchedCards: entries.flatMap((e) => {
      // A card can be re-created from its tcgapi.dev price source; cards that only ever had a removed provider can't.
      const source = e.card.priceSources.find((s) => s.provider === "TCGAPI_DEV");
      return source
        ? [
            {
              provider: "TCGAPI_DEV" as const,
              externalId: source.externalId,
              variant: source.variant,
              name: e.card.name,
              setName: e.card.setName,
              number: e.card.number,
              imageUrl: e.card.imageUrl,
              url: source.url,
              thresholdCents: e.thresholdCents,
            },
          ]
        : [];
    }),
    alertRules: rules.map((r) => ({
      setId: r.setId,
      name: r.name,
      kind: r.kind,
      rarity: r.rarity,
      query: r.query,
      onlyMissing: r.onlyMissing,
      maxPriceCents: r.maxPriceCents,
      enabled: r.enabled,
    })),
  };
}

export interface ImportResult {
  owned: { added: number; raised: number; unchanged: number; unknownSet: number };
  followedPokemon: number;
  watchedCards: number;
  alertRules: { added: number; skipped: number };
  /** Entries in the file that couldn't be read at all. */
  unreadable: string[];
}

/**
 * Merges a backup into one person's data. It only ever adds or raises: a card you own more of now
 * keeps its higher count, nothing is deleted, and running it twice changes nothing. Entries for sets
 * this install doesn't know are skipped (and counted).
 */
export async function importProfileData(profileId: string, data: ProfileExport, unreadable: string[] = []): Promise<ImportResult> {
  const result: ImportResult = {
    owned: { added: 0, raised: 0, unchanged: 0, unknownSet: 0 },
    followedPokemon: 0,
    watchedCards: 0,
    alertRules: { added: 0, skipped: 0 },
    unreadable,
  };

  // --- owned cards
  const setIds = [...new Set(data.owned.map((o) => o.setId))];
  const knownSets = new Set((setIds.length ? await prisma.cardSet.findMany({ where: { id: { in: setIds } }, select: { id: true } }) : []).map((s) => s.id));
  const existing = new Map((await prisma.ownedCard.findMany({ where: { profileId } })).map((o) => [`${o.setId}|${o.numberKey}`, o]));

  const toCreate: { profileId: string; setId: number; numberKey: string; number: string; name: string; quantity: number }[] = [];
  const toRaise: { id: string; quantity: number }[] = [];
  const seen = new Set<string>();
  for (const o of data.owned) {
    const key = cardKey(o.number);
    if (key == null) continue;
    if (!knownSets.has(o.setId)) {
      result.owned.unknownSet++;
      continue;
    }
    const k = `${o.setId}|${key}`;
    if (seen.has(k)) continue; // the file lists a card twice: the first wins
    seen.add(k);
    const have = existing.get(k);
    if (!have) toCreate.push({ profileId, setId: o.setId, numberKey: key, number: o.number, name: o.name, quantity: o.quantity });
    else if (o.quantity > have.quantity) toRaise.push({ id: have.id, quantity: o.quantity });
    else result.owned.unchanged++;
  }
  for (const group of chunks(toCreate)) await prisma.ownedCard.createMany({ data: group });
  for (const group of chunks(toRaise)) {
    await prisma.$transaction(group.map((r) => prisma.ownedCard.update({ where: { id: r.id }, data: { quantity: r.quantity } })));
  }
  result.owned.added = toCreate.length;
  result.owned.raised = toRaise.length;

  // --- followed Pokémon
  const haveFollowed = new Set((await prisma.followedPokemon.findMany({ where: { profileId }, select: { dexId: true } })).map((f) => f.dexId));
  const newFollowed = data.followedPokemon.filter((d) => !haveFollowed.has(d));
  if (newFollowed.length) await prisma.followedPokemon.createMany({ data: newFollowed.map((dexId) => ({ profileId, dexId })) });
  result.followedPokemon = newFollowed.length;

  // --- watched cards (put on the list; the alert price is set from the file)
  for (const w of data.watchedCards) {
    const card = await trackCard(profileId, { name: w.name, setName: w.setName, number: w.number, imageUrl: w.imageUrl, provider: w.provider, externalId: w.externalId, variant: w.variant, priceCents: null, lowPriceCents: null, url: w.url });
    if (w.thresholdCents != null) await setThreshold(profileId, card.id, w.thresholdCents);
    result.watchedCards++;
  }

  // --- alert rules (needs the set's prices to be loaded, like creating one by hand)
  const rules = await prisma.smartWatch.findMany({ where: { profileId } });
  const sameRule = (a: { setId: number; kind: string | null; rarity: string | null; query: string | null; onlyMissing: boolean; maxPriceCents: number }) =>
    rules.some((r) => r.setId === a.setId && r.kind === a.kind && r.rarity === a.rarity && r.query === a.query && r.onlyMissing === a.onlyMissing && r.maxPriceCents === a.maxPriceCents);
  const ruleSets = new Map((await prisma.cardSet.findMany({ where: { id: { in: [...new Set(data.alertRules.map((r) => r.setId))] } }, select: { id: true, itemsFetchedAt: true } })).map((s) => [s.id, s]));
  for (const r of data.alertRules) {
    const set = ruleSets.get(r.setId);
    if (!set?.itemsFetchedAt || sameRule(r)) {
      result.alertRules.skipped++;
      continue;
    }
    const created = await prisma.smartWatch.create({ data: { profileId, name: r.name, setId: r.setId, kind: r.kind, rarity: r.rarity, query: r.query, onlyMissing: r.onlyMissing, maxPriceCents: r.maxPriceCents, enabled: r.enabled } });
    rules.push(created);
    await baselineSmartWatch(created.id);
    result.alertRules.added++;
  }

  return result;
}
