"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { abtn, Badge, Card, Notice } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import type { Area, District, Division, LocationData } from "@/lib/locations";
import { formatTaka } from "@/lib/money";
import { deleteZone, saveZoneCoverage } from "./actions";
import { CoverageEditor } from "./CoverageEditor";
import { buildLocationIndex, ruleKey, type LocationIndex } from "./locationIndex";
import { ZoneForm } from "./ZoneForm";

export interface ZoneRule {
  districtId: string;
  /** "" = the whole district. */
  areaId: string;
}

export interface ZoneView {
  id: string;
  name: string;
  charge: number;
  estimatedDelivery: string | null;
  sortOrder: number;
  isDefault: boolean;
  rules: ZoneRule[];
}

type Flash = { tone: "success" | "error"; text: string; zoneId?: string } | null;

interface DistrictGroup {
  districtId: string;
  district: District | undefined;
  division: Division | undefined;
  whole: boolean;
  areas: { id: string; area: Area | undefined }[];
  totalAreas: number;
  /** Areas of this district assigned to other zones (they override a whole-district rule). */
  otherZoneAreas: number;
}

function groupRules(zone: ZoneView, index: LocationIndex, owners: Map<string, ZoneView>): DistrictGroup[] {
  const byDistrict = new Map<string, ZoneRule[]>();
  for (const r of zone.rules) {
    const list = byDistrict.get(r.districtId);
    if (list) list.push(r);
    else byDistrict.set(r.districtId, [r]);
  }
  const groups = [...byDistrict.entries()].map(([districtId, rules]): DistrictGroup => {
    const district = index.districts.get(districtId);
    const allAreas = index.areasByDistrict.get(districtId) ?? [];
    const order = new Map(allAreas.map((a, i) => [a.id, i]));
    return {
      districtId,
      district,
      division: district ? index.divisions.get(district.divisionId) : undefined,
      whole: rules.some((r) => r.areaId === ""),
      areas: rules
        .filter((r) => r.areaId !== "")
        .map((r) => ({ id: r.areaId, area: index.areas.get(r.areaId) }))
        .sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999)),
      totalAreas: allAreas.length,
      otherZoneAreas: allAreas.filter((a) => {
        const owner = owners.get(ruleKey(districtId, a.id));
        return owner && owner.id !== zone.id;
      }).length,
    };
  });
  return groups.sort(
    (a, b) =>
      (a.division?.en ?? "~").localeCompare(b.division?.en ?? "~") || (a.district?.en ?? a.districtId).localeCompare(b.district?.en ?? b.districtId),
  );
}

const CHIP_LIMIT = 12;

function AreaChips({ areas }: { areas: DistrictGroup["areas"] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? areas : areas.slice(0, CHIP_LIMIT);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shown.map(({ id, area }) => (
        <span key={id} className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-xs text-ink-soft ring-1 ring-line ring-inset">
          {area ? (
            <>
              {area.en} <span className="ml-1 text-muted">{area.bn}</span>
            </>
          ) : (
            <span className="text-danger-700">{id} (unknown area)</span>
          )}
        </span>
      ))}
      {areas.length > CHIP_LIMIT && (
        <button type="button" onClick={() => setExpanded((x) => !x)} className="text-xs font-semibold text-pine-700 hover:underline">
          {expanded ? "Show less" : `+${areas.length - CHIP_LIMIT} more`}
        </button>
      )}
    </div>
  );
}

export function DeliveryManager({ zones, locations }: { zones: ZoneView[]; locations: LocationData }) {
  const router = useRouter();
  const index = useMemo(() => buildLocationIndex(locations), [locations]);
  const owners = useMemo(() => {
    const map = new Map<string, ZoneView>();
    for (const z of zones) for (const r of z.rules) map.set(ruleKey(r.districtId, r.areaId), z);
    return map;
  }, [zones]);

  const [creating, setCreating] = useState(zones.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<{ zoneId: string; districtId: string } | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [pending, startTransition] = useTransition();

  const nextSortOrder = zones.length ? Math.max(...zones.map((z) => z.sortOrder)) + 1 : 0;

  function done(text: string, zoneId?: string) {
    setFlash({ tone: "success", text, zoneId });
    router.refresh();
  }

  function remove(zone: ZoneView) {
    setFlash(null);
    if (zone.isDefault) {
      setFlash({ tone: "error", text: "You cannot delete the default zone. Make another zone the default first, then delete this one.", zoneId: zone.id });
      return;
    }
    const n = zone.rules.length;
    const msg = `Delete the zone “${zone.name}”?${n ? ` Its ${n} location rule(s) will be removed and those locations will use the default zone.` : ""} Existing orders are not affected.`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteZone(zone.id);
      if (!res.ok) setFlash({ tone: "error", text: res.error, zoneId: zone.id });
      else {
        if (coverage?.zoneId === zone.id) setCoverage(null);
        if (editingId === zone.id) setEditingId(null);
        done(res.message ?? "Zone deleted");
      }
    });
  }

  function removeDistrict(zone: ZoneView, group: DistrictGroup) {
    const name = group.district?.en ?? group.districtId;
    if (!window.confirm(`Remove ${name} from “${zone.name}”? Those locations will use the default zone unless another rule covers them.`)) return;
    setFlash(null);
    startTransition(async () => {
      const res = await saveZoneCoverage({ zoneId: zone.id, districtId: group.districtId, wholeDistrict: false, areaIds: [] });
      if (!res.ok) setFlash({ tone: "error", text: res.error, zoneId: zone.id });
      else done(res.message ?? "Removed", zone.id);
    });
  }

  const flashFor = (zoneId?: string) => (flash && flash.zoneId === zoneId ? <Notice tone={flash.tone}>{flash.text}</Notice> : null);
  const globalFlash = flash && (!flash.zoneId || !zones.some((z) => z.id === flash.zoneId)) ? <Notice tone={flash.tone}>{flash.text}</Notice> : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-lg font-semibold text-ink">
          Zones <span className="text-muted">({zones.length})</span>
        </h2>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setFlash(null);
            }}
            className={`${abtn.primary} ${abtn.md}`}
          >
            <Icon name="plus" className="size-4" /> New zone
          </button>
        )}
      </div>

      {globalFlash}

      {creating && (
        <Card title="New delivery zone">
          <ZoneForm
            isFirstZone={zones.length === 0}
            nextSortOrder={nextSortOrder}
            onCancel={() => setCreating(false)}
            onSaved={(message, id) => {
              setCreating(false);
              setEditingId(null);
              // Go straight to assigning locations (except for the very first zone, the catch-all default).
              setCoverage(zones.length > 0 ? { zoneId: id, districtId: "" } : null);
              done(message, id);
            }}
          />
        </Card>
      )}

      {zones.map((zone) => {
        const groups = groupRules(zone, index, owners);
        const editing = editingId === zone.id;
        const assigning = coverage?.zoneId === zone.id;
        const areaCount = zone.rules.filter((r) => r.areaId !== "").length;
        const wholeCount = zone.rules.length - areaCount;
        return (
          <Card
            key={zone.id}
            title={zone.name}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {zone.isDefault && <Badge tone="green">Default</Badge>}
                {!editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(zone.id);
                      setFlash(null);
                    }}
                    className={`${abtn.secondary} ${abtn.sm}`}
                  >
                    <Icon name="edit" className="size-4" /> Edit
                  </button>
                )}
                <button type="button" onClick={() => remove(zone)} disabled={pending} className={`${abtn.danger} ${abtn.sm}`}>
                  <Icon name="trash" className="size-4" /> Delete
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              {flashFor(zone.id)}

              {editing ? (
                <ZoneForm
                  zone={zone}
                  onCancel={() => setEditingId(null)}
                  onSaved={(message) => {
                    setEditingId(null);
                    done(message, zone.id);
                  }}
                />
              ) : (
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Charge</dt>
                    <dd className="text-base font-bold text-ink tabular-nums">{zone.charge === 0 ? "Free" : formatTaka(zone.charge)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Delivery time</dt>
                    <dd className="text-ink">{zone.estimatedDelivery || <span className="text-muted">Not set</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Covers</dt>
                    <dd className="text-ink">
                      {zone.rules.length === 0
                        ? zone.isDefault
                          ? "Everything unassigned"
                          : "Nothing yet"
                        : [wholeCount && `${wholeCount} district${wholeCount === 1 ? "" : "s"}`, areaCount && `${areaCount} area${areaCount === 1 ? "" : "s"}`]
                            .filter(Boolean)
                            .join(" + ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Sort order</dt>
                    <dd className="text-ink tabular-nums">{zone.sortOrder}</dd>
                  </div>
                </dl>
              )}

              {zone.isDefault && (
                <p className="text-sm text-muted">
                  Default zone — used for every location that is not assigned to any zone
                  {zone.rules.length ? ", plus the locations below" : ""}.
                </p>
              )}
              {!zone.isDefault && zone.rules.length === 0 && !assigning && (
                <Notice tone="warning">No locations assigned yet, so no customer gets this zone. Assign districts or areas below.</Notice>
              )}

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-soft">Assigned districts &amp; areas</h3>
                  {!assigning && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoverage({ zoneId: zone.id, districtId: "" });
                        setFlash(null);
                      }}
                      className={`${abtn.secondary} ${abtn.sm}`}
                    >
                      <Icon name="mapPin" className="size-4" /> Assign locations
                    </button>
                  )}
                </div>

                {coverage && assigning && (
                  <div className="mb-3">
                    <CoverageEditor
                      key={`${zone.id}:${coverage.districtId}`}
                      zone={zone}
                      zones={zones}
                      index={index}
                      initialDistrictId={coverage.districtId}
                      onCancel={() => setCoverage(null)}
                      onSaved={(message) => {
                        setCoverage(null);
                        done(message, zone.id);
                      }}
                    />
                  </div>
                )}

                {groups.length === 0 ? (
                  <p className="text-sm text-muted">No districts or areas assigned.</p>
                ) : (
                  <ul className="space-y-2">
                    {groups.map((g) => (
                      <li key={g.districtId} className="rounded-lg border border-line bg-paper/60 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">
                              {g.district ? (
                                <>
                                  {g.district.en} <span className="font-normal text-ink-soft">· {g.district.bn}</span>
                                </>
                              ) : (
                                <span className="text-danger-700">{g.districtId} (unknown district)</span>
                              )}
                            </p>
                            <p className="text-xs text-muted">
                              {g.division ? `${g.division.en} division · ` : ""}
                              {g.whole
                                ? `Whole district${g.otherZoneAreas ? ` (except ${g.otherZoneAreas} area${g.otherZoneAreas === 1 ? "" : "s"} assigned to other zones)` : ""}`
                                : `${g.areas.length} of ${g.totalAreas} area${g.totalAreas === 1 ? "" : "s"}`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setCoverage({ zoneId: zone.id, districtId: g.districtId });
                                setFlash(null);
                              }}
                              disabled={pending}
                              className={`${abtn.ghost} ${abtn.sm}`}
                            >
                              <Icon name="edit" className="size-4" /> Edit
                            </button>
                            <button type="button" onClick={() => removeDistrict(zone, g)} disabled={pending} className={`${abtn.ghost} ${abtn.sm} text-danger-700`}>
                              <Icon name="x" className="size-4" /> Remove
                            </button>
                          </div>
                        </div>
                        {!g.whole && g.areas.length > 0 && <AreaChips areas={g.areas} />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
