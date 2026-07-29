<?php

namespace App\Services;

use InvalidArgumentException;
use RuntimeException;

/**
 * Password hashing driven by HASH_DRIVER (argon2id|bcrypt).
 *
 * verify() accepts either stored format so users can migrate by logging in
 * or changing their password after the driver switches.
 */
class PasswordHasher
{
    public const DRIVER_ARGON2ID = 'argon2id';

    public const DRIVER_BCRYPT = 'bcrypt';

    public function __construct(
        private readonly Argon2Password $argon2,
    ) {}

    public function driver(): string
    {
        $driver = strtolower((string) config('status.password.hash_driver', self::DRIVER_ARGON2ID));

        return match ($driver) {
            self::DRIVER_BCRYPT => self::DRIVER_BCRYPT,
            self::DRIVER_ARGON2ID => self::DRIVER_ARGON2ID,
            default => throw new InvalidArgumentException(
                "Unsupported HASH_DRIVER [{$driver}]. Use argon2id or bcrypt."
            ),
        };
    }

    public function hash(string $password): string
    {
        return match ($this->driver()) {
            self::DRIVER_BCRYPT => $this->hashBcrypt($password),
            default => $this->argon2->hash($password),
        };
    }

    public function verify(string $password, string $stored): bool
    {
        if ($password === '' || $stored === '') {
            return false;
        }

        if ($this->isArgon2id($stored)) {
            return $this->argon2->verify($password, $stored);
        }

        if ($this->isBcrypt($stored)) {
            return password_verify($password, $stored);
        }

        return false;
    }

    /** True when the stored hash should be upgraded to the active driver/params. */
    public function needsRehash(string $stored): bool
    {
        return match ($this->driver()) {
            self::DRIVER_BCRYPT => ! $this->isBcrypt($stored)
                || password_needs_rehash($stored, PASSWORD_BCRYPT, $this->bcryptOptions()),
            default => ! $this->isArgon2id($stored) || $this->argon2->needsRehash($stored),
        };
    }

    private function hashBcrypt(string $password): string
    {
        $hash = password_hash($password, PASSWORD_BCRYPT, $this->bcryptOptions());

        if ($hash === false) {
            throw new RuntimeException('Failed to hash password with bcrypt.');
        }

        return $hash;
    }

    /** @return array{cost: int} */
    private function bcryptOptions(): array
    {
        $rounds = (int) config('status.password.bcrypt_rounds', 12);

        return ['cost' => max(4, min(31, $rounds))];
    }

    private function isArgon2id(string $stored): bool
    {
        return str_starts_with($stored, 'argon2id$');
    }

    private function isBcrypt(string $stored): bool
    {
        return (bool) preg_match('/^\$2[aby]\$/', $stored);
    }
}
