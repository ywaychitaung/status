<?php

namespace Tests\Unit;

use App\Services\Argon2Password;
use App\Services\PasswordHasher;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class PasswordHasherTest extends TestCase
{
    private PasswordHasher $hasher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->hasher = new PasswordHasher(new Argon2Password);
    }

    public function test_it_defaults_to_argon2id(): void
    {
        Config::set('status.password.hash_driver', 'argon2id');

        $hash = $this->hasher->hash('secret-password');

        $this->assertStringStartsWith('argon2id$', $hash);
        $this->assertTrue($this->hasher->verify('secret-password', $hash));
        $this->assertFalse($this->hasher->needsRehash($hash));
    }

    public function test_it_can_hash_with_bcrypt(): void
    {
        Config::set('status.password.hash_driver', 'bcrypt');
        Config::set('status.password.bcrypt_rounds', 10);

        $hash = $this->hasher->hash('secret-password');

        $this->assertStringStartsWith('$2y$', $hash);
        $this->assertTrue($this->hasher->verify('secret-password', $hash));
        $this->assertFalse($this->hasher->needsRehash($hash));
    }

    public function test_it_verifies_both_formats_regardless_of_driver(): void
    {
        Config::set('status.password.hash_driver', 'bcrypt');
        $argon = (new Argon2Password)->hash('either-way');

        Config::set('status.password.hash_driver', 'argon2id');
        $bcrypt = password_hash('either-way', PASSWORD_BCRYPT, ['cost' => 10]);

        $this->assertTrue($this->hasher->verify('either-way', $argon));
        $this->assertTrue($this->hasher->verify('either-way', $bcrypt));
    }

    public function test_it_flags_cross_driver_hashes_for_rehash(): void
    {
        Config::set('status.password.hash_driver', 'argon2id');
        $this->assertTrue($this->hasher->needsRehash(password_hash('x', PASSWORD_BCRYPT)));

        Config::set('status.password.hash_driver', 'bcrypt');
        $this->assertTrue($this->hasher->needsRehash((new Argon2Password)->hash('x')));
    }
}
