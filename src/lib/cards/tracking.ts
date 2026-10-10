// Tracked cards, per person. A Card and its price sources are shared (one price check serves
// everyone who follows the card); what belongs to a person is the CardWatchlistEntry: "this card
// is on my list", with an optional price to be told about.

import { prisma } from "@/lib/prisma";
import type { Card, CardPriceProvider, CardPriceSource, CardWatchlistEntry } from "@/generated/prisma/client";

export type TrackedCard = Card & {
  priceSources: CardPriceSource[];
  /** This person's alert, or null when the card is tracked without one. */
  watchlistEntry: { id: string; cardId: string; thresholdCents: number } | null;
};

function withEntry(card: Card & { priceSources: CardPriceSource[] }, entry: CardWatchlistEntry): TrackedCard {
  return {
    ...card,
    watchlistEntry: entry.thresholdCents == null ? null : { id: entry.id, cardId: entry.cardId, thresholdCents: entry.thresholdCents },
  };
}

const cardInclude = { priceSources: { orderBy: { provider: "asc" } } } as const;

/** Every card on this person's list, newest first. With `alertsOnly`, just those with a price alert. */
export async function listTrackedCards(profileId: string, opts: { alertsOnly?: boolean } = {}): Promise<TrackedCard[]> {
  const entries = await prisma.cardWatchlistEntry.findMany({
    where: { profileId, ...(opts.alertsOnly ? { thresholdCents: { not: null } } : {}) },
    include: { card: { include: cardInclude } },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => withEntry(e.card, e));
}

export interface NewTrackedCard {
  name: string;
  setName: string;
  number: string | null;
  imageUrl: string | null;
  provider: CardPriceProvider;
  externalId: string;
  variant: string | null;
  priceCents: number | null;
  lowPriceCents: number | null;
  url: string;
}

/** Puts a card on this person's list, creating the shared Card the first time anyone tracks it. */
export async function trackCard(profileId: string, input: NewTrackedCard): Promise<TrackedCard> {
  const existing = await prisma.cardPriceSource.findUnique({
    where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
  });

  const cardId =
    existing?.cardId ??
    (
      await prisma.card.create({
        data: {
          name: input.name,
          setName: input.setName,
          number: input.number,
          imageUrl: input.imageUrl,
          priceSources: {
            create: {
              provider: input.provider,
              externalId: input.externalId,
              variant: input.variant,
              url: input.url,
              lastPriceCents: input.priceCents,
              lastLowPriceCents: input.lowPriceCents,
              lastCheckedAt: new Date(),
            },
          },
        },
      })
    ).id;

  const entry = await prisma.cardWatchlistEntry.upsert({
    where: { cardId_profileId: { cardId, profileId } },
    create: { cardId, profileId },
    update: {},
    include: { card: { include: cardInclude } },
  });
  return withEntry(entry.card, entry);
}

/** Whether this person has the card on their list. */
export async function tracksCard(profileId: string, cardId: string): Promise<boolean> {
  return (await prisma.cardWatchlistEntry.count({ where: { profileId, cardId } })) > 0;
}

/** Takes a card off this person's list; the shared card goes too once nobody follows it. */
export async function untrackCard(profileId: string, cardId: string): Promise<boolean> {
  const removed = await prisma.cardWatchlistEntry.deleteMany({ where: { profileId, cardId } });
  if (removed.count === 0) return false;
  if ((await prisma.cardWatchlistEntry.count({ where: { cardId } })) === 0) {
    await prisma.card.deleteMany({ where: { id: cardId } });
  }
  return true;
}

/** Sets (or, with null, removes) the price alert on one of this person's cards. Null when it isn't on their list. */
export async function setThreshold(
  profileId: string,
  cardId: string,
  thresholdCents: number | null,
): Promise<CardWatchlistEntry | null> {
  const result = await prisma.cardWatchlistEntry.updateMany({
    where: { profileId, cardId },
    // A changed threshold needs a fresh evaluation, so the "already alerted" memory is cleared.
    data: { thresholdCents, lastNotifiedThresholdCents: null },
  });
  if (result.count === 0) return null;
  return prisma.cardWatchlistEntry.findUnique({ where: { cardId_profileId: { cardId, profileId } } });
}

/** Adds the card to the list with an alert in one step (used from a set page's Watch button). */
export async function trackWithThreshold(profileId: string, cardId: string, thresholdCents: number): Promise<void> {
  await prisma.cardWatchlistEntry.upsert({
    where: { cardId_profileId: { cardId, profileId } },
    create: { cardId, profileId, thresholdCents },
    update: { thresholdCents, lastNotifiedThresholdCents: null },
  });
}
