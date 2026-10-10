
-- CreateTable
CREATE TABLE "DealNotice" (
    "profileId" TEXT NOT NULL,
    "setId" INTEGER NOT NULL,
    "numberKey" TEXT NOT NULL,
    "lowCents" INTEGER NOT NULL,
    "noticedAt" DATETIME NOT NULL,

    PRIMARY KEY ("profileId", "setId", "numberKey"),
    CONSTRAINT "DealNotice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

