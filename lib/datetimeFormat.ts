import { formatDashboardDatetimeWithTimezone } from "@/lib/datetimeShared.ts";
import { DEFAULT_TIMEZONE } from "@/lib/constants.ts";

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
  const id = safeTimezone(
    Deno.env.get("DASHBOARD_TIMEZONE") ?? DEFAULT_TIMEZONE.id,
  );
  return {
    id,
    short: Deno.env.get("DASHBOARD_TIMEZONE_SHORT") ?? DEFAULT_TIMEZONE.short,
    name: Deno.env.get("DASHBOARD_TIMEZONE_NAME") ?? DEFAULT_TIMEZONE.name,
    utcLabel: Deno.env.get("DASHBOARD_TIMEZONE_UTC_LABEL") ??
      DEFAULT_TIMEZONE.utcLabel,
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
