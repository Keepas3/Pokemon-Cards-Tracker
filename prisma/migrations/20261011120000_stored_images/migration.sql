
-- CreateTable
CREATE TABLE "StoredImage" (
    "sourceUrl" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

