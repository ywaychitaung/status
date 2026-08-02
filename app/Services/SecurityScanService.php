<?php

namespace App\Services;

use App\Exceptions\StatusException;
use App\Models\GithubInstallation;
use App\Models\GithubRepo;
use App\Models\SecurityScan;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/** Connect installs, link repos+domains, run/persist domain security scans. */
class SecurityScanService
{
    public function __construct(
        private readonly GithubAppService $github,
        private readonly DomainSecurityScanner $scanner,
    ) {}

    public function isConfigured(): bool
    {
        return $this->github->isConfigured();
    }

    public function connectUrl(User $user): string
    {
        if (! $this->isConfigured()) {
            throw new StatusException('GitHub App is not configured on this server.');
        }

        $state = $this->github->createState((int) $user->id);

        return $this->github->installUrl($state);
    }

    public function completeInstall(?string $state, ?string $installationId): GithubInstallation
    {
        if ($state === null || $state === '' || $installationId === null || $installationId === '') {
            throw new StatusException('Missing GitHub installation callback parameters.');
        }

        $userId = $this->github->consumeState($state);
        if ($userId === null) {
            throw new StatusException('GitHub install state expired or invalid. Try connecting again.');
        }

        $user = User::query()->find($userId);
        if ($user === null) {
            throw new StatusException('User for GitHub install no longer exists.');
        }

        $installationGithubId = (int) $installationId;
        $account = $this->github->installationAccount($installationGithubId);

        return GithubInstallation::query()->updateOrCreate(
            ['installation_id' => $installationGithubId],
            [
                'user_id' => $user->id,
                'account_login' => $account['login'],
                'account_type' => $account['type'],
                'account_avatar_url' => $account['avatarUrl'],
            ]
        );
    }

    /**
     * @return array{
     *   configured: bool,
     *   installUrl: string|null,
     *   installations: list<array<string, mixed>>,
     *   availableRepos: list<array<string, mixed>>,
     *   linkedRepos: list<array<string, mixed>>,
     *   scans: list<array<string, mixed>>
     * }
     */
    public function pageData(User $user): array
    {
        $configured = $this->isConfigured();
        $installations = GithubInstallation::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->get();

        $availableRepos = [];
        if ($configured) {
            foreach ($installations as $installation) {
                try {
                    foreach ($this->github->listInstallationRepos((int) $installation->installation_id) as $repo) {
                        $availableRepos[] = [
                            ...$repo,
                            'installationId' => (int) $installation->id,
                            'githubInstallationId' => (int) $installation->installation_id,
                            'accountLogin' => (string) ($installation->account_login ?? ''),
                        ];
                    }
                } catch (Throwable $error) {
                    Log::warning('Failed listing GitHub repos: '.$error->getMessage());
                }
            }
        }

        $linked = GithubRepo::query()
            ->where('user_id', $user->id)
            ->orderBy('full_name')
            ->get()
            ->map(fn (GithubRepo $repo): array => $repo->toForm())
            ->values()
            ->all();

        $scans = SecurityScan::query()
            ->where('user_id', $user->id)
            ->orderByDesc('scanned_at')
            ->limit(100)
            ->get()
            ->map(fn (SecurityScan $scan): array => $scan->toArrayForUi())
            ->values()
            ->all();

        return [
            'configured' => $configured,
            'installUrl' => $configured ? '/security/connect' : null,
            'installations' => $installations->map(fn (GithubInstallation $row): array => [
                'id' => (int) $row->id,
                'installationId' => (int) $row->installation_id,
                'accountLogin' => (string) ($row->account_login ?? ''),
                'accountType' => (string) ($row->account_type ?? ''),
                'accountAvatarUrl' => (string) ($row->account_avatar_url ?? ''),
            ])->values()->all(),
            'availableRepos' => $availableRepos,
            'linkedRepos' => $linked,
            'scans' => $scans,
        ];
    }

    public function linkRepo(User $user, int $installationRowId, int $githubRepoId, string $domainUrl): GithubRepo
    {
        $installation = GithubInstallation::query()
            ->where('user_id', $user->id)
            ->where('id', $installationRowId)
            ->first();

        if ($installation === null) {
            throw new StatusException('GitHub installation not found.');
        }

        $normalizedDomain = $this->normalizeDomain($domainUrl);
        $match = null;
        foreach ($this->github->listInstallationRepos((int) $installation->installation_id) as $repo) {
            if ($repo['id'] === $githubRepoId) {
                $match = $repo;
                break;
            }
        }

        if ($match === null) {
            throw new StatusException('Repository is not available on this GitHub installation.');
        }

        return GithubRepo::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'github_repo_id' => $match['id'],
            ],
            [
                'github_installation_id' => $installation->id,
                'full_name' => $match['fullName'],
                'name' => $match['name'],
                'owner_login' => $match['ownerLogin'],
                'private' => $match['private'],
                'html_url' => $match['htmlUrl'],
                'default_branch' => $match['defaultBranch'],
                'domain_url' => $normalizedDomain,
                'scan_on_push' => true,
            ]
        );
    }

    public function updateLinkedRepo(User $user, int $repoId, string $domainUrl, bool $scanOnPush): GithubRepo
    {
        $repo = GithubRepo::query()->where('user_id', $user->id)->where('id', $repoId)->first();
        if ($repo === null) {
            throw new StatusException('Linked repository not found.');
        }

        $repo->domain_url = $this->normalizeDomain($domainUrl);
        $repo->scan_on_push = $scanOnPush;
        $repo->save();

        return $repo;
    }

    public function unlinkRepo(User $user, int $repoId): void
    {
        $deleted = GithubRepo::query()->where('user_id', $user->id)->where('id', $repoId)->delete();
        if ($deleted === 0) {
            throw new StatusException('Linked repository not found.');
        }
    }

    public function runManualScan(User $user, int $repoId): SecurityScan
    {
        $repo = GithubRepo::query()->where('user_id', $user->id)->where('id', $repoId)->first();
        if ($repo === null) {
            throw new StatusException('Linked repository not found.');
        }

        return $this->persistScan(
            userId: (int) $user->id,
            repo: $repo,
            source: 'manual',
            commitSha: null,
            commitMessage: null,
            pusherLogin: null,
        );
    }

    /**
     * Handle a verified GitHub push webhook payload.
     *
     * @param  array<string, mixed>  $payload
     */
    public function handlePush(array $payload): int
    {
        $fullName = (string) data_get($payload, 'repository.full_name', '');
        if ($fullName === '') {
            return 0;
        }

        $repos = GithubRepo::query()
            ->where('full_name', $fullName)
            ->where('scan_on_push', true)
            ->get();

        $created = 0;
        foreach ($repos as $repo) {
            $this->persistScan(
                userId: (int) $repo->user_id,
                repo: $repo,
                source: 'github_push',
                commitSha: data_get($payload, 'after') ? (string) data_get($payload, 'after') : null,
                commitMessage: data_get($payload, 'head_commit.message')
                    ? Str::limit((string) data_get($payload, 'head_commit.message'), 240, '…')
                    : null,
                pusherLogin: data_get($payload, 'pusher.name')
                    ? (string) data_get($payload, 'pusher.name')
                    : (data_get($payload, 'sender.login') ? (string) data_get($payload, 'sender.login') : null),
            );
            $created++;
        }

        return $created;
    }

    private function persistScan(
        int $userId,
        GithubRepo $repo,
        string $source,
        ?string $commitSha,
        ?string $commitMessage,
        ?string $pusherLogin,
    ): SecurityScan {
        $result = $this->scanner->scan((string) $repo->domain_url);

        return SecurityScan::query()->create([
            'user_id' => $userId,
            'github_repo_id' => $repo->id,
            'source' => $source,
            'repo_full_name' => $repo->full_name,
            'commit_sha' => $commitSha,
            'commit_message' => $commitMessage,
            'pusher_login' => $pusherLogin,
            'domain_url' => $repo->domain_url,
            'status' => $result['status'],
            'summary' => $result['summary'],
            'details' => $result['details'],
            'scanned_at' => now(),
        ]);
    }

    private function normalizeDomain(string $domainUrl): string
    {
        $trimmed = trim($domainUrl);
        if ($trimmed === '') {
            throw new StatusException('Domain URL is required.');
        }

        if (! preg_match('#^https?://#i', $trimmed)) {
            $trimmed = 'https://'.$trimmed;
        }

        $parts = parse_url($trimmed);
        if (! is_array($parts) || empty($parts['host'])) {
            throw new StatusException('Enter a valid domain URL (e.g. https://example.com).');
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? 'https'));
        if ($scheme !== 'https' && $scheme !== 'http') {
            throw new StatusException('Domain URL must start with http:// or https://.');
        }

        $host = strtolower((string) $parts['host']);
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = $parts['path'] ?? '';

        return $scheme.'://'.$host.$port.($path === '' || $path === '/' ? '' : rtrim($path, '/'));
    }
}
