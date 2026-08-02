<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Move auth onto Laravel defaults: remember_token on users, drop app_settings.
 * Existing encrypted/hashed user rows are incompatible with Crypt + Hash, so
 * the users table is cleared and re-seeded by status:seed-admin / first login.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'remember_token')) {
            DB::statement('ALTER TABLE users ADD COLUMN remember_token TEXT NULL');
        }

        // Force re-seed under Laravel Crypt + Hash (legacy FieldCrypto/Argon2 rows won't verify).
        if (Schema::hasTable('users')) {
            DB::table('users')->delete();
        }

        DB::statement('DROP TABLE IF EXISTS app_settings CASCADE');
    }

    public function down(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            )
        SQL);

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'remember_token')) {
            DB::statement('ALTER TABLE users DROP COLUMN remember_token');
        }
    }
};
