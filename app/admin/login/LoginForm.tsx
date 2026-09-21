"use client";

import { useActionState } from "react";
import { abtn, ainput, alabel, Notice } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <div>
        <label htmlFor="username" className={alabel}>
          Username
        </label>
        {/* React resets the form after every action; the default value keeps the username after a failed sign-in. */}
        <input
          id="username"
          name="username"
          defaultValue={state?.username ?? ""}
          className={ainput}
          autoComplete="username"
          required
          autoFocus
          maxLength={60}
        />
      </div>
      <div>
        <label htmlFor="password" className={alabel}>
          Password
        </label>
        <input id="password" name="password" type="password" className={ainput} autoComplete="current-password" required maxLength={200} />
      </div>
      <button type="submit" disabled={pending} className={cn(abtn.primary, "h-11 w-full text-base")}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
