-- CreateTable
CREATE TABLE "OwnedCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" INTEGER NOT NULL,
    "itemExternalId" INTEGER NOT NULL,
    "printing" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "number" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnedCard_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SmartWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "setId" INTEGER NOT NULL,
    "kind" TEXT,
    "rarity" TEXT,
    "query" TEXT,
    "onlyMissing" BOOLEAN NOT NULL DEFAULT false,
    "maxPriceCents" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartWatch_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SmartWatch" ("createdAt", "enabled", "id", "kind", "maxPriceCents", "name", "query", "rarity", "setId", "updatedAt") SELECT "createdAt", "enabled", "id", "kind", "maxPriceCents", "name", "query", "rarity", "setId", "updatedAt" FROM "SmartWatch";
DROP TABLE "SmartWatch";
ALTER TABLE "new_SmartWatch" RENAME TO "SmartWatch";
CREATE INDEX "SmartWatch_setId_idx" ON "SmartWatch"("setId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OwnedCard_setId_idx" ON "OwnedCard"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedCard_setId_itemExternalId_printing_key" ON "OwnedCard"("setId", "itemExternalId", "printing");
