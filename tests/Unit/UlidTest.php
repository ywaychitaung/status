<?php

namespace Tests\Unit;

use App\Services\Ulid;
use PHPUnit\Framework\TestCase;

class UlidTest extends TestCase
{
    public function test_it_generates_26_character_crockford_base32_ids(): void
    {
        $id = Ulid::generate();

        $this->assertSame(26, strlen($id));
        $this->assertTrue(Ulid::isUlid($id));
        $this->assertMatchesRegularExpression('/^[0-9A-HJKMNP-TV-Z]{26}$/', $id);
    }

    public function test_ids_are_unique(): void
    {
        $ids = array_map(fn (): string => Ulid::generate(), range(1, 200));

        $this->assertCount(200, array_unique($ids));
    }

    public function test_the_timestamp_prefix_sorts_lexicographically(): void
    {
        $earlier = Ulid::generate(1_700_000_000_000);
        $later = Ulid::generate(1_700_000_001_000);

        $this->assertLessThan(substr($later, 0, 10), substr($earlier, 0, 10));
    }

    public function test_it_rejects_non_ulid_strings(): void
    {
        $this->assertFalse(Ulid::isUlid(''));
        $this->assertFalse(Ulid::isUlid('portfolio-v5'));
        // I, L, O, and U are excluded from the Crockford alphabet.
        $this->assertFalse(Ulid::isUlid('01ARZ3NDEKTSV4RRFFQ69G5FAI'));
        $this->assertFalse(Ulid::isUlid('01ARZ3NDEKTSV4RRFFQ69G5FA'));
    }
}
