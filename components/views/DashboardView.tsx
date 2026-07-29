import { route } from "preact-router";
import { formatDashboardDatetime } from "@/lib/datetimeFormat.ts";
import type { Snapshot } from "@/lib/pageTypes.ts";
import {
  Activity,
  Clock3,
  Gauge,
  Globe,
  ShieldCheck,
  ShieldX,
  Timer,
  Zap,
} from "lucide-preact";
import OutageTimer from "../../islands/OutageTimer.tsx";
import { LINKS, MONITOR } from "@/lib/constants.ts";

const MONITOR_UP =
  "group rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700";
const MONITOR_DOWN =
  "group rounded-2xl border border-red-200 bg-red-50/70 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-red-900/50 dark:bg-red-950/35 dark:hover:border-red-800";

const BADGE_UP =
  "inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300";
const BADGE_DOWN =
  "inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:bg-red-400/10 dark:text-red-300";

function navigate(event: MouseEvent, href: string) {
  if (event.defaultPrevented) return;
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  route(href);
}

export interface DashboardViewProps {
  snapshot: Snapshot;
}

export default function DashboardView({ snapshot }: DashboardViewProps) {
  const totalWebsites = snapshot.statuses.length;
  const upWebsites = snapshot.statuses.filter((status) => status.up).length;
  const downWebsites = totalWebsites - upWebsites;
  const allUp = downWebsites === 0 && totalWebsites > 0;
  const healthLabel = allUp
    ? "All systems operational"
    : downWebsites === 1
    ? "1 service is down"
    : `${downWebsites} services are down`;

  const latencySamples = snapshot.statuses
    .map((status) => status.responseTimeMs)
    .filter((ms): ms is number => ms !== null);
  const avgLatency = latencySamples.length > 0
    ? Math.round(
      latencySamples.reduce((sum, ms) => sum + ms, 0) / latencySamples.length,
    )
    : null;
  const maxLatency = latencySamples.length > 0
    ? Math.max(...latencySamples)
    : 1;
  const availability = totalWebsites > 0
    ? Math.round((upWebsites / totalWebsites) * 1000) / 10
    : 0;

  return (
    <>
      <section class="animate-rise grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Monitored
            </p>
            <span class="rounded-lg bg-zinc-100 p-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Globe size={16} />
            </span>
          </div>
          <p class="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
            {totalWebsites}
          </p>
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Active endpoints
          </p>
        </article>

        <article class="rounded-2xl border border-emerald-200/80 bg-linear-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-zinc-900/80">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80">
              Online
            </p>
            <span class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              <ShieldCheck size={16} />
            </span>
          </div>
          <p class="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-300">
            {upWebsites}
          </p>
          <p class="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/60">
            Responding with 200
          </p>
        </article>

        <article class="rounded-2xl border border-red-200/80 bg-linear-to-br from-red-50 to-white p-5 shadow-sm dark:border-red-900/40 dark:from-red-950/40 dark:to-zinc-900/80">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium uppercase tracking-wider text-red-700/80 dark:text-red-300/80">
              Offline
            </p>
            <span class="rounded-lg bg-red-500/10 p-2 text-red-600 dark:text-red-300">
              <ShieldX size={16} />
            </span>
          </div>
          <p class="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-red-700 dark:text-red-300">
            {downWebsites}
          </p>
          <p class="mt-1 text-xs text-red-700/70 dark:text-red-300/60">
            Needs attention
          </p>
        </article>

        <article class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Avg latency
            </p>
            <span class="rounded-lg bg-sky-500/10 p-2 text-sky-600 dark:text-sky-300">
              <Zap size={16} />
            </span>
          </div>
          <p class="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
            {avgLatency !== null ? avgLatency : "—"}
            {avgLatency !== null && (
              <span class="ml-1 text-base font-medium text-zinc-400">ms</span>
            )}
          </p>
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Across reachable hosts
          </p>
        </article>
      </section>

      <section class="animate-rise-1 grid gap-4 lg:grid-cols-3">
        <article class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold tracking-tight">Availability</p>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Current snapshot health ratio
              </p>
            </div>
            <span class="rounded-lg bg-zinc-100 p-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Gauge size={16} />
            </span>
          </div>
          <div class="mt-6 flex items-end gap-3">
            <p class="text-4xl font-semibold tracking-tight tabular-nums">
              {availability}
              <span class="text-xl text-zinc-400">%</span>
            </p>
            <p class="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
              {upWebsites}/{totalWebsites} services up
            </p>
          </div>
          <div class="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              class={`h-full rounded-full transition-all duration-500 ${
                allUp ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(availability, 100)}%` }}
            />
          </div>
        </article>

        <article class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold tracking-tight">
                Since last outage
              </p>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Continuous uptime clock
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
        </article>
      </section>

      <section class="animate-rise-2 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <div class="space-y-4">
          <div class="flex items-end justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold tracking-tight">
                Service monitors
              </h2>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Live checks every minute via Deno Cron + Postgres
              </p>
            </div>
            <a
              href={LINKS.services}
              class="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              onClick={(event) =>
                navigate(event as unknown as MouseEvent, LINKS.services)}
            >
              View all
            </a>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            {snapshot.statuses.map((status) => {
              const latencyPct = status.responseTimeMs != null && maxLatency > 0
                ? Math.max(
                  8,
                  Math.round((status.responseTimeMs / maxLatency) * 100),
                )
                : 0;

              return (
                <article
                  key={status.id}
                  class={status.up ? MONITOR_UP : MONITOR_DOWN}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class={`h-2 w-2 shrink-0 rounded-full ${
                            status.up ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        <h3 class="truncate text-[15px] font-semibold tracking-tight">
                          {status.name}
                        </h3>
                      </div>
                      <a
                        class="mt-1.5 block truncate text-xs text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                        href={status.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {status.url.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                    <span class={status.up ? BADGE_UP : BADGE_DOWN}>
                      <span
                        class={`h-1.5 w-1.5 rounded-full ${
                          status.up ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      {status.up ? "Up" : "Down"}
                    </span>
                  </div>

                  <div class="mt-5 grid grid-cols-2 gap-3 text-xs">
                    <div class="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/50">
                      <p class="text-zinc-400 dark:text-zinc-500">
                        Status code
                      </p>
                      <p class="mt-1 text-sm font-semibold tabular-nums">
                        {status.statusCode ?? "N/A"}
                      </p>
                    </div>
                    <div class="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/50">
                      <p class="text-zinc-400 dark:text-zinc-500">Response</p>
                      <p class="mt-1 text-sm font-semibold tabular-nums">
                        {status.responseTimeMs !== null
                          ? `${status.responseTimeMs} ms`
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div class="mt-4">
                    <div class="mb-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Latency load</span>
                      <span>{formatDashboardDatetime(status.checkedAt)}</span>
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        class={`h-full rounded-full transition-all ${
                          status.up ? "bg-sky-500" : "bg-red-400"
                        }`}
                        style={{ width: `${latencyPct}%` }}
                      />
                    </div>
                  </div>

                  {status.error && (
                    <p class="mt-3 text-xs text-red-600 dark:text-red-300">
                      {status.error}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <aside class="animate-rise-3 space-y-4">
          <article class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <div class="flex items-center gap-2">
              <Clock3 size={16} class="text-zinc-500" />
              <p class="text-sm font-semibold tracking-tight">Check schedule</p>
            </div>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-zinc-500 dark:text-zinc-400">Interval</dt>
                <dd class="font-medium">{MONITOR.intervalLabel}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-zinc-500 dark:text-zinc-400">Engine</dt>
                <dd class="font-medium">{MONITOR.engine}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-zinc-500 dark:text-zinc-400">Storage</dt>
                <dd class="font-medium">{MONITOR.storage}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-zinc-500 dark:text-zinc-400">Stream</dt>
                <dd class="font-medium">{MONITOR.stream}</dd>
              </div>
            </dl>
          </article>

          <article class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <div class="flex items-center gap-2">
              <Activity size={16} class="text-zinc-500" />
              <p class="text-sm font-semibold tracking-tight">
                Latency ranking
              </p>
            </div>
            <ul class="mt-4 space-y-3">
              {[...snapshot.statuses]
                .sort((a, b) =>
                  (a.responseTimeMs ?? 999999) - (b.responseTimeMs ?? 999999)
                )
                .map((status) => {
                  const pct = status.responseTimeMs != null && maxLatency > 0
                    ? Math.max(
                      6,
                      Math.round((status.responseTimeMs / maxLatency) * 100),
                    )
                    : 0;
                  return (
                    <li key={`rank-${status.id}`}>
                      <div class="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span class="truncate font-medium">{status.name}</span>
                        <span class="tabular-nums text-zinc-500 dark:text-zinc-400">
                          {status.responseTimeMs != null
                            ? `${status.responseTimeMs} ms`
                            : "N/A"}
                        </span>
                      </div>
                      <div class="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          class={`h-full rounded-full ${
                            status.up ? "bg-emerald-500" : "bg-red-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
            </ul>
          </article>

          <article
            class={`rounded-2xl border p-5 shadow-sm ${
              allUp
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
            }`}
          >
            <p class="text-sm font-semibold tracking-tight">System verdict</p>
            <p class="mt-2 text-sm leading-relaxed text-current/80">
              {healthLabel}. Checks run every minute and push live updates over
              SSE.
            </p>
            <a
              href={LINKS.incidents}
              class="mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline"
              onClick={(event) =>
                navigate(event as unknown as MouseEvent, LINKS.incidents)}
            >
              Open incidents →
            </a>
          </article>
        </aside>
      </section>
    </>
  );
}
