import {
  formatDashboardDatetime,
  getDashboardTimezoneConfig,
} from "@/lib/datetimeFormat.ts";
import { getSnapshot } from "@/lib/kv.ts";
import { AlertTriangle, CheckCircle2, Timer } from "lucide-preact";
import { define } from "../utils.ts";
import DashboardShell from "../components/DashboardShell.tsx";
import ThemeToggle from "../components/ThemeToggle.tsx";
import LiveClock from "../islands/LiveClock.tsx";
import OutageTimer from "../islands/OutageTimer.tsx";
import { AUTHOR, SUPPORT } from "@/lib/constants.ts";

export default define.page(async function IncidentsPage() {
  const snapshot = await getSnapshot();
  const timezone = getDashboardTimezoneConfig();
  const timestamp = formatDashboardDatetime(new Date().toISOString());
  const downServices = snapshot.statuses.filter((s) => !s.up);
  const total = snapshot.statuses.length;
  const upCount = total - downServices.length;
  const allUp = downServices.length === 0 && total > 0;
  const healthLabel = allUp
    ? "All systems operational"
    : downServices.length === 1
    ? "1 service is down"
    : `${downServices.length} services are down`;

  return (
    <DashboardShell
      active="incidents"
      title="Incidents"
      subtitle="Active outages and recovery timeline"
      timezoneName={timezone.name}
      timezoneUtcLabel={timezone.utcLabel}
      timezoneId={timezone.id}
      timestamp={timestamp}
      healthLabel={healthLabel}
      allUp={allUp}
      themeToggle={<ThemeToggle />}
      liveClock={<LiveClock timezoneId={timezone.id} />}
    >
      <section class="animate-rise grid gap-4 lg:grid-cols-3">
        <article class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold tracking-tight">
                Active incidents
              </p>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Services currently failing health checks
              </p>
            </div>
            <span
              class={`rounded-lg p-2 ${
                allUp
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "bg-red-500/10 text-red-600 dark:text-red-300"
              }`}
            >
              {allUp ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            </span>
          </div>

          {allUp
            ? (
              <div class="mt-8 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-5 py-10 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <CheckCircle2
                  size={28}
                  class="mx-auto text-emerald-600 dark:text-emerald-400"
                />
                <p class="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  No active incidents
                </p>
                <p class="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/60">
                  All {upCount} monitored services are responding normally.
                </p>
              </div>
            )
            : (
              <ul class="mt-6 space-y-3">
                {downServices.map((status) => (
                  <li
                    key={status.id}
                    class="rounded-2xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/50 dark:bg-red-950/30"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="h-2 w-2 rounded-full bg-red-500" />
                          <p class="font-semibold tracking-tight">
                            {status.name}
                          </p>
                        </div>
                        <a
                          href={status.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="mt-1 block truncate text-xs text-red-700/70 hover:underline dark:text-red-300/70"
                        >
                          {status.url.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                      <span class="rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                        Down
                      </span>
                    </div>
                    <dl class="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <dt class="text-red-700/60 dark:text-red-300/50">
                          Status code
                        </dt>
                        <dd class="mt-1 font-semibold tabular-nums">
                          {status.statusCode ?? "N/A"}
                        </dd>
                      </div>
                      <div>
                        <dt class="text-red-700/60 dark:text-red-300/50">
                          Detected
                        </dt>
                        <dd class="mt-1 font-semibold">
                          {formatDashboardDatetime(status.checkedAt)}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-red-700/60 dark:text-red-300/50">
                          Error
                        </dt>
                        <dd class="mt-1 font-medium">
                          {status.error || "Non-success response"}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
        </article>

        <article class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold tracking-tight">
                Since last outage
              </p>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Time since the most recent failure
              </p>
            </div>
            <span class="rounded-lg bg-zinc-100 p-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Timer size={16} />
            </span>
          </div>
          <div
            id="outage-timer"
            class="mt-6"
            data-last-outage-at={snapshot.summary.lastOutageAt ?? ""}
          >
            <OutageTimer lastOutageAt={snapshot.summary.lastOutageAt} />
          </div>
          <p class="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            {snapshot.summary.lastOutageAt
              ? `Last recorded at ${
                formatDashboardDatetime(snapshot.summary.lastOutageAt)
              }`
              : "No outages have been recorded yet."}
          </p>
        </article>
      </section>

      <section class="animate-rise-1 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <p class="text-sm font-semibold tracking-tight">Incident notes</p>
        <ul class="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <li class="flex gap-2">
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
            Checks run every minute. A non-200 response opens an active incident
            here.
          </li>
          <li class="flex gap-2">
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
            Discord and Telegram alerts fire to {AUTHOR.name}{" "}
            on down/recovery when configured.
          </li>
          <li class="flex gap-2">
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
            If an issue still hasn&apos;t been fixed, please report it to{" "}
            <a
              href={SUPPORT.reportMailto}
              class="font-medium text-zinc-800 underline underline-offset-2 transition-colors hover:text-emerald-600 dark:text-zinc-200 dark:hover:text-emerald-400"
            >
              {SUPPORT.reportEmail}
            </a>
            .
          </li>
          <li class="flex gap-2">
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
            This page refreshes live when monitor state changes.
          </li>
        </ul>
      </section>
    </DashboardShell>
  );
});
