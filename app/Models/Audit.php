<?php

namespace App\Models;

use App\Models\Concerns\ReadsEncryptedAttributes;
use App\Support\DashboardDatetime;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id ULID
 * @property Carbon $created_at
 * @property string $action plaintext (decrypted)
 * @property int|null $actor_user_id
 * @property string|null $actor_username plaintext (decrypted)
 * @property string|null $actor_name plaintext (decrypted)
 * @property string|null $entity_type plaintext (decrypted)
 * @property string|null $entity_id
 * @property string $summary plaintext (decrypted)
 * @property string|null $metadata plaintext JSON (decrypted)
 * @property string|null $ip plaintext (decrypted)
 * @property string|null $user_agent plaintext (decrypted)
 */
class Audit extends Model
{
    use ReadsEncryptedAttributes;
    public const ACTIONS = [
        'auth.login',
        'auth.login_failed',
        'auth.logout',
        'account.profile_update',
        'account.password_change',
        'alerts.update',
        'monitor.create',
        'monitor.update',
        'monitor.delete',
        'monitor.reactivate',
    ];

    protected $table = 'audits';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'created_at',
        'action',
        'actor_user_id',
        'actor_username',
        'actor_name',
        'entity_type',
        'entity_id',
        'summary',
        'metadata',
        'ip',
        'user_agent',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'action' => 'encrypted',
            'actor_username' => 'encrypted',
            'actor_name' => 'encrypted',
            'entity_type' => 'encrypted',
            'summary' => 'encrypted',
            'metadata' => 'encrypted',
            'ip' => 'encrypted',
            'user_agent' => 'encrypted',
            'created_at' => 'datetime',
        ];
    }

    /** Shape shared with the front end (AuditRecord in _legacy/lib/auditShared.ts). */
    public function toRecord(): array
    {
        $metadata = null;
        $rawMeta = $this->metadata;

        if (is_string($rawMeta) && $rawMeta !== '') {
            $decoded = json_decode($rawMeta, true);
            $metadata = is_array($decoded) ? $decoded : ['raw' => $rawMeta];
        }

        return [
            'id' => (string) $this->id,
            'createdAt' => DashboardDatetime::toIso($this->created_at),
            'action' => (string) $this->action,
            'actorUserId' => $this->actor_user_id === null ? null : (int) $this->actor_user_id,
            'actorUsername' => $this->actor_username,
            'actorName' => $this->actor_name,
            'entityType' => $this->entity_type,
            'entityId' => $this->entity_id,
            'summary' => (string) $this->summary,
            'metadata' => $metadata,
            'ip' => $this->ip,
            'userAgent' => $this->user_agent,
        ];
    }

    public static function formatAction(string $action): string
    {
        return match ($action) {
            'auth.login' => 'Logged in',
            'auth.login_failed' => 'Login failed',
            'auth.logout' => 'Logged out',
            'account.profile_update' => 'Profile updated',
            'account.password_change' => 'Password changed',
            'alerts.update' => 'Alert settings updated',
            'monitor.create' => 'Website created',
            'monitor.update' => 'Website updated',
            'monitor.delete' => 'Website deleted',
            'monitor.reactivate' => 'Website reactivated',
            default => $action,
        };
    }
}
