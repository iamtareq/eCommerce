"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { abtn, ainput, alabel, Badge, Card, EmptyState, Notice } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { Toggle } from "../settings/Toggle";
import { createAdminUser, updateAdminUser } from "./actions";
import { PASSWORD_HINT, PasswordField } from "./PasswordField";

type Role = "OWNER" | "STAFF";

export interface UserRow {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  /** Pre-formatted (Dhaka time) on the server. */
  lastLogin: string | null;
  created: string;
}

type Flash = { tone: "success" | "error"; text: string } | null;

const ROLE_HELP: Record<Role, string> = {
  OWNER: "Full access: products, prices, delivery, settings and users.",
  STAFF: "Can view and manage orders only.",
};

function RoleSelect({ id, value, onChange, disabled }: { id: string; value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className={alabel}>
        Role
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Role)} className={ainput}>
        <option value="STAFF">Staff</option>
        <option value="OWNER">Owner</option>
      </select>
      <p className="mt-1 text-xs text-muted">{ROLE_HELP[value]}</p>
    </div>
  );
}

function CreateUserForm({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAdminUser({ username, displayName, role, password });
      if (!res.ok) setError(res.error);
      else onDone(res.message ?? "User created");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-username" className={alabel}>
            Username *
          </label>
          <input
            id="new-username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
            maxLength={40}
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. rahim"
            className={`${ainput} font-mono`}
          />
          <p className="mt-1 text-xs text-muted">3–40 characters: a–z, 0–9, dot, dash or underscore. Used to sign in; cannot be changed later.</p>
        </div>
        <div>
          <label htmlFor="new-display-name" className={alabel}>
            Display name *
          </label>
          <input
            id="new-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            required
            placeholder="e.g. Rahim Uddin"
            className={ainput}
          />
          <p className="mt-1 text-xs text-muted">Shown in the admin panel and in order history.</p>
        </div>
        <RoleSelect id="new-role" value={role} onChange={setRole} />
        <PasswordField
          id="new-password"
          label="Password *"
          value={password}
          onChange={setPassword}
          required
          allowGenerate
          help={`${PASSWORD_HINT} Share it privately; they can change it under My account.`}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={`${abtn.primary} ${abtn.md}`}>
          {pending ? "Creating…" : "Create user"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={`${abtn.secondary} ${abtn.md}`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditUserForm({
  user,
  isSelf,
  isLastActiveOwner,
  onDone,
  onCancel,
}: {
  user: UserRow;
  isSelf: boolean;
  isLastActiveOwner: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<Role>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = isSelf || isLastActiveOwner;
  const prefix = `user-${user.id}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const warnings: string[] = [];
    if (user.isActive && !isActive) warnings.push(`Deactivate “${user.username}”? They will be signed out right away and can no longer sign in.`);
    else if (newPassword) warnings.push(`Reset the password for “${user.username}”? They will be signed out on every device.`);
    if (user.role === "OWNER" && role === "STAFF") warnings.push("They will lose access to products, delivery, settings and users.");
    if (warnings.length && !window.confirm(warnings.join("\n\n"))) return;

    startTransition(async () => {
      const res = await updateAdminUser({ id: user.id, displayName, role, isActive, newPassword });
      if (!res.ok) setError(res.error);
      else onDone(res.message ?? "Saved");
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4 rounded-lg border border-line bg-paper/70 p-3 sm:p-4">
      {error && <Notice tone="error">{error}</Notice>}
      {isSelf && <Notice tone="info">This is your own account. You cannot change your own role or deactivate yourself.</Notice>}
      {!isSelf && isLastActiveOwner && (
        <Notice tone="info">This is the only active owner, so the role and active status cannot be changed. Make someone else an owner first.</Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-name`} className={alabel}>
            Display name *
          </label>
          <input
            id={`${prefix}-name`}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            required
            className={ainput}
          />
        </div>
        <RoleSelect id={`${prefix}-role`} value={role} onChange={setRole} disabled={locked} />
        <div className="sm:col-span-2">
          <Toggle
            id={`${prefix}-active`}
            checked={isActive}
            onChange={setIsActive}
            disabled={locked}
            label={isActive ? "Active — can sign in" : "Inactive — cannot sign in"}
            description="Deactivating signs the user out immediately. Their name stays on past orders."
          />
        </div>
        <div className="sm:col-span-2">
          {isSelf ? (
            <p className="text-sm text-muted">
              To change your own password, use{" "}
              <Link href="/admin/account" className="font-semibold text-pine-700 underline">
                My account
              </Link>
              .
            </p>
          ) : (
            <div className="max-w-md">
              <PasswordField
                id={`${prefix}-password`}
                label="Reset password (optional)"
                value={newPassword}
                onChange={setNewPassword}
                allowGenerate
                placeholder="Leave empty to keep the current password"
                help={`${PASSWORD_HINT} Resetting signs the user out everywhere.`}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={`${abtn.primary} ${abtn.md}`}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={`${abtn.secondary} ${abtn.md}`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const GRID = "sm:grid sm:grid-cols-[minmax(0,1.6fr)_88px_92px_minmax(0,1.2fr)_84px] sm:items-center sm:gap-3";

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const activeOwners = users.filter((u) => u.role === "OWNER" && u.isActive).length;

  function done(text: string) {
    setCreating(false);
    setEditingId(null);
    setFlash({ tone: "success", text });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Notice tone="info">
        <strong>Owner</strong> — {ROLE_HELP.OWNER} <strong>Staff</strong> — {ROLE_HELP.STAFF}
      </Notice>
      {flash && <Notice tone={flash.tone}>{flash.text}</Notice>}

      {creating && (
        <Card title="Add user">
          <CreateUserForm onDone={done} onCancel={() => setCreating(false)} />
        </Card>
      )}

      <Card
        title={`Admin users (${users.length})`}
        padded={false}
        actions={
          !creating && (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setFlash(null);
              }}
              className={`${abtn.primary} ${abtn.sm}`}
            >
              <Icon name="plus" className="size-4" /> Add user
            </button>
          )
        }
      >
        {users.length === 0 ? (
          <EmptyState icon="users" title="No users" />
        ) : (
          <>
            <div className={cn("hidden border-b border-line bg-paper px-5 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase", GRID)}>
              <span>User</span>
              <span>Role</span>
              <span>Status</span>
              <span>Last login</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y divide-line">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const editing = editingId === u.id;
                return (
                  <li key={u.id} className={cn("px-4 py-3 sm:px-5", !u.isActive && "bg-stone-50")}>
                    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", GRID)}>
                      <div className="min-w-0 basis-full sm:basis-auto">
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                          <span className="truncate">{u.displayName}</span>
                          {isSelf && <Badge tone="blue">You</Badge>}
                        </p>
                        <p className="truncate font-mono text-xs text-muted">
                          @{u.username} · since {u.created}
                        </p>
                      </div>
                      <div>
                        <Badge tone={u.role === "OWNER" ? "violet" : "gray"}>{u.role === "OWNER" ? "Owner" : "Staff"}</Badge>
                      </div>
                      <div>
                        <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                      </div>
                      <div className="text-xs text-muted sm:text-sm sm:text-ink-soft">
                        <span className="sm:hidden">Last login: </span>
                        {u.lastLogin ?? "Never"}
                      </div>
                      <div className="ml-auto sm:ml-0 sm:text-right">
                        {!editing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(u.id);
                              setFlash(null);
                            }}
                            className={`${abtn.secondary} ${abtn.sm}`}
                            aria-label={`Edit ${u.username}`}
                          >
                            <Icon name="edit" className="size-4" /> Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {editing && (
                      <EditUserForm
                        user={u}
                        isSelf={isSelf}
                        isLastActiveOwner={u.role === "OWNER" && u.isActive && activeOwners <= 1}
                        onDone={done}
                        onCancel={() => setEditingId(null)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
