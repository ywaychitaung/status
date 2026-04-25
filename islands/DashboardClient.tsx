import { useEffect } from "preact/hooks";
import { formatDashboardDatetimeWithTimezone } from "@/lib/datetimeShared.ts";
import type { MonitorStatus } from "@/lib/monitor.ts";

interface DashboardClientProps {
  timezoneId: string;
}

declare global {
  var __lastOutageAt: string | null | undefined;
}

export default function DashboardClient({ timezoneId }: DashboardClientProps) {
  useEffect(() => {
    const outageRoot = document.getElementById("outage-timer");
    if (outageRoot) {
      globalThis.__lastOutageAt = outageRoot.dataset.lastOutageAt || null;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.repeat) return;
      if (event.key.toLowerCase() !== "d") return;

      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      const nextIsDark = !document.documentElement.classList.contains("dark");
      document.documentElement.classList.toggle("dark", nextIsDark);
      try {
        localStorage.setItem("theme", nextIsDark ? "dark" : "light");
      } catch {
        // Ignore storage failures.
      }
    };

    addEventListener("keydown", onKeyDown);

    const updateTimestamp = () => {
      const currentTimestamp = document.getElementById("current-timestamp");
      if (!currentTimestamp) return;
      currentTimestamp.textContent = formatDashboardDatetimeWithTimezone(
        new Date().toISOString(),
        timezoneId,
      );
    };
    updateTimestamp();
    const timestampTimer = setInterval(updateTimestamp, 1000);

    const source = new EventSource("/api/stream");
    let initialSignature: string | null = null;
    let reloadTimer: number | null = null;
    const onSnapshot = (event: MessageEvent) => {
      const payload = JSON.parse(event.data);
      const signature = JSON.stringify(payload);
      if (initialSignature === null) {
        initialSignature = signature;
      } else if (signature !== initialSignature) {
        if (reloadTimer !== null) {
          clearTimeout(reloadTimer);
        }
        reloadTimer = setTimeout(() => {
          location.reload();
        }, 250);
        return;
      }

      const lastUpdated = document.getElementById("last-updated");
      if (lastUpdated) {
        lastUpdated.textContent = formatDashboardDatetimeWithTimezone(
          payload.summary?.updatedAt,
          timezoneId,
        );
      }

      const outage = document.getElementById("outage-timer");
      if (outage) {
        const nextOutage = payload.summary?.lastOutageAt ?? null;
        outage.dataset.lastOutageAt = nextOutage ?? "";
        globalThis.__lastOutageAt = nextOutage;
      }

      const statuses = payload.statuses ?? [];
      const total = statuses.length;
      const upCount = statuses.filter((s: MonitorStatus) => s.up === true)
        .length;
      const downCount = total - upCount;
      const statTotal = document.getElementById("dashboard-stat-total");
      const statUp = document.getElementById("dashboard-stat-up");
      const statDown = document.getElementById("dashboard-stat-down");
      if (statTotal) statTotal.textContent = String(total);
      if (statUp) statUp.textContent = String(upCount);
      if (statDown) statDown.textContent = String(downCount);

      for (const status of statuses) {
        const card = document.getElementById(`monitor-${status.id}`);
        if (!card) continue;

        card.className = status.up
          ? "rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md border-emerald-300/80 bg-linear-to-br from-emerald-50 to-white dark:border-emerald-800/80 dark:from-emerald-950/40 dark:to-slate-900/70"
          : "rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md border-red-300/80 bg-linear-to-br from-red-50 to-white dark:border-red-800/80 dark:from-red-950/40 dark:to-slate-900/70";

        const badge = card.querySelector('[data-role="badge"]');
        if (badge) {
          badge.className = status.up
            ? "inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wide border-emerald-500/30 bg-emerald-600 text-white"
            : "inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wide border-red-500/30 bg-red-600 text-white";
          badge.textContent = status.up ? "UP" : "DOWN";
        }

        const code = card.querySelector('[data-role="status-code"]');
        if (code) code.textContent = status.statusCode ?? "N/A";

        const response = card.querySelector('[data-role="response-time"]');
        if (response) {
          response.textContent = status.responseTimeMs == null
            ? "N/A"
            : `${status.responseTimeMs} ms`;
        }

        const checked = card.querySelector('[data-role="checked-at"]');
        if (checked) {
          checked.textContent = formatDashboardDatetimeWithTimezone(
            status.checkedAt,
            timezoneId,
          );
        }

        const err = card.querySelector('[data-role="error"]');
        if (err) err.textContent = status.error ?? "";
      }
    };

    source.addEventListener("snapshot", onSnapshot as EventListener);

    return () => {
      removeEventListener("keydown", onKeyDown);
      clearInterval(timestampTimer);
      if (reloadTimer !== null) {
        clearTimeout(reloadTimer);
      }
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.close();
    };
  }, [timezoneId]);

  return null;
}
