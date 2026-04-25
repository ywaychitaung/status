import {
  formatDashboardDatetime,
  getDashboardTimezoneConfig,
} from "@/lib/datetimeFormat.ts";
import { getSnapshot } from "@/lib/kv.ts";
import { Globe, ShieldCheck, ShieldX } from "lucide-preact";
import { define } from "../utils.ts";
import DashboardClient from "../islands/DashboardClient.tsx";
import ThemeToggle from "../islands/ThemeToggle.tsx";

export default define.page(async function Home() {
  const snapshot = await getSnapshot();
  const timezone = getDashboardTimezoneConfig();
  const timestamp = formatDashboardDatetime(new Date().toISOString());
  const totalWebsites = snapshot.statuses.length;
  const upWebsites = snapshot.statuses.filter((status) => status.up).length;
  const downWebsites = totalWebsites - upWebsites;
  return (
    <div
      id="dashboard-root"
      class="relative min-h-screen bg-slate-50 px-4 pb-10 pt-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      data-timezone-id={timezone.id}
    >
      <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_90%_10%,rgba(59,130,246,0.12),transparent_35%)] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_90%_10%,rgba(59,130,246,0.16),transparent_35%)]" />
      <header class="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/85 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/75">
        <div class="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4">
          <h1 class="text-base font-semibold tracking-tight sm:text-lg">
            Uptime Monitor
          </h1>
          <ThemeToggle />
        </div>
      </header>
      <main class="mx-auto w-full max-w-4xl space-y-8 rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_20px_60px_-35px_rgba(2,6,23,0.45)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/65 sm:p-8">
        <section class="space-y-3">
          <h1 class="text-3xl font-bold tracking-tight">
            System Status
          </h1>
          <p class="text-slate-600 dark:text-slate-300">
            Status for personal websites, checked every minute with Deno Cron +
            KV.
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Timezone: {timezone.name}, ({timezone.utcLabel})
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Timestamp: <span id="current-timestamp">{timestamp}</span>
          </p>
        </section>

        <section class="grid gap-3 sm:grid-cols-3">
          <article class="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
            <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Globe size={16} />
              <p class="text-xs uppercase tracking-wide">Total Websites</p>
            </div>
            <p id="dashboard-stat-total" class="mt-2 text-2xl font-semibold">
              {totalWebsites}
            </p>
          </article>
          <article class="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/35">
            <div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={16} />
              <p class="text-xs uppercase tracking-wide">Up</p>
            </div>
            <p
              id="dashboard-stat-up"
              class="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300"
            >
              {upWebsites}
            </p>
          </article>
          <article class="rounded-2xl border border-red-200/80 bg-red-50/80 p-4 shadow-sm dark:border-red-900/70 dark:bg-red-950/35">
            <div class="flex items-center gap-2 text-red-700 dark:text-red-300">
              <ShieldX size={16} />
              <p class="text-xs uppercase tracking-wide">Down</p>
            </div>
            <p
              id="dashboard-stat-down"
              class="mt-2 text-2xl font-semibold text-red-700 dark:text-red-300"
            >
              {downWebsites}
            </p>
          </article>
        </section>

        <section class="space-y-3">
          {snapshot.statuses.map((status) => (
            <article
              id={`monitor-${status.id}`}
              key={status.id}
              class={`rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                status.up
                  ? "border-emerald-300/80 bg-linear-to-br from-emerald-50 to-white dark:border-emerald-800/80 dark:from-emerald-950/40 dark:to-slate-900/70"
                  : "border-red-300/80 bg-linear-to-br from-red-50 to-white dark:border-red-800/80 dark:from-red-950/40 dark:to-slate-900/70"
              }`}
            >
              <div class="flex items-center justify-between gap-4">
                <div>
                  <h2 class="text-lg font-semibold">{status.name}</h2>
                  <a
                    class="text-sm text-slate-600 underline underline-offset-4 dark:text-slate-300"
                    href={status.url}
                  >
                    {status.url}
                  </a>
                </div>
                <span
                  class={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${
                    status.up
                      ? "border-emerald-500/30 bg-emerald-600 text-white"
                      : "border-red-500/30 bg-red-600 text-white"
                  }`}
                  data-role="badge"
                >
                  {status.up ? "UP" : "DOWN"}
                </span>
              </div>
              <div class="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  Status code:{" "}
                  <span data-role="status-code">
                    {status.statusCode ?? "N/A"}
                  </span>
                </p>
                <p>
                  Response time:{" "}
                  <span data-role="response-time">
                    {status.responseTimeMs !== null
                      ? `${status.responseTimeMs} ms`
                      : "N/A"}
                  </span>
                </p>
                <p>
                  Last checked:{" "}
                  <span data-role="checked-at">
                    {formatDashboardDatetime(status.checkedAt)}
                  </span>
                </p>
              </div>
              <p data-role="error" class="mt-3 text-red-700 dark:text-red-300">
                {status.error ?? ""}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer class="mx-auto mt-6 flex w-full max-w-4xl items-center justify-between rounded-2xl border border-slate-200/80 bg-white/70 px-5 py-4 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-400">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Press{" "}
          <kbd class="rounded border border-slate-300 px-1.5 py-0.5 dark:border-slate-600">
            d
          </kbd>{" "}
          to toggle dark theme
        </p>
        <p>
          Made with 💚 by{" "}
          <a
            href="https://ywaychitaung.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="text-slate-600 dark:text-slate-300 hover:text-green-500"
          >
            Yway Chit Aung
          </a>
        </p>
      </footer>

      <DashboardClient timezoneId={timezone.id} />
    </div>
  );
});
