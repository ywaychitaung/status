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
    }

    public function test_it_rejects_a_missing_app_key(): void
    {
        config(['app.key' => '']);

        $this->expectException(RuntimeException::class);

        (new FieldCrypto)->rawKey();
    }

    public function test_laravel_crypt_round_trips_strings(): void
    {
        $cipher = Crypt::encryptString('https://example.com/path?a=1');

        $this->assertSame('https://example.com/path?a=1', Crypt::decryptString($cipher));
        $this->assertNotSame($cipher, Crypt::encryptString('https://example.com/path?a=1'));
    }
}
