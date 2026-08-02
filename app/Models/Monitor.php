<?php

namespace App\Models;

use App\Models\Concerns\ReadsEncryptedAttributes;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property string $id ULID
 * @property int $user_id
 * @property string $name plaintext (decrypted)
 * @property string $url plaintext (decrypted)
 * @property string|null $url_hash
 * @property int $sort_order
 * @property bool $is_active
 */
class Monitor extends Model
{
    use ReadsEncryptedAttributes;

    protected $table = 'websites';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'user_id',
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
            'user_id' => 'integer',
            'name' => 'encrypted',
            'url' => 'encrypted',
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

    /** @param  Builder<Monitor>  $query */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
            'userId' => (int) $this->user_id,
            'name' => (string) $this->name,
            'url' => (string) $this->url,
            'sortOrder' => (int) $this->sort_order,
            'isActive' => (bool) $this->is_active,
        ];
    }
}
