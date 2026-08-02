<?php

namespace App\Models;

use App\Models\Concerns\ReadsEncryptedAttributes;
use App\Services\FieldCrypto;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;

/**
 * Authenticatable user with Laravel-encrypted identity fields and HMAC
 * blind indexes for username/email login lookups. Sanctum PATs via HasApiTokens.
 *
 * @property int $id
 * @property string $name
 * @property string $username
 * @property string $username_hash
 * @property string $email
 * @property string $email_hash
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $email_verified_at
 */
class User extends Authenticatable
{
    use HasApiTokens, Notifiable, ReadsEncryptedAttributes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'username_hash',
        'email',
        'email_hash',
        'email_verified_at',
        'password',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'username_hash',
        'email_hash',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name' => 'encrypted',
            'username' => 'encrypted',
            'email' => 'encrypted',
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public static function hashIdentity(string $value): string
    {
        return app(FieldCrypto::class)->blindIndex(strtolower(trim($value)));
    }

    /** Find by username or email (blind-index match). */
    public static function findByLogin(string $identifier): ?self
    {
        $hash = static::hashIdentity($identifier);

        return static::query()
            ->where(function ($query) use ($hash): void {
                $query->where('username_hash', $hash)
                    ->orWhere('email_hash', $hash);
            })
            ->first();
    }

    public function setUsernameWithIndex(string $username): void
    {
        $normalized = strtolower(trim($username));
        $this->username = $normalized;
        $this->username_hash = static::hashIdentity($normalized);
    }

    public function setEmailWithIndex(string $email): void
    {
        $normalized = strtolower(trim($email));
        $this->email = $normalized;
        $this->email_hash = static::hashIdentity($normalized);
    }

    /** @return HasMany<Monitor, $this> */
    public function monitors(): HasMany
    {
        return $this->hasMany(Monitor::class);
    }

    /** @return HasMany<AlertChannel, $this> */
    public function alertChannels(): HasMany
    {
        return $this->hasMany(AlertChannel::class);
    }

    /** Shape shared with the front end. */
    public function toAuthUser(): array
    {
        return [
            'id' => (int) $this->id,
            'username' => (string) $this->username,
            'name' => (string) $this->name,
            'email' => (string) $this->email,
        ];
    }
}
