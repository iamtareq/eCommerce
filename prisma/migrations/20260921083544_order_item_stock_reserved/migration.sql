-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "stockReserved" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing orders. Whether a variant tracked stock when the order was
-- placed was never recorded, so use whether it tracks stock now: that is exactly
-- the rule the previous code applied on cancel/restore, so existing orders keep
-- behaving as before. Cancelled orders already returned their stock.
UPDATE "OrderItem" AS oi
SET "stockReserved" = true
FROM "Order" AS o, "ProductVariant" AS v
WHERE oi."orderId" = o."id"
  AND oi."variantId" = v."id"
  AND o."orderStatus" <> 'CANCELLED'
  AND v."stock" IS NOT NULL;
