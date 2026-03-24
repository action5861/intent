-- AlterTable
ALTER TABLE "withdrawal_requests" ADD COLUMN     "adminMemo" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
