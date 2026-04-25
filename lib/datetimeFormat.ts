import { formatDashboardDatetimeWithTimezone } from "@/lib/datetimeShared.ts";

export interface DashboardTimezoneConfig {
  id: string;
  short: string;
  name: string;
  utcLabel: string;
}

function safeTimezone(timezoneId: string): string {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezoneId }).format(
      new Date(),
    );
    return timezoneId;
  } catch {
    return "UTC";
  }
}

export function getDashboardTimezoneConfig(): DashboardTimezoneConfig {
  const id = safeTimezone(Deno.env.get("DASHBOARD_TIMEZONE") ?? "UTC");
  return {
    id,
    short: Deno.env.get("DASHBOARD_TIMEZONE_SHORT") ?? "UTC",
    name: Deno.env.get("DASHBOARD_TIMEZONE_NAME") ??
      "Coordinated Universal Time",
    utcLabel: Deno.env.get("DASHBOARD_TIMEZONE_UTC_LABEL") ?? "UTC/GMT +0",
  };
}

export function formatDashboardDatetime(iso: string): string {
  const timezone = getDashboardTimezoneConfig();
  return formatDashboardDatetimeWithTimezone(iso, timezone.id);
}

export function formatCurrentServerTime(timezoneId: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezoneId,
  }).format(new Date());
}
