<?php

namespace Database\Seeders;

use App\Services\UserService;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(UserService $users): void
    {
        if ($users->seedAdminIfEmpty()) {
            $this->command?->info(
                'Created default admin user "'.config('status.seed_admin.username').'".'
            );

            return;
        }

        $this->command?->info('Users already exist; nothing to seed.');
    }
}
