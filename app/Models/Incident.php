<?php

namespace App\Models;

use App\Models\Concerns\ReadsEncryptedAttributes;
use App\Support\DashboardDatetime;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $monitor_id
 * @property string $name plaintext (decrypted)
 * @property string $url plaintext (decrypted)
 * @property Carbon $started_at
 * @property Carbon|null $resolved_at
 * @property int|null $status_code
 * @property string|null $error plaintext (decrypted)
 */
class Incident extends Model
{
    use ReadsEncryptedAttributes;
    protected $table = 'incidents';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'monitor_id',
        'name',
        'url',
        'started_at',
        'resolved_at',
        'status_code',
        'error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name' => 'encrypted',
            'url' => 'encrypted',
            'error' => 'encrypted',
            'started_at' => 'datetime',
            'resolved_at' => 'datetime',
            'status_code' => 'integer',
        ];
    }

    /** @param  Builder<Incident>  $query */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNull('resolved_at');
    }

    /** Newest activity first, matching COALESCE(resolved_at, started_at) DESC. */
    public function scopeRecentFirst(Builder $query): Builder
    {
        return $query->orderByRaw('COALESCE(resolved_at, started_at) DESC');
    }

    /** Shape shared with the front end (IncidentRecord in _legacy/lib/monitor.ts). */
    public function toRecord(): array
    {
        return [
            'id' => (string) $this->id,
            'monitorId' => (string) $this->monitor_id,
            'name' => (string) $this->name,
            'url' => (string) $this->url,
            'startedAt' => DashboardDatetime::toIso($this->started_at),
            'resolvedAt' => DashboardDatetime::toIso($this->resolved_at),
            'statusCode' => $this->status_code === null ? null : (int) $this->status_code,
            'error' => $this->error,
        ];
    }
}
