import { route } from "preact-router";
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  Server,
  Settings,
  UserRound,
} from "lucide-preact";
import { LINKS } from "@/lib/constants.ts";
import type { DashboardNavId } from "@/lib/pageMeta.ts";

export type { DashboardNavId };

type NavItem = {
  id: DashboardNavId;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const BASE_NAV: NavItem[] = [
  {
    id: "dashboard",
    href: LINKS.home,
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "services",
    href: LINKS.services,
    label: "Services",
    icon: Server,
  },
  {
    id: "incidents",
    href: LINKS.incidents,
    label: "Incidents",
    icon: Activity,
  },
];

const AUTH_NAV: NavItem[] = [
  {
    id: "admin",
    href: LINKS.admin,
    label: "Admin",
    icon: Settings,
  },
  {
    id: "audits",
    href: LINKS.audits,
    label: "Audits",
    icon: ClipboardList,
  },
  {
    id: "account",
    href: LINKS.account,
    label: "Account",
    icon: UserRound,
  },
];

interface DashboardNavProps {
  active: DashboardNavId;
  authName: string | null;
  variant: "side" | "mobile";
}

function navClass(active: boolean): string {
  return active
    ? "flex items-center gap-2.5 rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
    : "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";
}

function mobileClass(active: boolean): string {
  return `flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-medium ${
    active
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-zinc-500 dark:text-zinc-400"
  }`;
}

/** Client-side nav via preact-router (no full page reload). */
function onNavClick(event: MouseEvent, href: string) {
  if (event.defaultPrevented) return;
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (globalThis.location.pathname === href) return;
  route(href);
}

export default function DashboardNav({
  active,
  authName,
  variant,
}: DashboardNavProps) {
  const items = authName ? [...BASE_NAV, ...AUTH_NAV] : BASE_NAV;

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <a
            key={item.id}
            href={item.href}
            class={variant === "mobile"
              ? mobileClass(isActive)
              : navClass(isActive)}
            aria-current={isActive ? "page" : undefined}
            onClick={(event) =>
              onNavClick(event as unknown as MouseEvent, item.href)}
          >
            <Icon size={variant === "mobile" ? 18 : 16} />
            {item.label}
          </a>
        );
      })}
    </>
  );
}
