-- DropForeignKey
ALTER TABLE "Proposal" DROP CONSTRAINT "Proposal_committeeId_fkey";

-- DropForeignKey
ALTER TABLE "Proposal" DROP CONSTRAINT "Proposal_eventId_fkey";

-- AlterTable
ALTER TABLE "Proposal" ALTER COLUMN "eventId" DROP NOT NULL,
ALTER COLUMN "committeeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
