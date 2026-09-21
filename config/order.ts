import type { OrderStatus, SheetSyncStatus } from "@/generated/prisma/enums";

/** Order statuses in workflow order, with admin (English) and customer (Bangla) labels. */
export const ORDER_STATUSES: { value: OrderStatus; label: string; labelBn: string; tone: Tone }[] = [
  { value: "PENDING", label: "Pending", labelBn: "অপেক্ষমাণ", tone: "amber" },
  { value: "ON_HOLD", label: "On Hold", labelBn: "হোল্ডে আছে", tone: "orange" },
  { value: "CONFIRMED", label: "Confirmed", labelBn: "কনফার্মড", tone: "blue" },
  { value: "PROCESSING", label: "Processing", labelBn: "প্রস্তুত হচ্ছে", tone: "indigo" },
  { value: "SHIPPED", label: "Shipped", labelBn: "পাঠানো হয়েছে", tone: "violet" },
  { value: "DELIVERED", label: "Delivered", labelBn: "ডেলিভারি সম্পন্ন", tone: "green" },
  { value: "CANCELLED", label: "Cancelled", labelBn: "বাতিল", tone: "red" },
];

export const SYNC_STATUSES: { value: SheetSyncStatus; label: string; tone: Tone }[] = [
  { value: "PENDING", label: "Pending", tone: "amber" },
  { value: "SYNCING", label: "Syncing", tone: "blue" },
  { value: "SYNCED", label: "Synced", tone: "green" },
  { value: "FAILED", label: "Failed", tone: "red" },
];

export type Tone = "amber" | "orange" | "blue" | "indigo" | "violet" | "green" | "red" | "gray";

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function orderStatusLabelBn(status: OrderStatus): string {
  return ORDER_STATUSES.find((s) => s.value === status)?.labelBn ?? status;
}

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.some((s) => s.value === value);
}

export function isSyncStatus(value: string): value is SheetSyncStatus {
  return SYNC_STATUSES.some((s) => s.value === value);
}

/** "Wall Frame (12×18)" — variant names are optional for single-variant products. */
export function itemLabel(productName: string, variantName: string | null | undefined): string {
  const v = variantName?.trim();
  return v ? `${productName} (${v})` : productName;
}
