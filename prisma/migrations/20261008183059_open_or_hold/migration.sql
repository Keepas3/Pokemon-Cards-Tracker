-- AlterTable
ALTER TABLE "Product" ADD COLUMN "marketExternalId" INTEGER;
ALTER TABLE "Product" ADD COLUMN "marketPrinting" TEXT;
ALTER TABLE "Product" ADD COLUMN "marketSetId" INTEGER;

-- CreateTable
CREATE TABLE "OpenHoldSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "feePct" REAL NOT NULL DEFAULT 13,
    "bulkThresholdCents" INTEGER NOT NULL DEFAULT 100,
    "bulkPerPackCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PullRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" INTEGER NOT NULL,
    "rarity" TEXT NOT NULL,
    "perPack" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PullRate_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackCount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" INTEGER NOT NULL,
    "itemExternalId" INTEGER NOT NULL,
    "printing" TEXT NOT NULL DEFAULT '',
    "packs" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackCount_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PullRate_setId_rarity_key" ON "PullRate"("setId", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "PackCount_setId_itemExternalId_printing_key" ON "PackCount"("setId", "itemExternalId", "printing");
