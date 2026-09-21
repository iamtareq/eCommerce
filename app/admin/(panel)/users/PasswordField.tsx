"use client";

import { useState } from "react";
import { abtn, ainput, alabel } from "@/components/admin/ui";
import { cn } from "@/lib/cn";

/** Same rules as lib/auth/password.ts → passwordProblem (checked again on the server). */
export const PASSWORD_HINT = "At least 10 characters, with letters and numbers.";

const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

/** Random 14-character password without look-alike characters (0/O, 1/l/I). */
export function generatePassword(length = 14): string {
  const all = LETTERS + DIGITS;
  const bytes = crypto.getRandomValues(new Uint32Array(length + 2));
  let out = "";
  for (let i = 0; i < length; i++) out += all.charAt((bytes[i] ?? 0) % all.length);
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + DIGITS.charAt((bytes[length] ?? 0) % DIGITS.length);
  if (!/[A-Za-z]/.test(out)) out = LETTERS.charAt((bytes[length + 1] ?? 0) % LETTERS.length) + out.slice(1);
  return out;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  required,
  help,
  autoComplete = "new-password",
  allowGenerate = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  help?: React.ReactNode;
  autoComplete?: "new-password" | "current-password";
  allowGenerate?: boolean;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={alabel}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          maxLength={128}
          required={required}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="none"
          className={cn(ainput, "min-w-0 flex-1", show && "font-mono")}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-controls={id}
          className={`${abtn.secondary} ${abtn.md} shrink-0 px-3`}
        >
          {show ? "Hide" : "Show"}
        </button>
        {allowGenerate && (
          <button
            type="button"
            onClick={() => {
              onChange(generatePassword());
              setShow(true);
            }}
            className={`${abtn.secondary} ${abtn.md} shrink-0 px-3`}
          >
            Generate
          </button>
        )}
      </div>
      {help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  );
}
