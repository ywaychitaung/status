<?php

namespace App\Models\Concerns;

use App\Services\FieldCrypto;
use Illuminate\Contracts\Encryption\DecryptException;

/**
 * Laravel `encrypted` cast reads, with tolerance for empty values and legacy
 * FieldCrypto (aes256gcm$) ciphertext until every row is re-encrypted.
 */
trait ReadsEncryptedAttributes
{
    public function fromEncryptedString($value)
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return parent::fromEncryptedString($value);
        } catch (DecryptException $error) {
            $crypto = app(FieldCrypto::class);

            if ($crypto->isEncrypted((string) $value)) {
                return $crypto->decrypt((string) $value);
            }

            throw $error;
        }
    }
}
