import { formatDashboardDatetime } from "@/lib/datetimeFormat.ts";
import type { Snapshot } from "@/lib/pageTypes.ts";
import { AlertTriangle, CheckCircle2, History, Timer } from "lucide-preact";
import OutageTimer from "../../islands/OutageTimer.tsx";
import { AUTHOR, SUPPORT } from "@/lib/constants.ts";

function formatIncidentDuration(
  startedAt: string,
  resolvedAt: string | null,
): string {
  const endMs = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const ms = endMs - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export interface IncidentsViewProps {
  snapshot: Snapshot;
}

export default function IncidentsView({ snapshot }: IncidentsViewProps) {
  const downServices = snapshot.statuses.filter((s) => !s.up);
  const previousIncidents = snapshot.incidents;
  const total = snapshot.statuses.length;
  const upCount = total - downServices.length;
  const allUp = downServices.length === 0 && total > 0;

  return (
    <>
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
                      <div class="min-w-0 sm:col-span-1">
                        <dt class="text-red-700/60 dark:text-red-300/50">
                          Error
                        </dt>
                        <dd class="mt-1 min-w-0 break-all font-medium">
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
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold tracking-tight">
              Previous incidents
            </p>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              All recorded outages, newest first
            </p>
          </div>
          <span class="rounded-lg bg-zinc-100 p-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <History size={16} />
          </span>
        </div>

        {previousIncidents.length === 0
          ? (
            <div class="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
              <p class="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                No previous incidents yet
              </p>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Past outages will show up here once they occur.
              </p>
            </div>
          )
          : (
            <ul class="mt-6 space-y-3">
              {previousIncidents.map((incident) => {
                const isOpen = incident.resolvedAt === null;
                return (
                  <li
                    key={incident.id}
                    class={`min-w-0 overflow-hidden rounded-2xl border p-4 ${
                      isOpen
                        ? "border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/25"
                        : "border-zinc-200/90 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-950/40"
                    }`}
                  >
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span
                            class={`h-2 w-2 rounded-full ${
                              isOpen ? "bg-red-500" : "bg-emerald-500"
                            }`}
                          />
                          <p class="font-semibold tracking-tight">
                            {incident.name}
                          </p>
                        </div>
                        <a
                          href={incident.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class={`mt-1 block truncate text-xs hover:underline ${
                            isOpen
                              ? "text-red-700/70 dark:text-red-300/70"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {incident.url.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                      <span
                        class={`rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                          isOpen
                            ? "bg-red-500/10 text-red-700 dark:text-red-300"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {isOpen ? "Ongoing" : "Resolved"}
                      </span>
                    </div>
                    <dl class="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt
                          class={isOpen
                            ? "text-red-700/60 dark:text-red-300/50"
                            : "text-zinc-500 dark:text-zinc-400"}
                        >
                          Started
                        </dt>
                        <dd class="mt-1 font-semibold">
                          {formatDashboardDatetime(incident.startedAt)}
                        </dd>
                      </div>
                      <div>
                        <dt
                          class={isOpen
                            ? "text-red-700/60 dark:text-red-300/50"
                            : "text-zinc-500 dark:text-zinc-400"}
                        >
                          Resolved
                        </dt>
                        <dd class="mt-1 font-semibold">
                          {incident.resolvedAt
                            ? formatDashboardDatetime(incident.resolvedAt)
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt
                          class={isOpen
                            ? "text-red-700/60 dark:text-red-300/50"
                            : "text-zinc-500 dark:text-zinc-400"}
                        >
                          Duration
                        </dt>
                        <dd class="mt-1 font-semibold tabular-nums">
                          {formatIncidentDuration(
                            incident.startedAt,
                            incident.resolvedAt,
                          )}
                          {isOpen ? " so far" : ""}
                        </dd>
                      </div>
                      <div class="min-w-0 sm:col-span-2 lg:col-span-4">
                        <dt
                          class={isOpen
                            ? "text-red-700/60 dark:text-red-300/50"
                            : "text-zinc-500 dark:text-zinc-400"}
                        >
                          Last error
                        </dt>
                        <dd class="mt-1 min-w-0 break-all font-medium">
                          {incident.error ||
                            (incident.statusCode != null
                              ? `Status ${incident.statusCode}`
                              : "Non-success response")}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
      </section>

      <section class="animate-rise-2 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
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
    </>
  );
}
