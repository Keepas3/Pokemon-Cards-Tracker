-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SmartWatchMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "smartWatchId" TEXT NOT NULL,
    "itemExternalId" INTEGER NOT NULL,
    "printing" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "notifiedAt" DATETIME,
    "baseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmartWatchMatch_smartWatchId_fkey" FOREIGN KEY ("smartWatchId") REFERENCES "SmartWatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SmartWatchMatch" ("createdAt", "id", "itemExternalId", "name", "notifiedAt", "priceCents", "printing", "smartWatchId") SELECT "createdAt", "id", "itemExternalId", "name", "notifiedAt", "priceCents", "printing", "smartWatchId" FROM "SmartWatchMatch";
DROP TABLE "SmartWatchMatch";
ALTER TABLE "new_SmartWatchMatch" RENAME TO "SmartWatchMatch";
CREATE UNIQUE INDEX "SmartWatchMatch_smartWatchId_itemExternalId_printing_key" ON "SmartWatchMatch"("smartWatchId", "itemExternalId", "printing");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
