-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "imageUrl" TEXT,
    "msrpCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RetailerLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastInStock" BOOLEAN NOT NULL DEFAULT false,
    "lastPriceCents" INTEGER,
    "lastCheckedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetailerLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailerLinkId" TEXT NOT NULL,
    "wasInStock" BOOLEAN NOT NULL,
    "isInStock" BOOLEAN NOT NULL,
    "priceCents" INTEGER,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockEvent_retailerLinkId_fkey" FOREIGN KEY ("retailerLinkId") REFERENCES "RetailerLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "discordWebhookUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pollIntervalSec" INTEGER NOT NULL DEFAULT 180,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "RetailerLink_productId_idx" ON "RetailerLink"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerLink_retailer_externalId_key" ON "RetailerLink"("retailer", "externalId");

-- CreateIndex
CREATE INDEX "StockEvent_retailerLinkId_idx" ON "StockEvent"("retailerLinkId");
