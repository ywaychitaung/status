<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $github_installation_id
 * @property int $user_id
 * @property int $github_repo_id
 * @property string $full_name
 * @property string $name
 * @property string $owner_login
 * @property bool $private
 * @property string|null $html_url
 * @property string|null $default_branch
 * @property string $domain_url
 * @property bool $scan_on_push
 */
class GithubRepo extends Model
{
    protected $table = 'github_repos';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'github_installation_id',
        'user_id',
        'github_repo_id',
        'full_name',
        'name',
        'owner_login',
        'private',
        'html_url',
        'default_branch',
        'domain_url',
        'scan_on_push',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'private' => 'boolean',
            'scan_on_push' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<GithubInstallation, $this>
     */
    public function installation(): BelongsTo
    {
        return $this->belongsTo(GithubInstallation::class, 'github_installation_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<SecurityScan, $this>
     */
    public function scans(): HasMany
    {
        return $this->hasMany(SecurityScan::class);
    }

    /** @return array<string, mixed> */
    public function toForm(): array
    {
        return [
            'id' => (int) $this->id,
            'githubRepoId' => (int) $this->github_repo_id,
            'fullName' => (string) $this->full_name,
            'name' => (string) $this->name,
            'ownerLogin' => (string) $this->owner_login,
            'private' => (bool) $this->private,
            'htmlUrl' => (string) ($this->html_url ?? ''),
            'domainUrl' => (string) $this->domain_url,
            'scanOnPush' => (bool) $this->scan_on_push,
        ];
    }
}
