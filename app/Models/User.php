<?php

namespace App\Models;

use App\Casts\EncryptedField;
use App\Services\FieldCrypto;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\User as Authenticatable;

/**
 * Matches the schema written by the legacy Deno app: no email column, the
 * username and name are AES-256-GCM ciphertext, and username_hash is an HMAC
 * blind index used for lookups.
 *
 * @property int $id
 * @property string $username plaintext (decrypted)
 * @property string $username_hash
 * @property string $password argon2id$… or bcrypt ($2y$…) hash
 * @property string $name plaintext (decrypted)
 */
class User extends Authenticatable
{
    protected $table = 'users';

    /**
     * Passwords are hashed by PasswordHasher (argon2id or bcrypt via
     * HASH_DRIVER), so Laravel's "hashed" cast is not used.
     *
     * @var list<string>
     */
    protected $fillable = [
        'username',
        'username_hash',
        'password',
        'name',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'username_hash',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'username' => EncryptedField::class,
            'name' => EncryptedField::class,
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /** The legacy schema has no remember_token column. */
    public function getRememberTokenName(): ?string
    {
        return null;
    }

    /** Set the username together with its blind index. */
    public function setUsernameWithIndex(string $username): void
    {
        $normalized = strtolower(trim($username));

        $this->username = $normalized;
        $this->username_hash = app(FieldCrypto::class)->blindIndex($normalized);
    }

    /** @param  Builder<User>  $query */
    public function scopeWhereUsername(Builder $query, string $username): Builder
    {
        return $query->where(
            'username_hash',
            app(FieldCrypto::class)->blindIndex(strtolower(trim($username)))
        );
    }

    public static function findByUsername(string $username): ?self
    {
        return static::query()->whereUsername($username)->first();
    }

    /** Shape shared with the front end (AuthUser in _legacy/lib/pageTypes.ts). */
    public function toAuthUser(): array
    {
        return [
            'id' => (int) $this->id,
            'username' => (string) $this->username,
            'name' => (string) $this->name,
        ];
    }
}
