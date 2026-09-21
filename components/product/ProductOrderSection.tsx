"use client";

import { Checkout } from "@/components/checkout/Checkout";
import { useProduct } from "./ProductContext";

/** The product page's order form: this product preselected, plus anything in the cart. */
export function ProductOrderSection() {
  const { product, variant, quantity, setVariantId, setQuantity } = useProduct();
  return (
    <Checkout
      featured={{
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.image,
        variantLabel: product.variantLabel,
        variants: product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          inStock: v.inStock,
          maxQuantity: v.maxQuantity,
        })),
        selectedVariantId: variant.id,
        quantity,
        onVariantChange: setVariantId,
        onQuantityChange: setQuantity,
      }}
    />
  );
}
