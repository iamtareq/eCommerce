"use client";

import { useEffect, useMemo, useState } from "react";
import { field } from "@/components/ui/styles";
import { areasOf, districtsOf, OTHER_AREA_ID, type LocationData } from "@/lib/locations";
import { FieldError } from "./FieldError";

export interface LocationValue {
  divisionId: string;
  districtId: string;
  areaId: string;
  areaOther: string;
}

let cache: Promise<LocationData> | null = null;
function loadLocations(): Promise<LocationData> {
  cache ??= import("@/data/bd-locations.json").then((m) => (m.default ?? m) as unknown as LocationData);
  return cache;
}

export function LocationFields({
  value,
  onChange,
  errors,
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  errors: Record<string, string | undefined>;
}) {
  const [data, setData] = useState<LocationData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    loadLocations()
      .then((d) => alive && setData(d))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const divisions = useMemo(
    () => (data ? [...data.divisions].sort((a, b) => a.bn.localeCompare(b.bn, "bn")) : []),
    [data],
  );
  const districts = useMemo(() => (data && value.divisionId ? districtsOf(data, value.divisionId) : []), [data, value.divisionId]);
  const areas = useMemo(() => (data && value.districtId ? areasOf(data, value.districtId) : []), [data, value.districtId]);
  const cityAreas = areas.filter((a) => a.type === "city");
  const otherAreas = areas.filter((a) => a.type !== "city");

  const disabled = !data;
  const placeholder = loadError ? "লোড করা যায়নি — পেজটি রিফ্রেশ করুন" : "লোড হচ্ছে…";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="division" className={field.label}>
          বিভাগ <span className="text-danger-600">*</span>
        </label>
        <select
          id="division"
          name="division"
          className={field.input}
          value={value.divisionId}
          disabled={disabled}
          aria-invalid={!!errors.divisionId}
          aria-describedby={errors.divisionId ? "division-error" : undefined}
          onChange={(e) => onChange({ divisionId: e.target.value, districtId: "", areaId: "", areaOther: "" })}
        >
          <option value="">{disabled ? placeholder : "বিভাগ নির্বাচন করুন"}</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.bn}
            </option>
          ))}
        </select>
        <FieldError id="division-error" message={errors.divisionId} />
      </div>

      <div>
        <label htmlFor="district" className={field.label}>
          জেলা <span className="text-danger-600">*</span>
        </label>
        <select
          id="district"
          name="district"
          className={field.input}
          value={value.districtId}
          disabled={disabled || !value.divisionId}
          aria-invalid={!!errors.districtId}
          aria-describedby={errors.districtId ? "district-error" : undefined}
          onChange={(e) => onChange({ ...value, districtId: e.target.value, areaId: "", areaOther: "" })}
        >
          <option value="">{value.divisionId ? "জেলা নির্বাচন করুন" : "আগে বিভাগ নির্বাচন করুন"}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.bn}
            </option>
          ))}
        </select>
        <FieldError id="district-error" message={errors.districtId} />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="area" className={field.label}>
          এলাকা / থানা <span className="text-danger-600">*</span>
        </label>
        <select
          id="area"
          name="area"
          className={field.input}
          value={value.areaId}
          disabled={disabled || !value.districtId}
          aria-invalid={!!errors.areaId}
          aria-describedby={errors.areaId ? "area-error" : undefined}
          onChange={(e) => onChange({ ...value, areaId: e.target.value, areaOther: e.target.value === OTHER_AREA_ID ? value.areaOther : "" })}
        >
          <option value="">{value.districtId ? "এলাকা / থানা নির্বাচন করুন" : "আগে জেলা নির্বাচন করুন"}</option>
          {cityAreas.length > 0 && (
            <optgroup label="ঢাকা সিটি (থানা)">
              {cityAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bn}
                </option>
              ))}
            </optgroup>
          )}
          {otherAreas.length > 0 && (
            <optgroup label={cityAreas.length ? "উপজেলা" : "উপজেলা / থানা"}>
              {otherAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bn}
                </option>
              ))}
            </optgroup>
          )}
          {value.districtId && <option value={OTHER_AREA_ID}>অন্য এলাকা (তালিকায় নেই)</option>}
        </select>
        <FieldError id="area-error" message={errors.areaId} />
      </div>

      {value.areaId === OTHER_AREA_ID && (
        <div className="sm:col-span-2">
          <label htmlFor="areaOther" className={field.label}>
            আপনার এলাকা / থানার নাম <span className="text-danger-600">*</span>
          </label>
          <input
            id="areaOther"
            name="areaOther"
            className={field.input}
            value={value.areaOther}
            maxLength={80}
            autoComplete="address-level3"
            aria-invalid={!!errors.areaOther}
            aria-describedby={errors.areaOther ? "areaOther-error" : undefined}
            onChange={(e) => onChange({ ...value, areaOther: e.target.value })}
          />
          <FieldError id="areaOther-error" message={errors.areaOther} />
        </div>
      )}
    </div>
  );
}
