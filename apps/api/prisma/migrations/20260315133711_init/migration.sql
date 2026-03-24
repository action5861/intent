-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "AdvertiserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalIntents" INTEGER NOT NULL DEFAULT 0,
    "rewardBalance" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisers" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalBudget" INTEGER NOT NULL DEFAULT 0,
    "remainingBudget" INTEGER NOT NULL DEFAULT 0,
    "status" "AdvertiserStatus" NOT NULL DEFAULT 'PENDING',
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_email_key" ON "advertisers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");
