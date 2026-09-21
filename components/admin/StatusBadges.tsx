import { ORDER_STATUSES, SYNC_STATUSES } from "@/config/order";
import type { OrderStatus, SheetSyncStatus } from "@/generated/prisma/enums";
import { Badge } from "./ui";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUSES.find((x) => x.value === status);
  return <Badge tone={s?.tone ?? "gray"}>{s?.label ?? status}</Badge>;
}

export function SyncStatusBadge({ status }: { status: SheetSyncStatus }) {
  const s = SYNC_STATUSES.find((x) => x.value === status);
  return <Badge tone={s?.tone ?? "gray"}>{s?.label ?? status}</Badge>;
}
