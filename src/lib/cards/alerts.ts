// When a card's new price should ping someone. Pure, so the "alert once per dip" rule is tested.

export type AlertDecision = "send" | "reset" | "none";

/**
 * - `send`: the price is at or under the person's limit and they haven't already been told
 *   about a price this low;
 * - `reset`: it rose back above the limit after an alert, so a later dip should alert again;
 * - `none`: nothing to do (no limit set, still above it, or already told).
 */
export function decideAlert(
  entry: { thresholdCents: number | null; lastNotifiedThresholdCents: number | null },
  priceCents: number,
): AlertDecision {
  if (entry.thresholdCents == null) return "none";
  const meetsThreshold = priceCents <= entry.thresholdCents;
  const alreadyTold = entry.lastNotifiedThresholdCents != null && priceCents >= entry.lastNotifiedThresholdCents;
  if (meetsThreshold && !alreadyTold) return "send";
  if (!meetsThreshold && entry.lastNotifiedThresholdCents != null) return "reset";
  return "none";
}
