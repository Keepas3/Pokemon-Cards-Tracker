-- CreateTable
CREATE TABLE "CardSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "releaseDate" DATETIME,
    "cardCount" INTEGER NOT NULL DEFAULT 0,
    "iconUrl" TEXT,
    "imageUrl" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemsFetchedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SetItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" INTEGER NOT NULL,
    "externalId" INTEGER NOT NULL,
    "tcgplayerId" INTEGER,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "rarity" TEXT,
    "kind" TEXT NOT NULL,
    "printing" TEXT NOT NULL DEFAULT '',
    "marketPriceCents" INTEGER,
    "lowPriceCents" INTEGER,
    "imageUrl" TEXT,
    "priceUpdatedAt" DATETIME,
    CONSTRAINT "SetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "provider" TEXT NOT NULL PRIMARY KEY,
    "dailyLimit" INTEGER,
    "dailyRemaining" INTEGER,
    "resetAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CardSet_slug_key" ON "CardSet"("slug");

-- CreateIndex
CREATE INDEX "SetItem_setId_idx" ON "SetItem"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "SetItem_setId_externalId_printing_key" ON "SetItem"("setId", "externalId", "printing");
