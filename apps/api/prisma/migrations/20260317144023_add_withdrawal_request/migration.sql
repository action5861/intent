-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);
