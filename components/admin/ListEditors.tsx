"use client";

import { Icon } from "@/components/ui/Icon";
import { abtn, ainput, atextarea } from "./ui";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** True when every field of a list row is empty (such rows are dropped on save; partly filled ones are validated). */
export const isBlankRow = (row: Record<string, string>) => Object.values(row).every((x) => !x.trim());

function RowControls({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0} className={`${abtn.ghost} size-8 p-0`} aria-label={`Move row ${index + 1} up`}>
        <Icon name="arrowUp" className="size-4" />
      </button>
      <button type="button" onClick={() => onMove(index + 1)} disabled={index === count - 1} className={`${abtn.ghost} size-8 p-0`} aria-label={`Move row ${index + 1} down`}>
        <Icon name="arrowDown" className="size-4" />
      </button>
      <button type="button" onClick={onRemove} className={`${abtn.ghost} size-8 p-0 text-danger-700`} aria-label={`Remove row ${index + 1}`}>
        <Icon name="trash" className="size-4" />
      </button>
    </div>
  );
}

/** Editable ordered list of single-line strings. */
export function TextListEditor({
  value,
  onChange,
  placeholder,
  addLabel = "Add item",
  max = 30,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            placeholder={placeholder}
            maxLength={300}
            className={ainput}
            aria-label={`${addLabel} ${i + 1}`}
          />
          <RowControls index={i} count={value.length} onMove={(to) => onChange(move(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      {value.length < max && (
        <button type="button" onClick={() => onChange([...value, ""])} className={`${abtn.secondary} ${abtn.sm}`}>
          <Icon name="plus" className="size-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}

export interface PairField<K extends string> {
  key: K;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}

/** Editable ordered list of small objects (e.g. benefits, specs, FAQ). */
export function PairListEditor<K extends string>({
  value,
  onChange,
  fields,
  addLabel = "Add",
  max = 20,
}: {
  value: Record<K, string>[];
  onChange: (v: Record<K, string>[]) => void;
  fields: PairField<K>[];
  addLabel?: string;
  max?: number;
}) {
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, ""])) as Record<K, string>;
  return (
    <div className="space-y-3">
      {value.map((row, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-line bg-paper/60 p-3">
          <div className="grid flex-1 gap-2">
            {fields.map((f) =>
              f.multiline ? (
                <textarea
                  key={f.key}
                  value={row[f.key]}
                  rows={2}
                  maxLength={f.maxLength ?? 2000}
                  onChange={(e) => onChange(value.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))}
                  placeholder={f.placeholder ?? f.label}
                  aria-label={`${f.label} ${i + 1}`}
                  className={atextarea}
                />
              ) : (
                <input
                  key={f.key}
                  value={row[f.key]}
                  maxLength={f.maxLength ?? 200}
                  onChange={(e) => onChange(value.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))}
                  placeholder={f.placeholder ?? f.label}
                  aria-label={`${f.label} ${i + 1}`}
                  className={ainput}
                />
              ),
            )}
          </div>
          <RowControls index={i} count={value.length} onMove={(to) => onChange(move(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      {value.length < max && (
        <button type="button" onClick={() => onChange([...value, blank()])} className={`${abtn.secondary} ${abtn.sm}`}>
          <Icon name="plus" className="size-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}

export { move };
