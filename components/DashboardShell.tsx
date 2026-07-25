import type { ComponentChildren } from "preact";
import { Activity, LayoutDashboard, Server } from "lucide-preact";
import {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  AUTHOR,
  LINKS,
  THEME,
} from "@/lib/constants.ts";

export type DashboardNavId = "dashboard" | "services" | "incidents";

interface DashboardShellProps {
  active: DashboardNavId;
  title: string;
  subtitle: string;
  timezoneName: string;
  timezoneUtcLabel: string;
  timezoneId: string;
  timestamp: string;
  healthLabel: string;
  allUp: boolean;
  themeToggle: ComponentChildren;
  liveClock: ComponentChildren;
  children: ComponentChildren;
}

const NAV = [
  {
    id: "dashboard" as const,
    href: LINKS.home,
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "services" as const,
    href: LINKS.services,
    label: "Services",
    icon: Server,
  },
  {
    id: "incidents" as const,
    href: LINKS.incidents,
    label: "Incidents",
    icon: Activity,
  },
];

function navClass(active: boolean): string {
  return active
    ? "flex items-center gap-2.5 rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
    : "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";
}

function BrandMark({ sizeClass }: { sizeClass: string }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      width={36}
      height={36}
      class={`${sizeClass} shadow-sm shadow-emerald-500/30`}
      aria-hidden="true"
    />
  );
}

export default function DashboardShell({
  active,
  title,
  subtitle,
  timezoneName,
  timezoneUtcLabel,
  timezoneId,
  timestamp,
  healthLabel,
  allUp,
  themeToggle,
  liveClock,
  children,
}: DashboardShellProps) {
  return (
    <div
      id="dashboard-root"
      class="relative min-h-screen bg-dashboard text-zinc-900 dark:text-zinc-50"
      data-timezone-id={timezoneId}
    >
      <div class="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside class="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-zinc-200/80 bg-white/70 px-4 py-6 backdrop-blur-md lg:flex dark:border-zinc-800/80 dark:bg-zinc-950/60">
          <a href={LINKS.home} class="flex items-center gap-2.5 px-2">
            <BrandMark sizeClass="h-9 w-9" />
            <div>
              <p class="text-sm font-semibold tracking-tight">{APP_NAME}</p>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
                {APP_TAGLINE}
              </p>
            </div>
          </a>

          <nav class="mt-8 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  class={navClass(active === item.id)}
                  aria-current={active === item.id ? "page" : undefined}
                >
                  <Icon size={16} />
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div class="mt-auto space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Live clock
            </p>
            <p
              id="current-timestamp"
              class="text-xs leading-relaxed tabular-nums text-zinc-700 dark:text-zinc-200"
            >
              {timestamp}
            </p>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
              {timezoneName} ({timezoneUtcLabel})
            </p>
          </div>
        </aside>

        <div class="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
          <header class="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/75 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/70">
            <div class="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div class="min-w-0">
                <div class="flex items-center gap-2 lg:hidden">
                  <BrandMark sizeClass="h-8 w-8" />
                  <h1 class="text-base font-semibold tracking-tight">
                    {APP_NAME}
                  </h1>
                </div>
                <div class="hidden lg:block">
                  <h1 class="text-lg font-semibold tracking-tight">{title}</h1>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    {subtitle}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div
                  id="dashboard-health-chip"
                  class={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex ${
                    allUp
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                  }`}
                >
                  <span
                    id="dashboard-health-dot"
                    class={`h-2 w-2 rounded-full animate-pulse-dot ${
                      allUp ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  <span id="dashboard-health-label">{healthLabel}</span>
                </div>
                {themeToggle}
              </div>
            </div>
          </header>

          <main class="flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div class="lg:hidden">
              <h1 class="text-xl font-semibold tracking-tight">{title}</h1>
              <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {subtitle}
              </p>
            </div>
            {children}
          </main>

          <footer class="mt-auto flex flex-col gap-2 border-t border-zinc-200/80 px-4 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 dark:border-zinc-800/80 dark:text-zinc-400">
            <p>
              Press{" "}
              <kbd class="rounded border border-zinc-300 px-1.5 py-0.5 font-sans text-[10px] dark:border-zinc-700">
                {THEME.shortcutKey}
              </kbd>{" "}
              to toggle theme
            </p>
            <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="tabular-nums text-zinc-400 dark:text-zinc-500">
                v{APP_VERSION}
              </span>
              <span class="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                ·
              </span>
              <span>
                Built by{" "}
                <a
                  href={AUTHOR.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-zinc-700 transition-colors hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400"
                >
                  {AUTHOR.name}
                </a>
              </span>
            </p>
          </footer>
        </div>
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/90 bg-white/90 backdrop-blur-md lg:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
        <div class="mx-auto grid max-w-7xl grid-cols-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                class={`flex flex-col items-center gap-1 px-2 py-3 text-[11px] font-medium ${
                  isActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>

      {liveClock}
    </div>
  );
}
