<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AuditService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Username + password login backed by the HMAC blind index and the legacy
 * Argon2id hashes, on top of Laravel's session guard
 * (port of _legacy/routes/api/auth.ts).
 */
class AuthController extends Controller
{
    private const GENERIC_ERROR = 'Incorrect username or password.';

    public function __construct(
        private readonly UserService $users,
        private readonly AuditService $audits,
    ) {}

    public function login(Request $request): RedirectResponse|JsonResponse
    {
        $username = $request->string('username')->toString();
        $password = $request->string('password')->toString();
        $attempted = trim($username) !== '' ? trim($username) : null;

        try {
            $this->users->seedAdminIfEmpty();
        } catch (Throwable) {
            // Login reports a clear error below if the database is unavailable.
        }

        try {
            if (! $this->users->hasUsers()) {
                $error = 'No admin user found. Check your database configuration and restart the app.';
                $this->auditFailure($request, $attempted, $error, 'no_users');

                return $this->failed($request, $error, 503);
            }

            $result = $this->users->attemptLogin($username, $password);

            if ($result['ok'] !== true) {
                $this->auditFailure($request, $attempted, $result['message'], $result['reason']);

                return $this->failed($request, self::GENERIC_ERROR, 401);
            }
        } catch (ValidationException $error) {
            throw $error;
        } catch (Throwable $error) {
            $this->auditFailure($request, $attempted, $error->getMessage(), 'server_error');

            return $this->failed($request, 'Login failed.', 500);
        }

        /** @var User $user */
        $user = $result['user'];

        Auth::login($user);
        $request->session()->regenerate();

        $this->audits->writeSafe([
            'action' => 'auth.login',
            'actor' => $user->toAuthUser(),
            'entityType' => 'session',
            'entityId' => (string) $user->id,
            'summary' => "{$user->name} logged in",
            'request' => $request,
        ]);

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'ok' => true,
                'name' => $user->name,
                'username' => $user->username,
            ]);
        }

        return redirect()->intended(route('dashboard'));
    }

    public function logout(Request $request): RedirectResponse|JsonResponse
    {
        $user = $request->user();

        if ($user instanceof User) {
            $this->audits->writeSafe([
                'action' => 'auth.logout',
                'actor' => $user->toAuthUser(),
                'entityType' => 'session',
                'summary' => "{$user->name} logged out",
                'request' => $request,
            ]);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['ok' => true]);
        }

        return redirect()->route('dashboard');
    }

    private function auditFailure(
        Request $request,
        ?string $attempted,
        string $error,
        string $reason
    ): void {
        $this->audits->writeSafe([
            'action' => 'auth.login_failed',
            'actorUsername' => $attempted,
            'entityType' => 'session',
            'summary' => 'Failed login attempt for '.($attempted ?? '(empty)').": {$error}",
            'metadata' => ['error' => $error, 'reason' => $reason],
            'request' => $request,
        ]);
    }

    private function failed(Request $request, string $error, int $status): JsonResponse
    {
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['ok' => false, 'error' => $error], $status);
        }

        throw ValidationException::withMessages(['username' => $error]);
    }
}
