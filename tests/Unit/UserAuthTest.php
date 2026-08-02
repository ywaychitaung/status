<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\FieldCrypto;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserAuthTest extends TestCase
{
    public function test_laravel_hash_driver_is_configured(): void
    {
        $hash = Hash::make('password');

        $this->assertTrue(Hash::check('password', $hash));
        $this->assertFalse(Hash::check('wrong', $hash));
    }

    public function test_user_uses_encrypted_identity_and_sanctum(): void
    {
        $user = new User;
        $casts = $user->getCasts();

        $this->assertSame('encrypted', $casts['name'] ?? null);
        $this->assertSame('encrypted', $casts['username'] ?? null);
        $this->assertSame('encrypted', $casts['email'] ?? null);
        $this->assertSame('hashed', $casts['password'] ?? null);
        $this->assertTrue(method_exists($user, 'createToken'));
    }

    public function test_identity_hash_is_case_insensitive_and_stable(): void
    {
        $crypto = app(FieldCrypto::class);

        $this->assertSame(User::hashIdentity('Admin'), User::hashIdentity('admin'));
        $this->assertSame(User::hashIdentity('Admin@Example.com'), User::hashIdentity('admin@example.com'));
        $this->assertSame($crypto->blindIndex('admin'), User::hashIdentity('Admin'));
        $this->assertNotSame(User::hashIdentity('admin'), User::hashIdentity('admin@status.local'));
    }
}
