<?php

namespace App\Models;

use App\Support\DashboardDatetime;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $github_repo_id
 * @property string $source
 * @property string|null $repo_full_name
 * @property string|null $commit_sha
 * @property string|null $commit_message
 * @property string|null $pusher_login
 * @property string $domain_url
 * @property string $status
 * @property string $summary
 * @property array<string, mixed> $details
 * @property Carbon $scanned_at
 */
class SecurityScan extends Model
{
    public const STATUS_PASS = 'pass';

    public const STATUS_WARN = 'warn';

    public const STATUS_FAIL = 'fail';

    protected $table = 'github_security_scans';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'github_repo_id',
        'source',
        'repo_full_name',
        'commit_sha',
        'commit_message',
        'pusher_login',
        'domain_url',
        'status',
        'summary',
        'details',
        'scanned_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'details' => 'array',
            'scanned_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<GithubRepo, $this>
     */
    public function repo(): BelongsTo
    {
        return $this->belongsTo(GithubRepo::class, 'github_repo_id');
    }

    /** @return array<string, mixed> */
    public function toArrayForUi(): array
    {
        return [
            'id' => (int) $this->id,
            'source' => (string) $this->source,
            'repoFullName' => (string) ($this->repo_full_name ?? ''),
            'commitSha' => (string) ($this->commit_sha ?? ''),
            'commitMessage' => (string) ($this->commit_message ?? ''),
            'pusherLogin' => (string) ($this->pusher_login ?? ''),
            'domainUrl' => (string) $this->domain_url,
            'status' => (string) $this->status,
            'summary' => (string) $this->summary,
            'details' => $this->details ?? [],
            'scannedAt' => DashboardDatetime::format($this->scanned_at?->toIso8601String() ?? now()->toIso8601String()),
            'scannedAtIso' => $this->scanned_at?->toIso8601String(),
        ];
    }
}
