-- Official card catalog (TCGdex today): the real card list for each set.
-- CreateTable
CREATE TABLE "OfficialSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "seriesName" TEXT NOT NULL,
    "releaseDate" DATETIME,
    "logoUrl" TEXT,
    "symbolUrl" TEXT,
    "totalCards" INTEGER NOT NULL,
    "officialCards" INTEGER NOT NULL,
    "cardSetId" INTEGER,
    "cardsFetchedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfficialSet_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OfficialCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "officialSetId" TEXT NOT NULL,
    "numberKey" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "OfficialCard_officialSetId_fkey" FOREIGN KEY ("officialSetId") REFERENCES "OfficialSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Ownership is now per card number, not per tcgapi.dev row.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OwnedCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" INTEGER NOT NULL,
    "numberKey" TEXT NOT NULL,
    "number" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnedCard_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Carry existing rows over. The key is the card number's numerator, lower-cased,
-- with leading zeros dropped when it's all digits ("025/088" -> "25") — the same
-- rule as cardKey() in src/lib/collection/numbers.ts. Printings of one number are
-- summed into one row. Rows with no card number (boxes, code cards that were
-- wrongly counted as cards) have nothing to key on and are dropped.
INSERT INTO "new_OwnedCard" ("id", "setId", "numberKey", "number", "name", "quantity", "createdAt", "updatedAt")
SELECT min("id"), "setId", "numberKey", min("number"), min("name"), sum("quantity"), min("createdAt"), max("updatedAt")
FROM (
    SELECT *,
        CASE
            WHEN "numerator" <> '' AND "numerator" NOT GLOB '*[^0-9]*' THEN CAST(CAST("numerator" AS INTEGER) AS TEXT)
            ELSE "numerator"
        END AS "numberKey"
    FROM (
        SELECT *,
            lower(trim(CASE WHEN instr("number", '/') > 0 THEN substr("number", 1, instr("number", '/') - 1) ELSE "number" END)) AS "numerator"
        FROM "OwnedCard"
        WHERE "number" IS NOT NULL AND trim("number") <> ''
    )
)
WHERE "numberKey" <> ''
GROUP BY "setId", "numberKey";

DROP TABLE "OwnedCard";
ALTER TABLE "new_OwnedCard" RENAME TO "OwnedCard";
CREATE INDEX "OwnedCard_setId_idx" ON "OwnedCard"("setId");
CREATE UNIQUE INDEX "OwnedCard_setId_numberKey_key" ON "OwnedCard"("setId", "numberKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OfficialSet_cardSetId_key" ON "OfficialSet"("cardSetId");

-- CreateIndex
CREATE INDEX "OfficialCard_officialSetId_idx" ON "OfficialCard"("officialSetId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialCard_officialSetId_numberKey_key" ON "OfficialCard"("officialSetId", "numberKey");
