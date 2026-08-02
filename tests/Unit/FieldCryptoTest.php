<?php

namespace Tests\Unit;

use App\Services\FieldCrypto;
use Illuminate\Support\Facades\Crypt;
use RuntimeException;
use Tests\TestCase;

class FieldCryptoTest extends TestCase
{
    private FieldCrypto $crypto;

    protected function setUp(): void
    {
        parent::setUp();

        $this->crypto = app(FieldCrypto::class);
    }

    public function test_blind_index_is_deterministic_and_salted_by_prefix(): void
    {
        $first = $this->crypto->blindIndex('admin');

        $this->assertSame($first, $this->crypto->blindIndex('admin'));
        $this->assertNotSame($first, $this->crypto->blindIndex('admin2'));
        $this->assertSame(
            hash_hmac('sha256', 'blind:admin', $this->crypto->rawKey()),
            $first
        );
        // Value produced by _legacy/lib/cryptoFields.ts for the same input.
        $this->assertSame('965f4d9d62d25b7eb05b4deed044e81cc64eb4f8e4326af4bf8e78e8ce0048e2', $first);
    }

    public function test_it_rejects_a_key_that_is_not_64_hex_characters(): void
    {
        config(['status.encryption_key' => 'too-short']);

        $this->expectException(RuntimeException::class);

        (new FieldCrypto)->keyHex();
    }

    public function test_laravel_crypt_round_trips_strings(): void
    {
        $cipher = Crypt::encryptString('https://example.com/path?a=1');

        $this->assertSame('https://example.com/path?a=1', Crypt::decryptString($cipher));
        $this->assertNotSame($cipher, Crypt::encryptString('https://example.com/path?a=1'));
    }
}
