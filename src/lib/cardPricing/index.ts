import { CardPriceProvider } from "@/generated/prisma/client";
import { tcgApiDevChecker } from "./tcgapiDev";
import type { CardPriceChecker } from "./types";

/**
 * The providers the app can check. tcgapi.dev is the only one: JustTCG's free tier doesn't
 * allow showing its data to other people, so it was removed. `JUSTTCG` stays in the database
 * enum only so rows saved earlier still load.
 */
export const cardPriceCheckers: Partial<Record<CardPriceProvider, CardPriceChecker>> = {
  [CardPriceProvider.TCGAPI_DEV]: tcgApiDevChecker,
};

/** Providers that have a checker. */
export const activeProviders: CardPriceProvider[] = Object.keys(cardPriceCheckers) as CardPriceProvider[];

export * from "./types";
