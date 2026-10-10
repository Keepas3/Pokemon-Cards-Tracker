// Plain-language reading of an Open-or-hold result, so the panel leads with
// what the numbers mean rather than a wall of figures. Pure and client-safe.

import { formatPrice } from "@/lib/labels";
import type { AnalysisResult, Verdict } from "./types";

/** "<1%", "34%", ">99%" — never a misleading 0% or 100% for a result that's merely very unlikely. */
export function formatProb(p: number | null | undefined): string {
  if (p == null) return "—";
  if (p < 0.005) return "<1%";
  if (p > 0.995) return ">99%";
  return `${Math.round(p * 100)}%`;
}

/** A per-pack rate as a percentage, with enough precision for tiny ones. */
export function formatRate(p: number | null | undefined): string {
  if (p == null) return "—";
  const pct = p * 100;
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(2)}%`;
}

export const verdictLabels: Record<Verdict, string> = {
  open: "Open",
  hold: "Hold",
  "toss-up": "Toss-up",
};

export const verdictBlurbs: Record<Verdict, string> = {
  open: "Opening beats the sealed value on average, and in most cases.",
  hold: "The sealed value beats opening on average, and in most cases.",
  "toss-up": "The average and the typical outcome disagree — usually a few big hits carrying the average.",
};

export interface SummaryContext {
  sealedPriceCents: number | null;
  retailPriceCents: number | null;
  /** Whether the hit rates are published ones (vs. ones you entered). */
  published: boolean;
}

/** The sentences under the headline numbers. */
export function describeResult(r: AnalysisResult, ctx: SummaryContext): string[] {
  const lines: string[] = [];

  if (r.sealedNetCents != null && ctx.sealedPriceCents != null) {
    lines.push(
      `Held sealed, it's worth about ${formatPrice(Math.round(r.sealedNetCents))} after fees (market price ${formatPrice(ctx.sealedPriceCents)}).`,
    );
  }
  lines.push(
    `Opened, its ${r.packs} pack${r.packs === 1 ? "" : "s"} return about ${formatPrice(Math.round(r.evCents))} on average. ` +
      `Half of opened products return less than ${formatPrice(Math.round(r.spread.p50))}, and nine in ten return less than ${formatPrice(Math.round(r.spread.p90))}.`,
  );

  if (r.probBeatsSealed != null) {
    lines.push(`${formatProb(r.probBeatsSealed)} of opened products return more than the sealed value.`);
  }

  if (r.breakEvenScale != null) {
    const which = ctx.published ? "published" : "assumed";
    if (r.breakEvenScale > 1) {
      lines.push(
        `Hit rates would have to be about ${r.breakEvenScale.toFixed(1)}× the ${which} ones for opening to match holding on average.`,
      );
    } else {
      lines.push(
        `Opening stays ahead on average unless real hit rates are more than ${Math.round((1 - r.breakEvenScale) * 100)}% below the ${which} ones.`,
      );
    }
  }

  if (ctx.retailPriceCents != null) {
    const diff = r.evCents - ctx.retailPriceCents;
    lines.push(
      `Against the ${formatPrice(ctx.retailPriceCents)} retail price: opening is worth ${diff >= 0 ? "+" : "−"}${formatPrice(Math.abs(Math.round(diff)))} on average, ` +
        `and ${formatProb(r.probBeatsPaid)} of opened products return more than you paid.`,
    );
  }
  return lines;
}
