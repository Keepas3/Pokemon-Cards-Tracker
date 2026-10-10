import { describe, it, expect } from "vitest";
import { describeResult, formatProb, formatRate } from "../summary";
import type { AnalysisResult } from "../types";

const result = (over: Partial<AnalysisResult> = {}): AnalysisResult => ({
  packs: 9,
  sealedNetCents: 12568,
  evCents: 5558,
  hitsEvCents: 5558,
  bulkEvCents: 0,
  byRarity: [],
  spread: { p10: 980, p50: 3401, p90: 12835 },
  probBeatsSealed: 0.1,
  probBeatsPaid: 0.3,
  sensitivity: [],
  breakEvenScale: 2.26,
  verdict: "hold",
  ...over,
});

const ctx = { sealedPriceCents: 14446, retailPriceCents: null, published: true };

describe("formatProb", () => {
  it("never claims certainty or impossibility", () => {
    expect(formatProb(0)).toBe("<1%");
    expect(formatProb(0.004)).toBe("<1%");
    expect(formatProb(1)).toBe(">99%");
    expect(formatProb(0.456)).toBe("46%");
    expect(formatProb(null)).toBe("—");
  });
});

describe("formatRate", () => {
  it("keeps precision for small rates", () => {
    expect(formatRate(0.2097)).toBe("21.0%");
    expect(formatRate(0.0123)).toBe("1.23%");
    expect(formatRate(0.0006)).toBe("0.06%");
    expect(formatRate(null)).toBe("—");
  });
});

describe("describeResult", () => {
  it("states the sealed value, the opened value and the odds", () => {
    const text = describeResult(result(), ctx).join(" ");
    expect(text).toContain("$125.68 after fees");
    expect(text).toContain("market price $144.46");
    expect(text).toContain("9 packs return about $55.58");
    expect(text).toContain("10% of opened products return more than the sealed value");
  });

  it("says how far off the hit rates would have to be", () => {
    expect(describeResult(result(), ctx).join(" ")).toContain("2.3× the published ones");
    const ahead = describeResult(result({ breakEvenScale: 0.6 }), ctx).join(" ");
    expect(ahead).toContain("more than 40% below");
  });

  it("compares with the retail price when there is one", () => {
    const text = describeResult(result(), { ...ctx, retailPriceCents: 5999 }).join(" ");
    expect(text).toContain("Against the $59.99 retail price");
    expect(text).toContain("30% of opened products return more than you paid");
  });

  it("copes with a missing sealed price", () => {
    const text = describeResult(result({ sealedNetCents: null, probBeatsSealed: null, breakEvenScale: null, verdict: null }), {
      ...ctx,
      sealedPriceCents: null,
    }).join(" ");
    expect(text).not.toContain("sealed value");
    expect(text).toContain("9 packs return about");
  });

  it("says 'assumed' when the rates are the user's own", () => {
    expect(describeResult(result(), { ...ctx, published: false }).join(" ")).toContain("assumed");
  });
});
