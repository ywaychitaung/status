<?php

namespace App\Models;

use App\Models\Concerns\ReadsEncryptedAttributes;
use App\Support\DashboardDatetime;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * OWASP ZAP scan result for a monitored website.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string|null $monitor_id
 * @property string $source
 * @property string $engine
 * @property string|null $monitor_name plaintext (decrypted)
 * @property string $domain_url plaintext (decrypted)
 * @property string $status
 * @property string $summary plaintext (decrypted)
 * @property array<string, mixed> $details plaintext (decrypted)
 * @property int $alert_high
 * @property int $alert_medium
 * @property int $alert_low
 * @property int $alert_info
 * @property int|null $exit_code
 * @property Carbon $scanned_at
 */
class SecurityScan extends Model
{
    use ReadsEncryptedAttributes;

    public const STATUS_PASS = 'pass';

    public const STATUS_WARN = 'warn';

    public const STATUS_FAIL = 'fail';

    public const ENGINE_ZAP = 'owasp_zap';

    protected $table = 'security_scans';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'monitor_id',
        'source',
        'engine',
        'monitor_name',
        'domain_url',
        'status',
        'summary',
        'details',
        'alert_high',
        'alert_medium',
        'alert_low',
        'alert_info',
        'exit_code',
        'scanned_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'monitor_name' => 'encrypted',
            'domain_url' => 'encrypted',
            'summary' => 'encrypted',
            'details' => 'encrypted:array',
            'alert_high' => 'integer',
            'alert_medium' => 'integer',
            'alert_low' => 'integer',
            'alert_info' => 'integer',
            'exit_code' => 'integer',
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

    /** @return array<string, mixed> */
    public function toArrayForUi(): array
    {
        return [
            'id' => (int) $this->id,
            'source' => (string) $this->source,
            'engine' => (string) ($this->engine ?: self::ENGINE_ZAP),
            'monitorId' => $this->monitor_id === null ? null : (string) $this->monitor_id,
            'monitorName' => (string) ($this->monitor_name ?? ''),
            'domainUrl' => (string) $this->domain_url,
            'status' => (string) $this->status,
            'summary' => (string) $this->summary,
            'details' => $this->details ?? [],
            'alertHigh' => (int) $this->alert_high,
            'alertMedium' => (int) $this->alert_medium,
            'alertLow' => (int) $this->alert_low,
            'alertInfo' => (int) $this->alert_info,
            'exitCode' => $this->exit_code === null ? null : (int) $this->exit_code,
            'scannedAt' => DashboardDatetime::format($this->scanned_at?->toIso8601String() ?? now()->toIso8601String()),
            'scannedAtIso' => $this->scanned_at?->toIso8601String(),
        ];
    }
}
