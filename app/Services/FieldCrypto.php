<?php

namespace App\Services;

use RuntimeException;

/**
 * HMAC-SHA256 blind indexes for username/email/url lookups.
 * Field values themselves use Laravel's `encrypted` cast / Crypt facade (APP_KEY).
 *
 * Blind indexes are keyed from APP_KEY so no separate ENCRYPTION_KEY is required.
 */
class FieldCrypto
{
    private ?string $rawKey = null;

    /** Raw application key bytes from APP_KEY. */
    public function rawKey(): string
    {
        if ($this->rawKey !== null) {
            return $this->rawKey;
        }

        $key = (string) config('app.key');
        if ($key === '') {
            throw new RuntimeException('APP_KEY is not set. Run: php artisan key:generate');
        }

        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);
            if ($decoded === false || $decoded === '') {
                throw new RuntimeException('APP_KEY is invalid.');
            }

            return $this->rawKey = $decoded;
        }

        return $this->rawKey = $key;
    }

    /** Deterministic blind index so encrypted values can still be looked up / uniqued. */
    public function blindIndex(string $value): string
    {
        return hash_hmac('sha256', 'blind:'.$value, $this->rawKey());
    }
}
