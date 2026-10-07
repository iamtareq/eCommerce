import { itemLabel, orderStatusLabel } from "@/config/order";
import type { OrderStatus } from "@/generated/prisma/enums";
import { formatDhakaDateTime } from "@/lib/dates";
import type { CellValue } from "./client";

/** Sheet header row. Column A must stay "Order Number" — rows are located by it. */
export const SHEET_COLUMNS = [
  "Order Number",
  "Order Date",
  "Customer Name",
  "Mobile Number",
  "Division",
  "District",
  "Area / Thana",
  "Full Address",
  "Product Name",
  "Quantity",
  "Unit Price",
  "Subtotal",
  "Delivery Charge",
  "Discount",
  "Total Amount",
  "Order Status",
  "Customer Note",
  // Added later: new columns go at the end so existing sheets keep their layout.
  "Gift",
] as const;

export const LAST_COLUMN = String.fromCharCode("A".charCodeAt(0) + SHEET_COLUMNS.length - 1);

export interface SheetOrder {
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  mobileNumber: string;
  division: string;
  district: string;
  area: string;
  address: string;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  totalAmount: number;
  orderStatus: OrderStatus;
  customerNote: string | null;
  giftWrap: boolean;
  giftWrapCharge: number;
  giftMessage: string | null;
  items: { productName: string; variantName: string | null; quantity: number; unitPrice: number }[];
}

/**
 * One row per order. Orders with several items list them on separate lines
 * inside the Product Name / Quantity / Unit Price cells so they stay aligned.
 */
export function orderToRow(order: SheetOrder): CellValue[] {
  const single = order.items.length === 1 ? order.items[0] : undefined;
  const products = order.items.map((i) => itemLabel(i.productName, i.variantName)).join("\n");
  const quantity: CellValue = single ? single.quantity : order.items.map((i) => i.quantity).join("\n");
  const unitPrice: CellValue = single ? single.unitPrice : order.items.map((i) => i.unitPrice).join("\n");
  return [
    order.orderNumber,
    formatDhakaDateTime(order.createdAt),
    order.customerName,
    order.mobileNumber,
    order.division,
    order.district,
    order.area,
    order.address,
    products,
    quantity,
    unitPrice,
    order.subtotal,
    order.deliveryCharge,
    order.discount,
    order.totalAmount,
    orderStatusLabel(order.orderStatus),
    order.customerNote ?? "",
    giftCell(order),
  ];
}

/** "Gift wrap (৳50)" and/or the gift message, one per line; empty when the order is not a gift. */
export function giftCell(order: Pick<SheetOrder, "giftWrap" | "giftWrapCharge" | "giftMessage">): string {
  return [order.giftWrap ? `Gift wrap (৳${order.giftWrapCharge})` : "", order.giftMessage ? `Message: ${order.giftMessage}` : ""]
    .filter(Boolean)
    .join("\n");
}
