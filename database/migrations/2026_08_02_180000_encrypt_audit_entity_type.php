<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Encrypt existing audits.entity_type values with Laravel Crypt. */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('audits')) {
            return;
        }

        DB::table('audits')->orderBy('id')->chunkById(100, function ($rows): void {
            foreach ($rows as $row) {
                $value = $row->entity_type ?? null;
                if (! is_string($value) || $value === '') {
                    continue;
                }

                try {
                    Crypt::decryptString($value);

                    continue;
                } catch (\Throwable) {
                    // Not Laravel ciphertext yet.
                }

                DB::table('audits')->where('id', $row->id)->update([
                    'entity_type' => Crypt::encryptString($value),
                ]);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('audits')) {
            return;
        }

        DB::table('audits')->orderBy('id')->chunkById(100, function ($rows): void {
            foreach ($rows as $row) {
                $value = $row->entity_type ?? null;
                if (! is_string($value) || $value === '') {
                    continue;
                }

                try {
                    $plain = Crypt::decryptString($value);
                } catch (\Throwable) {
                    continue;
                }

                DB::table('audits')->where('id', $row->id)->update([
                    'entity_type' => $plain,
                ]);
            }
        });
    }
};
