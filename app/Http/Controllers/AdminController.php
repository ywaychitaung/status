<?php

namespace App\Http\Controllers;

use App\Exceptions\StatusException;
use App\Models\User;
use App\Services\AuditService;
use App\Services\CheckService;
use App\Services\DashboardDataService;
use App\Services\MonitorService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/** Port of _legacy/routes/admin/index.tsx. */
class AdminController extends Controller
{
    public function __construct(
        private readonly DashboardDataService $data,
        private readonly MonitorService $monitors,
        private readonly CheckService $checks,
        private readonly AuditService $audits,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin', $this->data->adminPage($request));
    }

    /** Legacy-compatible entry point: a single POST carrying an `action` field. */
    public function dispatchAction(Request $request): RedirectResponse
    {
        return match ($request->string('action')->toString()) {
            'create' => $this->store($request),
            'update' => $this->update($request, $request->string('id')->toString()),
            'delete' => $this->destroy($request, $request->string('id')->toString()),
            'reactivate' => $this->reactivate($request, $request->string('id')->toString()),
            default => $this->failure('Unknown action.'),
        };
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = $this->actor($request);

        try {
            $created = $this->monitors->create(
                (int) $actor['id'],
                $request->string('name')->toString(),
                $request->string('url')->toString()
            );
        } catch (Throwable $error) {
            return $this->failure($this->message($error));
        }

        try {
            $this->checks->checkMonitor($created);
        } catch (Throwable $error) {
            Log::error('Initial check failed for '.$created['id'].': '.$error->getMessage());
        }

        $this->audits->writeSafe([
            'action' => 'monitor.create',
            'actor' => $actor,
            'entityType' => 'monitor',
            'entityId' => $created['id'],
            'summary' => "{$actor['name']} created website {$created['name']}",
            'metadata' => ['name' => $created['name'], 'url' => $created['url']],
            'request' => $request,
        ]);

        return $this->success('Website added.');
    }

    public function update(Request $request, string $monitor): RedirectResponse
    {
        $actor = $this->actor($request);
        $userId = (int) $actor['id'];
        $before = $this->monitors->find($monitor, $userId);

        try {
            $updated = $this->monitors->update(
                $userId,
                $monitor,
                $request->string('name')->toString(),
                $request->string('url')->toString(),
                $request->input('sort_order')
            );
        } catch (Throwable $error) {
            return $this->failure($this->message($error), $monitor);
        }

        $this->audits->writeSafe([
            'action' => 'monitor.update',
            'actor' => $actor,
            'entityType' => 'monitor',
            'entityId' => $updated['id'],
            'summary' => "{$actor['name']} updated website {$updated['name']}",
            'metadata' => [
                'before' => $before === null ? null : [
                    'name' => $before['name'],
                    'url' => $before['url'],
                    'sortOrder' => $before['sortOrder'],
                ],
                'after' => [
                    'name' => $updated['name'],
                    'url' => $updated['url'],
                    'sortOrder' => $updated['sortOrder'],
                ],
            ],
            'request' => $request,
        ]);

        return $this->success('Website updated.');
    }

    public function destroy(Request $request, string $monitor): RedirectResponse
    {
        $actor = $this->actor($request);
        $userId = (int) $actor['id'];
        $before = $this->monitors->find($monitor, $userId);

        try {
            $this->monitors->delete($userId, $monitor);
        } catch (Throwable $error) {
            return $this->failure($this->message($error), $monitor);
        }

        $this->audits->writeSafe([
            'action' => 'monitor.delete',
            'actor' => $actor,
            'entityType' => 'monitor',
            'entityId' => $monitor,
            'summary' => "{$actor['name']} deleted website ".($before['name'] ?? $monitor),
            'metadata' => $before === null
                ? ['id' => $monitor]
                : [
                    'name' => $before['name'],
                    'url' => $before['url'],
                    'sortOrder' => $before['sortOrder'],
                ],
            'request' => $request,
        ]);

        return $this->success('Website deactivated.');
    }

    public function reactivate(Request $request, string $monitor): RedirectResponse
    {
        $actor = $this->actor($request);

        try {
            $restored = $this->monitors->reactivate((int) $actor['id'], $monitor);
        } catch (Throwable $error) {
            return $this->failure($this->message($error), $monitor);
        }

        try {
            $this->checks->checkMonitor($restored);
        } catch (Throwable $error) {
            Log::error('Initial check failed for '.$restored['id'].': '.$error->getMessage());
        }

        $this->audits->writeSafe([
            'action' => 'monitor.reactivate',
            'actor' => $actor,
            'entityType' => 'monitor',
            'entityId' => $restored['id'],
            'summary' => "{$actor['name']} reactivated website {$restored['name']}",
            'metadata' => [
                'name' => $restored['name'],
                'url' => $restored['url'],
                'sortOrder' => $restored['sortOrder'],
            ],
            'request' => $request,
        ]);

        return $this->success('Website reactivated.');
    }

    /** @return array{id: int, username: string, name: string} */
    private function actor(Request $request): array
    {
        /** @var User $user */
        $user = $request->user();

        return $user->toAuthUser();
    }

    private function success(string $flash): RedirectResponse
    {
        return redirect()->route('admin')->with('flash', $flash);
    }

    private function failure(string $error, ?string $editingId = null): RedirectResponse
    {
        $redirect = redirect()->route('admin')->with('error', $error);

        return $editingId === null || $editingId === ''
            ? $redirect
            : $redirect->with('edit', $editingId);
    }

    private function message(Throwable $error): string
    {
        if ($error instanceof StatusException) {
            return $error->getMessage();
        }

        Log::error('Admin action failed: '.$error->getMessage());

        return 'Something went wrong.';
    }
}
