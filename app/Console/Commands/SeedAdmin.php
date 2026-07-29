<?php

namespace App\Console\Commands;

use App\Services\UserService;
use Illuminate\Console\Command;
use Throwable;

class SeedAdmin extends Command
{
    protected $signature = 'status:seed-admin';

    protected $description = 'Create the default admin user when the users table is empty';

    public function handle(UserService $users): int
    {
        try {
            $seeded = $users->seedAdminIfEmpty();
        } catch (Throwable $error) {
            $this->components->error('Seeding failed: '.$error->getMessage());

            return self::FAILURE;
        }

        if (! $seeded) {
            $this->components->info('Users already exist; nothing to seed.');

            return self::SUCCESS;
        }

        $username = config('status.seed_admin.username');

        $this->components->info("Created default admin user \"{$username}\". Change the password after signing in.");

        return self::SUCCESS;
    }
}
