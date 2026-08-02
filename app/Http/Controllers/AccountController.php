<?php

namespace App\Http\Controllers;

use App\Exceptions\StatusException;
use App\Models\User;
use App\Services\AuditService;
use App\Services\DashboardDataService;
use App\Services\UserService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/** Port of _legacy/routes/account.tsx. */
class AccountController extends Controller
{
    public function __construct(
        private readonly DashboardDataService $data,
        private readonly UserService $users,
        private readonly AuditService $audits,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('account', $this->data->accountPage($request));
    }

    /** Legacy-compatible entry point: a single POST carrying an `action` field. */
    public function dispatchAction(Request $request): RedirectResponse
    {
        return $request->string('action')->toString() === 'change_password'
            ? $this->changePassword($request)
            : $this->updateProfile($request);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $before = $user->toAuthUser();

        try {
            $updated = $this->users->updateAccount(
                $user,
                $request->string('name')->toString(),
                $request->string('username')->toString(),
                $request->string('email')->toString(),
            )->toAuthUser();
        } catch (Throwable $error) {
            return $this->failure($this->message($error));
        }

        $changes = [];
        foreach (['name', 'username', 'email'] as $field) {
            if ($updated[$field] !== $before[$field]) {
                $changes[$field] = [
                    'previous' => $before[$field],
                    'new' => $updated[$field],
                ];
            }
        }

        if ($changes !== []) {
            foreach ($changes as $field => $change) {
                $this->audits->writeSafe([
                    'action' => 'account.profile_update',
                    'actor' => $updated,
                    'entityType' => 'user',
                    'entityId' => (string) $updated['id'],
                    'summary' => "{$before['name']} updated {$field}",
                    'metadata' => [
                        'changes' => [
                            $field => $change,
                        ],
                        'before' => [
                            $field => $change['previous'],
                        ],
                        'after' => [
                            $field => $change['new'],
                        ],
                        'changed' => [$field],
                    ],
                    'request' => $request,
                ]);
            }
        }

        return $this->success('Profile updated.');
    }

    public function changePassword(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $actor = $user->toAuthUser();

        try {
            $this->users->changePassword(
                $user,
                $request->string('current_password')->toString(),
                $request->string('new_password')->toString(),
                $request->string('confirm_password')->toString()
            );
        } catch (Throwable $error) {
            return $this->failure($this->message($error));
        }

        $this->audits->writeSafe([
            'action' => 'account.password_change',
            'actor' => $actor,
            'entityType' => 'user',
            'entityId' => (string) $actor['id'],
            'summary' => "{$actor['name']} changed password",
            // Never store previous/new password values.
            'metadata' => [
                'changed' => ['password'],
            ],
            'request' => $request,
        ]);

        return $this->success('Password changed.');
    }

    private function success(string $flash): RedirectResponse
    {
        return redirect()->route('account')->with('flash', $flash);
    }

    private function failure(string $error): RedirectResponse
    {
        return redirect()->route('account')->with('error', $error);
    }

    private function message(Throwable $error): string
    {
        if ($error instanceof StatusException) {
            return $error->getMessage();
        }

        Log::error('Account action failed: '.$error->getMessage());

        return 'Something went wrong.';
    }
}
