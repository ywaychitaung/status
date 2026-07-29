import { getSql, notifyStatusUpdate } from "@/lib/db.ts";
import {
  decryptFieldMaybe,
  decryptNullable,
  encryptField,
  encryptNullable,
  isEncryptedField,
} from "@/lib/cryptoFields.ts";
import {
  INCIDENT_HISTORY_LIMIT,
  type IncidentRecord,
  type MonitorStatus,
  type MonitorSummary,
  toIso,
} from "@/lib/monitor.ts";
import { listMonitors } from "@/lib/monitorsDb.ts";
import { notifyStatusChange } from "@/lib/notify.ts";

function trimError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Guarantee a usable plaintext URL even if a caller hands us ciphertext. */
async function resolveMonitorUrl(url: string): Promise<string> {
  const plain = isEncryptedField(url) ? await decryptFieldMaybe(url) : url;
  if (isEncryptedField(plain) || !/^https?:\/\//i.test(plain)) {
    throw new Error(`Monitor URL is not usable: ${plain.slice(0, 48)}`);
  }
  return plain;
}

async function checkUrl(url: string): Promise<{
  up: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "status-monitor/1.0" },
    });
    const responseTimeMs = Math.round(performance.now() - startedAt);
    const up = response.status >= 200 && response.status < 400;

    return {
      up,
      statusCode: response.status,
      responseTimeMs,
      error: up ? null : `Unexpected status ${response.status}`,
    };
  } catch (error) {
    return {
      up: false,
      statusCode: null,
      responseTimeMs: Math.round(performance.now() - startedAt),
      error: trimError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getSummary(): Promise<MonitorSummary> {
  const sql = await getSql();
  const rows = await sql<{
    updated_at: Date;
    last_outage_at: Date | null;
  }[]>`
    SELECT updated_at, last_outage_at
    FROM app_summary
    WHERE id = 1
  `;
  const row = rows[0];
  return {
    updatedAt: toIso(row?.updated_at) ?? new Date().toISOString(),
    lastOutageAt: toIso(row?.last_outage_at),
  };
}

async function openIncident(
  monitor: { id: string; name: string; url: string },
  now: string,
  result: {
    statusCode: number | null;
    error: string | null;
  },
): Promise<void> {
  const sql = await getSql();
  const open = await sql<{ id: string }[]>`
    SELECT id FROM incidents
    WHERE monitor_id = ${monitor.id} AND resolved_at IS NULL
    LIMIT 1
  `;

  const errorCipher = await encryptNullable(result.error);

  if (open[0]) {
    await sql`
      UPDATE incidents
      SET status_code = ${result.statusCode},
          error = ${errorCipher}
      WHERE id = ${open[0].id}
    `;
    return;
  }

  await sql`
    INSERT INTO incidents (
      id, monitor_id, name, url, started_at, resolved_at, status_code, error
    ) VALUES (
      ${`${monitor.id}-${now}`},
      ${monitor.id},
      ${await encryptField(monitor.name)},
      ${await encryptField(monitor.url)},
      ${now},
      NULL,
      ${result.statusCode},
      ${errorCipher}
    )
  `;

  await sql`
    DELETE FROM incidents
    WHERE id IN (
      SELECT id FROM incidents
      ORDER BY COALESCE(resolved_at, started_at) DESC
      OFFSET ${INCIDENT_HISTORY_LIMIT}
    )
  `;
}

async function resolveIncident(monitorId: string, now: string): Promise<void> {
  const sql = await getSql();
  await sql`
    UPDATE incidents
    SET resolved_at = ${now}
    WHERE monitor_id = ${monitorId} AND resolved_at IS NULL
  `;
}

async function getIncidentHistory(): Promise<IncidentRecord[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    monitor_id: string;
    name: string;
    url: string;
    started_at: Date;
    resolved_at: Date | null;
    status_code: number | null;
    error: string | null;
  }[]>`
    SELECT id, monitor_id, name, url, started_at, resolved_at, status_code, error
    FROM incidents
    ORDER BY COALESCE(resolved_at, started_at) DESC
    LIMIT ${INCIDENT_HISTORY_LIMIT}
  `;

  return await Promise.all(rows.map(async (row) => ({
    id: row.id,
    monitorId: row.monitor_id,
    name: await decryptFieldMaybe(row.name),
    url: await decryptFieldMaybe(row.url),
    startedAt: toIso(row.started_at)!,
    resolvedAt: toIso(row.resolved_at),
    statusCode: row.status_code,
    error: await decryptNullable(row.error),
  })));
}

async function readPreviousStatus(
  monitorId: string,
): Promise<MonitorStatus | null> {
  const sql = await getSql();
  const rows = await sql<{
    monitor_id: string;
    name: string;
    url: string;
    up: boolean;
    checked_at: Date | null;
    status_code: number | null;
    response_time_ms: number | null;
    error: string | null;
  }[]>`
    SELECT monitor_id, name, url, up, checked_at, status_code, response_time_ms, error
    FROM monitor_statuses
    WHERE monitor_id = ${monitorId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.monitor_id,
    name: await decryptFieldMaybe(row.name),
    url: await decryptFieldMaybe(row.url),
    up: row.up,
    checkedAt: toIso(row.checked_at) ?? "",
    statusCode: row.status_code,
    responseTimeMs: row.response_time_ms,
    error: await decryptNullable(row.error),
  };
}

export async function runChecks() {
  const sql = await getSql();
  const now = new Date().toISOString();
  let summary = await getSummary();
  const monitors = await listMonitors();

  for (const monitor of monitors) {
    const url = await resolveMonitorUrl(monitor.url);
    const result = await checkUrl(url);
    const previous = await readPreviousStatus(monitor.id);
    const previousUp = previous ? previous.up : null;
    const becameDown = previousUp !== false && result.up === false;
    const becameUp = previousUp === false && result.up === true;

    if (becameDown) {
      summary = { ...summary, lastOutageAt: now };
      await openIncident({ ...monitor, url }, now, result);
    } else if (!result.up) {
      await openIncident({ ...monitor, url }, now, result);
    } else if (becameUp) {
      await resolveIncident(monitor.id, now);
    }

    const status: MonitorStatus = {
      id: monitor.id,
      name: monitor.name,
      url,
      checkedAt: now,
      ...result,
    };

    await sql`
      INSERT INTO monitor_statuses (
        monitor_id, name, url, up, checked_at, status_code, response_time_ms, error
      ) VALUES (
        ${monitor.id},
        ${await encryptField(monitor.name)},
        ${await encryptField(url)},
        ${status.up},
        ${now},
        ${status.statusCode},
        ${status.responseTimeMs},
        ${await encryptNullable(status.error)}
      )
      ON CONFLICT (monitor_id) DO UPDATE SET
        name = EXCLUDED.name,
        url = EXCLUDED.url,
        up = EXCLUDED.up,
        checked_at = EXCLUDED.checked_at,
        status_code = EXCLUDED.status_code,
        response_time_ms = EXCLUDED.response_time_ms,
        error = EXCLUDED.error
    `;

    await notifyStatusChange({
      monitor: { ...monitor, url },
      next: status,
      previousUp,
    });
  }

  await sql`
    UPDATE app_summary
    SET updated_at = ${now},
        last_outage_at = ${summary.lastOutageAt}
    WHERE id = 1
  `;

  await notifyStatusUpdate();
}

export async function getSnapshot(): Promise<{
  statuses: MonitorStatus[];
  summary: MonitorSummary;
  incidents: IncidentRecord[];
}> {
  const monitors = await listMonitors();
  const sql = await getSql();

  const statusRows = await sql<{
    monitor_id: string;
    name: string;
    url: string;
    up: boolean;
    checked_at: Date | null;
    status_code: number | null;
    response_time_ms: number | null;
    error: string | null;
  }[]>`
    SELECT monitor_id, name, url, up, checked_at, status_code, response_time_ms, error
    FROM monitor_statuses
  `;
  const byId = new Map(statusRows.map((row) => [row.monitor_id, row]));

  const statuses: MonitorStatus[] = await Promise.all(monitors.map(
    async (monitor) => {
      const row = byId.get(monitor.id);
      if (!row) {
        return {
          id: monitor.id,
          name: monitor.name,
          url: monitor.url,
          up: false,
          checkedAt: "",
          statusCode: null,
          responseTimeMs: null,
          error: "No checks yet",
        };
      }
      return {
        id: monitor.id,
        // Prefer canonical monitor fields (already decrypted).
        name: monitor.name,
        url: monitor.url,
        up: row.up,
        checkedAt: toIso(row.checked_at) ?? "",
        statusCode: row.status_code,
        responseTimeMs: row.response_time_ms,
        error: await decryptNullable(row.error),
      };
    },
  ));

  return {
    statuses,
    summary: await getSummary(),
    incidents: await getIncidentHistory(),
  };
}
