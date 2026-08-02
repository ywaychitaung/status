<?php

use App\Services\FieldCrypto;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Re-encrypt FieldCrypto / plaintext columns with Laravel Crypt (APP_KEY).
 */
return new class extends Migration
{
    /** @var list<array{0: string, 1: list<string>}> */
    private array $tables = [
        ['websites', ['name', 'url']],
        ['monitors', ['name', 'url']],
        ['website_statuses', ['name', 'url', 'error']],
        ['monitor_statuses', ['name', 'url', 'error']],
        ['incidents', ['name', 'url', 'error']],
        ['audits', ['actor_username', 'actor_name', 'summary', 'metadata', 'ip', 'user_agent']],
    ];

    public function up(): void
    {
        $legacy = app(FieldCrypto::class);

        foreach ($this->tables as [$table, $columns]) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $pk = in_array($table, ['website_statuses', 'monitor_statuses'], true) ? 'monitor_id' : 'id';

            DB::table($table)->orderBy($pk)->chunkById(100, function ($rows) use ($table, $columns, $pk, $legacy): void {
                foreach ($rows as $row) {
                    $updates = [];

                    foreach ($columns as $column) {
                        $value = $row->{$column} ?? null;
                        $converted = $this->toLaravelEncrypted($value, $legacy);

                        if ($converted !== $value) {
                            $updates[$column] = $converted;
                        }
                    }

                    if ($updates !== []) {
                        DB::table($table)->where($pk, $row->{$pk})->update($updates);
                    }
                }
            }, $pk);
        }
    }

    public function down(): void
    {
        // Irreversible: ciphertext is Laravel Crypt after this migration.
    }

    private function toLaravelEncrypted(mixed $value, FieldCrypto $legacy): mixed
    {
        if ($value === null || $value === '') {
            return $value;
        }

        if (! is_string($value)) {
            return $value;
        }

        try {
            Crypt::decryptString($value);

            return $value;
        } catch (\Throwable) {
            // Not Laravel ciphertext yet.
        }

        if ($legacy->isEncrypted($value)) {
            return Crypt::encryptString($legacy->decrypt($value));
        }

        return Crypt::encryptString($value);
    }
};
