<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * AES-256-GCM field encryption and HMAC-SHA256 blind indexes, wire-compatible
 * with the legacy Deno implementation (_legacy/lib/cryptoFields.ts).
 *
 * Ciphertext layout: aes256gcm$ivHex$ciphertextHex
 * where ciphertextHex is the WebCrypto AES-GCM output, i.e. ciphertext || tag.
 */
class FieldCrypto
{
    /** Ciphertext prefix for AES-256-GCM field encryption. */
    public const CIPHER_VERSION = 'aes256gcm';

    private const SETTINGS_ENCRYPTION_KEY = 'encryption_key';

    private const CIPHER = 'aes-256-gcm';

    private const IV_BYTES = 12;

    private const TAG_BYTES = 16;

    private ?string $keyHex = null;

    /**
     * Raw 32-byte key. Prefers ENCRYPTION_KEY, otherwise falls back to the
     * app_settings row so an existing Deno database keeps working.
     */
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
        if ($fromConfig !== '') {
            if (! preg_match('/^[0-9a-fA-F]{64}$/', $fromConfig)) {
                throw new RuntimeException(
                    'ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256. Generate with: openssl rand -hex 32'
                );
            }

            return $this->keyHex = strtolower($fromConfig);
        }

        return $this->keyHex = $this->keyHexFromSettings();
    }

    private function keyHexFromSettings(): string
    {
        $existing = DB::table('app_settings')
            ->where('key', self::SETTINGS_ENCRYPTION_KEY)
            ->value('value');

        if (is_string($existing) && preg_match('/^[0-9a-fA-F]{64}$/', $existing)) {
            return strtolower($existing);
        }

        $generated = bin2hex(random_bytes(32));

        DB::insertOrIgnore('app_settings', [
            'key' => self::SETTINGS_ENCRYPTION_KEY,
            'value' => $generated,
        ]);

        $again = DB::table('app_settings')
            ->where('key', self::SETTINGS_ENCRYPTION_KEY)
            ->value('value');

        return strtolower(is_string($again) && $again !== '' ? $again : $generated);
    }

    /** Deterministic blind index so encrypted values can still be looked up / uniqued. */
    public function blindIndex(string $value): string
    {
        return hash_hmac('sha256', 'blind:'.$value, $this->rawKey());
    }

    public function isEncrypted(string $payload): bool
    {
        return str_starts_with($payload, self::CIPHER_VERSION.'$')
            || str_starts_with($payload, 'v1$');
    }

    /** Encrypt a field with AES-256-GCM. Stored as aes256gcm$iv$ciphertext. */
    public function encrypt(string $plaintext): string
    {
        $iv = random_bytes(self::IV_BYTES);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $this->rawKey(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_BYTES
        );

        if ($ciphertext === false) {
            throw new RuntimeException('Field encryption failed');
        }

        return self::CIPHER_VERSION.'$'.bin2hex($iv).'$'.bin2hex($ciphertext.$tag);
    }

    public function decrypt(string $payload): string
    {
        $parts = explode('$', $payload);
        $version = $parts[0] ?? '';
        $ivHex = $parts[1] ?? '';
        $dataHex = $parts[2] ?? '';

        if (($version !== self::CIPHER_VERSION && $version !== 'v1') || $ivHex === '' || $dataHex === '') {
            throw new RuntimeException('Invalid encrypted field');
        }

        $iv = @hex2bin($ivHex);
        $data = @hex2bin($dataHex);

        if ($iv === false || $data === false || strlen($data) < self::TAG_BYTES) {
            throw new RuntimeException('Invalid encrypted field');
        }

        $ciphertext = substr($data, 0, -self::TAG_BYTES);
        $tag = substr($data, -self::TAG_BYTES);

        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER,
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

    /** Decrypt when ciphertext; pass through legacy plaintext. */
    public function decryptMaybe(string $payload): string
    {
        if (! $this->isEncrypted($payload)) {
            return $payload;
        }

        return $this->decrypt($payload);
    }

    public function encryptNullable(?string $value): ?string
    {
        return $value === null ? null : $this->encrypt($value);
    }

    public function decryptNullable(?string $value): ?string
    {
        return $value === null ? null : $this->decryptMaybe($value);
    }
}
