<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One row per alert channel (discord, telegram) with shared columns:
 * name, webhook_url, bot_token, chat_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alert_channels', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('webhook_url')->nullable();
            $table->text('bot_token')->nullable();
            $table->text('chat_id')->nullable();
            $table->timestamps();
        });

        $discordWebhook = null;
        $telegramToken = null;
        $telegramChatId = null;

        if (Schema::hasTable('alert_settings')) {
            $legacy = DB::table('alert_settings')->orderBy('id')->first();
            if ($legacy !== null) {
                $discordWebhook = $this->plainOrNull($legacy->discord_webhook_url ?? null);
                $telegramToken = $this->plainOrNull($legacy->telegram_bot_token ?? null);
                $telegramChatId = $this->plainOrNull($legacy->telegram_chat_id ?? null);
            }
        }

        // Fallback for fresh installs / empty legacy row: seed from ALERT_* env.
        if ($discordWebhook === null) {
            $fromEnv = trim((string) env('ALERT_DISCORD_WEBHOOK_URL', ''));
            $discordWebhook = $fromEnv !== '' ? $fromEnv : null;
        }
        if ($telegramToken === null) {
            $fromEnv = trim((string) env('ALERT_TELEGRAM_BOT_TOKEN', ''));
            $telegramToken = $fromEnv !== '' ? $fromEnv : null;
        }
        if ($telegramChatId === null) {
            $fromEnv = trim((string) env('ALERT_TELEGRAM_CHAT_ID', ''));
            $telegramChatId = $fromEnv !== '' ? $fromEnv : null;
        }

        DB::table('alert_channels')->insert([
            [
                'name' => 'discord',
                'webhook_url' => $this->encryptNullable($discordWebhook),
                'bot_token' => null,
                'chat_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'telegram',
                'webhook_url' => null,
                'bot_token' => $this->encryptNullable($telegramToken),
                'chat_id' => $this->encryptNullable($telegramChatId),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        Schema::dropIfExists('alert_settings');
    }

    public function down(): void
    {
        Schema::create('alert_settings', function (Blueprint $table) {
            $table->id();
            $table->text('discord_webhook_url')->nullable();
            $table->text('telegram_bot_token')->nullable();
            $table->text('telegram_chat_id')->nullable();
            $table->timestamps();
        });

        $discord = DB::table('alert_channels')->where('name', 'discord')->first();
        $telegram = DB::table('alert_channels')->where('name', 'telegram')->first();

        DB::table('alert_settings')->insert([
            'id' => 1,
            'discord_webhook_url' => $discord->webhook_url ?? null,
            'telegram_bot_token' => $telegram->bot_token ?? null,
            'telegram_chat_id' => $telegram->chat_id ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::dropIfExists('alert_channels');
    }

    private function plainOrNull(mixed $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return $value;
        }
    }

    private function encryptNullable(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Crypt::encryptString($value);
    }
};
