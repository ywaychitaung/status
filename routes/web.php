<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AlertsController;
use App\Http\Controllers\AuditsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\IncidentsController;
use App\Http\Controllers\SecurityController;
use App\Http\Controllers\ServicesController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public dashboard
|--------------------------------------------------------------------------
*/

Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
Route::get('/services', [ServicesController::class, 'index'])->name('services');
Route::get('/incidents', [IncidentsController::class, 'index'])->name('incidents');

/*
|--------------------------------------------------------------------------
| Authentication (username + password)
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('guest')
    ->name('login');

Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth')
    ->name('logout');

/*
|--------------------------------------------------------------------------
| Authenticated dashboard
|--------------------------------------------------------------------------
*/

Route::middleware('auth')->group(function (): void {
    Route::get('/admin', [AdminController::class, 'index'])->name('admin');
    Route::post('/admin', [AdminController::class, 'dispatchAction'])->name('admin.action');
    Route::post('/admin/monitors', [AdminController::class, 'store'])->name('admin.monitors.store');
    Route::patch('/admin/monitors/{monitor}', [AdminController::class, 'update'])
        ->name('admin.monitors.update');
    Route::delete('/admin/monitors/{monitor}', [AdminController::class, 'destroy'])
        ->name('admin.monitors.destroy');
    Route::post('/admin/monitors/{monitor}/reactivate', [AdminController::class, 'reactivate'])
        ->name('admin.monitors.reactivate');

    Route::get('/alerts', [AlertsController::class, 'index'])->name('alerts');
    Route::put('/alerts', [AlertsController::class, 'update'])->name('alerts.update');

    Route::get('/audits', [AuditsController::class, 'index'])->name('audits');

    Route::get('/security', [SecurityController::class, 'index'])->name('security');
    Route::post('/security/scan', [SecurityController::class, 'scanNow'])->name('security.scan');

    Route::get('/account', [AccountController::class, 'index'])->name('account');
    Route::post('/account', [AccountController::class, 'dispatchAction'])->name('account.action');
    Route::patch('/account/profile', [AccountController::class, 'updateProfile'])
        ->name('account.profile');
    Route::put('/account/password', [AccountController::class, 'changePassword'])
        ->name('account.password');
});
