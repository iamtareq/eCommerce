"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/admin/login/actions";
import { LogoMark } from "@/components/store/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  owner?: boolean;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: "list" },
  { href: "/admin/reports", label: "Sales report", icon: "sparkles", owner: true },
  { href: "/admin/products", label: "Products", icon: "package", owner: true },
  { href: "/admin/categories", label: "Categories", icon: "layers", owner: true },
  { href: "/admin/coupons", label: "Coupons", icon: "tag", owner: true },
  { href: "/admin/reviews", label: "Reviews", icon: "star", owner: true },
  { href: "/admin/delivery", label: "Delivery", icon: "truck", owner: true },
  { href: "/admin/settings", label: "Site settings", icon: "settings", owner: true },
  { href: "/admin/users", label: "Users", icon: "users", owner: true },
  { href: "/admin/account", label: "My account", icon: "lock" },
];

function NavLinks({ isOwner, onNavigate }: { isOwner: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {NAV.filter((n) => !n.owner || isOwner).map((n) => {
        const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[0.93rem] font-medium transition-colors",
                active ? "bg-white/12 text-white" : "text-pine-100/80 hover:bg-white/6 hover:text-white",
              )}
            >
              <Icon name={n.icon} className="size-[1.1rem]" />
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Footer({ name, role }: { name: string; role: string }) {
  return (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate px-3 text-sm font-semibold text-white">{name}</p>
      <p className="px-3 text-xs text-pine-100/60">{role === "OWNER" ? "Owner" : "Staff"}</p>
      <div className="mt-3 space-y-0.5">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[0.93rem] text-pine-100/80 hover:bg-white/6 hover:text-white">
          <Icon name="external" className="size-[1.1rem]" /> View store
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[0.93rem] text-pine-100/80 hover:bg-white/6 hover:text-white">
            <Icon name="logout" className="size-[1.1rem]" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminNav({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isOwner = role === "OWNER";
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close the mobile drawer after navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // The open drawer is a modal dialog: move focus into it, keep Tab inside it, close on Escape,
  // and hand focus back to the menu button when it closes.
  useEffect(() => {
    if (!open) return;
    const opener = menuButton.current;
    closeButton.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const box = panel.current;
      // No trap while the drawer isn't rendered (window widened to the desktop layout while it was open).
      if (e.key !== "Tab" || !box || box.getClientRects().length === 0) return;
      const items = box.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const outside = !box.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="bg-girih-light fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-pine-950 px-3 py-5 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
          <LogoMark className="size-8" />
          <span className="font-sans text-lg font-bold text-white">Deenbox</span>
        </Link>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto">
          <NavLinks isOwner={isOwner} />
        </nav>
        <Footer name={name} role={role} />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <LogoMark className="size-7" />
          <span className="font-sans font-bold text-ink">Deenbox Admin</span>
        </Link>
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-lg text-ink hover:bg-sand"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Icon name="menu" className="size-6" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          {/* Tap-outside target only; keyboard users have the X button and Escape. */}
          <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div ref={panel} className="bg-girih-light absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-pine-950 px-3 py-4">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="flex items-center gap-2">
                <LogoMark className="size-8" />
                <span className="font-sans text-lg font-bold text-white">Deenbox</span>
              </span>
              <button
                ref={closeButton}
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-lg text-white hover:bg-white/10"
                aria-label="Close menu"
              >
                <Icon name="x" className="size-5" />
              </button>
            </div>
            <nav aria-label="Admin" className="flex-1 overflow-y-auto">
              <NavLinks isOwner={isOwner} onNavigate={() => setOpen(false)} />
            </nav>
            <Footer name={name} role={role} />
          </div>
        </div>
      )}
    </>
  );
}
