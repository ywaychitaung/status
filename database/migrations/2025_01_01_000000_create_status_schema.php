<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
        $this->createWebsites();
        $this->createWebsiteStatuses();
        $this->createAppSummary();
        $this->createIncidents();
        $this->createAlertStates();
        $this->createAudits();
        $this->createUsers();
    }

    /**
     * Intentionally destructive only for tables this app owns end to end; the
     * legacy Deno app shares this database, so dropping is opt-in via rollback.
     */
    public function down(): void
    {
        foreach ([
            'website_statuses',
            'monitor_statuses',
            'alert_states',
            'incidents',
            'audits',
            'app_summary',
            'users',
            'websites',
            'monitors',
        ] as $table) {
            DB::statement("DROP TABLE IF EXISTS {$table} CASCADE");
        }
    }

    private function createWebsites(): void
    {
        // Prefer the current name; keep creating `monitors` only if neither exists
        // so older environments that still expect that table stay compatible until
        // the rename migration runs.
        if (Schema::hasTable('websites') || Schema::hasTable('monitors')) {
            $table = Schema::hasTable('websites') ? 'websites' : 'monitors';
            $this->ensureWebsiteColumns($table);

            return;
        }

        DB::statement(<<<'SQL'
            CREATE TABLE websites (
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

        $this->ensureWebsiteColumns('websites');
    }

    private function ensureWebsiteColumns(string $table): void
    {
        DB::statement("ALTER TABLE {$table} ADD COLUMN IF NOT EXISTS sort_order INTEGER");
        DB::statement("ALTER TABLE {$table} ADD COLUMN IF NOT EXISTS is_active BOOLEAN");
        DB::statement("ALTER TABLE {$table} ADD COLUMN IF NOT EXISTS url_hash TEXT");
        DB::statement("UPDATE {$table} SET is_active = TRUE WHERE is_active IS NULL");
        DB::statement("ALTER TABLE {$table} ALTER COLUMN is_active SET DEFAULT TRUE");
        DB::statement("ALTER TABLE {$table} ALTER COLUMN is_active SET NOT NULL");

        $health = DB::selectOne(<<<SQL
            SELECT
              EXISTS (SELECT 1 FROM {$table} WHERE sort_order IS NULL) AS has_null,
              EXISTS (
                SELECT 1
                FROM {$table}
                WHERE is_active = TRUE
                GROUP BY sort_order
                HAVING COUNT(*) > 1
              ) AS has_dup
        SQL);

        if ($health !== null && ($health->has_null || $health->has_dup)) {
            DB::statement(<<<SQL
                WITH ranked AS (
                  SELECT
                    id,
                    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
                  FROM {$table}
                )
                UPDATE {$table} AS m
                SET sort_order = ranked.rn
                FROM ranked
                WHERE m.id = ranked.id
            SQL);
        }

        DB::statement("ALTER TABLE {$table} ALTER COLUMN sort_order SET NOT NULL");

        $urlHashIndex = $table === 'websites' ? 'websites_url_hash_active_uidx' : 'monitors_url_hash_active_uidx';
        $sortIndex = $table === 'websites' ? 'websites_sort_order_active_uidx' : 'monitors_sort_order_active_uidx';
        $createdIndex = $table === 'websites' ? 'websites_created_at_idx' : 'monitors_created_at_idx';
        $activeIndex = $table === 'websites' ? 'websites_active_idx' : 'monitors_active_idx';

        DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS monitors_url_key");
        DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS websites_url_key");
        DB::statement('DROP INDEX IF EXISTS monitors_url_key');
        DB::statement('DROP INDEX IF EXISTS websites_url_key');
        DB::statement('DROP INDEX IF EXISTS monitors_sort_order_uidx');
        DB::statement('DROP INDEX IF EXISTS monitors_url_active_uidx');
        DB::statement(<<<SQL
            CREATE UNIQUE INDEX IF NOT EXISTS {$urlHashIndex}
            ON {$table} (url_hash)
            WHERE is_active = TRUE AND url_hash IS NOT NULL
        SQL);
        DB::statement(<<<SQL
            CREATE UNIQUE INDEX IF NOT EXISTS {$sortIndex}
            ON {$table} (sort_order)
            WHERE is_active = TRUE
        SQL);
        DB::statement("CREATE INDEX IF NOT EXISTS {$createdIndex} ON {$table} (created_at ASC)");
        DB::statement("CREATE INDEX IF NOT EXISTS {$activeIndex} ON {$table} (is_active)");
    }

    private function createWebsiteStatuses(): void
    {
        $websitesTable = Schema::hasTable('websites') ? 'websites' : 'monitors';
        $statusesTable = Schema::hasTable('website_statuses')
            ? 'website_statuses'
            : (Schema::hasTable('monitor_statuses') ? 'monitor_statuses' : null);

        if ($statusesTable === null) {
            DB::statement(<<<SQL
                CREATE TABLE website_statuses (
                  monitor_id TEXT PRIMARY KEY REFERENCES {$websitesTable}(id)
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
            $statusesTable = 'website_statuses';
        }

        $fkName = $statusesTable === 'website_statuses'
            ? 'website_statuses_monitor_id_fkey'
            : 'monitor_statuses_monitor_id_fkey';

        DB::statement(<<<SQL
            DO \$fk\$
            BEGIN
              ALTER TABLE {$statusesTable}
                DROP CONSTRAINT IF EXISTS monitor_statuses_monitor_id_fkey;
              ALTER TABLE {$statusesTable}
                DROP CONSTRAINT IF EXISTS website_statuses_monitor_id_fkey;
              ALTER TABLE {$statusesTable}
                ADD CONSTRAINT {$fkName}
                FOREIGN KEY (monitor_id) REFERENCES {$websitesTable}(id)
                ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END
            \$fk\$
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
        $websitesTable = Schema::hasTable('websites') ? 'websites' : 'monitors';

        if (! Schema::hasTable('alert_states')) {
            DB::statement(<<<SQL
                CREATE TABLE alert_states (
                  monitor_id TEXT PRIMARY KEY REFERENCES {$websitesTable}(id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                  consecutive_downs INTEGER NOT NULL DEFAULT 0,
                  last_down_alert_at TIMESTAMPTZ
                )
            SQL);
        }

        DB::statement(<<<SQL
            DO \$fk\$
            BEGIN
              ALTER TABLE alert_states
                DROP CONSTRAINT IF EXISTS alert_states_monitor_id_fkey;
              ALTER TABLE alert_states
                ADD CONSTRAINT alert_states_monitor_id_fkey
                FOREIGN KEY (monitor_id) REFERENCES {$websitesTable}(id)
                ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END
            \$fk\$
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

    /**
     * Placeholder users table for fresh installs. Rebuilt to the full Laravel
     * auth shape (email, remember_token, etc.) by a later migration.
     */
    private function createUsers(): void
    {
        if (Schema::hasTable('users')) {
            return;
        }

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->text('name');
            $table->text('username');
            $table->string('username_hash', 64)->unique();
            $table->text('email');
            $table->string('email_hash', 64)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });
    }
};
