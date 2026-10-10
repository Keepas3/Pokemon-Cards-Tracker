import { prisma } from "@/lib/prisma";
import { activeProviders, cardPriceCheckers } from "@/lib/cardPricing";
import { sendDiscordCardPriceAlert } from "@/lib/notify/discord";
import { isQuietHours } from "@/lib/notify/quietHours";
import { decideAlert } from "@/lib/cards/alerts";
import type { CardPriceSource, Card } from "@/generated/prisma/client";

export interface CardPriceUpdateInput {
  priceCents: number | null;
  lowPriceCents: number | null;
  /** Omitted when the provider doesn't hand back a link on this call — keeps the stored one. */
  url?: string | null;
  imageUrl?: string | null;
}

/**
 * Applies a fresh price reading to a card's price source: records history on
 * a price change, and fires a threshold alert if the card is watched.
 */
export async function applyCardPriceUpdate(
  source: CardPriceSource & { card: Card },
  update: CardPriceUpdateInput,
): Promise<{ priceChanged: boolean }> {
  const oldPriceCents = source.lastPriceCents;
  const priceChanged = oldPriceCents !== update.priceCents;

  const cardBackfill: { imageUrl?: string } = {};
  if (update.imageUrl && update.imageUrl !== source.card.imageUrl) {
    cardBackfill.imageUrl = update.imageUrl;
  }
  const hasBackfill = Object.keys(cardBackfill).length > 0;

  const [, createdEvent] = await prisma.$transaction([
    prisma.cardPriceSource.update({
      where: { id: source.id },
      data: {
        lastPriceCents: update.priceCents,
        lastLowPriceCents: update.lowPriceCents,
        lastCheckedAt: new Date(),
        lastError: null,
        url: update.url || source.url,
      },
    }),
    ...(priceChanged
      ? [
          prisma.cardPriceEvent.create({
            data: { cardPriceSourceId: source.id, oldPriceCents, newPriceCents: update.priceCents },
          }),
        ]
      : []),
    ...(hasBackfill ? [prisma.card.update({ where: { id: source.cardId }, data: cardBackfill })] : []),
  ]);

  // Tell each person who follows this card and has an alert set, using their own webhook and quiet hours.
  if (update.priceCents != null) {
    const entries = await prisma.cardWatchlistEntry.findMany({
      where: { cardId: source.cardId, thresholdCents: { not: null } },
      include: { profile: true },
    });
    let anyNotified = false;

    for (const entry of entries) {
      const decision = decideAlert(entry, update.priceCents);
      if (decision === "reset") {
        // Price rose back above the limit — clear the guard so a future dip alerts again.
        await prisma.cardWatchlistEntry.update({ where: { id: entry.id }, data: { lastNotifiedThresholdCents: null } });
        continue;
      }
      if (decision !== "send") continue;

      const { profile } = entry;
      const quiet = isQuietHours(new Date(), profile.quietHoursStart, profile.quietHoursEnd);
      if (!profile.notificationsEnabled || !profile.discordWebhookUrl || quiet) continue;

      const result = await sendDiscordCardPriceAlert(profile.discordWebhookUrl, {
        cardName: source.card.name,
        setName: source.card.setName,
        variant: source.variant,
        provider: source.provider,
        url: update.url || source.url,
        priceCents: update.priceCents,
        thresholdCents: entry.thresholdCents!,
        imageUrl: update.imageUrl ?? source.card.imageUrl,
      });
      if (result.ok) {
        anyNotified = true;
        await prisma.cardWatchlistEntry.update({ where: { id: entry.id }, data: { lastNotifiedThresholdCents: update.priceCents } });
      }
    }

    if (anyNotified && createdEvent) {
      await prisma.cardPriceEvent.update({ where: { id: (createdEvent as { id: string }).id }, data: { notified: true } });
    }
  }

  return { priceChanged };
}

export interface CardPollResult {
  cardPriceSourceId: string;
  cardName: string;
  provider: string;
  ok: boolean;
  priceChanged: boolean;
  error?: string;
}

/** Checks a single card price source via its provider and applies the result. */
export async function pollCardPriceSource(
  source: CardPriceSource & { card: Card },
): Promise<CardPollResult> {
  const checker = cardPriceCheckers[source.provider];
  const result = checker
    ? await checker.checkPrice(source.externalId, source.variant)
    : { ok: false as const, error: `${source.provider} is no longer supported` };

  if (!result.ok) {
    await prisma.cardPriceSource.update({
      where: { id: source.id },
      data: { lastCheckedAt: new Date(), lastError: result.error },
    });
    return {
      cardPriceSourceId: source.id,
      cardName: source.card.name,
      provider: source.provider,
      ok: false,
      priceChanged: false,
      error: result.error,
    };
  }

  const { priceChanged } = await applyCardPriceUpdate(source, {
    priceCents: result.priceCents,
    lowPriceCents: result.lowPriceCents,
    url: result.url,
    imageUrl: result.imageUrl,
  });

  return {
    cardPriceSourceId: source.id,
    cardName: source.card.name,
    provider: source.provider,
    ok: true,
    priceChanged,
  };
}

/** Polls every tracked card price source, one at a time (gentle on rate limits). */
export async function pollAllCardPrices(): Promise<CardPollResult[]> {
  // Sources saved under a provider that was removed (JustTCG) are left alone rather than erroring every run.
  const sources = await prisma.cardPriceSource.findMany({ where: { provider: { in: activeProviders } }, include: { card: true } });
  const results: CardPollResult[] = [];
  for (const source of sources) {
    try {
      results.push(await pollCardPriceSource(source));
    } catch (err) {
      results.push({
        cardPriceSourceId: source.id,
        cardName: source.card.name,
        provider: source.provider,
        ok: false,
        priceChanged: false,
        error: (err as Error).message,
      });
    }
  }
  return results;
}
