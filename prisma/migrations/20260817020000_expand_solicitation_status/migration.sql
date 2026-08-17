-- CreateEnum
CREATE TYPE "SolicitationDeliveryMethod" AS ENUM ('MAIL', 'PICKUP', 'DROPOFF', 'DIGITAL');

-- AlterEnum
-- The old enum's ASKED value is remapped to CONTACTED before the type
-- swap below (via a plain-text intermediate column) so this migration is
-- safe to run against a database that already has ASKED rows in it — the
-- straight USING (status::text::new_enum) cast Prisma would generate here
-- fails outright on any label the new enum doesn't have.
BEGIN;
ALTER TABLE "solicitations" ALTER COLUMN "status" TYPE TEXT;
UPDATE "solicitations" SET "status" = 'CONTACTED' WHERE "status" = 'ASKED';
CREATE TYPE "SolicitationStatus_new" AS ENUM ('PROSPECT', 'CONTACTED', 'COMMITTED', 'DONATED', 'DECLINED', 'DO_NOT_CONTACT');
ALTER TABLE "public"."solicitations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "solicitations" ALTER COLUMN "status" TYPE "SolicitationStatus_new" USING ("status"::"SolicitationStatus_new");
ALTER TYPE "SolicitationStatus" RENAME TO "SolicitationStatus_old";
ALTER TYPE "SolicitationStatus_new" RENAME TO "SolicitationStatus";
DROP TYPE "public"."SolicitationStatus_old";
ALTER TABLE "solicitations" ALTER COLUMN "status" SET DEFAULT 'PROSPECT';
COMMIT;

-- AlterTable
ALTER TABLE "solicitations" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "deliveryMethod" "SolicitationDeliveryMethod",
ADD COLUMN     "lastContactedAt" TIMESTAMP(3),
ADD COLUMN     "priorYearDonor" BOOLEAN NOT NULL DEFAULT false;

