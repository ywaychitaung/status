import {
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

export async function runChecks() {
  const kv = await getKv();
  const now = new Date().toISOString();
  const summary = await getSummary(kv);

  for (const monitor of MONITORS) {
    const result = await checkUrl(monitor.url);
    const key = monitorKey(monitor.id);
    const previous = await kv.get<MonitorStatus>(key);

    if (previous.value?.up !== false && result.up === false) {
      summary.lastOutageAt = now;
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
      previousUp: previous.value?.up ?? null,
    });
  }

  summary.updatedAt = now;
  await kv.set(SUMMARY_KEY, summary);
}

export async function getSnapshot(): Promise<{
  statuses: MonitorStatus[];
  summary: MonitorSummary;
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
  return { statuses, summary };
}
