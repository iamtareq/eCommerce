import type { Quote } from "@/lib/orders/quote";

/** A line shown in the checkout, either from the cart or the product being viewed. */
export interface CheckoutLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  image: string | null;
  price: number;
  quantity: number;
  maxQuantity: number;
  /** True for the product-page line that is not (yet) in the cart. */
  featured: boolean;
}

/** The product being viewed on a product page, offered as a preselected line. */
export interface FeaturedProduct {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  variantLabel: string;
  variants: { id: string; name: string; price: number; inStock: boolean; maxQuantity: number }[];
  selectedVariantId: string;
  quantity: number;
  onVariantChange: (variantId: string) => void;
  onQuantityChange: (quantity: number) => void;
}

export type { Quote };

export interface QuoteState {
  quote: Quote | null;
  loading: boolean;
  error: string | null;
}
