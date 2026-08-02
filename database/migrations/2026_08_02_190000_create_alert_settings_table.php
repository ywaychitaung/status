<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Store Discord / Telegram alert credentials in the database (encrypted).
 * Seeds from ALERT_* env vars when present.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alert_settings', function (Blueprint $table) {
            $table->id();
            $table->text('discord_webhook_url')->nullable();
            $table->text('telegram_bot_token')->nullable();
            $table->text('telegram_chat_id')->nullable();
            $table->timestamps();
        });

        $discord = trim((string) env('ALERT_DISCORD_WEBHOOK_URL', ''));
        $token = trim((string) env('ALERT_TELEGRAM_BOT_TOKEN', ''));
        $chatId = trim((string) env('ALERT_TELEGRAM_CHAT_ID', ''));

        DB::table('alert_settings')->insert([
            'id' => 1,
            'discord_webhook_url' => $discord !== '' ? Crypt::encryptString($discord) : null,
            'telegram_bot_token' => $token !== '' ? Crypt::encryptString($token) : null,
            'telegram_chat_id' => $chatId !== '' ? Crypt::encryptString($chatId) : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_settings');
    }
};
