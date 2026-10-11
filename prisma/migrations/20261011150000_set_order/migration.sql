-- CreateTable
CREATE TABLE "SetOrder" (
    "profileId" TEXT NOT NULL,
    "setId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("profileId", "setId"),
    CONSTRAINT "SetOrder_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
