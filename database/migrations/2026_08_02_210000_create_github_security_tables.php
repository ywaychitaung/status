<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
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
                /** Domain / URL to scan on each push (e.g. https://example.com). */
                $table->string('domain_url');
                $table->boolean('scan_on_push')->default(true);
                $table->timestamps();

                $table->unique(['user_id', 'github_repo_id']);
                $table->index('full_name');
                $table->index('user_id');
            });
        }

        if (! Schema::hasTable('github_security_scans')) {
            Schema::create('github_security_scans', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('github_repo_id')->nullable()->constrained('github_repos')->nullOnDelete();
                $table->string('source')->default('github_push');
                $table->string('repo_full_name')->nullable();
                $table->string('commit_sha', 64)->nullable();
                $table->string('commit_message')->nullable();
                $table->string('pusher_login')->nullable();
                $table->string('domain_url');
                $table->string('status'); // pass | warn | fail
                $table->string('summary');
                $table->json('details');
                $table->timestamp('scanned_at');
                $table->timestamps();

                $table->index(['user_id', 'scanned_at']);
                $table->index('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('github_security_scans');
        Schema::dropIfExists('github_repos');
        Schema::dropIfExists('github_installations');
    }
};
