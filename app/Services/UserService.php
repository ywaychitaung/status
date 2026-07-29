<?php

namespace App\Services;

use App\Exceptions\StatusException;
use App\Models\User;
use Illuminate\Database\QueryException;
use Throwable;

/** Port of the user/credential half of _legacy/lib/adminAuth.ts. */
class UserService
{
    public function __construct(
        private readonly FieldCrypto $crypto,
        private readonly PasswordHasher $passwords,
    ) {}

    public function count(): int
    {
        return User::query()->count();
    }

    public function hasUsers(): bool
    {
        return $this->count() > 0;
    }

    public function create(string $name, string $username, string $password): User
    {
        $name = trim($name);
        $username = strtolower(trim($username));

        if ($name === '') {
            throw new StatusException('Name is required');
        }
        if ($username === '') {
            throw new StatusException('Username is required');
        }
        if (strlen($password) < 8) {
            throw new StatusException('Password must be at least 8 characters');
        }

        try {
            return User::query()->create([
                'username' => $username,
                'username_hash' => $this->crypto->blindIndex($username),
                'password' => $this->passwords->hash($password),
                'name' => $name,
            ]);
        } catch (QueryException $error) {
            throw $this->translateUsernameConflict($error);
        }
    }

    /** Insert the default admin when the users table is empty. */
    public function seedAdminIfEmpty(): bool
    {
        if ($this->hasUsers()) {
            return false;
        }

        $seed = config('status.seed_admin');

        $this->create($seed['name'], $seed['username'], $seed['password']);

        return true;
    }

    public function updateAccount(User $user, string $name, string $username): User
    {
        $name = trim($name);
        $username = strtolower(trim($username));

        if ($name === '') {
            throw new StatusException('Name is required');
        }
        if ($username === '') {
            throw new StatusException('Username is required');
        }

        $user->setUsernameWithIndex($username);
        $user->name = $name;

        try {
            $user->save();
        } catch (QueryException $error) {
            throw $this->translateUsernameConflict($error);
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

        if (! $this->passwords->verify($currentPassword, (string) $user->password)) {
            throw new StatusException('Current password is incorrect');
        }

        $user->password = $this->passwords->hash($newPassword);
        $user->save();
    }

    /**
     * @return array{ok: true, user: User}|array{ok: false, reason: string, message: string}
     */
    public function attemptLogin(string $username, string $password): array
    {
        $normalized = strtolower(trim($username));

        if ($normalized === '') {
            return ['ok' => false, 'reason' => 'empty_username', 'message' => 'Username is required'];
        }
        if ($password === '') {
            return ['ok' => false, 'reason' => 'empty_password', 'message' => 'Password is required'];
        }

        $user = User::findByUsername($normalized);

        if ($user === null) {
            return ['ok' => false, 'reason' => 'unknown_user', 'message' => 'Unknown username'];
        }

        if (! $this->passwords->verify($password, (string) $user->password)) {
            return ['ok' => false, 'reason' => 'bad_password', 'message' => 'Incorrect password'];
        }

        if ($this->passwords->needsRehash((string) $user->password)) {
            $user->password = $this->passwords->hash($password);
            $user->save();
        }

        return ['ok' => true, 'user' => $user];
    }

    private function translateUsernameConflict(Throwable $error): Throwable
    {
        $message = $error->getMessage();

        if (str_contains($message, 'users_username_hash_key') || str_contains($message, 'duplicate key')) {
            return new StatusException('Username already exists');
        }

        return $error;
    }
}
