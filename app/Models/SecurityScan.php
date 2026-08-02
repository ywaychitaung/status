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
 * @property string|int|null $alert_high plaintext count (decrypted)
 * @property string|int|null $alert_medium plaintext count (decrypted)
 * @property string|int|null $alert_low plaintext count (decrypted)
 * @property string|int|null $alert_info plaintext count (decrypted)
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

    public const SOURCE_WEEKLY = 'zap_weekly';

    public const SOURCE_MANUAL = 'manual_trigger';

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
            'alert_high' => 'encrypted',
            'alert_medium' => 'encrypted',
            'alert_low' => 'encrypted',
            'alert_info' => 'encrypted',
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
    public function toArrayForUi(bool $includeDetails = true): array
    {
        $payload = [
            'id' => (int) $this->id,
            'source' => (string) $this->source,
            'engine' => (string) ($this->engine ?: self::ENGINE_ZAP),
            'monitorId' => $this->monitor_id === null ? null : (string) $this->monitor_id,
            'monitorName' => (string) ($this->monitor_name ?? ''),
            'domainUrl' => (string) $this->domain_url,
            'status' => (string) $this->status,
            'summary' => (string) $this->summary,
            'alertHigh' => $this->alertCount('alert_high'),
            'alertMedium' => $this->alertCount('alert_medium'),
            'alertLow' => $this->alertCount('alert_low'),
            'alertInfo' => $this->alertCount('alert_info'),
            'exitCode' => $this->exit_code === null ? null : (int) $this->exit_code,
            'scannedAt' => DashboardDatetime::format($this->scanned_at?->toIso8601String() ?? now()->toIso8601String()),
            'scannedAtIso' => $this->scanned_at?->toIso8601String(),
        ];

        if ($includeDetails) {
            $payload['details'] = $this->details ?? [];
        }

        return $payload;
    }

    private function alertCount(string $attribute): int
    {
        $value = $this->getAttribute($attribute);

        if ($value === null || $value === '') {
            return 0;
        }

        return max(0, (int) $value);
    }
}
