-- CreateTable
CREATE TABLE "SmartWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "setId" INTEGER NOT NULL,
    "kind" TEXT,
    "rarity" TEXT,
    "query" TEXT,
    "maxPriceCents" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartWatch_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmartWatchMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "smartWatchId" TEXT NOT NULL,
    "itemExternalId" INTEGER NOT NULL,
    "printing" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmartWatchMatch_smartWatchId_fkey" FOREIGN KEY ("smartWatchId") REFERENCES "SmartWatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetValueSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jtcgSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "change7dPct" REAL,
    "change30dPct" REAL,
    "day" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "discordWebhookUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pollIntervalSec" INTEGER NOT NULL DEFAULT 180,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "digestHour" INTEGER NOT NULL DEFAULT 9,
    "lastDigestAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_NotificationConfig" ("discordWebhookUrl", "enabled", "id", "pollIntervalSec", "quietHoursEnd", "quietHoursStart", "updatedAt") SELECT "discordWebhookUrl", "enabled", "id", "pollIntervalSec", "quietHoursEnd", "quietHoursStart", "updatedAt" FROM "NotificationConfig";
DROP TABLE "NotificationConfig";
ALTER TABLE "new_NotificationConfig" RENAME TO "NotificationConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SmartWatch_setId_idx" ON "SmartWatch"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartWatchMatch_smartWatchId_itemExternalId_printing_key" ON "SmartWatchMatch"("smartWatchId", "itemExternalId", "printing");

-- CreateIndex
CREATE INDEX "SetValueSnapshot_day_idx" ON "SetValueSnapshot"("day");

-- CreateIndex
CREATE UNIQUE INDEX "SetValueSnapshot_jtcgSetId_day_key" ON "SetValueSnapshot"("jtcgSetId", "day");
