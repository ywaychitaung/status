<?php

namespace App\Models;

use App\Support\DashboardDatetime;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Tracks a manual or scheduled OWASP ZAP batch scan.
 *
 * @property int $id
 * @property int|null $user_id
 * @property bool $is_active
 * @property string $status
 * @property int $monitors_total
 * @property int $monitors_completed
 * @property Carbon $started_at
 * @property Carbon|null $finished_at
 * @property string|null $error
 */
class ZapScanRun extends Model
{
    public const STATUS_RUNNING = 'running';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    protected $table = 'zap_scan_runs';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'is_active',
        'status',
        'monitors_total',
        'monitors_completed',
        'started_at',
        'finished_at',
        'error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'monitors_total' => 'integer',
            'monitors_completed' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function markCompleted(): void
    {
        $this->forceFill([
            'is_active' => false,
            'status' => self::STATUS_COMPLETED,
            'finished_at' => now(),
            'error' => null,
        ])->save();
    }

    public function markFailed(string $message): void
    {
        $this->forceFill([
            'is_active' => false,
            'status' => self::STATUS_FAILED,
            'finished_at' => now(),
            'error' => $message,
        ])->save();
    }

    /** @return array<string, mixed> */
    public function toArrayForUi(): array
    {
        $total = max(0, (int) $this->monitors_total);
        $completed = max(0, (int) $this->monitors_completed);
        $progressPercent = $total > 0
            ? (int) min(100, round(($completed / $total) * 100))
            : ($this->status === self::STATUS_COMPLETED ? 100 : 0);

        if ($this->status === self::STATUS_COMPLETED) {
            $progressPercent = 100;
        }

        return [
            'id' => (int) $this->id,
            'userId' => $this->user_id === null ? null : (int) $this->user_id,
            'isActive' => (bool) $this->is_active,
            'status' => (string) $this->status,
            'monitorsTotal' => $total,
            'monitorsCompleted' => $completed,
            'progressPercent' => $progressPercent,
            'startedAt' => DashboardDatetime::format($this->started_at?->toIso8601String() ?? now()->toIso8601String()),
            'startedAtIso' => $this->started_at?->toIso8601String(),
            'finishedAt' => $this->finished_at === null
                ? null
                : DashboardDatetime::format($this->finished_at->toIso8601String()),
            'finishedAtIso' => $this->finished_at?->toIso8601String(),
            'error' => $this->error,
        ];
    }
}
