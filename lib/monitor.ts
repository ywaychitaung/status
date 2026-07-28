export interface MonitorTarget {
  id: string;
  name: string;
  url: string;
}

export interface MonitorStatus {
  id: string;
  name: string;
  url: string;
  up: boolean;
  checkedAt: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

export interface MonitorSummary {
  updatedAt: string;
  lastOutageAt: string | null;
}

/** Incident history entry stored in KV (open or resolved). */
export interface IncidentRecord {
  id: string;
  monitorId: string;
  name: string;
  url: string;
  startedAt: string;
  /** Null while the outage is still ongoing. */
  resolvedAt: string | null;
  statusCode: number | null;
  error: string | null;
}

export const MONITORS: MonitorTarget[] = [
  {
    id: "ywaychitaung-dev",
    name: "Portfolio v5",
    url: "https://ywaychitaung.dev",
  },
  {
    id: "ywaychitaung-com",
    name: "Personal",
    url: "https://ywaychitaung.com",
  },
  {
    id: "utils-ywaychitaung-dev",
    name: "Utilities",
    url: "https://utils.ywaychitaung.dev",
  },
  {
    id: "team7labs-com",
    name: "Team7 Labs",
    url: "https://team7labs.com",
  },
];

export function monitorKey(id: string): Deno.KvKey {
  return ["monitor", id];
}

export const SUMMARY_KEY: Deno.KvKey = ["summary"];
export const INCIDENT_HISTORY_KEY: Deno.KvKey = ["incidents", "history"];

/** Max incident records retained in KV (newest kept). */
export const INCIDENT_HISTORY_LIMIT = 50;
