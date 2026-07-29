<?php

namespace App\Casts;

use App\Services\FieldCrypto;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Transparently decrypts AES-256-GCM field ciphertext on read and encrypts on
 * write, tolerating legacy plaintext rows.
 *
 * @implements CastsAttributes<string|null, string|null>
 */
class EncryptedField implements CastsAttributes
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return app(FieldCrypto::class)->decryptMaybe((string) $value);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return app(FieldCrypto::class)->encrypt((string) $value);
    }
}
