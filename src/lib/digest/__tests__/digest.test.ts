import { describe, it, expect } from "vitest";
import { DIGEST_GRACE_HOURS, collapseMoves, digestDue } from "../pure";
import { MAX_TOTAL_CHARS, embedChars, formatDigest } from "../format";
import { digestIsEmpty } from "../types";
import type { Digest } from "../types";

const at = (iso: string) => new Date(iso);

describe("collapseMoves", () => {
  it("reports the net move across a window, not each step", () => {
    const moves = collapseMoves([
      { sourceId: "a", oldPriceCents: 1000, newPriceCents: 900, createdAt: at("2026-10-08T04:00:00Z") },
      { sourceId: "a", oldPriceCents: 900, newPriceCents: 700, createdAt: at("2026-10-08T08:00:00Z") },
    ]);
    expect(moves.get("a")).toEqual({ fromCents: 1000, toCents: 700 });
  });

  it("drops a card that ended the day where it started", () => {
    const moves = collapseMoves([
      { sourceId: "a", oldPriceCents: 1000, newPriceCents: 800, createdAt: at("2026-10-08T04:00:00Z") },
      { sourceId: "a", oldPriceCents: 800, newPriceCents: 1000, createdAt: at("2026-10-08T08:00:00Z") },
    ]);
    expect(moves.has("a")).toBe(false);
  });

  it("orders by time even when events arrive shuffled", () => {
    const moves = collapseMoves([
      { sourceId: "a", oldPriceCents: 900, newPriceCents: 700, createdAt: at("2026-10-08T08:00:00Z") },
      { sourceId: "a", oldPriceCents: 1000, newPriceCents: 900, createdAt: at("2026-10-08T04:00:00Z") },
    ]);
    expect(moves.get("a")).toEqual({ fromCents: 1000, toCents: 700 });
  });

  it("ignores a first-ever reading (no old price) but keeps the later moves", () => {
    const moves = collapseMoves([
      { sourceId: "a", oldPriceCents: null, newPriceCents: 1000, createdAt: at("2026-10-08T04:00:00Z") },
      { sourceId: "a", oldPriceCents: 1000, newPriceCents: 850, createdAt: at("2026-10-08T08:00:00Z") },
    ]);
    expect(moves.get("a")).toEqual({ fromCents: 1000, toCents: 850 });
  });

  it("keeps sources separate", () => {
    const moves = collapseMoves([
      { sourceId: "a", oldPriceCents: 100, newPriceCents: 200, createdAt: at("2026-10-08T04:00:00Z") },
      { sourceId: "b", oldPriceCents: 500, newPriceCents: 400, createdAt: at("2026-10-08T05:00:00Z") },
    ]);
    expect([...moves.keys()].sort()).toEqual(["a", "b"]);
  });
});

describe("digestDue", () => {
  const config = { digestEnabled: true, digestHour: 9, lastDigestAt: null as Date | null };
  const local = (h: number, day = 8) => new Date(2026, 9, day, h, 0, 0);

  it("is never due when switched off", () => {
    expect(digestDue({ ...config, digestEnabled: false }, local(9))).toBe(false);
  });

  it("is due from the chosen hour, not before", () => {
    expect(digestDue(config, local(8))).toBe(false);
    expect(digestDue(config, local(9))).toBe(true);
  });

  it("still goes out late within the grace window, but not as a night-time 'morning' digest", () => {
    expect(digestDue(config, local(9 + DIGEST_GRACE_HOURS - 1))).toBe(true);
    expect(digestDue(config, local(9 + DIGEST_GRACE_HOURS))).toBe(false);
    expect(digestDue(config, local(23))).toBe(false);
  });

  it("sends at most once per local day", () => {
    expect(digestDue({ ...config, lastDigestAt: local(9) }, local(10))).toBe(false);
    expect(digestDue({ ...config, lastDigestAt: local(9, 7) }, local(10, 8))).toBe(true);
  });
});

const baseDigest = (over: Partial<Digest> = {}): Digest => ({
  since: "2026-10-07T09:00:00.000Z",
  until: "2026-10-08T09:00:00.000Z",
  cardMoves: [],
  smartAlerts: [],
  deals: [],
  ...over,
});

describe("formatDigest", () => {
  it("sends nothing on a day with nothing to report", () => {
    expect(digestIsEmpty(baseDigest())).toBe(true);
    expect(formatDigest(baseDigest())).toBeNull();
  });

  it("includes only the sections that have something in them", () => {
    const payload = formatDigest(
      baseDigest({
        smartAlerts: [{ watchName: "Cheap SIRs", setName: "30th", items: [{ name: "Mew ex", priceCents: 4999, url: "https://x" }] }],
      }),
    )!;
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds![0].title).toMatch(/Smart alerts [(]1 new matches[)]/);
    expect(payload.embeds![0].description).toContain("$49.99");
  });

  it("lists new deals on missing cards with the saving, and warns about an extreme gap", () => {
    const deal = { setId: 1, key: "5", name: "Mew ex", setName: "Perfect Order", number: "005/124", lowCents: 2000, marketCents: 3200, savingsPct: 0.375, suspicious: false, url: "https://www.tcgplayer.com/product/1" };
    const payload = formatDigest(baseDigest({ deals: [deal, { ...deal, key: "6", name: "Odd Card", lowCents: 100, marketCents: 5000, savingsPct: 0.98, suspicious: true }] }))!;
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds![0].title).toMatch(/Deals on cards you're missing \(2\)/);
    const text = payload.embeds![0].description!;
    expect(text).toContain("[Mew ex](https://www.tcgplayer.com/product/1)");
    expect(text).toContain("Perfect Order 005/124: **$20.00** (market $32.00, 38% off)");
    expect(text).toContain("unusually low");
    expect(payload.embeds![0].footer?.text).toMatch(/any condition/);
  });

  it("a digest with only deals is still worth sending", () => {
    expect(digestIsEmpty(baseDigest())).toBe(true);
    expect(digestIsEmpty(baseDigest({ deals: [{ setId: 1, key: "1", name: "A", setName: "S", number: null, lowCents: 1, marketCents: 2, savingsPct: 0.5, suspicious: false, url: "https://u" }] }))).toBe(false);
  });

  it("shows direction and the user's alert threshold on watchlist moves", () => {
    const payload = formatDigest(
      baseDigest({
        cardMoves: [
          { cardName: "Mew ex", setName: "30th", fromCents: 1200, toCents: 900, thresholdCents: 1000 },
          { cardName: "Pikachu", setName: "30th", fromCents: 500, toCents: 650, thresholdCents: null },
        ],
      }),
    )!;
    const text = payload.embeds![0].description!;
    expect(text).toContain("▼ **Mew ex**");
    expect(text).toContain("alert ≤ $10.00");
    expect(text).toContain("▲ **Pikachu**");
  });

  it("stays inside Discord's size limits however much happened", () => {
    const long = "A very long product or card name that goes on and on ".repeat(6);
    const payload = formatDigest(
      baseDigest({
        cardMoves: Array.from({ length: 40 }, (_, i) => ({
          cardName: `${long}${i}`, setName: "Some Set", fromCents: 100000, toCents: 90000, thresholdCents: 95000,
        })),
        smartAlerts: Array.from({ length: 20 }, (_, i) => ({
          watchName: `${long}${i}`, setName: "S", items: Array.from({ length: 30 }, (_, j) => ({ name: `${long}${j}`, priceCents: 100 + j, url: "https://u" })),
        })),
      }),
    )!;
    expect(embedChars(payload)).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
    for (const e of payload.embeds!) expect(e.description!.length).toBeLessThanOrEqual(4096);
    expect(payload.embeds!.length).toBeLessThanOrEqual(10);
  });

  it("says how many rows were left out instead of dropping them silently", () => {
    const payload = formatDigest(
      baseDigest({
        cardMoves: Array.from({ length: 12 }, (_, i) => ({
          cardName: `Card ${i}`, setName: "Set", fromCents: 2000, toCents: 1000, thresholdCents: null,
        })),
      }),
    )!;
    expect(payload.embeds![0].description).toContain("…and 4 more");
  });
});
