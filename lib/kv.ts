import {
  INCIDENT_HISTORY_KEY,
  INCIDENT_HISTORY_LIMIT,
  type IncidentRecord,
  monitorKey,
  MONITORS,
  type MonitorStatus,
  type MonitorSummary,
  SUMMARY_KEY,
} from "@/lib/monitor.ts";
import { notifyStatusChange } from "@/lib/notify.ts";

let kvPromise: Promise<Deno.Kv> | null = null;

export function getKv() {
  if (!kvPromise) {
    kvPromise = Deno.openKv();
  }
  return kvPromise;
}

function trimError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function incidentActivityAt(incident: IncidentRecord): string {
  return incident.resolvedAt ?? incident.startedAt;
}

function sortIncidentsNewestFirst(
  incidents: IncidentRecord[],
): IncidentRecord[] {
  return [...incidents].sort((a, b) =>
    incidentActivityAt(b).localeCompare(incidentActivityAt(a))
  );
}

async function readIncidentHistory(kv: Deno.Kv): Promise<IncidentRecord[]> {
  const current = await kv.get<IncidentRecord[]>(INCIDENT_HISTORY_KEY);
  return current.value ?? [];
}

async function writeIncidentHistory(
  kv: Deno.Kv,
  incidents: IncidentRecord[],
): Promise<IncidentRecord[]> {
  const next = sortIncidentsNewestFirst(incidents).slice(
    0,
    INCIDENT_HISTORY_LIMIT,
  );
  await kv.set(INCIDENT_HISTORY_KEY, next);
  return next;
}

async function getIncidentHistory(kv: Deno.Kv): Promise<IncidentRecord[]> {
  return sortIncidentsNewestFirst(await readIncidentHistory(kv));
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

async function getSummary(kv: Deno.Kv): Promise<MonitorSummary> {
  const current = await kv.get<MonitorSummary>(SUMMARY_KEY);
  return current.value ?? {
    updatedAt: new Date().toISOString(),
    lastOutageAt: null,
  };
}

async function openIncident(
  kv: Deno.Kv,
  monitor: { id: string; name: string; url: string },
  now: string,
  result: {
    statusCode: number | null;
    error: string | null;
  },
): Promise<void> {
  const history = await readIncidentHistory(kv);
  const openIndex = history.findIndex(
    (incident) =>
      incident.monitorId === monitor.id && incident.resolvedAt === null,
  );

  if (openIndex >= 0) {
    history[openIndex] = {
      ...history[openIndex],
      statusCode: result.statusCode,
      error: result.error,
    };
    await writeIncidentHistory(kv, history);
    return;
  }

  const incident: IncidentRecord = {
    id: `${monitor.id}-${now}`,
    monitorId: monitor.id,
    name: monitor.name,
    url: monitor.url,
    startedAt: now,
    resolvedAt: null,
    statusCode: result.statusCode,
    error: result.error,
  };
  await writeIncidentHistory(kv, [incident, ...history]);
}

async function resolveIncident(
  kv: Deno.Kv,
  monitorId: string,
  now: string,
): Promise<void> {
  const history = await readIncidentHistory(kv);
  const openIndex = history.findIndex(
    (incident) =>
      incident.monitorId === monitorId && incident.resolvedAt === null,
  );
  if (openIndex < 0) return;

  history[openIndex] = {
    ...history[openIndex],
    resolvedAt: now,
  };
  await writeIncidentHistory(kv, history);
}

export async function runChecks() {
  const kv = await getKv();
  const now = new Date().toISOString();
  const summary = await getSummary(kv);

  for (const monitor of MONITORS) {
    const result = await checkUrl(monitor.url);
    const key = monitorKey(monitor.id);
    const previous = await kv.get<MonitorStatus>(key);
    const previousUp = previous.value?.up ?? null;
    const becameDown = previousUp !== false && result.up === false;
    const becameUp = previousUp === false && result.up === true;

    if (becameDown) {
      summary.lastOutageAt = now;
      await openIncident(kv, monitor, now, result);
    } else if (!result.up) {
      // Persist / refresh the open record while the outage continues.
      await openIncident(kv, monitor, now, result);
    } else if (becameUp) {
      await resolveIncident(kv, monitor.id, now);
    }

    const status: MonitorStatus = {
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      checkedAt: now,
      ...result,
    };
    await kv.set(key, status);
    await notifyStatusChange({
      kv,
      monitor,
      next: status,
      previousUp,
    });
  }

  summary.updatedAt = now;
  await kv.set(SUMMARY_KEY, summary);
}

export async function getSnapshot(): Promise<{
  statuses: MonitorStatus[];
  summary: MonitorSummary;
  incidents: IncidentRecord[];
}> {
  const kv = await getKv();

  const statuses: MonitorStatus[] = [];
  for (const monitor of MONITORS) {
    const value = await kv.get<MonitorStatus>(monitorKey(monitor.id));
    statuses.push(
      value.value ?? {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        up: false,
        checkedAt: "",
        statusCode: null,
        responseTimeMs: null,
        error: "No checks yet",
      },
    );
  }

  const summary = await getSummary(kv);
  const incidents = await getIncidentHistory(kv);
  return { statuses, summary, incidents };
}
