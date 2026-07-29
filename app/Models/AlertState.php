<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $monitor_id
 * @property int $consecutive_downs
 * @property Carbon|null $last_down_alert_at
 */
class AlertState extends Model
{
    protected $table = 'alert_states';

    protected $primaryKey = 'monitor_id';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'monitor_id',
        'consecutive_downs',
        'last_down_alert_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'consecutive_downs' => 'integer',
            'last_down_alert_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Monitor, $this> */
    public function monitor(): BelongsTo
    {
        return $this->belongsTo(Monitor::class, 'monitor_id');
    }
}
