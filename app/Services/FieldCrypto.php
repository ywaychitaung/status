<?php

namespace App\Services;

use RuntimeException;

/**
 * HMAC-SHA256 blind indexes for username/email/url lookups.
 * Field values themselves use Laravel's `encrypted` cast / Crypt facade.
 *
 * Requires ENCRYPTION_KEY in the environment (64 hex chars).
 */
class FieldCrypto
{
    private ?string $keyHex = null;

    /** Raw 32-byte key from ENCRYPTION_KEY. */
    public function rawKey(): string
    {
        return hex2bin($this->keyHex());
    }

    public function keyHex(): string
    {
        if ($this->keyHex !== null) {
            return $this->keyHex;
        }

        $fromConfig = trim((string) config('status.encryption_key'));
        if ($fromConfig === '' || ! preg_match('/^[0-9a-fA-F]{64}$/', $fromConfig)) {
            throw new RuntimeException(
                'ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32'
            );
        }

        return $this->keyHex = strtolower($fromConfig);
    }

    /** Deterministic blind index so encrypted values can still be looked up / uniqued. */
    public function blindIndex(string $value): string
    {
        return hash_hmac('sha256', 'blind:'.$value, $this->rawKey());
    }

    /** @deprecated Kept only for the one-time Laravel Crypt re-encrypt migration. */
    public function isEncrypted(string $payload): bool
    {
        return str_starts_with($payload, 'aes256gcm$')
            || str_starts_with($payload, 'v1$');
    }

    /** @deprecated Kept only for the one-time Laravel Crypt re-encrypt migration. */
    public function decrypt(string $payload): string
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

        $ciphertext = substr($data, 0, -16);
        $tag = substr($data, -16);

        $plaintext = openssl_decrypt(
            $ciphertext,
            'aes-256-gcm',
            $this->rawKey(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($plaintext === false) {
            throw new RuntimeException('Field decryption failed');
        }

        return $plaintext;
    }
}
