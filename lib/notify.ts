import type { MonitorStatus, MonitorTarget } from "@/lib/monitor.ts";
import { formatDashboardDatetime } from "@/lib/datetimeFormat.ts";
import { ALERTS, DASHBOARD_TIMEZONE } from "@/lib/constants.ts";
import { getSql } from "@/lib/db.ts";

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
  const lines = [
    `Uptime alert: ${monitor.name} is ${state}`,
    `URL: ${monitor.url}`,
    `Status code: ${code}`,
    `Latency: ${latency}`,
    `Error: ${error}`,
    `Checked at: ${checkedAt}`,
    `Timezone: ${DASHBOARD_TIMEZONE.id}`,
    `Transition: ${transition}`,
  ];
  if (!next.up && consecutiveDowns != null) {
    lines.push(`Consecutive failures: ${consecutiveDowns}`);
  }
  return lines.join("\n");
}

async function sendDiscord(text: string): Promise<void> {
  const webhook = Deno.env.get("ALERT_DISCORD_WEBHOOK_URL")?.trim();
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

async function sendTelegram(text: string): Promise<void> {
  const token = Deno.env.get("ALERT_TELEGRAM_BOT_TOKEN")?.trim();
  const chatId = Deno.env.get("ALERT_TELEGRAM_CHAT_ID")?.trim();
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

async function ensureAlertState(monitorId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO alert_states (monitor_id, consecutive_downs)
    VALUES (${monitorId}, 0)
    ON CONFLICT (monitor_id) DO NOTHING
  `;
}

export async function notifyStatusChange(args: {
  monitor: MonitorTarget;
  next: MonitorStatus;
  previousUp: boolean | null;
}) {
  const { monitor, next, previousUp } = args;
  const { onDown, onRecovery, downConsecutive, downIntervalMinutes } = ALERTS;
  const isRecoveryTransition = previousUp === false && next.up === true;
  const sql = await getSql();
  await ensureAlertState(monitor.id);

  if (!next.up) {
    const rows = await sql<{ consecutive_downs: number }[]>`
      UPDATE alert_states
      SET consecutive_downs = consecutive_downs + 1
      WHERE monitor_id = ${monitor.id}
      RETURNING consecutive_downs
    `;
    const consecutive = rows[0]?.consecutive_downs ?? 1;

    if (!onDown) return;
    if (consecutive < downConsecutive) return;

    const downIntervalMs = downIntervalMinutes * 60_000;
    const nowMs = Date.now();

    // Claim the send slot in one statement so overlapping cron ticks cannot
    // each fire a webhook in the same throttle window.
    const claimed = await sql<{ monitor_id: string }[]>`
      UPDATE alert_states
      SET last_down_alert_at = ${new Date(nowMs).toISOString()}
      WHERE monitor_id = ${monitor.id}
        AND (
          last_down_alert_at IS NULL
          OR last_down_alert_at <= ${new Date(nowMs - downIntervalMs).toISOString()}
        )
      RETURNING monitor_id
    `;
    if (claimed.length === 0) return;

    const message = buildMessage(monitor, next, previousUp, consecutive);
    await Promise.allSettled([sendDiscord(message), sendTelegram(message)]);
    return;
  }

  const stateRows = await sql<{ consecutive_downs: number }[]>`
    SELECT consecutive_downs
    FROM alert_states
    WHERE monitor_id = ${monitor.id}
    LIMIT 1
  `;
  const consecutive = stateRows[0]?.consecutive_downs ?? 0;
  const wasConfirmedDown = consecutive >= downConsecutive;

  await sql`
    UPDATE alert_states
    SET consecutive_downs = 0,
        last_down_alert_at = NULL
    WHERE monitor_id = ${monitor.id}
  `;

  if (!wasConfirmedDown || !isRecoveryTransition || !onRecovery) return;

  const message = buildMessage(monitor, next, previousUp);
  await Promise.allSettled([sendDiscord(message), sendTelegram(message)]);
}
