import { formatDashboardDatetime } from "@/lib/datetimeFormat.ts";
import type { Snapshot } from "@/lib/pageTypes.ts";
import { ExternalLink } from "lucide-preact";

export interface ServicesViewProps {
  snapshot: Snapshot;
}

export default function ServicesView({ snapshot }: ServicesViewProps) {
  const total = snapshot.statuses.length;
  const upCount = snapshot.statuses.filter((s) => s.up).length;
  const downCount = total - upCount;

  return (
    <>
      <section class="animate-rise grid gap-3 sm:grid-cols-3">
        <article class="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <p class="text-xs uppercase tracking-wider text-zinc-500">Total</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">{total}</p>
        </article>
        <article class="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <p class="text-xs uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80">
            Up
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            {upCount}
          </p>
        </article>
        <article class="rounded-2xl border border-red-200/80 bg-red-50 p-4 shadow-sm dark:border-red-900/40 dark:bg-red-950/30">
          <p class="text-xs uppercase tracking-wider text-red-700/80 dark:text-red-300/80">
            Down
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-red-700 dark:text-red-300">
            {downCount}
          </p>
        </article>
      </section>

      <section class="animate-rise-1 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div class="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 class="text-sm font-semibold tracking-tight">
              Service catalog
            </h2>
            <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Updated {formatDashboardDatetime(snapshot.summary.updatedAt)}
            </p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
              <tr>
                <th class="px-5 py-3 font-medium">Service</th>
                <th class="px-5 py-3 font-medium">Status</th>
                <th class="px-5 py-3 font-medium">Code</th>
                <th class="px-5 py-3 font-medium">Latency</th>
                <th class="px-5 py-3 font-medium">Last checked</th>
                <th class="px-5 py-3 font-medium">URL</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
              {snapshot.statuses.map((status) => (
                <tr
                  key={status.id}
                  class="transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-950/40"
                >
                  <td class="px-5 py-4">
                    <div class="flex items-center gap-2">
                      <span
                        class={`h-2 w-2 rounded-full ${
                          status.up ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      <span class="font-medium">{status.name}</span>
                    </div>
                    {status.error && (
                      <p class="mt-1 max-w-xs truncate text-xs text-red-600 dark:text-red-300">
                        {status.error}
                      </p>
                    )}
                  </td>
                  <td class="px-5 py-4">
                    <span
                      class={`inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                        status.up
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-red-500/10 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {status.up ? "Up" : "Down"}
                    </span>
                  </td>
                  <td class="px-5 py-4 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {status.statusCode ?? "N/A"}
                  </td>
                  <td class="px-5 py-4 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {status.responseTimeMs != null
                      ? `${status.responseTimeMs} ms`
                      : "N/A"}
                  </td>
                  <td class="px-5 py-4 text-zinc-600 dark:text-zinc-300">
                    {formatDashboardDatetime(status.checkedAt)}
                  </td>
                  <td class="px-5 py-4">
                    <a
                      href={status.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-zinc-600 transition-colors hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400"
                    >
                      <span class="max-w-45 truncate">
                        {status.url.replace(/^https?:\/\//, "")}
                      </span>
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
