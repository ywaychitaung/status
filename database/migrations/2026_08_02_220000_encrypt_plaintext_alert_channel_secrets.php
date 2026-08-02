<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Encrypt any plaintext alert_channels secrets so Laravel `encrypted` casts work.
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $columns = [
        'webhook_url',
        'bot_token',
        'chat_id',
    ];

    public function up(): void
    {
        if (! Schema::hasTable('alert_channels')) {
            return;
        }

        DB::table('alert_channels')->orderBy('id')->chunkById(100, function ($rows): void {
            foreach ($rows as $row) {
                $updates = [];

                foreach ($this->columns as $column) {
                    $value = $row->{$column} ?? null;
                    if (! is_string($value) || $value === '') {
                        continue;
                    }

                    try {
                        Crypt::decryptString($value);

                        continue;
                    } catch (\Throwable) {
                        // Plaintext (or otherwise not Laravel ciphertext).
                    }

                    $updates[$column] = Crypt::encryptString($value);
                }

                if ($updates !== []) {
                    DB::table('alert_channels')->where('id', $row->id)->update($updates);
                }
            }
        });
    }

    public function down(): void
    {
        // Irreversible: leave ciphertext in place.
    }
};
