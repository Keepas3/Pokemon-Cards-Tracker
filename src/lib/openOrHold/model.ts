// The maths of Open or hold. Pure: feed it a pack structure and card values,
// get numbers back. Nothing here reads a database or the network.
//
// Model: a pack has slots; each slot holds one hit rarity with its published
// per-pack probability, or nothing special. A hit is a card drawn uniformly
// from that rarity's pool, worth its market price less fees — or nothing if it
// falls under the bulk cut-off. Opening a product opens `packs` of them.
// Expected value is exact (a sum); the spread and the chance of beating the
// sealed price come from a seeded Monte-Carlo run, so a result never changes
// between page loads.

import type {
  Assumptions,
  AnalysisResult,
  RarityContribution,
  SensitivityPoint,
  Verdict,
} from "./types";

// --- Pools ---

export interface CardRow {
  externalId: number;
  number: string | null;
  rarity: string | null;
  marketPriceCents: number | null;
}

/** Spellings of one rarity that should compare equal (tcgapi.dev has "RBG Rare" for TCGplayer's "RGB Rare"). */
export function rarityKey(r: string | null | undefined): string {
  return (r ?? "").toLowerCase().replace(/\s+/g, " ").trim().replace(/^rbg\b/, "rgb");
}

/** Rarities that are filler, not hits: never offered as "missing a pull rate". */
const BULK_RARITIES = new Set(["", "common", "uncommon", "rare", "code card"]);
export const isBulkRarity = (r: string | null | undefined) => BULK_RARITIES.has(rarityKey(r));

/**
 * One entry per distinct card: rows that share a card number (a card's several
 * printings) count once, at the average of their prices.
 */
export function distinctCards(rows: CardRow[]): { priceCents: number | null }[] {
  const byCard = new Map<string, number[]>();
  for (const r of rows) {
    const key = r.number ? `n:${r.number}` : `id:${r.externalId}`;
    const prices = byCard.get(key) ?? [];
    if (r.marketPriceCents != null && r.marketPriceCents > 0) prices.push(r.marketPriceCents);
    byCard.set(key, prices);
  }
  return [...byCard.values()].map((p) => ({
    priceCents: p.length ? p.reduce((a, b) => a + b, 0) / p.length : null,
  }));
}

/** What one card sells for after fees, or 0 if it's under the bulk cut-off or has no price. */
export function netValue(priceCents: number | null | undefined, a: Assumptions): number {
  if (priceCents == null || priceCents <= 0 || priceCents < a.bulkThresholdCents) return 0;
  return priceCents * (1 - a.feePct / 100);
}

export interface Pool {
  /** Net sale value of each distinct card, in cents. */
  values: number[];
  cards: number;
  unpriced: number;
  avgMarketCents: number | null;
  maxMarketCents: number | null;
}

/** The pool of cards of one rarity (or, with `rarity` null, every card in the rows). */
export function buildPool(rows: CardRow[], rarity: string | null, a: Assumptions): Pool {
  const key = rarity == null ? null : rarityKey(rarity);
  const cards = distinctCards(rows.filter((r) => key == null || rarityKey(r.rarity) === key));
  const priced = cards.filter((c) => c.priceCents != null).map((c) => c.priceCents as number);
  return {
    values: cards.map((c) => netValue(c.priceCents, a)),
    cards: cards.length,
    unpriced: cards.length - priced.length,
    avgMarketCents: priced.length ? priced.reduce((x, y) => x + y, 0) / priced.length : null,
    maxMarketCents: priced.length ? Math.max(...priced) : null,
  };
}

// --- Expected value ---

export interface ModelHit {
  rarity: string;
  perPack: number;
  values: number[];
}
export interface ModelSlot {
  label: string;
  hits: ModelHit[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Expected hit value of one pack, and each rarity's share of it. */
export function expectedPerPack(slots: ModelSlot[]): { total: number; byRarity: { rarity: string; perPack: number; cards: number; avgNetCents: number; evPerPack: number }[] } {
  const byRarity = slots.flatMap((s) =>
    s.hits.map((h) => {
      const avg = mean(h.values);
      return { rarity: h.rarity, perPack: h.perPack, cards: h.values.length, avgNetCents: avg, evPerPack: h.perPack * avg };
    }),
  );
  return { total: byRarity.reduce((n, r) => n + r.evPerPack, 0), byRarity };
}

/** Every hit rate multiplied by `k`, scaled back so no slot's rates add up to more than 1. */
export function scaleSlots(slots: ModelSlot[], k: number): ModelSlot[] {
  return slots.map((s) => {
    const sum = s.hits.reduce((n, h) => n + h.perPack * k, 0);
    const f = sum > 1 ? k / sum : k;
    return { ...s, hits: s.hits.map((h) => ({ ...h, perPack: h.perPack * f })) };
  });
}

// --- Monte-Carlo ---

/** Small, fast, seedable generator (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimSummary {
  mean: number;
  quantile(p: number): number;
  /** Share of trials that returned strictly more than `x`. */
  fractionAbove(x: number): number;
}

/** Opens `packs` packs, `trials` times over, and summarises what each product returned. */
export function simulate(slots: ModelSlot[], packs: number, bulkPerPackCents: number, trials: number, seed: number): SimSummary {
  const rng = makeRng(seed);
  const totals = new Float64Array(trials);
  const usable = slots.filter((s) => s.hits.some((h) => h.perPack > 0 && h.values.length > 0));

  for (let t = 0; t < trials; t++) {
    let total = bulkPerPackCents * packs;
    for (let p = 0; p < packs; p++) {
      for (const slot of usable) {
        const u = rng();
        let acc = 0;
        for (const h of slot.hits) {
          acc += h.perPack;
          if (u < acc) {
            total += h.values[Math.floor(rng() * h.values.length)];
            break;
          }
        }
      }
    }
    totals[t] = total;
  }

  totals.sort();
  const quantile = (p: number) => totals[Math.min(trials - 1, Math.max(0, Math.floor(p * trials)))];
  return {
    mean: totals.reduce((a, b) => a + b, 0) / trials,
    quantile,
    fractionAbove(x: number) {
      // First index whose value is > x (binary search over the sorted totals).
      let lo = 0;
      let hi = trials;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (totals[mid] > x) hi = mid;
        else lo = mid + 1;
      }
      return (trials - lo) / trials;
    },
  };
}

// --- Putting it together ---

export interface AnalyzeInput {
  packs: number;
  /** Sealed market price, before fees. */
  sealedCents: number | null;
  /** Retail price, when the product is one you can buy at retail. */
  retailCents: number | null;
  slots: ModelSlot[];
  assumptions: Assumptions;
  trials?: number;
  seed?: number;
}

export const DEFAULT_TRIALS = 20_000;
export const SENSITIVITY_SCALES = [0.5, 1, 1.5];

/**
 * Hold if opening is expected to lose to the sealed price AND usually does;
 * Open if it's expected to win AND usually does; otherwise it's a toss-up —
 * typically a result carried by a few lucky hits. The verdict is derived from
 * the numbers beside it and is not a recommendation on its own.
 */
export function verdictOf(evCents: number, sealedNetCents: number | null, probBeatsSealed: number | null): Verdict | null {
  if (sealedNetCents == null || probBeatsSealed == null) return null;
  if (evCents >= sealedNetCents && probBeatsSealed >= 0.5) return "open";
  if (evCents < sealedNetCents && probBeatsSealed < 0.5) return "hold";
  return "toss-up";
}

export function analyze(input: AnalyzeInput): AnalysisResult {
  const { packs, slots, assumptions: a } = input;
  const trials = input.trials ?? DEFAULT_TRIALS;
  const seed = input.seed ?? 1;
  const sealedNet = input.sealedCents != null ? input.sealedCents * (1 - a.feePct / 100) : null;

  const per = expectedPerPack(slots);
  const hitsEv = per.total * packs;
  const bulkEv = a.bulkPerPackCents * packs;
  const ev = hitsEv + bulkEv;

  const sim = simulate(slots, packs, a.bulkPerPackCents, trials, seed);
  const probBeatsSealed = sealedNet != null ? sim.fractionAbove(sealedNet) : null;
  const probBeatsPaid = input.retailCents != null ? sim.fractionAbove(input.retailCents) : null;

  const sensitivity: SensitivityPoint[] = SENSITIVITY_SCALES.map((scale) => {
    if (scale === 1) return { scale, evCents: ev, probBeatsSealed };
    const scaled = scaleSlots(slots, scale);
    const s = simulate(scaled, packs, a.bulkPerPackCents, trials, seed);
    return {
      scale,
      evCents: expectedPerPack(scaled).total * packs + bulkEv,
      probBeatsSealed: sealedNet != null ? s.fractionAbove(sealedNet) : null,
    };
  });

  const byRarity: RarityContribution[] = per.byRarity
    .map((r) => ({ rarity: r.rarity, perPack: r.perPack, cards: r.cards, avgNetCents: r.avgNetCents, evCents: r.evPerPack * packs }))
    .sort((x, y) => y.evCents - x.evCents);

  return {
    packs,
    sealedNetCents: sealedNet,
    evCents: ev,
    hitsEvCents: hitsEv,
    bulkEvCents: bulkEv,
    byRarity,
    spread: { p10: sim.quantile(0.1), p50: sim.quantile(0.5), p90: sim.quantile(0.9) },
    probBeatsSealed,
    probBeatsPaid,
    sensitivity,
    breakEvenScale: sealedNet != null && hitsEv > 0 ? Math.max(0, (sealedNet - bulkEv) / hitsEv) : null,
    verdict: verdictOf(ev, sealedNet, probBeatsSealed),
  };
}
