import postgres from "postgres";
import { loadEnvFile } from "@/lib/loadEnv.ts";
import { isMonitorUlid, newMonitorId } from "@/lib/monitor.ts";

let sqlPromise: Promise<ReturnType<typeof postgres>> | null = null;
let listenSqlPromise: Promise<ReturnType<typeof postgres>> | null = null;
let migrated = false;
let migratePromise: Promise<void> | null = null;

export const STATUS_CHANNEL = "status_update";

export function getDatabaseUrl(): string {
  loadEnvFile();
  const url = Deno.env.get("DATABASE_URL")?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Example: postgres://user:pass@127.0.0.1:5432/status",
    );
  }
  return url;
}

function createClient(max: number) {
  return postgres(getDatabaseUrl(), {
    max,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export async function getSql() {
  if (!sqlPromise) {
    sqlPromise = Promise.resolve(createClient(5));
  }
  const sql = await sqlPromise;
  if (!migrated) {
    // Serialize bootstrap across concurrent callers (Vite HMR / cron / requests).
    if (!migratePromise) {
      migratePromise = (async () => {
        await migrate(sql);
        migrated = true;
        const { backfillEncryptedSensitiveFields } = await import(
          "@/lib/encryptBackfill.ts"
        );
        await backfillEncryptedSensitiveFields(sql);
      })().finally(() => {
        migratePromise = null;
      });
    }
    await migratePromise;
  }
  return sql;
}

/** Dedicated single connection for LISTEN (one shared subscriber). */
export async function getListenSql() {
  if (!listenSqlPromise) {
    listenSqlPromise = Promise.resolve(createClient(1));
  }
  return await listenSqlPromise;
}

export async function notifyStatusUpdate(): Promise<void> {
  const sql = await getSql();
  await sqlUnsafeNotify(sql);
}

async function sqlUnsafeNotify(
  sql: ReturnType<typeof postgres>,
): Promise<void> {
  await sql.unsafe(`NOTIFY ${STATUS_CHANNEL}`);
}

/** Rewrite legacy slug IDs to ULIDs and keep child table FKs in sync. */
async function migrateMonitorIdsToUlid(
  sql: ReturnType<typeof postgres>,
): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM monitors
  `;
  const stale = rows.filter((row) => !isMonitorUlid(row.id));
  if (stale.length === 0) {
    // Still ensure FKs allow ON UPDATE CASCADE for future safety.
    await ensureMonitorFkCascade(sql);
    return;
  }

  await sql.unsafe(
    `ALTER TABLE monitor_statuses DROP CONSTRAINT IF EXISTS monitor_statuses_monitor_id_fkey`,
  );
  await sql.unsafe(
    `ALTER TABLE alert_states DROP CONSTRAINT IF EXISTS alert_states_monitor_id_fkey`,
  );

  for (const row of stale) {
    const nextId = newMonitorId();
    await sql`UPDATE monitors SET id = ${nextId} WHERE id = ${row.id}`;
    await sql`
      UPDATE monitor_statuses
      SET monitor_id = ${nextId}
      WHERE monitor_id = ${row.id}
    `;
    await sql`
      UPDATE alert_states
      SET monitor_id = ${nextId}
      WHERE monitor_id = ${row.id}
    `;
    await sql`
      UPDATE incidents
      SET monitor_id = ${nextId}
      WHERE monitor_id = ${row.id}
    `;
  }

  await ensureMonitorFkCascade(sql);
}

async function ensureMonitorFkCascade(
  sql: ReturnType<typeof postgres>,
): Promise<void> {
  await sql.unsafe(`
    DO $fk$
    BEGIN
      ALTER TABLE monitor_statuses
        DROP CONSTRAINT IF EXISTS monitor_statuses_monitor_id_fkey;
      ALTER TABLE monitor_statuses
        ADD CONSTRAINT monitor_statuses_monitor_id_fkey
        FOREIGN KEY (monitor_id) REFERENCES monitors(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $fk$;
  `);
  await sql.unsafe(`
    DO $fk$
    BEGIN
      ALTER TABLE alert_states
        DROP CONSTRAINT IF EXISTS alert_states_monitor_id_fkey;
      ALTER TABLE alert_states
        ADD CONSTRAINT alert_states_monitor_id_fkey
        FOREIGN KEY (monitor_id) REFERENCES monitors(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $fk$;
  `);
}

async function migrate(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      url_hash TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE monitors
    ADD COLUMN IF NOT EXISTS sort_order INTEGER
  `;
  await sql`
    ALTER TABLE monitors
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN
  `;
  await sql`
    ALTER TABLE monitors
    ADD COLUMN IF NOT EXISTS url_hash TEXT
  `;
  await sql`
    UPDATE monitors
    SET is_active = TRUE
    WHERE is_active IS NULL
  `;
  await sql`
    ALTER TABLE monitors
    ALTER COLUMN is_active SET DEFAULT TRUE
  `;
  await sql`
    ALTER TABLE monitors
    ALTER COLUMN is_active SET NOT NULL
  `;
  const orderHealth = await sql<{
    has_null: boolean;
    has_dup: boolean;
  }[]>`
    SELECT
      EXISTS (SELECT 1 FROM monitors WHERE sort_order IS NULL) AS has_null,
      EXISTS (
        SELECT 1
        FROM monitors
        WHERE is_active = TRUE
        GROUP BY sort_order
        HAVING COUNT(*) > 1
      ) AS has_dup
  `;
  if (orderHealth[0]?.has_null || orderHealth[0]?.has_dup) {
    await sql`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY created_at ASC, id ASC
          ) AS rn
        FROM monitors
      )
      UPDATE monitors AS m
      SET sort_order = ranked.rn
      FROM ranked
      WHERE m.id = ranked.id
    `;
  }
  await sql`
    ALTER TABLE monitors
    ALTER COLUMN sort_order SET NOT NULL
  `;
  // Soft-delete friendly uniqueness: blind-indexed URL among active rows.
  await sql`
    ALTER TABLE monitors DROP CONSTRAINT IF EXISTS monitors_url_key
  `;
  await sql`DROP INDEX IF EXISTS monitors_url_key`;
  await sql`DROP INDEX IF EXISTS monitors_sort_order_uidx`;
  await sql`DROP INDEX IF EXISTS monitors_url_active_uidx`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS monitors_url_hash_active_uidx
    ON monitors (url_hash)
    WHERE is_active = TRUE AND url_hash IS NOT NULL
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS monitors_sort_order_active_uidx
    ON monitors (sort_order)
    WHERE is_active = TRUE
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS monitors_created_at_idx
    ON monitors (created_at ASC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS monitors_active_idx
    ON monitors (is_active)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS monitor_statuses (
      monitor_id TEXT PRIMARY KEY REFERENCES monitors(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      up BOOLEAN NOT NULL DEFAULT FALSE,
      checked_at TIMESTAMPTZ,
      status_code INTEGER,
      response_time_ms INTEGER,
      error TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS app_summary (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_outage_at TIMESTAMPTZ
    )
  `;
  await sql`
    INSERT INTO app_summary (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      resolved_at TIMESTAMPTZ,
      status_code INTEGER,
      error TEXT
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS incidents_open_idx
    ON incidents (monitor_id)
    WHERE resolved_at IS NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS incidents_activity_idx
    ON incidents (COALESCE(resolved_at, started_at) DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS alert_states (
      monitor_id TEXT PRIMARY KEY REFERENCES monitors(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      consecutive_downs INTEGER NOT NULL DEFAULT 0,
      last_down_alert_at TIMESTAMPTZ
    )
  `;

  await migrateMonitorIdsToUlid(sql);

  await sql`
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      action TEXT NOT NULL,
      actor_user_id BIGINT,
      actor_username TEXT,
      actor_name TEXT,
      entity_type TEXT,
      entity_id TEXT,
      summary TEXT NOT NULL,
      metadata TEXT,
      ip TEXT,
      user_agent TEXT
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS audits_created_at_idx
    ON audits (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS audits_action_idx
    ON audits (action)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS audits_actor_user_id_idx
    ON audits (actor_user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;

  const secretRows = await sql<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = 'session_secret' LIMIT 1
  `;
  if (secretRows.length === 0) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    await sql`
      INSERT INTO app_settings (key, value)
      VALUES ('session_secret', ${secret})
      ON CONFLICT (key) DO NOTHING
    `;
  }

  // users: password = Argon2id; username/name = AES-256-GCM; username_hash = blind index.
  // Recreate if an older column layout is detected.
  const userCols = await sql<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
  `;
  const colSet = new Set(userCols.map((c) => c.column_name));
  const needsNewUsersSchema = colSet.size === 0 ||
    !colSet.has("username_hash") ||
    !colSet.has("username") ||
    !colSet.has("name") ||
    !colSet.has("password") ||
    colSet.has("username_blind") ||
    colSet.has("username_cipher") ||
    colSet.has("name_cipher") ||
    colSet.has("password_hash");

  if (needsNewUsersSchema && colSet.size > 0) {
    await sql`DROP TABLE IF EXISTS users CASCADE`;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      username_hash TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
