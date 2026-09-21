"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { abtn, ainput, alabel, Notice } from "@/components/admin/ui";
import { PASSWORD_HINT, PasswordField } from "../users/PasswordField";
import { changeMyPassword, updateMyDisplayName } from "./actions";

type Result = { tone: "success" | "error"; text: string } | null;

export function DisplayNameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await updateMyDisplayName(name);
      if (!res.ok) {
        setResult({ tone: "error", text: res.error });
        return;
      }
      setSaved(name.trim());
      setName(name.trim());
      setResult({ tone: "success", text: res.message ?? "Saved" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <div>
        <label htmlFor="account-display-name" className={alabel}>
          Display name
        </label>
        <div className="flex gap-2">
          <input
            id="account-display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            autoComplete="name"
            className={`${ainput} min-w-0 flex-1`}
          />
          <button type="submit" disabled={pending || name.trim() === saved || !name.trim()} className={`${abtn.primary} ${abtn.md} shrink-0`}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Shown in the admin panel and on order history entries you create.</p>
      </div>
    </form>
  );
}

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function ChangePasswordForm() {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof typeof EMPTY) => (value: string) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };
  const mismatch = v.confirmPassword !== "" && v.newPassword !== v.confirmPassword;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (mismatch) {
      setErrors({ confirmPassword: "Does not match the new password" });
      setResult({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    startTransition(async () => {
      const res = await changeMyPassword(v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setResult({ tone: "error", text: res.error });
        return;
      }
      setV(EMPTY);
      setErrors({});
      setResult({ tone: "success", text: res.message ?? "Password changed" });
    });
  }

  const error = (key: keyof typeof EMPTY) =>
    errors[key] ? <p className="mt-1 text-xs font-medium text-danger-700">{errors[key]}</p> : null;

  return (
    <form onSubmit={submit} className="space-y-4">
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <div>
        <PasswordField
          id="account-current-password"
          label="Current password"
          value={v.currentPassword}
          onChange={set("currentPassword")}
          autoComplete="current-password"
          required
        />
        {error("currentPassword")}
      </div>
      <div>
        <PasswordField id="account-new-password" label="New password" value={v.newPassword} onChange={set("newPassword")} required help={PASSWORD_HINT} />
        {error("newPassword")}
      </div>
      <div>
        <PasswordField id="account-confirm-password" label="Confirm new password" value={v.confirmPassword} onChange={set("confirmPassword")} required />
        {mismatch && !errors.confirmPassword && <p className="mt-1 text-xs font-medium text-amber-800">Does not match the new password yet.</p>}
        {error("confirmPassword")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !v.currentPassword || !v.newPassword || !v.confirmPassword} className={`${abtn.primary} ${abtn.md}`}>
          {pending ? "Changing…" : "Change password"}
        </button>
        <span className="text-xs text-muted">You will stay signed in here; other devices are signed out.</span>
      </div>
    </form>
  );
}
