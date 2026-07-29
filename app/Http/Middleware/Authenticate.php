<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /** Guests land on the dashboard with the login dialog open. */
    protected function redirectTo(Request $request): ?string
    {
        return route('dashboard', ['login' => 1]);
    }
}
