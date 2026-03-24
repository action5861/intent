-- AlterTable
ALTER TABLE "advertisers" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "intents" ADD COLUMN     "matchedAdvertiserId" TEXT;
