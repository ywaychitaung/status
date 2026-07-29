import { ulid } from "@std/ulid";
import { getSql } from "@/lib/db.ts";
import {
  decryptFieldMaybe,
  decryptNullable,
  encryptField,
  encryptNullable,
} from "@/lib/cryptoFields.ts";
import type { AuthUser } from "@/lib/pageTypes.ts";
import type {
  AuditAction,
  AuditEntityType,
  AuditRecord,
} from "@/lib/auditShared.ts";

export type {
  AuditAction,
  AuditEntityType,
  AuditRecord,
} from "@/lib/auditShared.ts";
export { formatAuditAction } from "@/lib/auditShared.ts";

type AuditRow = {
  id: string;
  created_at: Date;
  action: string;
  actor_user_id: number | null;
  actor_username: string | null;
  actor_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  metadata: string | null;
  ip: string | null;
  user_agent: string | null;
};

export function requestClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    null;
}

export function requestUserAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent")?.trim();
  if (!ua) return null;
  return ua.length > 400 ? `${ua.slice(0, 400)}…` : ua;
}

async function rowToAudit(row: AuditRow): Promise<AuditRecord> {
  let metadata: Record<string, unknown> | null = null;
  const rawMeta = await decryptNullable(row.metadata);
  if (rawMeta) {
    try {
      metadata = JSON.parse(rawMeta) as Record<string, unknown>;
    } catch {
      metadata = { raw: rawMeta };
    }
  }

  return {
    id: row.id,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    action: row.action as AuditAction,
    actorUserId: row.actor_user_id === null ? null : Number(row.actor_user_id),
    actorUsername: row.actor_username
      ? await decryptFieldMaybe(row.actor_username)
      : null,
    actorName: row.actor_name
      ? await decryptFieldMaybe(row.actor_name)
      : null,
    entityType: (row.entity_type as AuditEntityType | null) ?? null,
    entityId: row.entity_id,
    summary: await decryptFieldMaybe(row.summary),
    metadata,
    ip: await decryptNullable(row.ip),
    userAgent: await decryptNullable(row.user_agent),
  };
}

export async function writeAudit(input: {
  action: AuditAction;
  actor?: AuthUser | null;
  actorUsername?: string | null;
  entityType?: AuditEntityType | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  req?: Request | null;
}): Promise<void> {
  const sql = await getSql();
  const actorUsername = input.actor?.username ?? input.actorUsername ?? null;
  const actorName = input.actor?.name ?? null;
  const metaJson = input.metadata ? JSON.stringify(input.metadata) : null;
  const ip = input.req ? requestClientIp(input.req) : null;
  const userAgent = input.req ? requestUserAgent(input.req) : null;

  await sql`
    INSERT INTO audits (
      id,
      action,
      actor_user_id,
      actor_username,
      actor_name,
      entity_type,
      entity_id,
      summary,
      metadata,
      ip,
      user_agent
    ) VALUES (
      ${ulid()},
      ${input.action},
      ${input.actor?.id ?? null},
      ${await encryptNullable(actorUsername)},
      ${await encryptNullable(actorName)},
      ${input.entityType ?? null},
      ${input.entityId ?? null},
      ${await encryptField(input.summary)},
      ${await encryptNullable(metaJson)},
      ${await encryptNullable(ip)},
      ${await encryptNullable(userAgent)}
    )
  `;
}

/** Best-effort: never block the main action if audit write fails. */
export async function writeAuditSafe(
  input: Parameters<typeof writeAudit>[0],
): Promise<void> {
  try {
    await writeAudit(input);
  } catch (error) {
    console.error("Audit write failed:", error);
  }
}

export async function listAudits(limit = 50): Promise<AuditRecord[]> {
  const sql = await getSql();
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 200);
  const rows = await sql<AuditRow[]>`
    SELECT
      id,
      created_at,
      action,
      actor_user_id,
      actor_username,
      actor_name,
      entity_type,
      entity_id,
      summary,
      metadata,
      ip,
      user_agent
    FROM audits
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;
  return await Promise.all(rows.map((row) => rowToAudit(row)));
}
