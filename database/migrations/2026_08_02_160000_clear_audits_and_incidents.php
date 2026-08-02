<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Clear historical audit and incident rows. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('audits')) {
            DB::table('audits')->delete();
        }

        if (Schema::hasTable('incidents')) {
            DB::table('incidents')->delete();
        }
    }

    public function down(): void
    {
        // Data wipe is irreversible.
    }
};
