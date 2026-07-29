<?php

namespace App\Services;

use App\Models\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Port of _legacy/lib/audit.ts. */
class AuditService
{
    private const MAX_LIMIT = 200;

    private const USER_AGENT_MAX = 400;

    /**
     * @param  array{
     *     action: string,
     *     actor?: array{id: int, username: string, name: string}|null,
     *     actorUsername?: string|null,
     *     entityType?: string|null,
     *     entityId?: string|null,
     *     summary: string,
     *     metadata?: array<string, mixed>|null,
     *     request?: Request|null,
     * }  $input
     */
    public function write(array $input): void
    {
        $actor = $input['actor'] ?? null;
        $request = $input['request'] ?? null;
        $metadata = $input['metadata'] ?? null;

        Audit::query()->create([
            'id' => Ulid::generate(),
            'action' => $input['action'],
            'actor_user_id' => $actor['id'] ?? null,
            'actor_username' => $actor['username'] ?? ($input['actorUsername'] ?? null),
            'actor_name' => $actor['name'] ?? null,
            'entity_type' => $input['entityType'] ?? null,
            'entity_id' => $input['entityId'] ?? null,
            'summary' => $input['summary'],
            'metadata' => $metadata === null || $metadata === []
                ? null
                : json_encode($metadata, JSON_UNESCAPED_SLASHES),
            'ip' => $request ? $this->clientIp($request) : null,
            'user_agent' => $request ? $this->userAgent($request) : null,
        ]);
    }

    /** Best-effort: never block the main action if the audit write fails. */
    public function writeSafe(array $input): void
    {
        try {
            $this->write($input);
        } catch (Throwable $error) {
            Log::error('Audit write failed: '.$error->getMessage());
        }
    }

    /** @return array<int, array<string, mixed>> */
    public function list(int $limit = 50): array
    {
        $safeLimit = min(max(1, $limit), self::MAX_LIMIT);

        return Audit::query()
            ->orderByDesc('created_at')
            ->limit($safeLimit)
            ->get()
            ->map(fn (Audit $audit): array => $audit->toRecord())
            ->all();
    }

    public function clientIp(Request $request): ?string
    {
        $forwarded = $request->header('x-forwarded-for');
        if (is_string($forwarded) && $forwarded !== '') {
            $first = trim(explode(',', $forwarded)[0]);
            if ($first !== '') {
                return $first;
            }
        }

        foreach (['cf-connecting-ip', 'x-real-ip'] as $header) {
            $value = $request->header($header);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return $request->ip();
    }

    public function userAgent(Request $request): ?string
    {
        $agent = trim((string) $request->userAgent());

        if ($agent === '') {
            return null;
        }

        return mb_strlen($agent) > self::USER_AGENT_MAX
            ? mb_substr($agent, 0, self::USER_AGENT_MAX).'…'
            : $agent;
    }
}
