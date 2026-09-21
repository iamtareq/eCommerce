import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/guard";
import { formatDateEn } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { ChangePasswordForm, DisplayNameForm } from "./AccountForms";

export const metadata = { title: "My account" };

async function loadAccount(userId: string, sessionId: string) {
  const [user, otherSessions] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: userId }, select: { lastLoginAt: true, createdAt: true } }),
    prisma.adminSession.count({ where: { userId, id: { not: sessionId }, expiresAt: { gt: new Date() } } }),
  ]);
  return { user, otherSessions };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-[0.95rem] text-ink">{children}</dd>
    </div>
  );
}

export default async function AccountPage() {
  const admin = await requireAdmin();
  const { user, otherSessions } = await loadAccount(admin.id, admin.sessionId);

  return (
    <>
      <PageHeader title="My account" description="Your name and password for this admin panel." />
      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="mb-5 grid grid-cols-2 gap-4">
            <Field label="Username">
              <span className="font-mono">{admin.username}</span>
            </Field>
            <Field label="Role">
              <Badge tone={admin.role === "OWNER" ? "violet" : "gray"}>{admin.role === "OWNER" ? "Owner" : "Staff"}</Badge>
            </Field>
            <Field label="Last sign-in">{user?.lastLoginAt ? formatDateEn(user.lastLoginAt) : "—"}</Field>
            <Field label="Other signed-in devices">{otherSessions}</Field>
          </dl>
          <DisplayNameForm initial={admin.displayName} />
          <p className="mt-4 text-xs text-muted">
            {admin.role === "OWNER"
              ? "Usernames and roles are managed on the Users page."
              : "To change your username or role, ask the store owner."}
          </p>
        </Card>

        <Card title="Change password">
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
