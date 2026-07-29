<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Mirrors the schema the legacy Deno app created at boot (_legacy/lib/db.ts).
 *
 * Every statement is idempotent because the production database already holds
 * the Deno tables and data; running this migration against it must be a no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->createMonitors();
        $this->createMonitorStatuses();
        $this->createAppSummary();
        $this->createIncidents();
        $this->createAlertStates();
        $this->createAudits();
        $this->createAppSettings();
        $this->createUsers();
    }

    /**
     * Intentionally destructive only for tables this app owns end to end; the
     * legacy Deno app shares this database, so dropping is opt-in via rollback.
     */
    public function down(): void
    {
        foreach ([
            'monitor_statuses',
            'alert_states',
            'incidents',
            'audits',
            'app_summary',
            'app_settings',
            'users',
            'monitors',
        ] as $table) {
            DB::statement("DROP TABLE IF EXISTS {$table} CASCADE");
        }
    }

    private function createMonitors(): void
    {
        DB::statement(<<<'SQL'
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
        SQL);

        DB::statement('ALTER TABLE monitors ADD COLUMN IF NOT EXISTS sort_order INTEGER');
        DB::statement('ALTER TABLE monitors ADD COLUMN IF NOT EXISTS is_active BOOLEAN');
        DB::statement('ALTER TABLE monitors ADD COLUMN IF NOT EXISTS url_hash TEXT');
        DB::statement('UPDATE monitors SET is_active = TRUE WHERE is_active IS NULL');
        DB::statement('ALTER TABLE monitors ALTER COLUMN is_active SET DEFAULT TRUE');
        DB::statement('ALTER TABLE monitors ALTER COLUMN is_active SET NOT NULL');

        $health = DB::selectOne(<<<'SQL'
            SELECT
              EXISTS (SELECT 1 FROM monitors WHERE sort_order IS NULL) AS has_null,
              EXISTS (
                SELECT 1
                FROM monitors
                WHERE is_active = TRUE
                GROUP BY sort_order
                HAVING COUNT(*) > 1
              ) AS has_dup
        SQL);

        if ($health !== null && ($health->has_null || $health->has_dup)) {
            DB::statement(<<<'SQL'
                WITH ranked AS (
                  SELECT
                    id,
                    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
                  FROM monitors
                )
                UPDATE monitors AS m
                SET sort_order = ranked.rn
                FROM ranked
                WHERE m.id = ranked.id
            SQL);
        }

        DB::statement('ALTER TABLE monitors ALTER COLUMN sort_order SET NOT NULL');

        // Soft-delete friendly uniqueness: blind-indexed URL among active rows.
        DB::statement('ALTER TABLE monitors DROP CONSTRAINT IF EXISTS monitors_url_key');
        DB::statement('DROP INDEX IF EXISTS monitors_url_key');
        DB::statement('DROP INDEX IF EXISTS monitors_sort_order_uidx');
        DB::statement('DROP INDEX IF EXISTS monitors_url_active_uidx');
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX IF NOT EXISTS monitors_url_hash_active_uidx
            ON monitors (url_hash)
            WHERE is_active = TRUE AND url_hash IS NOT NULL
        SQL);
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX IF NOT EXISTS monitors_sort_order_active_uidx
            ON monitors (sort_order)
            WHERE is_active = TRUE
        SQL);
        DB::statement('CREATE INDEX IF NOT EXISTS monitors_created_at_idx ON monitors (created_at ASC)');
        DB::statement('CREATE INDEX IF NOT EXISTS monitors_active_idx ON monitors (is_active)');
    }

    private function createMonitorStatuses(): void
    {
        DB::statement(<<<'SQL'
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
        SQL);

        DB::statement(<<<'SQL'
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
            $fk$
        SQL);
    }

    private function createAppSummary(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS app_summary (
              id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              last_outage_at TIMESTAMPTZ
            )
        SQL);

        DB::statement('INSERT INTO app_summary (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
    }

    private function createIncidents(): void
    {
        DB::statement(<<<'SQL'
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
        SQL);

        DB::statement(<<<'SQL'
            CREATE INDEX IF NOT EXISTS incidents_open_idx
            ON incidents (monitor_id)
            WHERE resolved_at IS NULL
        SQL);
        DB::statement(<<<'SQL'
            CREATE INDEX IF NOT EXISTS incidents_activity_idx
            ON incidents (COALESCE(resolved_at, started_at) DESC)
        SQL);
    }

    private function createAlertStates(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS alert_states (
              monitor_id TEXT PRIMARY KEY REFERENCES monitors(id)
                ON DELETE CASCADE ON UPDATE CASCADE,
              consecutive_downs INTEGER NOT NULL DEFAULT 0,
              last_down_alert_at TIMESTAMPTZ
            )
        SQL);

        DB::statement(<<<'SQL'
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
            $fk$
        SQL);
    }

    private function createAudits(): void
    {
        DB::statement(<<<'SQL'
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
        SQL);

        DB::statement('CREATE INDEX IF NOT EXISTS audits_created_at_idx ON audits (created_at DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS audits_action_idx ON audits (action)');
        DB::statement('CREATE INDEX IF NOT EXISTS audits_actor_user_id_idx ON audits (actor_user_id)');
    }

    private function createAppSettings(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            )
        SQL);
    }

    /**
     * users: password = Argon2id; username/name = AES-256-GCM;
     * username_hash = blind index. Existing rows are left untouched.
     */
    private function createUsers(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS users (
              id BIGSERIAL PRIMARY KEY,
              username TEXT NOT NULL,
              username_hash TEXT NOT NULL UNIQUE,
              password TEXT NOT NULL,
              name TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        SQL);
    }
};
