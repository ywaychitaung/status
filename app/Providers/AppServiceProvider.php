<?php

namespace App\Providers;

use App\Services\Argon2Password;
use App\Services\FieldCrypto;
use App\Services\PasswordHasher;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Shared instances so the encryption key is resolved (and cached) once.
        $this->app->singleton(FieldCrypto::class);
        $this->app->singleton(Argon2Password::class);
        $this->app->singleton(PasswordHasher::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
