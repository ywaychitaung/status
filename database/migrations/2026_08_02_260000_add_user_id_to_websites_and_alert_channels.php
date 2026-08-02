<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Scope websites and alert_channels to the owning user so each account
 * only manages its own monitors and notification destinations.
 */
return new class extends Migration
{
    public function up(): void
    {
        $ownerId = DB::table('users')->orderBy('id')->value('id');

        $this->addWebsiteOwnership($ownerId === null ? null : (int) $ownerId);
        $this->addAlertChannelOwnership($ownerId === null ? null : (int) $ownerId);
    }

    public function down(): void
    {
        if (Schema::hasTable('websites') && Schema::hasColumn('websites', 'user_id')) {
            DB::statement('DROP INDEX IF EXISTS websites_url_hash_active_uidx');
            DB::statement('DROP INDEX IF EXISTS websites_sort_order_active_uidx');

            Schema::table('websites', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('user_id');
            });

            DB::statement(<<<'SQL'
                CREATE UNIQUE INDEX IF NOT EXISTS websites_url_hash_active_uidx
                ON websites (url_hash)
                WHERE is_active = TRUE AND url_hash IS NOT NULL
            SQL);
            DB::statement(<<<'SQL'
                CREATE UNIQUE INDEX IF NOT EXISTS websites_sort_order_active_uidx
                ON websites (sort_order)
                WHERE is_active = TRUE
            SQL);
        }

        if (Schema::hasTable('alert_channels') && Schema::hasColumn('alert_channels', 'user_id')) {
            Schema::table('alert_channels', function (Blueprint $table): void {
                $table->dropUnique('alert_channels_user_id_name_unique');
                $table->dropConstrainedForeignId('user_id');
                $table->unique('name');
            });
        }
    }

    private function addWebsiteOwnership(?int $ownerId): void
    {
        if (! Schema::hasTable('websites') || Schema::hasColumn('websites', 'user_id')) {
            return;
        }

        Schema::table('websites', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->cascadeOnDelete();
        });

        if ($ownerId !== null) {
            DB::table('websites')->whereNull('user_id')->update(['user_id' => $ownerId]);
        } else {
            // No users yet — drop orphan rows so NOT NULL can be applied later if needed.
            DB::table('websites')->whereNull('user_id')->delete();
        }

        // Existing installs may still have nulls if users were deleted; remove those.
        DB::table('websites')->whereNull('user_id')->delete();

        DB::statement('ALTER TABLE websites ALTER COLUMN user_id SET NOT NULL');

        DB::statement('DROP INDEX IF EXISTS websites_url_hash_active_uidx');
        DB::statement('DROP INDEX IF EXISTS websites_sort_order_active_uidx');

        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX websites_url_hash_active_uidx
            ON websites (user_id, url_hash)
            WHERE is_active = TRUE AND url_hash IS NOT NULL
        SQL);
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX websites_sort_order_active_uidx
            ON websites (user_id, sort_order)
            WHERE is_active = TRUE
        SQL);

        Schema::table('websites', function (Blueprint $table): void {
            $table->index(['user_id', 'is_active']);
        });
    }

    private function addAlertChannelOwnership(?int $ownerId): void
    {
        if (! Schema::hasTable('alert_channels') || Schema::hasColumn('alert_channels', 'user_id')) {
            return;
        }

        Schema::table('alert_channels', function (Blueprint $table): void {
            $table->dropUnique(['name']);
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->cascadeOnDelete();
        });

        if ($ownerId !== null) {
            DB::table('alert_channels')->whereNull('user_id')->update(['user_id' => $ownerId]);
        } else {
            DB::table('alert_channels')->whereNull('user_id')->delete();
        }

        DB::table('alert_channels')->whereNull('user_id')->delete();

        DB::statement('ALTER TABLE alert_channels ALTER COLUMN user_id SET NOT NULL');

        Schema::table('alert_channels', function (Blueprint $table): void {
            $table->unique(['user_id', 'name']);
        });
    }
};
