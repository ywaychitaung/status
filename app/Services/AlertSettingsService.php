<?php

namespace App\Services;

use App\Models\AlertChannel;

/** Read / update Discord + Telegram alert channel rows. */
class AlertSettingsService
{
    /**
     * Flat form shape for the Alerts page (derived from channel rows).
     *
     * @return array{discordWebhookUrl: string, telegramBotToken: string, telegramChatId: string}
     */
    public function toForm(): array
    {
        AlertChannel::ensureDefaults();

        $discord = AlertChannel::findByName(AlertChannel::NAME_DISCORD);
        $telegram = AlertChannel::findByName(AlertChannel::NAME_TELEGRAM);

        return [
            'discordWebhookUrl' => (string) ($discord?->webhook_url ?? ''),
            'telegramBotToken' => (string) ($telegram?->bot_token ?? ''),
            'telegramChatId' => (string) ($telegram?->chat_id ?? ''),
        ];
    }

    /**
     * @return array{changed: list<string>}
     */
    public function update(string $discordWebhookUrl, string $telegramBotToken, string $telegramChatId): array
    {
        AlertChannel::ensureDefaults();

        $changed = [];

        $discord = AlertChannel::findByName(AlertChannel::NAME_DISCORD);
        if ($discord !== null) {
            $before = (string) ($discord->webhook_url ?? '');
            $discord->webhook_url = $this->nullableTrim($discordWebhookUrl);
            $discord->bot_token = null;
            $discord->chat_id = null;
            $discord->save();

            if ($before !== (string) ($discord->webhook_url ?? '')) {
                $changed[] = 'discord.webhook_url';
            }
        }

        $telegram = AlertChannel::findByName(AlertChannel::NAME_TELEGRAM);
        if ($telegram !== null) {
            $beforeToken = (string) ($telegram->bot_token ?? '');
            $beforeChat = (string) ($telegram->chat_id ?? '');
            $telegram->webhook_url = null;
            $telegram->bot_token = $this->nullableTrim($telegramBotToken);
            $telegram->chat_id = $this->nullableTrim($telegramChatId);
            $telegram->save();

            if ($beforeToken !== (string) ($telegram->bot_token ?? '')) {
                $changed[] = 'telegram.bot_token';
            }
            if ($beforeChat !== (string) ($telegram->chat_id ?? '')) {
                $changed[] = 'telegram.chat_id';
            }
        }

        return ['changed' => $changed];
    }

    private function nullableTrim(string $value): ?string
    {
        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}
