<?php

namespace App\Services;

use App\Exceptions\StatusException;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Hash;
use Throwable;

/** User credentials + account updates (encrypted identity + Hash passwords). */
class UserService
{
    public function count(): int
    {
        return User::query()->count();
    }

    public function hasUsers(): bool
    {
        return $this->count() > 0;
    }

    public function create(string $name, string $username, string $password, ?string $email = null): User
    {
        $name = trim($name);
        $username = strtolower(trim($username));
        $email = strtolower(trim((string) ($email ?? "{$username}@status.local")));

        if ($name === '') {
            throw new StatusException('Name is required');
        }
        if ($username === '') {
            throw new StatusException('Username is required');
        }
        if (! $this->isValidEmail($email)) {
            throw new StatusException('A valid email is required');
        }
        if (strlen($password) < 8) {
            throw new StatusException('Password must be at least 8 characters');
        }

        try {
            return User::query()->create([
                'name' => $name,
                'username' => $username,
                'username_hash' => User::hashIdentity($username),
                'email' => $email,
                'email_hash' => User::hashIdentity($email),
                'email_verified_at' => now(),
                'password' => $password,
            ]);
        } catch (QueryException $error) {
            throw $this->translateUniqueConflict($error);
        }
    }

    /** Insert the default admin when the users table is empty. */
    public function seedAdminIfEmpty(): bool
    {
        if ($this->hasUsers()) {
            return false;
        }

        $seed = config('status.seed_admin');

        $this->create(
            $seed['name'],
            $seed['username'],
            $seed['password'],
            $seed['email'] ?? null,
        );

        return true;
    }

    public function updateAccount(User $user, string $name, string $username, string $email): User
    {
        $name = trim($name);
        $username = strtolower(trim($username));
        $email = strtolower(trim($email));

        if ($name === '') {
            throw new StatusException('Name is required');
        }
        if ($username === '') {
            throw new StatusException('Username is required');
        }
        if (! $this->isValidEmail($email)) {
            throw new StatusException('A valid email is required');
        }

        $user->name = $name;
        $user->setUsernameWithIndex($username);
        $user->setEmailWithIndex($email);

        try {
            $user->save();
        } catch (QueryException $error) {
            throw $this->translateUniqueConflict($error);
        }

        return $user;
    }

    public function changePassword(
        User $user,
        string $currentPassword,
        string $newPassword,
        string $confirmPassword
    ): void {
        if ($currentPassword === '') {
            throw new StatusException('Current password is required');
        }
        if (strlen($newPassword) < 8) {
            throw new StatusException('New password must be at least 8 characters');
        }
        if ($newPassword !== $confirmPassword) {
            throw new StatusException('New password and confirmation do not match');
        }
        if ($newPassword === $currentPassword) {
            throw new StatusException('New password must be different from the current one');
        }

        if (! Hash::check($currentPassword, (string) $user->password)) {
            throw new StatusException('Current password is incorrect');
        }

        $user->password = $newPassword;
        $user->save();
    }

    /**
     * Resolve login via username_hash or email_hash, then verify password.
     *
     * @return array{user: User}|array{ok: false, reason: string, message: string}
     */
    public function authenticate(string $identifier, string $password): array
    {
        $normalized = strtolower(trim($identifier));

        if ($normalized === '') {
            return ['ok' => false, 'reason' => 'empty_username', 'message' => 'Username or email is required'];
        }
        if ($password === '') {
            return ['ok' => false, 'reason' => 'empty_password', 'message' => 'Password is required'];
        }

        $user = User::findByLogin($normalized);

        if ($user === null || ! Hash::check($password, (string) $user->password)) {
            return ['ok' => false, 'reason' => 'auth_failed', 'message' => 'Incorrect password or username'];
        }

        return ['user' => $user];
    }

    public function isValidEmail(string $email): bool
    {
        return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    private function translateUniqueConflict(Throwable $error): Throwable
    {
        $message = $error->getMessage();

        if (
            str_contains($message, 'users_username_hash_unique')
            || str_contains($message, 'users_email_hash_unique')
            || str_contains($message, 'username_hash')
            || str_contains($message, 'email_hash')
            || str_contains($message, 'duplicate key')
        ) {
            return new StatusException('Username or email already exists');
        }

        return $error;
    }
}
