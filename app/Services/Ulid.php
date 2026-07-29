<?php

namespace App\Services;

/**
 * Crockford Base32 ULID generator, matching the ids written by the legacy
 * Deno app via @std/ulid (_legacy/lib/monitor.ts).
 */
class Ulid
{
    private const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    private const TIME_LENGTH = 10;

    private const RANDOM_LENGTH = 16;

    private const PATTERN = '/^[0-9A-HJKMNP-TV-Z]{26}$/';

    public static function generate(?int $milliseconds = null): string
    {
        $milliseconds ??= (int) floor(microtime(true) * 1000);

        return self::encodeTime($milliseconds).self::encodeRandom();
    }

    public static function isUlid(string $value): bool
    {
        return (bool) preg_match(self::PATTERN, $value);
    }

    private static function encodeTime(int $milliseconds): string
    {
        $out = '';

        for ($i = 0; $i < self::TIME_LENGTH; $i++) {
            $out = self::ALPHABET[$milliseconds % 32].$out;
            $milliseconds = intdiv($milliseconds, 32);
        }

        return $out;
    }

    private static function encodeRandom(): string
    {
        $out = '';

        for ($i = 0; $i < self::RANDOM_LENGTH; $i++) {
            $out .= self::ALPHABET[random_int(0, 31)];
        }

        return $out;
    }
}
