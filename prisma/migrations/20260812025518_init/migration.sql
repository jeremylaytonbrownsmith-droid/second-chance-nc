-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuctionItemType" AS ENUM ('SILENT', 'LIVE', 'RAFFLE', 'FIXED_PRICE', 'FUND_A_NEED');

-- CreateEnum
CREATE TYPE "AuctionItemStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'UNSOLD');

-- CreateEnum
CREATE TYPE "BidSource" AS ENUM ('MOBILE', 'PAPER', 'AUCTIONEER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "TransactionMethod" AS ENUM ('CARD', 'CASH', 'CHECK', 'IN_KIND');

-- CreateEnum
CREATE TYPE "TransactionLineType" AS ENUM ('AUCTION_WIN', 'RAFFLE', 'FUND_A_NEED', 'CASH_GIFT', 'TICKET', 'SPONSORSHIP', 'MERCH');

-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('QUID_PRO_QUO', 'ANNUAL_STATEMENT', 'IN_KIND');

-- CreateEnum
CREATE TYPE "SyncEntityType" AS ENUM ('CONSTITUENT', 'GIFT');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ein" TEXT,
    "fiscalYearStart" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "silentCloseAt" TIMESTAMP(3),
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constituents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "orgName" TEXT,
    "isBusiness" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "phone" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "etapestryAccountRef" TEXT,
    "notes" TEXT,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "constituents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "constituentId" TEXT NOT NULL,
    "bidderNumber" INTEGER NOT NULL,
    "tableAssignment" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "paymentCustomerRef" TEXT,
    "paymentMethodRef" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_donors" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "constituentId" TEXT NOT NULL,
    "claimedValueCents" INTEGER NOT NULL,
    "substantiationNeeded" BOOLEAN NOT NULL DEFAULT false,
    "form8283ReceivedAt" TIMESTAMP(3),
    "form8282DueAt" TIMESTAMP(3),
    "form8282FiledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "item_donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_items" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "itemType" "AuctionItemType" NOT NULL,
    "fmvCents" INTEGER,
    "fmvBasis" TEXT,
    "startingBidCents" INTEGER,
    "bidIncrementCents" INTEGER,
    "buyNowCents" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemDonorId" TEXT,
    "closeAt" TIMESTAMP(3),
    "status" "AuctionItemStatus" NOT NULL DEFAULT 'DRAFT',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "auction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "BidSource" NOT NULL,
    "isMaxBid" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "processor" TEXT,
    "processorRef" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "method" "TransactionMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_lines" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "lineType" "TransactionLineType" NOT NULL,
    "awardId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "fmvCents" INTEGER NOT NULL DEFAULT 0,
    "deductibleCents" INTEGER NOT NULL,
    "designation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "transaction_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "constituentId" TEXT NOT NULL,
    "receiptType" "ReceiptType" NOT NULL,
    "eventId" TEXT,
    "taxYear" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "pdfKey" TEXT,
    "voidOfReceiptId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "entityType" "SyncEntityType" NOT NULL,
    "localId" TEXT NOT NULL,
    "remoteRef" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_orgId_idx" ON "events"("orgId");

-- CreateIndex
CREATE INDEX "constituents_orgId_idx" ON "constituents"("orgId");

-- CreateIndex
CREATE INDEX "constituents_orgId_email_idx" ON "constituents"("orgId", "email");

-- CreateIndex
CREATE INDEX "constituents_orgId_lastName_firstName_idx" ON "constituents"("orgId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "registrations_eventId_constituentId_idx" ON "registrations"("eventId", "constituentId");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_eventId_bidderNumber_key" ON "registrations"("eventId", "bidderNumber");

-- CreateIndex
CREATE INDEX "item_donors_eventId_constituentId_idx" ON "item_donors"("eventId", "constituentId");

-- CreateIndex
CREATE INDEX "auction_items_eventId_status_idx" ON "auction_items"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "auction_items_eventId_itemNumber_key" ON "auction_items"("eventId", "itemNumber");

-- CreateIndex
CREATE INDEX "bids_itemId_amountCents_idx" ON "bids"("itemId", "amountCents");

-- CreateIndex
CREATE INDEX "bids_registrationId_idx" ON "bids"("registrationId");

-- CreateIndex
CREATE INDEX "awards_itemId_idx" ON "awards"("itemId");

-- CreateIndex
CREATE INDEX "awards_registrationId_idx" ON "awards"("registrationId");

-- CreateIndex
CREATE INDEX "transactions_registrationId_idx" ON "transactions"("registrationId");

-- CreateIndex
CREATE INDEX "transactions_eventId_status_idx" ON "transactions"("eventId", "status");

-- CreateIndex
CREATE INDEX "transaction_lines_transactionId_idx" ON "transaction_lines"("transactionId");

-- CreateIndex
CREATE INDEX "receipts_constituentId_taxYear_idx" ON "receipts"("constituentId", "taxYear");

-- CreateIndex
CREATE INDEX "sync_logs_entityType_localId_idx" ON "sync_logs"("entityType", "localId");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sync_logs_entityType_localId_payloadHash_key" ON "sync_logs"("entityType", "localId", "payloadHash");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constituents" ADD CONSTRAINT "constituents_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constituents" ADD CONSTRAINT "constituents_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "constituents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_constituentId_fkey" FOREIGN KEY ("constituentId") REFERENCES "constituents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_donors" ADD CONSTRAINT "item_donors_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_donors" ADD CONSTRAINT "item_donors_constituentId_fkey" FOREIGN KEY ("constituentId") REFERENCES "constituents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_items" ADD CONSTRAINT "auction_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_items" ADD CONSTRAINT "auction_items_itemDonorId_fkey" FOREIGN KEY ("itemDonorId") REFERENCES "item_donors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "auction_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "auction_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "awards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_constituentId_fkey" FOREIGN KEY ("constituentId") REFERENCES "constituents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_voidOfReceiptId_fkey" FOREIGN KEY ("voidOfReceiptId") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
