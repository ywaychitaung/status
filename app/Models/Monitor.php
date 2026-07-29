<?php

namespace App\Models;

use App\Casts\EncryptedField;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property string $id ULID
 * @property string $name plaintext (decrypted)
 * @property string $url plaintext (decrypted)
 * @property string|null $url_hash
 * @property int $sort_order
 * @property bool $is_active
 */
class Monitor extends Model
{
    protected $table = 'monitors';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'name',
        'url',
        'url_hash',
        'sort_order',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name' => EncryptedField::class,
            'url' => EncryptedField::class,
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /** @param  Builder<Monitor>  $query */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /** @param  Builder<Monitor>  $query */
    public function scopeInactive(Builder $query): Builder
    {
        return $query->where('is_active', false);
    }

    /** @return HasOne<MonitorStatus, $this> */
    public function status(): HasOne
    {
        return $this->hasOne(MonitorStatus::class, 'monitor_id');
    }

    /** @return HasOne<AlertState, $this> */
    public function alertState(): HasOne
    {
        return $this->hasOne(AlertState::class, 'monitor_id');
    }

    /** Shape shared with the front end (MonitorTarget in _legacy/lib/monitor.ts). */
    public function toTarget(): array
    {
        return [
            'id' => (string) $this->id,
            'name' => (string) $this->name,
            'url' => (string) $this->url,
            'sortOrder' => (int) $this->sort_order,
            'isActive' => (bool) $this->is_active,
        ];
    }
}
