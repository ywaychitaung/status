<?php

namespace Tests\Unit;

use App\Services\FieldCrypto;
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

    public function test_it_round_trips_a_value(): void
    {
        $payload = $this->crypto->encrypt('https://example.com/path?a=1');

        $this->assertSame('https://example.com/path?a=1', $this->crypto->decrypt($payload));
    }

    public function test_it_uses_the_legacy_ciphertext_layout(): void
    {
        $payload = $this->crypto->encrypt('hello');
        [$version, $ivHex, $dataHex] = explode('$', $payload);

        $this->assertSame('aes256gcm', $version);
        // 12-byte IV, and ciphertext plus a 16-byte GCM tag.
        $this->assertSame(24, strlen($ivHex));
        $this->assertSame((strlen('hello') + 16) * 2, strlen($dataHex));
    }

    public function test_each_encryption_uses_a_fresh_iv(): void
    {
        $this->assertNotSame($this->crypto->encrypt('same'), $this->crypto->encrypt('same'));
    }

    public function test_it_decrypts_a_payload_produced_by_the_legacy_deno_app(): void
    {
        // Generated with _legacy/lib/cryptoFields.ts using the test key.
        $payload = 'aes256gcm$7082ba50a0c4e796f8ce4fa9$ccdd1104344aaec8d8bed574cc0dba2841fa310d4e2f645193a87e8e';

        $this->assertSame('legacy-value', $this->crypto->decrypt($payload));
    }

    public function test_it_passes_through_legacy_plaintext(): void
    {
        $this->assertSame('https://plain.example', $this->crypto->decryptMaybe('https://plain.example'));
        $this->assertFalse($this->crypto->isEncrypted('https://plain.example'));
        $this->assertTrue($this->crypto->isEncrypted('aes256gcm$aa$bb'));
        $this->assertTrue($this->crypto->isEncrypted('v1$aa$bb'));
    }

    public function test_it_rejects_a_malformed_payload(): void
    {
        $this->expectException(RuntimeException::class);

        $this->crypto->decrypt('aes256gcm$not-hex');
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

    public function test_nullable_helpers_pass_null_through(): void
    {
        $this->assertNull($this->crypto->encryptNullable(null));
        $this->assertNull($this->crypto->decryptNullable(null));
        $this->assertSame('x', $this->crypto->decryptNullable($this->crypto->encryptNullable('x')));
    }

    public function test_it_rejects_a_key_that_is_not_64_hex_characters(): void
    {
        config(['status.encryption_key' => 'too-short']);

        $this->expectException(RuntimeException::class);

        (new FieldCrypto)->keyHex();
    }
}
