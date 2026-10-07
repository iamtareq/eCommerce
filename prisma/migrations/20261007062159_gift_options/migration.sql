-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "giftMessage" TEXT,
ADD COLUMN     "giftWrap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "giftWrapCharge" INTEGER NOT NULL DEFAULT 0;
