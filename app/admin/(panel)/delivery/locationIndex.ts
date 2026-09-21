import type { Area, District, Division, LocationData } from "@/lib/locations";

/** Lookup tables over the Bangladesh location dataset for the delivery admin screens. */
export interface LocationIndex {
  divisions: Map<string, Division>;
  districts: Map<string, District>;
  areas: Map<string, Area>;
  /** Divisions with their districts, both sorted by English name. */
  groups: { division: Division; districts: District[] }[];
  /** Areas of a district: Dhaka city thanas first, then upazilas; each sorted by English name. */
  areasByDistrict: Map<string, Area[]>;
}

const byEn = (a: { en: string }, b: { en: string }) => a.en.localeCompare(b.en, "en");

export function buildLocationIndex(data: LocationData): LocationIndex {
  const areasByDistrict = new Map<string, Area[]>();
  for (const area of data.areas) {
    const list = areasByDistrict.get(area.districtId);
    if (list) list.push(area);
    else areasByDistrict.set(area.districtId, [area]);
  }
  for (const list of areasByDistrict.values()) {
    list.sort((a, b) => (a.type === b.type ? byEn(a, b) : a.type === "city" ? -1 : 1));
  }
  return {
    divisions: new Map(data.divisions.map((d) => [d.id, d])),
    districts: new Map(data.districts.map((d) => [d.id, d])),
    areas: new Map(data.areas.map((a) => [a.id, a])),
    groups: [...data.divisions].sort(byEn).map((division) => ({
      division,
      districts: data.districts.filter((d) => d.divisionId === division.id).sort(byEn),
    })),
    areasByDistrict,
  };
}

/** Key for the unique [districtId, areaId] pair of a DeliveryZoneArea rule ("" = whole district). */
export const ruleKey = (districtId: string, areaId: string) => `${districtId}|${areaId}`;
