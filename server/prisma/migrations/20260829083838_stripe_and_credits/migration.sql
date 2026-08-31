-- AlterTable
ALTER TABLE "user" ADD COLUMN     "credits" DECIMAL(12,1) NOT NULL DEFAULT 10,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
    "cancelAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "seats" INTEGER,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "billingInterval" TEXT,
    "stripeScheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_referenceId_idx" ON "subscription"("referenceId");

-- CreateIndex
CREATE INDEX "subscription_stripeCustomerId_idx" ON "subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "user_stripeCustomerId_idx" ON "user"("stripeCustomerId");
