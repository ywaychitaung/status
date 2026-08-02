<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('security_scans')) {
            return;
        }

        // Drop GitHub-only columns (CASCADE clears any leftover FK).
        foreach (['github_repo_id', 'commit_sha', 'commit_message', 'pusher_login'] as $column) {
            if (Schema::hasColumn('security_scans', $column)) {
                DB::statement("ALTER TABLE security_scans DROP COLUMN IF EXISTS {$column} CASCADE");
            }
        }

        // Prefer rename; fall back to copy+drop if the driver needs it.
        if (Schema::hasColumn('security_scans', 'repo_full_name') && ! Schema::hasColumn('security_scans', 'monitor_name')) {
            try {
                Schema::table('security_scans', function (Blueprint $table) {
                    $table->renameColumn('repo_full_name', 'monitor_name');
                });
            } catch (\Throwable) {
                Schema::table('security_scans', function (Blueprint $table) {
                    $table->text('monitor_name')->nullable();
                });
                DB::statement('UPDATE security_scans SET monitor_name = repo_full_name');
                DB::statement('ALTER TABLE security_scans DROP COLUMN IF EXISTS repo_full_name CASCADE');
            }
        } elseif (! Schema::hasColumn('security_scans', 'monitor_name')) {
            Schema::table('security_scans', function (Blueprint $table) {
                $table->text('monitor_name')->nullable();
            });
        }

        DB::table('security_scans')
            ->where(function ($query): void {
                $query->whereNull('engine')
                    ->orWhere('engine', '')
                    ->orWhere('engine', 'domain');
            })
            ->update(['engine' => 'owasp_zap', 'source' => 'zap_daily']);

        Schema::dropIfExists('github_repos');
        Schema::dropIfExists('github_installations');
    }

    public function down(): void
    {
        if (! Schema::hasTable('github_installations')) {
            Schema::create('github_installations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedBigInteger('installation_id')->unique();
                $table->string('account_login')->nullable();
                $table->string('account_type')->nullable();
                $table->string('account_avatar_url')->nullable();
                $table->timestamps();
                $table->index('user_id');
            });
        }

        if (! Schema::hasTable('github_repos')) {
            Schema::create('github_repos', function (Blueprint $table) {
                $table->id();
                $table->foreignId('github_installation_id')->constrained('github_installations')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedBigInteger('github_repo_id');
                $table->string('full_name');
                $table->string('name');
                $table->string('owner_login');
                $table->boolean('private')->default(false);
                $table->string('html_url')->nullable();
                $table->string('default_branch')->nullable();
                $table->string('domain_url');
                $table->boolean('scan_on_push')->default(true);
                $table->timestamps();
                $table->unique(['user_id', 'github_repo_id']);
                $table->index('full_name');
                $table->index('user_id');
            });
        }

        if (Schema::hasTable('security_scans') && Schema::hasColumn('security_scans', 'monitor_name') && ! Schema::hasColumn('security_scans', 'repo_full_name')) {
            Schema::table('security_scans', function (Blueprint $table) {
                $table->renameColumn('monitor_name', 'repo_full_name');
            });
        }
    }
};
