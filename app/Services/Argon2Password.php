<?php

namespace App\Services;

use RuntimeException;

/**
 * Argon2id hashing in the legacy Deno string format so existing users can
 * still sign in (_legacy/lib/adminAuth.ts).
 *
 * Stored format: argon2id$m=19456,t=2,p=1$saltHex$hashHex
 *
 * libsodium's crypto_pwhash produces byte-identical output to @noble/hashes
 * argon2id for these parameters (Argon2id v1.3, lanes = 1).
 */
class Argon2Password
{
    /** OWASP Argon2id (interactive) parameters used by the legacy app. */
    private const MEMORY_KIB = 19456;

    private const ITERATIONS = 2;

    private const PARALLELISM = 1;

    private const KEY_LENGTH = 32;

    private const SALT_BYTES = 16;

    public function hash(string $password): string
    {
        $salt = random_bytes(self::SALT_BYTES);

        $hash = $this->derive(
            $password,
            $salt,
            self::MEMORY_KIB,
            self::ITERATIONS,
            self::PARALLELISM,
            self::KEY_LENGTH
        );

        return sprintf(
            'argon2id$m=%d,t=%d,p=%d$%s$%s',
            self::MEMORY_KIB,
            self::ITERATIONS,
            self::PARALLELISM,
            bin2hex($salt),
            bin2hex($hash)
        );
    }

    public function verify(string $password, string $stored): bool
    {
        // Stored hashes always come from passwords of 8+ characters, so an empty
        // candidate can never match; short-circuiting also keeps libsodium from
        // emitting a warning.
        if ($password === '') {
            return false;
        }

        $parts = explode('$', $stored);
        $algo = $parts[0] ?? '';
        $params = $parts[1] ?? '';
        $saltHex = $parts[2] ?? '';
        $hashHex = $parts[3] ?? '';

        if ($algo !== 'argon2id' || $params === '' || $saltHex === '' || $hashHex === '') {
            return false;
        }

        $memory = $this->param($params, 'm');
        $iterations = $this->param($params, 't');
        $parallelism = $this->param($params, 'p');

        if ($memory === null || $iterations === null || $parallelism === null) {
            return false;
        }

        $salt = @hex2bin($saltHex);
        if ($salt === false || strlen($hashHex) % 2 !== 0) {
            return false;
        }

        try {
            $computed = $this->derive(
                $password,
                $salt,
                $memory,
                $iterations,
                $parallelism,
                intdiv(strlen($hashHex), 2)
            );
        } catch (RuntimeException) {
            return false;
        }

        return hash_equals($hashHex, bin2hex($computed));
    }

    /** True when the stored hash should be upgraded to the current parameters. */
    public function needsRehash(string $stored): bool
    {
        $parts = explode('$', $stored);

        if (($parts[0] ?? '') !== 'argon2id') {
            return true;
        }

        return $this->param($parts[1] ?? '', 'm') !== self::MEMORY_KIB
            || $this->param($parts[1] ?? '', 't') !== self::ITERATIONS
            || $this->param($parts[1] ?? '', 'p') !== self::PARALLELISM;
    }

    private function param(string $params, string $key): ?int
    {
        if (! preg_match('/'.preg_quote($key, '/').'=(\d+)/', $params, $matches)) {
            return null;
        }

        $value = (int) $matches[1];

        return $value > 0 ? $value : null;
    }

    private function derive(
        string $password,
        string $salt,
        int $memoryKib,
        int $iterations,
        int $parallelism,
        int $length
    ): string {
        if (! extension_loaded('sodium')) {
            throw new RuntimeException('The sodium extension is required for Argon2id password hashing.');
        }

        // libsodium's Argon2id is single-lane only; the legacy app always used p=1.
        if ($parallelism !== 1) {
            throw new RuntimeException('Only Argon2id with p=1 is supported.');
        }

        if (strlen($salt) !== SODIUM_CRYPTO_PWHASH_SALTBYTES) {
            throw new RuntimeException('Argon2id salt must be '.SODIUM_CRYPTO_PWHASH_SALTBYTES.' bytes.');
        }

        return sodium_crypto_pwhash(
            $length,
            $password,
            $salt,
            $iterations,
            $memoryKib * 1024,
            SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13
        );
    }
}
