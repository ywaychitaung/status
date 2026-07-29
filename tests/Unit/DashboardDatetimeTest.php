<?php

namespace Tests\Unit;

use App\Support\DashboardDatetime;
use Tests\TestCase;

class DashboardDatetimeTest extends TestCase
{
    public function test_it_formats_like_the_legacy_intl_output(): void
    {
        $this->assertSame(
            '30 July 2026, 12:14:08 am',
            DashboardDatetime::formatWithTimezone('2026-07-29T16:14:08.000Z', 'Asia/Singapore')
        );
        $this->assertSame(
            '29 July 2026, 04:14:08 pm',
            DashboardDatetime::formatWithTimezone('2026-07-29T16:14:08.000Z', 'UTC')
        );
    }

    public function test_it_reports_never_for_empty_or_invalid_input(): void
    {
        $this->assertSame('Never', DashboardDatetime::format(null));
        $this->assertSame('Never', DashboardDatetime::format(''));
        $this->assertSame('Never', DashboardDatetime::format('not a date'));
    }

    public function test_it_falls_back_to_utc_for_an_unknown_timezone(): void
    {
        $this->assertSame('UTC', DashboardDatetime::safeTimezone('Mars/Olympus_Mons'));
        $this->assertSame('Asia/Singapore', DashboardDatetime::safeTimezone('Asia/Singapore'));
    }

    public function test_it_emits_iso_strings_with_milliseconds(): void
    {
        $this->assertSame(
            '2026-07-29T16:14:08.123Z',
            DashboardDatetime::toIso('2026-07-30T00:14:08.123+08:00')
        );
        $this->assertNull(DashboardDatetime::toIso(null));
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/',
            DashboardDatetime::nowIso()
        );
    }
}
