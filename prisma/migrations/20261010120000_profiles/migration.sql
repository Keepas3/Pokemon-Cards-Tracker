
-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "discordWebhookUrl" TEXT,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "digestHour" INTEGER NOT NULL DEFAULT 9,
    "lastDigestAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- The first profile ("Owner") takes over everything that existed when the app had one user,
-- including its Discord settings. It has no password until BOOTSTRAP_PROFILES / `npm run profile:set`
-- claims it (lib/auth/bootstrap.ts), so nobody can sign in to it by accident.
INSERT INTO "Profile" ("id", "name", "passwordHash", "discordWebhookUrl", "notificationsEnabled", "quietHoursStart", "quietHoursEnd", "digestEnabled", "digestHour", "lastDigestAt", "createdAt", "updatedAt")
SELECT 'owner', 'Owner', '', "discordWebhookUrl", "enabled", "quietHoursStart", "quietHoursEnd", "digestEnabled", "digestHour", "lastDigestAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "NotificationConfig" WHERE "id" = 'singleton';
INSERT INTO "Profile" ("id", "name", "passwordHash", "notificationsEnabled", "digestEnabled", "digestHour", "createdAt", "updatedAt")
SELECT 'owner', 'Owner', '', 1, 0, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM "Profile");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CardWatchlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "thresholdCents" INTEGER,
    "lastNotifiedThresholdCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CardWatchlistEntry_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CardWatchlistEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CardWatchlistEntry" ("cardId", "createdAt", "id", "lastNotifiedThresholdCents", "thresholdCents", "updatedAt", "profileId") SELECT "cardId", "createdAt", "id", "lastNotifiedThresholdCents", "thresholdCents", "updatedAt", 'owner' FROM "CardWatchlistEntry";
-- A card that was tracked without an alert used to need no row; now every tracked card is on someone's list.
INSERT INTO "new_CardWatchlistEntry" ("id", "cardId", "profileId", "thresholdCents", "lastNotifiedThresholdCents", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(12))), c."id", 'owner', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Card" c WHERE c."id" NOT IN (SELECT "cardId" FROM "CardWatchlistEntry");
DROP TABLE "CardWatchlistEntry";
ALTER TABLE "new_CardWatchlistEntry" RENAME TO "CardWatchlistEntry";
CREATE INDEX "CardWatchlistEntry_profileId_idx" ON "CardWatchlistEntry"("profileId");
CREATE UNIQUE INDEX "CardWatchlistEntry_cardId_profileId_key" ON "CardWatchlistEntry"("cardId", "profileId");
CREATE TABLE "new_OwnedCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "setId" INTEGER NOT NULL,
    "numberKey" TEXT NOT NULL,
    "number" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnedCard_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OwnedCard_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OwnedCard" ("createdAt", "id", "name", "number", "numberKey", "quantity", "setId", "updatedAt", "profileId") SELECT "createdAt", "id", "name", "number", "numberKey", "quantity", "setId", "updatedAt", 'owner' FROM "OwnedCard";
DROP TABLE "OwnedCard";
ALTER TABLE "new_OwnedCard" RENAME TO "OwnedCard";
CREATE INDEX "OwnedCard_profileId_setId_idx" ON "OwnedCard"("profileId", "setId");
CREATE INDEX "OwnedCard_setId_idx" ON "OwnedCard"("setId");
CREATE UNIQUE INDEX "OwnedCard_profileId_setId_numberKey_key" ON "OwnedCard"("profileId", "setId", "numberKey");
CREATE TABLE "new_SmartWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
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
    CONSTRAINT "SmartWatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmartWatch_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SmartWatch" ("createdAt", "enabled", "id", "kind", "maxPriceCents", "name", "onlyMissing", "query", "rarity", "setId", "updatedAt", "profileId") SELECT "createdAt", "enabled", "id", "kind", "maxPriceCents", "name", "onlyMissing", "query", "rarity", "setId", "updatedAt", 'owner' FROM "SmartWatch";
DROP TABLE "SmartWatch";
ALTER TABLE "new_SmartWatch" RENAME TO "SmartWatch";
CREATE INDEX "SmartWatch_setId_idx" ON "SmartWatch"("setId");
CREATE INDEX "SmartWatch_profileId_idx" ON "SmartWatch"("profileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_name_key" ON "Profile"("name");

