<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Re-encrypt legacy FieldCrypto / plaintext columns with Laravel Crypt (APP_KEY).
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
        foreach ($this->tables as [$table, $columns]) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $pk = in_array($table, ['website_statuses', 'monitor_statuses'], true) ? 'monitor_id' : 'id';

            DB::table($table)->orderBy($pk)->chunkById(100, function ($rows) use ($table, $columns, $pk): void {
                foreach ($rows as $row) {
                    $updates = [];

                    foreach ($columns as $column) {
                        $value = $row->{$column} ?? null;
                        $converted = $this->toLaravelEncrypted($value);

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

    private function toLaravelEncrypted(mixed $value): mixed
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

        if ($this->isLegacyEncrypted($value)) {
            return Crypt::encryptString($this->decryptLegacy($value));
        }

        return Crypt::encryptString($value);
    }

    private function isLegacyEncrypted(string $payload): bool
    {
        return str_starts_with($payload, 'aes256gcm$')
            || str_starts_with($payload, 'v1$');
    }

    private function decryptLegacy(string $payload): string
    {
        $parts = explode('$', $payload);
        $version = $parts[0] ?? '';
        $ivHex = $parts[1] ?? '';
        $dataHex = $parts[2] ?? '';

        if (($version !== 'aes256gcm' && $version !== 'v1') || $ivHex === '' || $dataHex === '') {
            throw new RuntimeException('Invalid encrypted field');
        }

        $iv = @hex2bin($ivHex);
        $data = @hex2bin($dataHex);

        if ($iv === false || $data === false || strlen($data) < 16) {
            throw new RuntimeException('Invalid encrypted field');
        }

        $key = (string) config('app.key');
        if (str_starts_with($key, 'base64:')) {
            $key = (string) base64_decode(substr($key, 7), true);
        }

        $plaintext = openssl_decrypt(
            substr($data, 0, -16),
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            substr($data, -16)
        );

        if ($plaintext === false) {
            throw new RuntimeException('Field decryption failed');
        }

        return $plaintext;
    }
};
