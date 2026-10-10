// Open or hold, against the saved data: loads a set's cards and prices, the
// published (or your own) pull rates and your assumptions, runs the model in
// ./model.ts, and reports the result along with everything it rested on. It
// spends no API requests — it only reads what Browse already saved.

import { prisma } from "@/lib/prisma";
import type { CardSet, SetItem } from "@/generated/prisma/client";
import { isOversized } from "@/lib/sets/setsView";
import { classifyItem } from "@/lib/sets/classify";
import { analyze, buildPool, isBulkRarity, rarityKey, scaleSlots } from "./model";
import type { CardRow, ModelHit, ModelSlot } from "./model";
import { guessPacks } from "./packs";
import { findProfile } from "./profiles";
import { DEFAULT_ASSUMPTIONS } from "./types";
import type { Assumptions, OpenHoldDTO, RateRow, UnmodeledRarity } from "./types";
import type { PackCountInput, PullRateInput } from "./input";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Card prices older than this get a warning on the result. */
const STALE_AFTER_MS = 3 * DAY_MS;

const toCardRow = (i: Pick<SetItem, "externalId" | "number" | "rarity" | "marketPriceCents">): CardRow => ({
  externalId: i.externalId,
  number: i.number,
  rarity: i.rarity,
  marketPriceCents: i.marketPriceCents,
});

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// --- Your assumptions, pull-rate overrides and pack counts ---

export async function loadAssumptions(): Promise<Assumptions> {
  const row = await prisma.openHoldSettings.findUnique({ where: { id: "singleton" } });
  if (!row) return DEFAULT_ASSUMPTIONS;
  return { feePct: row.feePct, bulkThresholdCents: row.bulkThresholdCents, bulkPerPackCents: row.bulkPerPackCents };
}

export async function saveAssumptions(patch: Partial<Assumptions>): Promise<Assumptions> {
  await prisma.openHoldSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...DEFAULT_ASSUMPTIONS, ...patch },
    update: patch,
  });
  return loadAssumptions();
}

/** Saves your own rate for a rarity, or (perPack null) goes back to the published one. */
export async function savePullRate(input: PullRateInput): Promise<boolean> {
  const set = await prisma.cardSet.findUnique({ where: { id: input.setId }, select: { id: true } });
  if (!set) return false;
  // Same rarity however it's cased or spelled, so an override can't hide behind a typo variant.
  const existing = (await prisma.pullRate.findMany({ where: { setId: input.setId } })).filter(
    (r) => rarityKey(r.rarity) === rarityKey(input.rarity),
  );
  if (existing.length) await prisma.pullRate.deleteMany({ where: { id: { in: existing.map((r) => r.id) } } });
  if (input.perPack != null) {
    await prisma.pullRate.create({ data: { setId: input.setId, rarity: input.rarity, perPack: input.perPack } });
  }
  return true;
}

export async function savePackCount(input: PackCountInput): Promise<boolean> {
  const set = await prisma.cardSet.findUnique({ where: { id: input.setId }, select: { id: true } });
  if (!set) return false;
  const key = { setId: input.setId, itemExternalId: input.itemExternalId, printing: input.printing };
  if (input.packs == null) {
    await prisma.packCount.deleteMany({ where: key });
  } else {
    await prisma.packCount.upsert({
      where: { setId_itemExternalId_printing: key },
      create: { ...key, packs: input.packs },
      update: { packs: input.packs },
    });
  }
  return true;
}

// --- The analysis ---

async function buildAnalysis(
  item: SetItem,
  set: CardSet,
  opts: { retailPriceCents?: number | null; extraNames?: string[] } = {},
): Promise<OpenHoldDTO> {
  const assumptions = await loadAssumptions();
  const profile = findProfile(set.name);

  const [cardItems, overrideRows, packRow] = await Promise.all([
    prisma.setItem.findMany({ where: { setId: set.id, kind: "CARD" } }),
    prisma.pullRate.findMany({ where: { setId: set.id } }),
    prisma.packCount.findUnique({
      where: { setId_itemExternalId_printing: { setId: set.id, itemExternalId: item.externalId, printing: item.printing } },
    }),
  ]);
  const cardRows = cardItems.filter((i) => classifyItem(i) === "card").map(toCardRow);
  const overrides = new Map(overrideRows.map((r) => [rarityKey(r.rarity), r.perPack]));

  // Some hits live in a different set (30th Celebration's Classic Collection).
  const poolNames = [...new Set((profile?.slots ?? []).flatMap((s) => s.hits).map((h) => h.poolSet).filter((n): n is string => !!n))];
  const poolSets = poolNames.length ? await prisma.cardSet.findMany({ where: { name: { in: poolNames } } }) : [];
  const poolRows = new Map<string, CardRow[]>();
  for (const ps of poolSets) {
    const rows = await prisma.setItem.findMany({ where: { setId: ps.id, kind: "CARD" } });
    poolRows.set(ps.name, rows.map(toCardRow));
  }

  const warnings: string[] = [];
  const blockers: string[] = [];
  const rates: RateRow[] = [];
  const slots: ModelSlot[] = [];
  const covered = new Set<string>();
  const unpricedNoted = new Set<string>();

  const noteUnpriced = (rarity: string, unpriced: number) => {
    if (unpriced > 0 && !unpricedNoted.has(rarity)) {
      unpricedNoted.add(rarity);
      warnings.push(`${unpriced} ${rarity} card${unpriced === 1 ? " has" : "s have"} no price yet and ${unpriced === 1 ? "is" : "are"} counted as worthless.`);
    }
  };

  for (const slot of profile?.slots ?? []) {
    const modeled: ModelHit[] = [];
    for (const def of slot.hits) {
      const key = rarityKey(def.rarity);
      covered.add(key);
      const overridden = overrides.has(key);
      const perPack = overridden ? (overrides.get(key) as number) : def.perPack;

      const fromOtherSet = def.poolSet != null;
      const rows = fromOtherSet ? (poolRows.get(def.poolSet as string) ?? []) : cardRows;
      const pool = buildPool(rows, fromOtherSet ? null : def.rarity, assumptions);

      rates.push({
        rarity: def.rarity,
        slot: slot.label,
        perPack,
        published: def.perPack,
        overridden,
        cards: pool.cards,
        avgNetCents: mean(pool.values),
        maxMarketCents: pool.maxMarketCents,
        poolSetName: fromOtherSet ? (def.poolSet as string) : null,
      });

      if (perPack != null && perPack > 0) {
        if (pool.cards === 0) {
          warnings.push(
            fromOtherSet
              ? `${def.rarity} cards come from “${def.poolSet}”, which isn't loaded — open it on Browse to count them.`
              : `No ${def.rarity} cards are loaded for this set, so that rarity isn't counted.`,
          );
        } else {
          noteUnpriced(def.rarity, pool.unpriced);
          modeled.push({ rarity: def.rarity, perPack, values: pool.values });
        }
      }
    }
    if (modeled.length) slots.push({ label: slot.label, hits: modeled });
  }

  // Rates you've added for rarities the published profile doesn't cover (or for a set with no profile).
  for (const [key, perPack] of overrides) {
    if (covered.has(key)) continue;
    covered.add(key);
    const rarity = overrideRows.find((r) => rarityKey(r.rarity) === key)?.rarity ?? key;
    const pool = buildPool(cardRows, rarity, assumptions);
    rates.push({
      rarity,
      slot: "Your rate",
      perPack,
      published: null,
      overridden: true,
      cards: pool.cards,
      avgNetCents: mean(pool.values),
      maxMarketCents: pool.maxMarketCents,
      poolSetName: null,
    });
    if (perPack > 0 && pool.cards > 0) {
      noteUnpriced(rarity, pool.unpriced);
      slots.push({ label: "Your rate", hits: [{ rarity, perPack, values: pool.values }] });
    } else if (perPack > 0) {
      warnings.push(`No ${rarity} cards are loaded for this set, so your ${rarity} rate isn't counted.`);
    }
  }

  // Rates adding up past one card per slot (after your edits) get scaled back, with a note.
  const modelSlots = slots.map((s) => {
    const sum = s.hits.reduce((n, h) => n + h.perPack, 0);
    if (sum > 1.0000001) {
      warnings.push(`The rates in “${s.label}” add up to ${(sum * 100).toFixed(1)}% — more than one card per pack — so they were scaled down to 100%.`);
      return scaleSlots([s], 1)[0];
    }
    return s;
  });

  // Rarities in the set that could be hits but have no rate: shown so they aren't silently ignored.
  const unmodeled: UnmodeledRarity[] = [];
  const seenRarities = new Map<string, string>();
  for (const r of cardRows) {
    const key = rarityKey(r.rarity);
    if (!isBulkRarity(r.rarity) && !covered.has(key) && !seenRarities.has(key)) seenRarities.set(key, r.rarity as string);
  }
  for (const [, rarity] of seenRarities) {
    const pool = buildPool(cardRows, rarity, assumptions);
    unmodeled.push({ rarity, cards: pool.cards, avgMarketCents: pool.avgMarketCents, maxMarketCents: pool.maxMarketCents });
  }
  unmodeled.sort((x, y) => (y.maxMarketCents ?? 0) - (x.maxMarketCents ?? 0));

  // The things that stop a result from existing at all.
  const packs = guessPacks([...(opts.extraNames ?? []), item.name], packRow?.packs);
  if (!set.itemsFetchedAt) {
    blockers.push("This set's card prices haven't been loaded yet — open the set on Browse first.");
  } else if (cardRows.length === 0) {
    blockers.push("No cards are listed for this set yet (it may not be fully released), so there's nothing to open into.");
  } else if (isOversized(set)) {
    blockers.push("This set is too large for the free tier to load completely, so its card pool is incomplete.");
  }
  if (packs.packs == null) blockers.push(packs.note ?? "Enter how many packs this contains.");
  if (!blockers.length && modelSlots.length === 0) {
    blockers.push(
      profile
        ? "None of this set's published rates apply to the cards loaded — check the rates below."
        : "No pull rates are published for this set yet. Enter a rate for each rarity you want counted, under Pull rates.",
    );
  }
  if (set.itemsFetchedAt && Date.now() - set.itemsFetchedAt.getTime() > STALE_AFTER_MS) {
    const days = Math.floor((Date.now() - set.itemsFetchedAt.getTime()) / DAY_MS);
    warnings.push(`Card prices are ${days} days old — refresh the set on Browse for a current figure.`);
  }
  if (item.marketPriceCents == null) {
    warnings.push("This product has no sealed market price, so there's nothing to compare opening against.");
  }

  const result =
    blockers.length === 0 && packs.packs != null
      ? analyze({
          packs: packs.packs,
          sealedCents: item.marketPriceCents,
          retailCents: opts.retailPriceCents ?? null,
          slots: modelSlots,
          assumptions,
          seed: ((set.id * 31 + item.externalId) >>> 0) || 1,
        })
      : null;

  return {
    item: {
      id: item.id,
      name: item.name,
      setId: set.id,
      setName: set.name,
      setSlug: set.slug,
      externalId: item.externalId,
      printing: item.printing,
      marketPriceCents: item.marketPriceCents,
    },
    packs: {
      value: packs.packs,
      source: packs.source,
      note: packs.note,
      defaultValue: guessPacks([...(opts.extraNames ?? []), item.name]).packs,
    },
    sealedPriceCents: item.marketPriceCents,
    retailPriceCents: opts.retailPriceCents ?? null,
    assumptions,
    profile: profile
      ? { ...profile.source, notes: profile.notes }
      : null,
    rates,
    unmodeled,
    result,
    blockers,
    warnings,
    pricesFetchedAt: set.itemsFetchedAt?.toISOString() ?? null,
  };
}

/** Open or hold for one sealed row on a set page (by its SetItem id). */
export async function analyzeItem(itemId: string): Promise<OpenHoldDTO | null> {
  const item = await prisma.setItem.findUnique({ where: { id: itemId }, include: { set: true } });
  if (!item || classifyItem(item) !== "sealed") return null;
  return buildAnalysis(item, item.set);
}

