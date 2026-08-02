<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Rename monitors → websites and monitor_statuses → website_statuses. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('monitors') && ! Schema::hasTable('websites')) {
            DB::statement('ALTER TABLE monitors RENAME TO websites');
        }

        if (Schema::hasTable('monitor_statuses') && ! Schema::hasTable('website_statuses')) {
            DB::statement('ALTER TABLE monitor_statuses RENAME TO website_statuses');
        }

        $this->renameIndex('monitors_url_hash_active_uidx', 'websites_url_hash_active_uidx');
        $this->renameIndex('monitors_sort_order_active_uidx', 'websites_sort_order_active_uidx');
        $this->renameIndex('monitors_created_at_idx', 'websites_created_at_idx');
        $this->renameIndex('monitors_active_idx', 'websites_active_idx');

        $this->renameConstraint('website_statuses', 'monitor_statuses_monitor_id_fkey', 'website_statuses_monitor_id_fkey');
        $this->repointForeignKey(
            'website_statuses',
            'website_statuses_monitor_id_fkey',
            'monitor_id',
            'websites',
            'id',
        );
        $this->repointForeignKey(
            'alert_states',
            'alert_states_monitor_id_fkey',
            'monitor_id',
            'websites',
            'id',
        );
    }

    public function down(): void
    {
        if (Schema::hasTable('website_statuses') && ! Schema::hasTable('monitor_statuses')) {
            DB::statement('ALTER TABLE website_statuses RENAME TO monitor_statuses');
        }

        if (Schema::hasTable('websites') && ! Schema::hasTable('monitors')) {
            DB::statement('ALTER TABLE websites RENAME TO monitors');
        }

        $this->renameIndex('websites_url_hash_active_uidx', 'monitors_url_hash_active_uidx');
        $this->renameIndex('websites_sort_order_active_uidx', 'monitors_sort_order_active_uidx');
        $this->renameIndex('websites_created_at_idx', 'monitors_created_at_idx');
        $this->renameIndex('websites_active_idx', 'monitors_active_idx');

        $this->renameConstraint('monitor_statuses', 'website_statuses_monitor_id_fkey', 'monitor_statuses_monitor_id_fkey');
        $this->repointForeignKey(
            'monitor_statuses',
            'monitor_statuses_monitor_id_fkey',
            'monitor_id',
            'monitors',
            'id',
        );
        $this->repointForeignKey(
            'alert_states',
            'alert_states_monitor_id_fkey',
            'monitor_id',
            'monitors',
            'id',
        );
    }

    private function renameIndex(string $from, string $to): void
    {
        DB::statement(<<<SQL
            DO \$\$
            BEGIN
              IF EXISTS (SELECT 1 FROM pg_class WHERE relname = '{$from}')
                 AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '{$to}') THEN
                EXECUTE 'ALTER INDEX {$from} RENAME TO {$to}';
              END IF;
            END
            \$\$;
        SQL);
    }

    private function renameConstraint(string $table, string $from, string $to): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        DB::statement(<<<SQL
            DO \$\$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = '{$from}'
              ) AND NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = '{$to}'
              ) THEN
                EXECUTE 'ALTER TABLE {$table} RENAME CONSTRAINT {$from} TO {$to}';
              END IF;
            END
            \$\$;
        SQL);
    }

    private function repointForeignKey(
        string $table,
        string $constraint,
        string $column,
        string $referencesTable,
        string $referencesColumn,
    ): void {
        if (! Schema::hasTable($table) || ! Schema::hasTable($referencesTable)) {
            return;
        }

        DB::statement(<<<SQL
            DO \$fk\$
            BEGIN
              ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$constraint};
              ALTER TABLE {$table}
                ADD CONSTRAINT {$constraint}
                FOREIGN KEY ({$column}) REFERENCES {$referencesTable}({$referencesColumn})
                ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END
            \$fk\$;
        SQL);
    }
};
