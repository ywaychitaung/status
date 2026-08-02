<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('github_security_scans') && ! Schema::hasTable('security_scans')) {
            Schema::rename('github_security_scans', 'security_scans');
        }

        if (! Schema::hasTable('security_scans')) {
            Schema::create('security_scans', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('github_repo_id')->nullable()->constrained('github_repos')->nullOnDelete();
                $table->string('monitor_id', 26)->nullable()->index();
                $table->string('source')->default('zap_daily');
                $table->string('engine')->default('owasp_zap');
                $table->text('repo_full_name')->nullable();
                $table->string('commit_sha', 64)->nullable();
                $table->text('commit_message')->nullable();
                $table->text('pusher_login')->nullable();
                $table->text('domain_url');
                $table->string('status');
                $table->text('summary');
                $table->text('details');
                $table->unsignedInteger('alert_high')->default(0);
                $table->unsignedInteger('alert_medium')->default(0);
                $table->unsignedInteger('alert_low')->default(0);
                $table->unsignedInteger('alert_info')->default(0);
                $table->integer('exit_code')->nullable();
                $table->timestamp('scanned_at');
                $table->timestamps();

                $table->index(['user_id', 'scanned_at']);
                $table->index('status');
                $table->index('engine');
            });

            return;
        }

        Schema::table('security_scans', function (Blueprint $table) {
            if (! Schema::hasColumn('security_scans', 'monitor_id')) {
                $table->string('monitor_id', 26)->nullable()->after('github_repo_id')->index();
            }
            if (! Schema::hasColumn('security_scans', 'engine')) {
                $table->string('engine')->default('domain')->after('source')->index();
            }
            if (! Schema::hasColumn('security_scans', 'alert_high')) {
                $table->unsignedInteger('alert_high')->default(0)->after('details');
            }
            if (! Schema::hasColumn('security_scans', 'alert_medium')) {
                $table->unsignedInteger('alert_medium')->default(0)->after('alert_high');
            }
            if (! Schema::hasColumn('security_scans', 'alert_low')) {
                $table->unsignedInteger('alert_low')->default(0)->after('alert_medium');
            }
            if (! Schema::hasColumn('security_scans', 'alert_info')) {
                $table->unsignedInteger('alert_info')->default(0)->after('alert_low');
            }
            if (! Schema::hasColumn('security_scans', 'exit_code')) {
                $table->integer('exit_code')->nullable()->after('alert_info');
            }
        });

        // Widen columns that will hold Laravel Crypt payloads.
        DB::statement('ALTER TABLE security_scans ALTER COLUMN domain_url TYPE text');
        DB::statement('ALTER TABLE security_scans ALTER COLUMN summary TYPE text');
        DB::statement('ALTER TABLE security_scans ALTER COLUMN details TYPE text USING details::text');
        DB::statement('ALTER TABLE security_scans ALTER COLUMN repo_full_name TYPE text');
        DB::statement('ALTER TABLE security_scans ALTER COLUMN commit_message TYPE text');
        DB::statement('ALTER TABLE security_scans ALTER COLUMN pusher_login TYPE text');
        DB::statement('ALTER TABLE security_scans ALTER COLUMN user_id DROP NOT NULL');

        $this->encryptExistingRows();
    }

    public function down(): void
    {
        if (! Schema::hasTable('security_scans')) {
            return;
        }

        Schema::table('security_scans', function (Blueprint $table) {
            foreach (['monitor_id', 'engine', 'alert_high', 'alert_medium', 'alert_low', 'alert_info', 'exit_code'] as $column) {
                if (Schema::hasColumn('security_scans', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        if (! Schema::hasTable('github_security_scans')) {
            Schema::rename('security_scans', 'github_security_scans');
        }
    }

    private function encryptExistingRows(): void
    {
        DB::table('security_scans')->orderBy('id')->chunkById(50, function ($rows): void {
            foreach ($rows as $row) {
                $updates = [];

                foreach (['domain_url', 'summary', 'repo_full_name', 'commit_message', 'pusher_login'] as $column) {
                    $value = $row->{$column} ?? null;
                    if (! is_string($value) || $value === '' || $this->looksEncrypted($value)) {
                        continue;
                    }
                    $updates[$column] = Crypt::encryptString($value);
                }

                $details = $row->details ?? null;
                if (is_string($details) && $details !== '' && ! $this->looksEncrypted($details)) {
                    // Already JSON text from ::text cast, or a JSON string — normalize then encrypt.
                    $decoded = json_decode($details, true);
                    $payload = json_last_error() === JSON_ERROR_NONE ? json_encode($decoded) : $details;
                    $updates['details'] = Crypt::encryptString((string) $payload);
                }

                if ($updates !== []) {
                    DB::table('security_scans')->where('id', $row->id)->update($updates);
                }
            }
        });
    }

    private function looksEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }
};
