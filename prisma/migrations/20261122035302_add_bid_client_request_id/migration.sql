-- AlterTable
ALTER TABLE "bids" ADD COLUMN     "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bids_clientRequestId_key" ON "bids"("clientRequestId");
