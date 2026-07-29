import { ulid } from "@std/ulid";

export interface MonitorTarget {
  id: string;
  name: string;
  url: string;
  sortOrder: number;
  isActive: boolean;
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

/** Incident history entry (open or resolved). */
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

/** Crockford Base32 ULID (26 chars). */
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function newMonitorId(): string {
  return ulid();
}

export function isMonitorUlid(id: string): boolean {
  return ULID_RE.test(id);
}

/** Max incident records retained (newest kept). */
export const INCIDENT_HISTORY_LIMIT = 50;

export function normalizeMonitorUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("URL is required");
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }
  parsed.hash = "";
  const path = parsed.pathname === "/"
    ? ""
    : parsed.pathname.replace(/\/$/, "");
  return `${parsed.origin}${path}${parsed.search}`;
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}
