import { getSnapshot } from "@/lib/checks.ts";
import { getCurrentUser } from "@/lib/adminAuth.ts";
import { listInactiveMonitors, listMonitors } from "@/lib/monitorsDb.ts";
import { listAudits } from "@/lib/audit.ts";
import type { AuditRecord } from "@/lib/auditShared.ts";
import type { MonitorTarget } from "@/lib/monitor.ts";
import {
  type AuthUser,
  type DashboardFrame,
  getDashboardFrame,
  requireAdminSession,
} from "@/lib/dashboardAuth.ts";

export type { Snapshot } from "@/lib/pageTypes.ts";
import type { Snapshot } from "@/lib/pageTypes.ts";

export async function loadPublicPageData(req: Request): Promise<{
  frame: DashboardFrame;
  snapshot: Snapshot;
  user: AuthUser | null;
}> {
  const [frame, snapshot, user] = await Promise.all([
    getDashboardFrame(),
    getSnapshot(),
    getCurrentUser(req),
  ]);

  return { frame, snapshot, user };
}

export async function loadAdminPageData(req: Request): Promise<
  | Response
  | {
    frame: DashboardFrame;
    user: AuthUser;
    monitors: MonitorTarget[];
    inactiveMonitors: MonitorTarget[];
    flash: string | null;
    error: string | null;
    editingId: string | null;
  }
> {
  const session = await requireAdminSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const [frame, monitors, inactiveMonitors] = await Promise.all([
    getDashboardFrame(),
    listMonitors(),
    listInactiveMonitors(),
  ]);

  return {
    frame,
    user: session,
    monitors,
    inactiveMonitors,
    flash: url.searchParams.get("flash"),
    error: url.searchParams.get("error"),
    editingId: url.searchParams.get("edit"),
  };
}

export async function loadAuditsPageData(req: Request): Promise<
  | Response
  | {
    frame: DashboardFrame;
    user: AuthUser;
    audits: AuditRecord[];
  }
> {
  const session = await requireAdminSession(req);
  if (session instanceof Response) return session;

  const [frame, audits] = await Promise.all([
    getDashboardFrame(),
    listAudits(100),
  ]);

  return {
    frame,
    user: session,
    audits,
  };
}

export async function loadAccountPageData(req: Request): Promise<
  | Response
  | {
    frame: DashboardFrame;
    user: AuthUser;
    flash: string | null;
    error: string | null;
  }
> {
  const session = await requireAdminSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const frame = await getDashboardFrame();

  return {
    frame,
    user: session,
    flash: url.searchParams.get("flash"),
    error: url.searchParams.get("error"),
  };
}
