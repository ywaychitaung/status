<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property int $installation_id
 * @property string|null $account_login
 * @property string|null $account_type
 * @property string|null $account_avatar_url
 */
class GithubInstallation extends Model
{
    protected $table = 'github_installations';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'installation_id',
        'account_login',
        'account_type',
        'account_avatar_url',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<GithubRepo, $this>
     */
    public function repos(): HasMany
    {
        return $this->hasMany(GithubRepo::class);
    }
}
