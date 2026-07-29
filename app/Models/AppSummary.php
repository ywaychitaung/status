<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Single-row table (id = 1) holding the last check time and last outage time.
 *
 * @property int $id
 * @property Carbon $updated_at
 * @property Carbon|null $last_outage_at
 */
class AppSummary extends Model
{
    public const SINGLETON_ID = 1;

    protected $table = 'app_summary';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'updated_at',
        'last_outage_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'updated_at' => 'datetime',
            'last_outage_at' => 'datetime',
        ];
    }

    public static function singleton(): ?self
    {
        return static::query()->find(self::SINGLETON_ID);
    }
}
