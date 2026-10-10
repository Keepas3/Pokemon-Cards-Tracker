import cron, { type ScheduledTask } from "node-cron";
import { pollAllCardPrices } from "@/lib/cardPoller";
import { fillNextSetPrices } from "@/lib/sets/setsService";
import { FILL_INTERVAL_MS } from "@/lib/sets/freshness";
import { digestTick } from "@/lib/digest/send";
import { takeSnapshot } from "@/lib/backup/snapshot";

// Card price checks cost one request PER card price source, and tcgapi.dev's
// free tier caps out around 100 requests/day — a handful of watched cards
// checked every few minutes would blow through that in hours. Market prices
// don't move that fast, so a few checks a day is plenty. Kept well under
// budget on purpose; not (yet) a Settings knob.
const CARD_PRICE_INTERVAL_MS = 4 * 60 * 60 * 1000;

let scheduledTask: ScheduledTask | null = null;
let lastCardPriceAt = 0;
let cardPriceRunning = false;
let lastSetFillAt = 0;
let setFillRunning = false;
// Sets whose last background fetch failed -> epoch ms before which they're skipped.
const setFillSkipUntil = new Map<number, number>();

async function cardPriceTick() {
  if (cardPriceRunning) return;
  if (Date.now() - lastCardPriceAt < CARD_PRICE_INTERVAL_MS) return;

  cardPriceRunning = true;
  lastCardPriceAt = Date.now();
  try {
    const results = await pollAllCardPrices();
    const changed = results.filter((r) => r.priceChanged);
    const errors = results.filter((r) => !r.ok);
    if (changed.length || errors.length) {
      console.log(
        `[scheduler] checked ${results.length} card price source(s): ${changed.length} changed, ${errors.length} error(s)`,
      );
    }
  } catch (err) {
    console.error("[scheduler] card price cycle failed:", err);
  } finally {
    cardPriceRunning = false;
  }
}

/**
 * Background fill of set price ranges: one set per FILL_INTERVAL_MS, and only
 * while the daily API budget has room to spare (see fillNextSetPrices). Exported
 * so a single step can be run on its own, without starting every other tick.
 */
export async function setFillTick() {
  if (setFillRunning) return;
  if (Date.now() - lastSetFillAt < FILL_INTERVAL_MS) return;

  setFillRunning = true;
  lastSetFillAt = Date.now();
  try {
    const result = await fillNextSetPrices(setFillSkipUntil);
    // Idle / waiting / no-key are the quiet steady states — only log real work.
    if (result.status === "filled") {
      console.log(
        `[scheduler] set prices: ${result.firstLoad ? "loaded" : "refreshed"} "${result.setName}"${result.tier === "watched" ? " (has a smart alert)" : ""}`,
      );
    } else if (result.status === "error") {
      console.error(`[scheduler] set prices: couldn't fetch "${result.setName}": ${result.error}`);
    }
  } catch (err) {
    console.error("[scheduler] set price fill failed:", err);
  } finally {
    setFillRunning = false;
  }
}

let snapshotRunning = false;

/** Once a day, a copy of the database (see lib/backup/snapshot.ts). Cheap to check every minute. */
async function snapshotTick() {
  if (snapshotRunning) return;
  snapshotRunning = true;
  try {
    const result = await takeSnapshot();
    if (result.status === "taken") console.log(`[scheduler] database snapshot saved (${result.file}${result.pruned ? `, removed ${result.pruned} old` : ""})`);
    else if (result.status === "error") console.error(`[scheduler] database snapshot failed: ${result.error}`);
  } catch (err) {
    console.error("[scheduler] database snapshot failed:", err);
  } finally {
    snapshotRunning = false;
  }
}

let digestRunning = false;

/** Sends the morning digest when it's due (once a day, at the hour chosen in Settings). */
async function morningDigestTick() {
  if (digestRunning) return;
  digestRunning = true;
  try {
    for (const { name, result } of await digestTick()) {
      if (result.status === "sent") console.log(`[scheduler] morning digest sent to ${name} (${result.sections} section(s))`);
      else if (result.status === "error") console.error(`[scheduler] morning digest for ${name} failed: ${result.error}`);
    }
  } catch (err) {
    console.error("[scheduler] morning digest failed:", err);
  } finally {
    digestRunning = false;
  }
}

/** Starts the in-process cron loop. Safe to call more than once — only starts one task. */
export function startScheduler() {
  if (scheduledTask) return;
  // Ticks every minute; each tick function gates on its own interval so all
  // four can run off one cron job.
  scheduledTask = cron.schedule("* * * * *", () => {
    void cardPriceTick();
    void setFillTick();
    void morningDigestTick();
    void snapshotTick();
  });
  // Run shortly after startup so the app has data without waiting for the
  // first interval to elapse. Each is staggered so a fresh restart doesn't
  // fire a burst of requests to multiple external services at once.
  setTimeout(() => void cardPriceTick(), 35_000);
  setTimeout(() => void setFillTick(), 50_000);
  setTimeout(() => void snapshotTick(), 65_000);
  console.log(
    "[scheduler] started — checking watched card prices, filling set prices and sending the morning digest on an interval",
  );
}
