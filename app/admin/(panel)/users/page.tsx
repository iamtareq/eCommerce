import { PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth/guard";
import { formatDateEn } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { UsersManager, type UserRow } from "./UsersManager";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireOwner();
  const users = await prisma.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "asc" }],
    select: { id: true, username: true, displayName: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    lastLogin: u.lastLoginAt ? formatDateEn(u.lastLoginAt) : null,
    created: formatDateEn(u.createdAt),
  }));

  return (
    <>
      <PageHeader title="Users" description="People who can sign in to this admin panel. Accounts are never deleted, because order history refers to them." />
      <UsersManager users={rows} currentUserId={me.id} />
    </>
  );
}
