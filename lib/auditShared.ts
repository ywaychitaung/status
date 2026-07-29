/** Client-safe audit types and labels (no DB / Node imports). */

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "monitor.create"
  | "monitor.update"
  | "monitor.delete"
  | "monitor.reactivate";

export type AuditEntityType = "user" | "monitor" | "session";

export type AuditRecord = {
  id: string;
  createdAt: string;
  action: AuditAction;
  actorUserId: number | null;
  actorUsername: string | null;
  actorName: string | null;
  entityType: AuditEntityType | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
};

export function formatAuditAction(action: AuditAction): string {
  switch (action) {
    case "auth.login":
      return "Logged in";
    case "auth.login_failed":
      return "Login failed";
    case "auth.logout":
      return "Logged out";
    case "monitor.create":
      return "Website created";
    case "monitor.update":
      return "Website updated";
    case "monitor.delete":
      return "Website deleted";
    case "monitor.reactivate":
      return "Website reactivated";
    default:
      return action;
  }
}
