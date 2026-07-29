<?php

namespace App\Services;

use App\Exceptions\StatusException;
use App\Models\Monitor;
use App\Support\MonitorUrl;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Throwable;

/** Port of _legacy/lib/monitorsDb.ts. */
class MonitorService
{
    private const SELECT_COLUMNS = ['id', 'name', 'url', 'url_hash', 'sort_order', 'is_active'];

    public function __construct(
        private readonly FieldCrypto $crypto,
        private readonly StatusEvents $events,
    ) {}

    /**
     * Active monitors only, ordered for public + admin + checks.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listActive(): array
    {
        return Monitor::query()
            ->active()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(self::SELECT_COLUMNS)
            ->map(fn (Monitor $monitor): array => $monitor->toTarget())
            ->all();
    }

    /**
     * Soft-deleted monitors for the admin inactive list.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listInactive(): array
    {
        return Monitor::query()
            ->inactive()
            ->orderByDesc('updated_at')
            ->orderBy('id')
            ->get(self::SELECT_COLUMNS)
            ->map(fn (Monitor $monitor): array => $monitor->toTarget())
            ->all();
    }

    /** @return array<string, mixed>|null */
    public function find(string $id): ?array
    {
        $monitor = Monitor::query()
            ->active()
            ->whereKey($id)
            ->first(self::SELECT_COLUMNS);

        return $monitor?->toTarget();
    }

    /** @return array<string, mixed> */
    public function create(string $name, string $url): array
    {
        $name = trim($name);
        if ($name === '') {
            throw new StatusException('Name is required');
        }

        $normalizedUrl = $this->normalizeUrl($url);
        $id = Ulid::generate();

        try {
            $target = DB::transaction(function () use ($id, $name, $normalizedUrl): array {
                $sortOrder = $this->nextSortOrder();

                DB::table('monitors')->insert([
                    'id' => $id,
                    'name' => $this->crypto->encrypt($name),
                    'url' => $this->crypto->encrypt($normalizedUrl),
                    'url_hash' => $this->crypto->blindIndex($normalizedUrl),
                    'sort_order' => $sortOrder,
                    'is_active' => true,
                ]);

                return [
                    'id' => $id,
                    'name' => $name,
                    'url' => $normalizedUrl,
                    'sortOrder' => $sortOrder,
                    'isActive' => true,
                ];
            });
        } catch (Throwable $error) {
            throw $this->translateUrlConflict($error, 'A monitor with this URL already exists');
        }

        $this->events->notifyUpdate();

        return $target;
    }

    /** @return array<string, mixed> */
    public function update(string $id, string $name, string $url, mixed $sortOrder): array
    {
        $name = trim($name);
        if ($name === '') {
            throw new StatusException('Name is required');
        }

        $normalizedUrl = $this->normalizeUrl($url);
        $order = $this->parseSortOrder($sortOrder);

        $payload = [
            'name' => $this->crypto->encrypt($name),
            'url' => $this->crypto->encrypt($normalizedUrl),
            'url_hash' => $this->crypto->blindIndex($normalizedUrl),
            'updated_at' => now(),
        ];

        try {
            DB::transaction(function () use ($id, $order, $payload): void {
                $current = DB::table('monitors')
                    ->where('id', $id)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->first();

                if ($current === null) {
                    throw new StatusException('Monitor not found');
                }

                $oldOrder = (int) $current->sort_order;

                if ($oldOrder === $order) {
                    DB::table('monitors')
                        ->where('id', $id)
                        ->where('is_active', true)
                        ->update($payload);

                    return;
                }

                $occupant = DB::table('monitors')
                    ->where('sort_order', $order)
                    ->where('is_active', true)
                    ->where('id', '<>', $id)
                    ->lockForUpdate()
                    ->first();

                if ($occupant !== null) {
                    // Park this row on a negative slot so the partial unique
                    // index on active sort_order stays satisfied mid-swap.
                    $parkOrder = -abs($oldOrder === 0 ? 1 : $oldOrder);

                    DB::table('monitors')
                        ->where('id', $id)
                        ->update(['sort_order' => $parkOrder, 'updated_at' => now()]);

                    DB::table('monitors')
                        ->where('id', $occupant->id)
                        ->update(['sort_order' => $oldOrder, 'updated_at' => now()]);
                }

                DB::table('monitors')
                    ->where('id', $id)
                    ->update($payload + ['sort_order' => $order]);
            });
        } catch (StatusException $error) {
            throw $error;
        } catch (Throwable $error) {
            throw $this->translateUrlConflict($error, 'A monitor with this URL already exists');
        }

        $this->events->notifyUpdate();

        return [
            'id' => $id,
            'name' => $name,
            'url' => $normalizedUrl,
            'sortOrder' => $order,
            'isActive' => true,
        ];
    }

    /** Soft-delete: mark inactive instead of removing the row. */
    public function delete(string $id): bool
    {
        $affected = DB::table('monitors')
            ->where('id', $id)
            ->where('is_active', true)
            ->update(['is_active' => false, 'updated_at' => now()]);

        if ($affected === 0) {
            return false;
        }

        $this->events->notifyUpdate();

        return true;
    }

    /**
     * Restore a soft-deleted monitor and place it at the end of the active order.
     *
     * @return array<string, mixed>
     */
    public function reactivate(string $id): array
    {
        $clashMessage = 'An active website already uses this URL. Change or remove it first.';

        try {
            $sortOrder = DB::transaction(function () use ($id, $clashMessage): int {
                $current = DB::table('monitors')
                    ->where('id', $id)
                    ->where('is_active', false)
                    ->lockForUpdate()
                    ->first();

                if ($current === null) {
                    throw new StatusException('Deleted website not found');
                }

                $clash = DB::table('monitors')
                    ->where('url_hash', $current->url_hash)
                    ->where('is_active', true)
                    ->where('id', '<>', $id)
                    ->exists();

                if ($clash) {
                    throw new StatusException($clashMessage);
                }

                $sortOrder = $this->nextSortOrder();

                DB::table('monitors')
                    ->where('id', $id)
                    ->update([
                        'is_active' => true,
                        'sort_order' => $sortOrder,
                        'updated_at' => now(),
                    ]);

                return $sortOrder;
            });
        } catch (StatusException $error) {
            throw $error;
        } catch (Throwable $error) {
            throw $this->translateUrlConflict($error, $clashMessage);
        }

        $this->events->notifyUpdate();

        $monitor = Monitor::query()->whereKey($id)->first(self::SELECT_COLUMNS);

        return $monitor?->toTarget() ?? [
            'id' => $id,
            'name' => '',
            'url' => '',
            'sortOrder' => $sortOrder,
            'isActive' => true,
        ];
    }

    private function nextSortOrder(): int
    {
        $max = DB::table('monitors')->where('is_active', true)->max('sort_order');

        return (int) $max + 1;
    }

    private function parseSortOrder(mixed $raw): int
    {
        if (! is_numeric($raw) || (float) $raw !== floor((float) $raw) || (int) $raw < 1) {
            throw new StatusException('Order must be a whole number of 1 or greater');
        }

        return (int) $raw;
    }

    private function normalizeUrl(string $url): string
    {
        try {
            return MonitorUrl::normalize($url);
        } catch (InvalidArgumentException $error) {
            throw new StatusException($error->getMessage());
        }
    }

    private function translateUrlConflict(Throwable $error, string $message): Throwable
    {
        $raw = $error->getMessage();

        foreach ([
            'monitors_url_hash_active_uidx',
            'monitors_url_active_uidx',
            'monitors_url_key',
            'duplicate key',
        ] as $needle) {
            if (str_contains($raw, $needle)) {
                return new StatusException($message);
            }
        }

        return $error;
    }
}
