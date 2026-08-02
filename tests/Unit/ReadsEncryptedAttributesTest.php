<?php

namespace Tests\Unit;

use App\Models\AlertChannel;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class ReadsEncryptedAttributesTest extends TestCase
{
    public function test_alert_channel_reads_laravel_ciphertext(): void
    {
        $channel = new AlertChannel;
        $channel->setRawAttributes([
            'id' => 1,
            'name' => 'discord',
            'webhook_url' => Crypt::encryptString('https://example.com/hooks/a'),
            'bot_token' => null,
            'chat_id' => null,
        ], true);

        $this->assertSame('https://example.com/hooks/a', $channel->webhook_url);
    }

    public function test_alert_channel_rejects_plaintext_secrets(): void
    {
        $channel = new AlertChannel;
        $channel->setRawAttributes([
            'id' => 2,
            'name' => 'telegram',
            'webhook_url' => null,
            'bot_token' => '123456:PLAINTEXT-TOKEN',
            'chat_id' => null,
        ], true);

        $this->expectException(DecryptException::class);
        $channel->bot_token;
    }

    public function test_alert_channel_reads_empty_encrypted_fields_as_null(): void
    {
        $channel = new AlertChannel;
        $channel->setRawAttributes([
            'id' => 3,
            'name' => 'discord',
            'webhook_url' => '',
            'bot_token' => null,
            'chat_id' => null,
        ], true);

        $this->assertNull($channel->webhook_url);
    }
}
