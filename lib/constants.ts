/** Static app metadata and shared defaults. */

export const APP_VERSION = "2.0.0";

export const APP_NAME = "Status";
export const APP_TAGLINE = "Uptime Monitor";
export const APP_DESCRIPTION =
  "Personal website uptime monitoring with Deno Cron, KV, and live SSE updates.";

export const AUTHOR = {
  name: "Yway Chit Aung",
  url: "https://ywaychitaung.dev",
  email: "yca@duck.com",
} as const;

export const SUPPORT = {
  reportEmail: AUTHOR.email,
  reportMailto: `mailto:${AUTHOR.email}`,
} as const;

export const DASHBOARD_TIMEZONE = {
  id: "Asia/Singapore",
  short: "SGT",
  name: "Singapore Time",
  utcLabel: "UTC/GMT +8",
} as const;

export const MONITOR = {
  /** Cron expression used by Deno.cron */
  cronExpression: "* * * * *",
  intervalLabel: "Every 1 minute",
  intervalMinutes: 1,
  engine: "Deno Cron",
  storage: "Deno KV",
  stream: "SSE live",
} as const;

export const ALERTS = {
  onDown: true,
  onRecovery: true,
  /** Minutes between repeated down alerts for the same monitor */
  downIntervalMinutes: 60,
  /** Consecutive failed checks before a down alert is sent */
  downConsecutive: 5,
} as const;

export const THEME = {
  storageKey: "theme",
  shortcutKey: "d",
  defaultMode: "light" as const,
} as const;

export const LINKS = {
  home: "/",
  services: "/services",
  incidents: "/incidents",
  github: "https://github.com/ywaychitaung/status",
} as const;
