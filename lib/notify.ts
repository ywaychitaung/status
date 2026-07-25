import type { MonitorStatus, MonitorTarget } from "@/lib/monitor.ts";
import { formatDashboardDatetime } from "@/lib/datetimeFormat.ts";
import { DEFAULT_TIMEZONE } from "@/lib/constants.ts";

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = Deno.env.get(name);
  if (raw == null || raw.trim() === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" ||
    normalized === "on";
}

function parseNumberEnv(name: string, defaultValue: number): number {
  const raw = Deno.env.get(name);
  if (raw == null || raw.trim() === "") return defaultValue;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function buildMessage(
  monitor: MonitorTarget,
  next: MonitorStatus,
  previousUp: boolean | null,
  consecutiveDowns?: number,
): string {
  const state = next.up ? "RECOVERED" : "DOWN";
  const transition = previousUp === null
    ? "Initial check"
    : previousUp === next.up
    ? "No state change"
    : "State changed";
  const code = next.statusCode ?? "N/A";
  const latency = next.responseTimeMs === null
    ? "N/A"
    : `${next.responseTimeMs} ms`;
  const error = next.error ?? "None";
  const checkedAt = formatDashboardDatetime(next.checkedAt);
  const timezoneId = Deno.env.get("DASHBOARD_TIMEZONE")?.trim() ||
    DEFAULT_TIMEZONE.id;
  const lines = [
    `Uptime alert: ${monitor.name} is ${state}`,
    `URL: ${monitor.url}`,
    `Status code: ${code}`,
    `Latency: ${latency}`,
    `Error: ${error}`,
    `Checked at: ${checkedAt}`,
    `Timezone: ${timezoneId}`,
    `Transition: ${transition}`,
  ];
  if (!next.up && consecutiveDowns != null) {
    lines.push(`Consecutive failures: ${consecutiveDowns}`);
  }
  return lines.join("\n");
}

async function sendDiscord(text: string): Promise<void> {
  const webhook = Deno.env.get("ALERT_DISCORD_WEBHOOK_URL");
  if (!webhook) return;

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: text }),
  });

  if (!response.ok) {
    console.error("Discord notification failed:", response.status);
  }
}

/** Stored at `downThrottleKey` so KV always round-trips a structured value. */
type DownAlertThrottle = { sentAt: number };

function readDownAlertThrottleMs(
  entry: Deno.KvEntryMaybe<number | DownAlertThrottle>,
): number | null {
  if (entry.versionstamp === null) return null;
  const v = entry.value as unknown;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (
    v !== null &&
    typeof v === "object" &&
    "sentAt" in v &&
    typeof (v as DownAlertThrottle).sentAt === "number" &&
    Number.isFinite((v as DownAlertThrottle).sentAt)
  ) {
    return (v as DownAlertThrottle).sentAt;
  }
  return null;
}

function readConsecutiveDowns(
  entry: Deno.KvEntryMaybe<number>,
): number {
  if (entry.versionstamp === null) return 0;
  const v = entry.value;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.floor(v);
  }
  return 0;
}

async function sendTelegram(text: string): Promise<void> {
  const token = Deno.env.get("ALERT_TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("ALERT_TELEGRAM_CHAT_ID");
  if (!token || !chatId) return;

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    console.error("Telegram notification failed:", response.status);
  }
}

export async function notifyStatusChange(args: {
  kv: Deno.Kv;
  monitor: MonitorTarget;
  next: MonitorStatus;
  previousUp: boolean | null;
}) {
  const { kv, monitor, next, previousUp } = args;
  const alertOnDown = parseBooleanEnv("ALERT_ON_DOWN", true);
  const alertOnRecovery = parseBooleanEnv("ALERT_ON_RECOVERY", true);
  const consecutiveThreshold = parseNumberEnv("ALERT_DOWN_CONSECUTIVE", 5);
  const isRecoveryTransition = previousUp === false && next.up === true;

  const consecutiveKey: Deno.KvKey = [
    "alert",
    "down",
    "consecutive",
    monitor.id,
  ];
  const downThrottleKey: Deno.KvKey = [
    "alert",
    "down",
    "last_sent",
    monitor.id,
  ];

  // Track consecutive failures. A brief flap (e.g. D D D D U) resets the
  // counter, so notifications only fire after enough downs in a row.
  if (!next.up) {
    const consecutiveEntry = await kv.get<number>(consecutiveKey);
    const consecutive = readConsecutiveDowns(consecutiveEntry) + 1;
    await kv.set(consecutiveKey, consecutive);

    if (!alertOnDown) return;
    if (consecutive < consecutiveThreshold) return;

    const downIntervalMinutes = parseNumberEnv(
      "ALERT_DOWN_INTERVAL_MINUTES",
      60,
    );
    const downIntervalMs = downIntervalMinutes * 60_000;

    // Throttle repeated DOWN alerts while the monitor stays failed.
    // Persist throttle before sending so a crash after notify cannot cause
    // one alert per cron tick.
    const lastSent = await kv.get<number | DownAlertThrottle>(downThrottleKey);
    const nowMs = Date.now();
    const lastMs = readDownAlertThrottleMs(lastSent);
    const age = lastMs === null ? Infinity : nowMs - lastMs;
    if (lastMs !== null && age >= 0 && age < downIntervalMs) {
      return;
    }

    // Claim the send slot in one commit so overlapping cron retries / isolates
    // cannot all pass the time check and each fire a webhook in the same window.
    const committed = await kv.atomic()
      .check(lastSent)
      .set(downThrottleKey, { sentAt: nowMs })
      .commit();
    if (!committed.ok) {
      return;
    }

    const message = buildMessage(monitor, next, previousUp, consecutive);
    await Promise.allSettled([sendDiscord(message), sendTelegram(message)]);
    return;
  }

  // Recovery path: only notify if we had already crossed the consecutive
  // threshold (i.e. a real confirmed outage, not a short flap).
  const consecutiveEntry = await kv.get<number>(consecutiveKey);
  const consecutive = readConsecutiveDowns(consecutiveEntry);
  const wasConfirmedDown = consecutive >= consecutiveThreshold;
  await kv.delete(consecutiveKey);
  await kv.delete(downThrottleKey);

  if (!wasConfirmedDown || !isRecoveryTransition || !alertOnRecovery) return;

  const message = buildMessage(monitor, next, previousUp);
  await Promise.allSettled([sendDiscord(message), sendTelegram(message)]);
}
