import type {
  IncidentRecord,
  MonitorStatus,
  MonitorSummary,
  MonitorTarget,
} from "@/lib/monitor.ts";
import type { AuditRecord } from "@/lib/auditShared.ts";
import type { DashboardNavId, PagePath } from "@/lib/pageMeta.ts";

/** Serializable identity shown in the dashboard chrome. */
export type AuthUser = { id: number; username: string; name: string };

/** Chrome fields shared by every dashboard page. */
export type DashboardFrame = {
  healthLabel: string;
  allUp: boolean;
  timezoneName: string;
  timezoneUtcLabel: string;
  timezoneId: string;
  timestamp: string;
};

export type Snapshot = {
  statuses: MonitorStatus[];
  summary: MonitorSummary;
  incidents: IncidentRecord[];
};

/** JSON shape returned by `/api/pages` and bootstrapped into AppShell. */
export type PagePayload = {
  path: PagePath;
  meta: { active: DashboardNavId; title: string; subtitle: string };
  frame: DashboardFrame;
  user: AuthUser | null;
  snapshot?: Snapshot;
  monitors?: MonitorTarget[];
  inactiveMonitors?: MonitorTarget[];
  audits?: AuditRecord[];
  flash?: string | null;
  error?: string | null;
  editingId?: string | null;
};
