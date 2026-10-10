
-- CreateTable
CREATE TABLE "DexCache" (
    "dexId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardsJson" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FollowedPokemon" (
    "profileId" TEXT NOT NULL,
    "dexId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("profileId", "dexId"),
    CONSTRAINT "FollowedPokemon_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

