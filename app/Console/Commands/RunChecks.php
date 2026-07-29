<?php

namespace App\Console\Commands;

use App\Services\CheckService;
use Illuminate\Console\Command;
use Throwable;

class RunChecks extends Command
{
    protected $signature = 'status:check';

    protected $description = 'Probe every active monitor, store the results, and fan out alerts';

    public function handle(CheckService $checks): int
    {
        try {
            $checked = $checks->runChecks();
        } catch (Throwable $error) {
            $this->components->error('Check run failed: '.$error->getMessage());

            return self::FAILURE;
        }

        $this->components->info(
            $checked === 1 ? 'Checked 1 monitor.' : "Checked {$checked} monitors."
        );

        return self::SUCCESS;
    }
}
