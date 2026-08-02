<?php

namespace App\Models;

use App\Models\Concerns\ReadsEncryptedAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * One alert destination row (discord, telegram, …) with shared columns.
 *
 * @property int $id
 * @property string $name
 * @property string|null $webhook_url
 * @property string|null $bot_token
 * @property string|null $chat_id
 */
class AlertChannel extends Model
{
    use ReadsEncryptedAttributes;

    public const NAME_DISCORD = 'discord';

    public const NAME_TELEGRAM = 'telegram';

    /** @var list<string> */
    public const NAMES = [
        self::NAME_DISCORD,
        self::NAME_TELEGRAM,
    ];

    protected $table = 'alert_channels';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'webhook_url',
        'bot_token',
        'chat_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'webhook_url' => 'encrypted',
            'bot_token' => 'encrypted',
            'chat_id' => 'encrypted',
        ];
    }

    public static function findByName(string $name): ?self
    {
        return static::query()->where('name', $name)->first();
    }

    public static function ensureDefaults(): void
    {
        foreach (self::NAMES as $name) {
            static::query()->firstOrCreate(
                ['name' => $name],
                [
                    'webhook_url' => null,
                    'bot_token' => null,
                    'chat_id' => null,
                ]
            );
        }
    }

    /** @return array{name: string, webhookUrl: string, botToken: string, chatId: string} */
    public function toForm(): array
    {
        return [
            'name' => (string) $this->name,
            'webhookUrl' => (string) ($this->webhook_url ?? ''),
            'botToken' => (string) ($this->bot_token ?? ''),
            'chatId' => (string) ($this->chat_id ?? ''),
        ];
    }
}
