-- CreateEnum
CREATE TYPE "SolicitationStatus" AS ENUM ('PROSPECT', 'ASKED', 'DECLINED', 'DONATED');

-- CreateTable
CREATE TABLE "solicitations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "estimatedValueCents" INTEGER,
    "status" "SolicitationStatus" NOT NULL DEFAULT 'PROSPECT',
    "fulfilledAuctionItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "solicitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitations_fulfilledAuctionItemId_key" ON "solicitations"("fulfilledAuctionItemId");

-- CreateIndex
CREATE INDEX "solicitations_eventId_status_idx" ON "solicitations"("eventId", "status");

-- CreateIndex
CREATE INDEX "solicitations_eventId_category_idx" ON "solicitations"("eventId", "category");

-- AddForeignKey
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_fulfilledAuctionItemId_fkey" FOREIGN KEY ("fulfilledAuctionItemId") REFERENCES "auction_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
