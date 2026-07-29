<?php

namespace App\Http\Middleware;

use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'app' => [
                'name' => config('status.name'),
                'tagline' => config('status.tagline'),
                'description' => config('status.description'),
                'version' => config('status.version'),
                'author' => config('status.author'),
                'support' => config('status.support'),
                'monitor' => [
                    'intervalLabel' => config('status.monitor.interval_label'),
                    'intervalMinutes' => config('status.monitor.interval_minutes'),
                    'engine' => config('status.monitor.engine'),
                    'storage' => config('status.monitor.storage'),
                    'stream' => config('status.monitor.stream'),
                ],
                'theme' => [
                    'storageKey' => config('status.theme.storage_key'),
                    'shortcutKey' => config('status.theme.shortcut_key'),
                    'defaultMode' => config('status.theme.default_mode'),
                ],
                'links' => config('status.links'),
            ],
            'auth' => [
                'user' => $user instanceof User ? $user->toAuthUser() : null,
            ],
            'flash' => [
                'flash' => fn () => $request->session()->get('flash'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
