// Small pure pieces of the digest, kept apart from the database code so the
// logic that's easy to get subtly wrong — net price moves, when a digest is due —
// can be tested directly.

export interface PriceEventLike {
  sourceId: string;
  oldPriceCents: number | null;
  newPriceCents: number | null;
  createdAt: Date;
}

/**
 * Collapses a window's price-change events into one net move per price source:
 * the price it started the window at → the price it ended at. A card that went
 * $10 → $8 → $10 over the day moved nowhere, so it isn't reported.
 */
export function collapseMoves(events: PriceEventLike[]): Map<string, { fromCents: number; toCents: number }> {
  const bySource = new Map<string, PriceEventLike[]>();
  for (const e of events) {
    const list = bySource.get(e.sourceId) ?? [];
    list.push(e);
    bySource.set(e.sourceId, list);
  }

  const moves = new Map<string, { fromCents: number; toCents: number }>();
  for (const [sourceId, list] of bySource) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // The first-ever reading has no "old" price; start from the first event that does.
    const first = list.find((e) => e.oldPriceCents != null);
    const last = [...list].reverse().find((e) => e.newPriceCents != null);
    if (!first || !last) continue;
    const fromCents = first.oldPriceCents!;
    const toCents = last.newPriceCents!;
    if (fromCents !== toCents) moves.set(sourceId, { fromCents, toCents });
  }
  return moves;
}

/** How long after the chosen hour a missed digest may still go out the same day. */
export const DIGEST_GRACE_HOURS = 6;

/**
 * Whether the morning digest is due: switched on, within a few hours after the
 * chosen local hour, and not already sent today. The grace window means an app
 * that wasn't running at exactly 9:00 still sends at 9:40 — but won't send a
 * "morning" digest at 11pm.
 */
export function digestDue(
  config: { digestEnabled: boolean; digestHour: number; lastDigestAt: Date | null },
  now: Date,
): boolean {
  if (!config.digestEnabled) return false;
  const hour = now.getHours();
  if (hour < config.digestHour || hour >= config.digestHour + DIGEST_GRACE_HOURS) return false;
  if (!config.lastDigestAt) return true;
  const last = config.lastDigestAt;
  const sameDay =
    last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth() && last.getDate() === now.getDate();
  return !sameDay;
}

