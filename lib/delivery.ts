export interface ZoneLike {
  id: string;
  name: string;
  charge: number;
  isDefault: boolean;
  estimatedDelivery: string | null;
}

export interface ZoneRuleLike {
  zoneId: string;
  districtId: string;
  /** "" means the rule covers the whole district. */
  areaId: string;
}

/**
 * Picks the delivery zone for a location. An area-level rule beats a
 * district-level rule; with no match the default zone is used.
 */
export function resolveZone<Z extends ZoneLike>(
  zones: Z[],
  rules: ZoneRuleLike[],
  districtId: string,
  areaId: string | null,
): Z | null {
  const rule =
    (areaId ? rules.find((r) => r.districtId === districtId && r.areaId === areaId) : undefined) ??
    rules.find((r) => r.districtId === districtId && r.areaId === "");
  const matched = rule ? zones.find((z) => z.id === rule.zoneId) : undefined;
  return matched ?? zones.find((z) => z.isDefault) ?? zones[0] ?? null;
}
