<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Store ZAP alert severity counts as Laravel Crypt ciphertext (text columns).
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $columns = [
        'alert_high',
        'alert_medium',
        'alert_low',
        'alert_info',
    ];

    public function up(): void
    {
        if (! Schema::hasTable('security_scans')) {
            return;
        }

        foreach ($this->columns as $column) {
            if (! Schema::hasColumn('security_scans', $column)) {
                continue;
            }

            DB::statement("ALTER TABLE security_scans ALTER COLUMN {$column} TYPE text USING {$column}::text");
            DB::statement("ALTER TABLE security_scans ALTER COLUMN {$column} DROP DEFAULT");
        }

        DB::table('security_scans')->orderBy('id')->chunkById(50, function ($rows): void {
            foreach ($rows as $row) {
                $updates = [];

                foreach ($this->columns as $column) {
                    $value = $row->{$column} ?? null;
                    if ($value === null || $value === '') {
                        $updates[$column] = Crypt::encryptString('0');

                        continue;
                    }

                    if (is_string($value) && $this->looksEncrypted($value)) {
                        continue;
                    }

                    $updates[$column] = Crypt::encryptString((string) max(0, (int) $value));
                }

                if ($updates !== []) {
                    DB::table('security_scans')->where('id', $row->id)->update($updates);
                }
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('security_scans')) {
            return;
        }

        DB::table('security_scans')->orderBy('id')->chunkById(50, function ($rows): void {
            foreach ($rows as $row) {
                $updates = [];

                foreach ($this->columns as $column) {
                    $value = $row->{$column} ?? null;
                    if (! is_string($value) || $value === '') {
                        $updates[$column] = '0';

                        continue;
                    }

                    try {
                        $updates[$column] = (string) max(0, (int) Crypt::decryptString($value));
                    } catch (Throwable) {
                        $updates[$column] = (string) max(0, (int) $value);
                    }
                }

                if ($updates !== []) {
                    DB::table('security_scans')->where('id', $row->id)->update($updates);
                }
            }
        });

        foreach ($this->columns as $column) {
            if (! Schema::hasColumn('security_scans', $column)) {
                continue;
            }

            DB::statement("ALTER TABLE security_scans ALTER COLUMN {$column} TYPE integer USING GREATEST({$column}::integer, 0)");
            DB::statement("ALTER TABLE security_scans ALTER COLUMN {$column} SET DEFAULT 0");
        }
    }

    private function looksEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);

            return true;
        } catch (Throwable) {
            return false;
        }
    }
};
