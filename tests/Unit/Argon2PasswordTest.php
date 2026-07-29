<?php

namespace Tests\Unit;

use App\Services\Argon2Password;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class Argon2PasswordTest extends TestCase
{
    private Argon2Password $passwords;

    protected function setUp(): void
    {
        parent::setUp();

        $this->passwords = new Argon2Password;
    }

    public function test_it_hashes_in_the_legacy_string_format(): void
    {
        $hash = $this->passwords->hash('correct horse');
        [$algo, $params, $saltHex, $hashHex] = explode('$', $hash);

        $this->assertSame('argon2id', $algo);
        $this->assertSame('m=19456,t=2,p=1', $params);
        $this->assertSame(32, strlen($saltHex));
        $this->assertSame(64, strlen($hashHex));
    }

    public function test_it_verifies_its_own_hash(): void
    {
        $hash = $this->passwords->hash('correct horse');

        $this->assertTrue($this->passwords->verify('correct horse', $hash));
        $this->assertFalse($this->passwords->verify('wrong horse', $hash));
        $this->assertFalse($this->passwords->verify('', $hash));
    }

    public function test_it_verifies_a_hash_produced_by_the_legacy_deno_app(): void
    {
        // Generated with argon2idAsync from _legacy/lib/adminAuth.ts.
        $hash = 'argon2id$m=19456,t=2,p=1$c622bef0094b626860eb60fe78d6ff9d'
            .'$76a21f7e34067d2691430b6efa2a6158182050d644ee79b0a1e40cbbf3b2cd12';

        $this->assertTrue($this->passwords->verify('legacy-password', $hash));
        $this->assertFalse($this->passwords->verify('legacy-passwerd', $hash));
    }

    public function test_it_uses_a_fresh_salt_per_hash(): void
    {
        $this->assertNotSame($this->passwords->hash('same'), $this->passwords->hash('same'));
    }

    #[DataProvider('malformedHashes')]
    public function test_it_rejects_malformed_stored_hashes(string $stored): void
    {
        $this->assertFalse($this->passwords->verify('anything', $stored));
    }

    /** @return array<string, array{string}> */
    public static function malformedHashes(): array
    {
        return [
            'empty' => [''],
            'bcrypt' => ['$2y$10$abcdefghijklmnopqrstuv'],
            'wrong algo' => ['argon2i$m=19456,t=2,p=1$aabb$ccdd'],
            'missing params' => ['argon2id$$aabb$ccdd'],
            'zero memory' => ['argon2id$m=0,t=2,p=1$aabb$ccdd'],
            'unsupported parallelism' => ['argon2id$m=19456,t=2,p=4$'.str_repeat('ab', 16).'$'.str_repeat('cd', 32)],
        ];
    }

    public function test_it_flags_outdated_parameters_for_rehash(): void
    {
        $this->assertFalse($this->passwords->needsRehash($this->passwords->hash('pw')));
        $this->assertTrue($this->passwords->needsRehash('argon2id$m=4096,t=3,p=1$aabb$ccdd'));
        $this->assertTrue($this->passwords->needsRehash('$2y$10$abcdefghijklmnopqrstuv'));
    }
}
