<?php

namespace App\Support;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Throwable;

/**
 * Dashboard timestamp formatting, matching the Intl output used by the legacy
 * Deno app (_legacy/lib/datetimeShared.ts): "29 July 2026, 11:53:00 PM".
 */
class DashboardDatetime
{
    /**
     * @return array{id: string, short: string, name: string, utc_label: string}
     */
    public static function timezoneConfig(): array
    {
        return [
            'id' => self::safeTimezone((string) config('status.timezone.id', 'UTC')),
            'short' => (string) config('status.timezone.short', 'UTC'),
            'name' => (string) config('status.timezone.name', 'Coordinated Universal Time'),
            'utc_label' => (string) config('status.timezone.utc_label', 'UTC/GMT +0'),
        ];
    }

    public static function safeTimezone(string $timezoneId): string
    {
        try {
            new DateTimeZone($timezoneId);

            return $timezoneId;
        } catch (Throwable) {
            return 'UTC';
        }
    }

    public static function format(DateTimeInterface|string|null $value): string
    {
        return self::formatWithTimezone($value, self::timezoneConfig()['id']);
    }

    public static function formatWithTimezone(
        DateTimeInterface|string|null $value,
        string $timezoneId
    ): string {
        $date = self::toDate($value);

        if ($date === null) {
            return 'Never';
        }

        return $date
            ->setTimezone(new DateTimeZone(self::safeTimezone($timezoneId)))
            ->format('d F Y, h:i:s A');
    }

    /** ISO-8601 with milliseconds and a Z suffix, like Date#toISOString(). */
    public static function toIso(DateTimeInterface|string|null $value): ?string
    {
        $date = self::toDate($value);

        if ($date === null) {
            return null;
        }

        return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function nowIso(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    }

    /**
     * Current clock floored to the start of the minute in the dashboard timezone,
     * returned as UTC ISO-8601 (so UI always shows …:00 for scheduled checks).
     */
    public static function nowMinuteIso(): string
    {
        $tz = new DateTimeZone(self::timezoneConfig()['id']);
        $local = new DateTimeImmutable('now', $tz);
        $minute = $local->setTime(
            (int) $local->format('H'),
            (int) $local->format('i'),
            0,
        );

        return $minute
            ->setTimezone(new DateTimeZone('UTC'))
            ->format('Y-m-d\TH:i:s.v\Z');
    }

    private static function toDate(DateTimeInterface|string|null $value): ?DateTimeImmutable
    {
        if ($value === null) {
            return null;
        }

        if ($value instanceof DateTimeInterface) {
            return DateTimeImmutable::createFromInterface($value);
        }

        if (trim($value) === '') {
            return null;
        }

        try {
            return new DateTimeImmutable($value);
        } catch (Throwable) {
            return null;
        }
    }
}
