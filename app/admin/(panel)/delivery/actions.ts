"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { nullableText, requiredInt, type ActionResult } from "@/lib/admin/common";
import { requireOwner } from "@/lib/auth/guard";
import { DELIVERY_TAG } from "@/lib/catalog";
import { isUniqueViolation, prisma } from "@/lib/db";
import { getLocationData } from "@/lib/locations.server";

function refresh() {
  updateTag(DELIVERY_TAG);
  revalidatePath("/admin/delivery");
}

const zoneSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(1, { error: "Zone name is required" }).max(60, { error: "Zone name must be at most 60 characters" }),
  charge: requiredInt(0, 100_000),
  estimatedDelivery: nullableText(60),
  sortOrder: requiredInt(-10_000, 10_000),
  isDefault: z.boolean(),
});

export type ZoneInput = z.input<typeof zoneSchema>;

/** Readable message for the first validation problem. */
function zoneError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  switch (issue.path[0]) {
    case "charge":
      return "Delivery charge must be a whole number of taka between 0 and 100000.";
    case "sortOrder":
      return "Sort order must be a whole number between -10000 and 10000.";
    case "estimatedDelivery":
      return "Estimated delivery must be at most 60 characters.";
    default:
      return issue.message;
  }
}

class UserFacingError extends Error {}

/** Creates or updates a zone. Keeps exactly one default zone. */
export async function saveZone(input: ZoneInput): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zoneError(parsed.error) };
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fields = {
        name: data.name,
        charge: data.charge,
        estimatedDelivery: data.estimatedDelivery,
        sortOrder: data.sortOrder,
      };
      let id = data.id;
      if (id) {
        const existing = await tx.deliveryZone.findUnique({ where: { id }, select: { isDefault: true } });
        if (!existing) throw new UserFacingError("This zone no longer exists. Reload the page.");
        if (existing.isDefault && !data.isDefault) {
          throw new UserFacingError("One zone must always be the default. To change it, edit another zone and make that one the default.");
        }
        await tx.deliveryZone.update({ where: { id }, data: { ...fields, isDefault: data.isDefault } });
      } else {
        id = (await tx.deliveryZone.create({ data: { ...fields, isDefault: data.isDefault }, select: { id: true } })).id;
      }

      if (data.isDefault) {
        await tx.deliveryZone.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      // Safety net: there must always be a default zone (e.g. the very first zone).
      let becameDefault = false;
      if ((await tx.deliveryZone.count({ where: { isDefault: true } })) === 0) {
        await tx.deliveryZone.update({ where: { id }, data: { isDefault: true } });
        becameDefault = true;
      }
      return { id, becameDefault };
    });

    refresh();
    return {
      ok: true,
      message: result.becameDefault
        ? "Zone saved. It was made the default zone because no other zone is the default."
        : data.id
          ? "Zone saved"
          : "Zone created. Now assign the districts or areas it covers.",
      data: { id: result.id },
    };
  } catch (error) {
    if (error instanceof UserFacingError) return { ok: false, error: error.message };
    console.error("[admin] saveZone failed", error);
    return { ok: false, error: "Could not save the zone. Please try again." };
  }
}

/** Deletes a non-default zone together with its area rules (those locations fall back to other rules / the default zone). */
export async function deleteZone(id: string): Promise<ActionResult> {
  await requireOwner();
  if (typeof id !== "string" || !id) return { ok: false, error: "Zone not found" };
  const zone = await prisma.deliveryZone.findUnique({ where: { id }, select: { isDefault: true } });
  if (!zone) return { ok: false, error: "This zone no longer exists. Reload the page." };
  if (zone.isDefault) {
    return { ok: false, error: "You cannot delete the default zone. Make another zone the default first, then delete this one." };
  }
  // deleteMany keeps this idempotent if two tabs delete at the same time; area rules cascade.
  await prisma.deliveryZone.deleteMany({ where: { id, isDefault: false } });
  refresh();
  return { ok: true, message: "Zone deleted. Its locations now use the default zone (unless another rule covers them)." };
}

const coverageSchema = z.object({
  zoneId: z.string().min(1).max(40),
  districtId: z.string().min(1, { error: "Choose a district" }).max(80),
  wholeDistrict: z.boolean(),
  areaIds: z.array(z.string().min(1).max(120)).max(500),
});

export type CoverageInput = z.input<typeof coverageSchema>;

/**
 * Replaces this zone's rules for one district: either the whole district or a
 * list of its areas. Rules for the same location owned by another zone are
 * moved to this zone ([districtId, areaId] is unique).
 */
export async function saveZoneCoverage(input: CoverageInput): Promise<ActionResult> {
  await requireOwner();
  const parsed = coverageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { zoneId, districtId, wholeDistrict } = parsed.data;

  const areaIds = wholeDistrict ? [] : [...new Set(parsed.data.areaIds)];
  const locations = getLocationData();
  const district = locations.districts.find((d) => d.id === districtId);
  if (!district) {
    // Only allow clearing leftover rules for a district that is no longer in the dataset.
    if (wholeDistrict || areaIds.length) return { ok: false, error: "Unknown district" };
    await prisma.deliveryZoneArea.deleteMany({ where: { zoneId, districtId } });
    refresh();
    return { ok: true, message: "Removed the rules for an unknown district." };
  }
  const validAreas = new Set(locations.areas.filter((a) => a.districtId === districtId).map((a) => a.id));
  if (areaIds.some((id) => !validAreas.has(id))) return { ok: false, error: `Some selected areas do not belong to ${district.en}. Reload the page and try again.` };

  try {
    const moved = await prisma.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.findUnique({ where: { id: zoneId }, select: { id: true } });
      if (!zone) throw new UserFacingError("This zone no longer exists. Reload the page.");

      await tx.deliveryZoneArea.deleteMany({ where: { zoneId, districtId } });
      if (wholeDistrict) {
        const taken = await tx.deliveryZoneArea.deleteMany({ where: { districtId, areaId: "" } });
        await tx.deliveryZoneArea.create({ data: { zoneId, districtId, areaId: "" } });
        return taken.count;
      }
      if (areaIds.length === 0) return 0;
      const taken = await tx.deliveryZoneArea.deleteMany({ where: { districtId, areaId: { in: areaIds } } });
      await tx.deliveryZoneArea.createMany({ data: areaIds.map((areaId) => ({ zoneId, districtId, areaId })) });
      return taken.count;
    });

    refresh();
    const what = wholeDistrict
      ? `Whole ${district.en} district assigned`
      : areaIds.length === 0
        ? `Removed this zone's rules for ${district.en}`
        : `${areaIds.length} area${areaIds.length === 1 ? "" : "s"} in ${district.en} assigned`;
    const movedNote = moved > 0 ? ` (${moved} moved from another zone)` : "";
    return { ok: true, message: `${what}${movedNote}.` };
  } catch (error) {
    if (error instanceof UserFacingError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "These locations were changed at the same time by someone else. Reload the page and try again." };
    console.error("[admin] saveZoneCoverage failed", error);
    return { ok: false, error: "Could not save the locations. Please try again." };
  }
}
