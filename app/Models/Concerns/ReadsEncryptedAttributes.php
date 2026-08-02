<?php

namespace App\Models\Concerns;

/**
 * Laravel `encrypted` cast reads, with tolerance for empty values.
 */
trait ReadsEncryptedAttributes
{
    public function fromEncryptedString(mixed $value): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        return parent::fromEncryptedString($value);
    }
}
