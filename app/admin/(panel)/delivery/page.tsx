import { Notice, PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { getLocationData } from "@/lib/locations.server";
import { DeliveryManager, type ZoneView } from "./DeliveryManager";

export const metadata = { title: "Delivery" };

export default async function DeliveryPage() {
  await requireOwner();
  const rows = await prisma.deliveryZone.findMany({
    // Same order as the storefront (lib/catalog.ts → loadDeliveryConfig).
    orderBy: [{ sortOrder: "asc" }, { charge: "asc" }, { createdAt: "asc" }],
    include: { areas: { select: { districtId: true, areaId: true } } },
  });
  const zones: ZoneView[] = rows.map((z) => ({
    id: z.id,
    name: z.name,
    charge: z.charge,
    estimatedDelivery: z.estimatedDelivery,
    sortOrder: z.sortOrder,
    isDefault: z.isDefault,
    rules: z.areas,
  }));
  const hasDefault = zones.some((z) => z.isDefault);

  return (
    <>
      <PageHeader title="Delivery" description="Delivery charges and the districts/areas each charge applies to. Changes apply to new orders only." />

      <div className="mb-6 space-y-2">
        <Notice tone="info">
          <p className="font-semibold">How a customer&apos;s delivery charge is chosen</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>If their area/thana is assigned to a zone, that zone is used.</li>
            <li>Otherwise, if their whole district is assigned to a zone, that zone is used.</li>
            <li>Anything not assigned uses the default zone.</li>
          </ol>
          <p className="mt-1">So area rules beat whole-district rules. Each district or area can belong to only one zone.</p>
        </Notice>
        {zones.length === 0 && (
          <Notice tone="warning">No delivery zones yet — customers cannot order until you create at least one zone.</Notice>
        )}
        {zones.length > 0 && !hasDefault && (
          <Notice tone="warning">No zone is marked as the default. Edit a zone and tick &ldquo;Default zone&rdquo;.</Notice>
        )}
      </div>

      <DeliveryManager zones={zones} locations={getLocationData()} />
    </>
  );
}
