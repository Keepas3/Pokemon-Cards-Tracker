-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "number" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CardPriceSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "variant" TEXT,
    "url" TEXT NOT NULL,
    "lastPriceCents" INTEGER,
    "lastLowPriceCents" INTEGER,
    "lastCheckedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CardPriceSource_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardPriceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardPriceSourceId" TEXT NOT NULL,
    "oldPriceCents" INTEGER,
    "newPriceCents" INTEGER,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardPriceEvent_cardPriceSourceId_fkey" FOREIGN KEY ("cardPriceSourceId") REFERENCES "CardPriceSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardWatchlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "thresholdCents" INTEGER NOT NULL,
    "lastNotifiedThresholdCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CardWatchlistEntry_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CardPriceSource_cardId_idx" ON "CardPriceSource"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardPriceSource_provider_externalId_key" ON "CardPriceSource"("provider", "externalId");

-- CreateIndex
CREATE INDEX "CardPriceEvent_cardPriceSourceId_idx" ON "CardPriceEvent"("cardPriceSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CardWatchlistEntry_cardId_key" ON "CardWatchlistEntry"("cardId");
