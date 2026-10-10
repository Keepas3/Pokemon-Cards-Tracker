-- AlterTable
ALTER TABLE "Product" ADD COLUMN "releaseDate" DATETIME;

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "notifyOnRestock" BOOLEAN NOT NULL DEFAULT true,
    "thresholdCents" INTEGER,
    "lastNotifiedThresholdCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchlistEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RetailerLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "lastInStock" BOOLEAN NOT NULL DEFAULT false,
    "lastPriceCents" INTEGER,
    "lastCheckedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetailerLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RetailerLink" ("createdAt", "externalId", "id", "lastCheckedAt", "lastError", "lastInStock", "lastPriceCents", "productId", "retailer", "updatedAt", "url") SELECT "createdAt", "externalId", "id", "lastCheckedAt", "lastError", "lastInStock", "lastPriceCents", "productId", "retailer", "updatedAt", "url" FROM "RetailerLink";
DROP TABLE "RetailerLink";
ALTER TABLE "new_RetailerLink" RENAME TO "RetailerLink";
CREATE INDEX "RetailerLink_productId_idx" ON "RetailerLink"("productId");
CREATE UNIQUE INDEX "RetailerLink_retailer_externalId_key" ON "RetailerLink"("retailer", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistEntry_productId_key" ON "WatchlistEntry"("productId");
