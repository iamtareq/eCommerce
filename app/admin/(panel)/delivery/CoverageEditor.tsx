"use client";

import { useMemo, useState, useTransition } from "react";
import { abtn, ainput, alabel, Notice } from "@/components/admin/ui";
import type { Area } from "@/lib/locations";
import { cn } from "@/lib/cn";
import { saveZoneCoverage } from "./actions";
import type { ZoneView } from "./DeliveryManager";
import { ruleKey, type LocationIndex } from "./locationIndex";

/**
 * Assigns one district of a zone: either the whole district or specific areas.
 * Saving replaces this zone's rules for that district; locations owned by other
 * zones are moved to this one.
 */
export function CoverageEditor({
  zone,
  zones,
  index,
  initialDistrictId,
  onSaved,
  onCancel,
}: {
  zone: ZoneView;
  zones: ZoneView[];
  index: LocationIndex;
  initialDistrictId: string;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  /** Which zone owns each [districtId, areaId] rule right now. */
  const owners = useMemo(() => {
    const map = new Map<string, ZoneView>();
    for (const z of zones) for (const r of z.rules) map.set(ruleKey(r.districtId, r.areaId), z);
    return map;
  }, [zones]);
  const myDistricts = useMemo(() => new Set(zone.rules.map((r) => r.districtId)), [zone.rules]);
  const defaultZone = zones.find((z) => z.isDefault) ?? null;

  function stateFor(districtId: string) {
    const mine = zone.rules.filter((r) => r.districtId === districtId);
    const areaIds = mine.filter((r) => r.areaId !== "" && index.areas.get(r.areaId)?.districtId === districtId).map((r) => r.areaId);
    // A district this zone does not cover yet starts as "whole district".
    return { wholeDistrict: mine.length === 0 || mine.some((r) => r.areaId === ""), selected: new Set(areaIds) };
  }

  const [districtId, setDistrictId] = useState(initialDistrictId);
  const [wholeDistrict, setWholeDistrict] = useState(() => stateFor(initialDistrictId).wholeDistrict);
  const [selected, setSelected] = useState<Set<string>>(() => stateFor(initialDistrictId).selected);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickDistrict(id: string) {
    const s = stateFor(id);
    setDistrictId(id);
    setWholeDistrict(s.wholeDistrict);
    setSelected(s.selected);
    setError(null);
  }

  const district = districtId ? index.districts.get(districtId) : undefined;
  const areas = district ? (index.areasByDistrict.get(district.id) ?? []) : [];
  const cityAreas = areas.filter((a) => a.type === "city");
  const otherAreas = areas.filter((a) => a.type !== "city");
  const hadRules = !!district && myDistricts.has(district.id);
  const hadWhole = !!district && owners.get(ruleKey(district.id, ""))?.id === zone.id;
  const myAreaRuleCount = district ? zone.rules.filter((r) => r.districtId === district.id && r.areaId !== "").length : 0;

  /** Zone that owns an area rule, when it is not this zone. */
  const otherOwner = (areaId: string) => {
    const owner = district ? owners.get(ruleKey(district.id, areaId)) : undefined;
    return owner && owner.id !== zone.id ? owner : null;
  };
  const districtOwner = district ? owners.get(ruleKey(district.id, "")) : undefined;
  const otherZoneAreaCount = areas.filter((a) => otherOwner(a.id)).length;
  const movingCount = wholeDistrict ? 0 : [...selected].filter((id) => otherOwner(id)).length;
  /** Where unticked areas go after saving. */
  const fallbackName = districtOwner && districtOwner.id !== zone.id ? `${districtOwner.name} (whole-district rule)` : defaultZone ? `${defaultZone.name} (default zone)` : "the default zone";

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const addAll = (list: Area[]) => setSelected((prev) => new Set([...prev, ...list.map((a) => a.id)]));

  function save() {
    setError(null);
    if (!district) {
      setError("Choose a district first.");
      return;
    }
    if (!wholeDistrict && selected.size === 0) {
      if (!hadRules) {
        setError("Tick at least one area, or choose “Whole district”.");
        return;
      }
      if (!window.confirm(`Remove all of this zone's rules for ${district.en}? Those locations will use ${fallbackName}.`)) return;
    }
    startTransition(async () => {
      const res = await saveZoneCoverage({
        zoneId: zone.id,
        districtId: district.id,
        wholeDistrict,
        areaIds: wholeDistrict ? [] : [...selected],
      });
      if (!res.ok) setError(res.error);
      else onSaved(res.message ?? "Locations saved");
    });
  }

  const fieldId = `coverage-${zone.id}`;

  const areaCheckbox = (a: Area) => {
    const checked = selected.has(a.id);
    const other = otherOwner(a.id);
    return (
      <label
        key={a.id}
        className={cn(
          "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors",
          checked ? "border-pine-600/40 bg-white" : "border-line bg-white/60 hover:border-line-strong",
        )}
      >
        <input type="checkbox" checked={checked} onChange={(e) => toggle(a.id, e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-pine-700" />
        <span className="min-w-0">
          <span className="block text-ink">
            {a.en} <span className="text-ink-soft">· {a.bn}</span>
          </span>
          {other && (
            <span className={cn("block text-xs", checked ? "font-semibold text-amber-800" : "text-muted")}>
              {checked ? `Moves here from ${other.name}` : `Now in: ${other.name}`}
            </span>
          )}
        </span>
      </label>
    );
  };

  return (
    <div className="space-y-4 rounded-lg border border-pine-600/30 bg-pine-50/50 p-3 sm:p-4">
      <p className="font-semibold text-ink">Assign locations to &ldquo;{zone.name}&rdquo;</p>
      {error && <Notice tone="error">{error}</Notice>}

      <div className="max-w-md">
        <label htmlFor={`${fieldId}-district`} className={alabel}>
          District
        </label>
        <select id={`${fieldId}-district`} value={districtId} onChange={(e) => pickDistrict(e.target.value)} className={ainput}>
          <option value="">— Choose a district —</option>
          {index.groups.map((g) => (
            <optgroup key={g.division.id} label={`${g.division.en} division`}>
              {g.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.en} — {d.bn}
                  {myDistricts.has(d.id) ? " ✓" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">✓ = this zone already covers something in that district.</p>
      </div>

      {district && (
        <>
          <fieldset>
            <legend className={alabel}>What does this zone cover in {district.en}?</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" name={`${fieldId}-mode`} checked={wholeDistrict} onChange={() => setWholeDistrict(true)} className="size-4 accent-pine-700" />
                Whole district
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" name={`${fieldId}-mode`} checked={!wholeDistrict} onChange={() => setWholeDistrict(false)} className="size-4 accent-pine-700" />
                Specific areas ({areas.length} available)
              </label>
            </div>
          </fieldset>

          {wholeDistrict ? (
            <div className="space-y-2 text-sm">
              <p className="text-ink-soft">
                Every area of {district.en} that is not assigned individually will use this zone.
              </p>
              {districtOwner && districtOwner.id !== zone.id && (
                <Notice tone="warning">
                  The whole district is currently assigned to &ldquo;{districtOwner.name}&rdquo;. Saving moves it to this zone.
                </Notice>
              )}
              {myAreaRuleCount > 0 && (
                <Notice tone="info">This zone&apos;s {myAreaRuleCount} individual area rule(s) in {district.en} will be replaced by the whole-district rule.</Notice>
              )}
              {otherZoneAreaCount > 0 && (
                <Notice tone="info">
                  {otherZoneAreaCount} area(s) in {district.en} are assigned to other zones individually and keep their own zone (area rules win).
                </Notice>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {cityAreas.length > 0 && (
                  <button type="button" onClick={() => addAll(cityAreas)} className={`${abtn.secondary} ${abtn.sm}`}>
                    Select all Dhaka city thanas ({cityAreas.length})
                  </button>
                )}
                <button type="button" onClick={() => addAll(areas)} className={`${abtn.secondary} ${abtn.sm}`}>
                  Select all ({areas.length})
                </button>
                <button type="button" onClick={() => setSelected(new Set())} disabled={selected.size === 0} className={`${abtn.ghost} ${abtn.sm}`}>
                  Clear
                </button>
              </div>
              <p className="text-xs text-muted">
                Unticked areas use {fallbackName}.{hadWhole ? ` Saving replaces this zone's whole-district rule for ${district.en} with the ticked areas.` : ""}
              </p>

              {cityAreas.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Dhaka city thanas</p>
                  <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">{cityAreas.map(areaCheckbox)}</div>
                </div>
              )}
              {otherAreas.length > 0 && (
                <div>
                  {cityAreas.length > 0 && <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Upazilas outside the city</p>}
                  <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">{otherAreas.map(areaCheckbox)}</div>
                </div>
              )}
              {areas.length === 0 && <p className="text-sm text-muted">This district has no areas in the dataset — use &ldquo;Whole district&rdquo;.</p>}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-pine-600/15 pt-3">
        <button type="button" onClick={save} disabled={pending || !district} className={`${abtn.primary} ${abtn.md}`}>
          {pending ? "Saving…" : "Save locations"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={`${abtn.secondary} ${abtn.md}`}>
          Cancel
        </button>
        {district && !wholeDistrict && (
          <span className="text-sm text-muted">
            {selected.size} of {areas.length} selected
            {movingCount > 0 ? ` · ${movingCount} will move from other zones` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
