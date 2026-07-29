<?php

use App\Http\Controllers\StreamController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Live status stream
|--------------------------------------------------------------------------
|
| Registered outside the "web" group on purpose: a long-lived SSE response
| would otherwise hold the session file lock for its whole lifetime and block
| every other request from the same browser.
|
*/

Route::get('/api/stream', StreamController::class)->name('api.stream');
