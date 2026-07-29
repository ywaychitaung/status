<?php

namespace App\Models;

use App\Casts\EncryptedField;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Latest check result per monitor (one row per monitor).
 *
 * @property string $monitor_id
 * @property string $name plaintext (decrypted)
 * @property string $url plaintext (decrypted)
 * @property bool $up
 * @property int|null $status_code
 * @property int|null $response_time_ms
 * @property string|null $error plaintext (decrypted)
 */
class MonitorStatus extends Model
{
    protected $table = 'monitor_statuses';

    protected $primaryKey = 'monitor_id';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'monitor_id',
        'name',
        'url',
        'up',
        'checked_at',
        'status_code',
        'response_time_ms',
        'error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name' => EncryptedField::class,
            'url' => EncryptedField::class,
            'error' => EncryptedField::class,
            'up' => 'boolean',
            'status_code' => 'integer',
            'response_time_ms' => 'integer',
            'checked_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Monitor, $this> */
    public function monitor(): BelongsTo
    {
        return $this->belongsTo(Monitor::class, 'monitor_id');
    }
}
