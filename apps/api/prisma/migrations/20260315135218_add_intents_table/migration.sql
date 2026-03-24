-- CreateTable
CREATE TABLE "intents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "enrichedText" TEXT,
    "category" TEXT,
    "details" JSONB,
    "expectedPrice" INTEGER,
    "confidenceScore" INTEGER,
    "actionType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING_MATCH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intents_pkey" PRIMARY KEY ("id")
);
