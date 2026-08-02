<?php

namespace App\Models;

use App\Models\Concerns\ReadsEncryptedAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One alert destination row (discord, telegram, …) with shared columns.
 *
 * @property int $id
 * @property int $user_id
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
        'user_id',
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
            'user_id' => 'integer',
            'webhook_url' => 'encrypted',
            'bot_token' => 'encrypted',
            'chat_id' => 'encrypted',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function findByName(string $name, int $userId): ?self
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('name', $name)
            ->first();
    }

    public static function ensureDefaults(int $userId): void
    {
        foreach (self::NAMES as $name) {
            static::query()->firstOrCreate(
                ['user_id' => $userId, 'name' => $name],
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
