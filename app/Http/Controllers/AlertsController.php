<?php

namespace App\Http\Controllers;

use App\Exceptions\StatusException;
use App\Models\User;
use App\Services\AlertSettingsService;
use App\Services\AuditService;
use App\Services\DashboardDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class AlertsController extends Controller
{
    public function __construct(
        private readonly DashboardDataService $data,
        private readonly AlertSettingsService $settings,
        private readonly AuditService $audits,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('alerts', $this->data->alertsPage($request));
    }

    public function update(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $result = $this->settings->update(
                $request->string('discord_webhook_url')->toString(),
                $request->string('telegram_bot_token')->toString(),
                $request->string('telegram_chat_id')->toString(),
            );
        } catch (Throwable $error) {
            if ($error instanceof StatusException) {
                return redirect()->route('alerts')->with('error', $error->getMessage());
            }

            Log::error('Alert settings update failed: '.$error->getMessage());

            return redirect()->route('alerts')->with('error', 'Something went wrong.');
        }

        if ($result['changed'] !== []) {
            $labels = [
                'discord.webhook_url' => 'Discord webhook URL',
                'telegram.bot_token' => 'Telegram bot token',
                'telegram.chat_id' => 'Telegram chat ID',
            ];
            $changedLabels = array_map(
                fn (string $field): string => $labels[$field] ?? $field,
                $result['changed'],
            );

            $this->audits->writeSafe([
                'action' => 'alerts.update',
                'actor' => $user->toAuthUser(),
                'entityType' => 'alert_channel',
                'entityId' => 'channels',
                'summary' => "{$user->name} updated alert channels (".implode(', ', $changedLabels).')',
                'metadata' => [
                    'changed' => $result['changed'],
                    // Never store webhook/token/chat secrets in audits.
                ],
                'request' => $request,
            ]);
        }

        return redirect()->route('alerts')->with('flash', 'Alert settings saved.');
    }
}
