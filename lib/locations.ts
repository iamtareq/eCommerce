/**
 * Bangladesh location types and helpers, shared by the browser and the server.
 * The dataset itself lives in data/bd-locations.json and is loaded lazily on the
 * client (it is only needed once the order form is shown).
 */

export interface Division {
  id: string;
  en: string;
  bn: string;
}

export interface District {
  id: string;
  divisionId: string;
  en: string;
  bn: string;
}

export interface Area {
  id: string;
  districtId: string;
  en: string;
  bn: string;
  /** "city" = Dhaka city thana, "upazila" = upazila/thana. */
  type: "city" | "upazila";
}

export interface LocationData {
  divisions: Division[];
  districts: District[];
  areas: Area[];
}

/** Sentinel area id meaning "my area is not in the list" (free-text area). */
export const OTHER_AREA_ID = "other";

export function districtsOf(data: LocationData, divisionId: string): District[] {
  return data.districts
    .filter((d) => d.divisionId === divisionId)
    .sort((a, b) => a.bn.localeCompare(b.bn, "bn"));
}

export function areasOf(data: LocationData, districtId: string): Area[] {
  return data.areas
    .filter((a) => a.districtId === districtId)
    .sort((a, b) => (a.type === b.type ? a.bn.localeCompare(b.bn, "bn") : a.type === "city" ? -1 : 1));
}

export interface ResolvedLocation {
  division: Division;
  district: District;
  area: Area | null;
  /** Display name stored on the order (area name or the free-text value). */
  areaName: string;
}

/**
 * Validates that the division → district → area chain is consistent.
 * Returns null when any id is unknown or does not belong to its parent.
 */
export function resolveLocation(
  data: LocationData,
  input: { divisionId: string; districtId: string; areaId: string; areaOther?: string | null },
): ResolvedLocation | null {
  const division = data.divisions.find((d) => d.id === input.divisionId);
  if (!division) return null;
  const district = data.districts.find((d) => d.id === input.districtId && d.divisionId === division.id);
  if (!district) return null;
  if (input.areaId === OTHER_AREA_ID) {
    const other = input.areaOther?.trim();
    if (!other) return null;
    return { division, district, area: null, areaName: other };
  }
  const area = data.areas.find((a) => a.id === input.areaId && a.districtId === district.id);
  if (!area) return null;
  return { division, district, area, areaName: area.bn };
}
