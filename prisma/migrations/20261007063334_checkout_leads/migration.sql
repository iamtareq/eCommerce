-- CreateTable
CREATE TABLE "CheckoutLead" (
    "id" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "district" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "ipHash" TEXT,
    "contactedAt" TIMESTAMP(3),
    "contactedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutLead_mobileNumber_key" ON "CheckoutLead"("mobileNumber");

-- CreateIndex
CREATE INDEX "CheckoutLead_updatedAt_idx" ON "CheckoutLead"("updatedAt");
