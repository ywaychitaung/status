<?php

namespace App\Services;

use App\Exceptions\StatusException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/** GitHub App JWT + installation API client. */
class GithubAppService
{
    public function isConfigured(): bool
    {
        return filled(config('github.app_id'))
            && filled(config('github.private_key'))
            && filled(config('github.slug'));
    }

    public function installUrl(string $state): string
    {
        $slug = (string) config('github.slug');

        return "https://github.com/apps/{$slug}/installations/new?state=".urlencode($state);
    }

    public function createState(int $userId): string
    {
        $nonce = Str::random(32);
        Cache::put($this->stateCacheKey($nonce), $userId, now()->addMinutes(30));

        return $nonce;
    }

    public function consumeState(string $state): ?int
    {
        $key = $this->stateCacheKey($state);
        $userId = Cache::pull($key);

        return is_int($userId) ? $userId : (is_numeric($userId) ? (int) $userId : null);
    }

    /**
     * @return list<array{
     *   id: int,
     *   fullName: string,
     *   name: string,
     *   ownerLogin: string,
     *   private: bool,
     *   htmlUrl: string,
     *   defaultBranch: string
     * }>
     */
    public function listInstallationRepos(int $installationId): array
    {
        $token = $this->installationToken($installationId);
        $repos = [];
        $page = 1;

        do {
            $response = Http::withToken($token)
                ->accept('application/vnd.github+json')
                ->withHeaders(['X-GitHub-Api-Version' => '2022-11-28'])
                ->timeout(20)
                ->get('https://api.github.com/installation/repositories', [
                    'per_page' => 100,
                    'page' => $page,
                ]);

            if ($response->failed()) {
                throw new StatusException('GitHub API error while listing repositories (HTTP '.$response->status().').');
            }

            $batch = $response->json('repositories') ?? [];
            foreach ($batch as $repo) {
                if (! is_array($repo)) {
                    continue;
                }
                $repos[] = [
                    'id' => (int) ($repo['id'] ?? 0),
                    'fullName' => (string) ($repo['full_name'] ?? ''),
                    'name' => (string) ($repo['name'] ?? ''),
                    'ownerLogin' => (string) data_get($repo, 'owner.login', ''),
                    'private' => (bool) ($repo['private'] ?? false),
                    'htmlUrl' => (string) ($repo['html_url'] ?? ''),
                    'defaultBranch' => (string) ($repo['default_branch'] ?? 'main'),
                ];
            }

            $page++;
            $hasMore = count($batch) === 100;
        } while ($hasMore && $page <= 10);

        return $repos;
    }

    /** @return array{login: string|null, type: string|null, avatarUrl: string|null} */
    public function installationAccount(int $installationId): array
    {
        $jwt = $this->appJwt();
        $response = Http::withToken($jwt, 'Bearer')
            ->accept('application/vnd.github+json')
            ->withHeaders(['X-GitHub-Api-Version' => '2022-11-28'])
            ->timeout(20)
            ->get("https://api.github.com/app/installations/{$installationId}");

        if ($response->failed()) {
            return ['login' => null, 'type' => null, 'avatarUrl' => null];
        }

        return [
            'login' => data_get($response->json(), 'account.login'),
            'type' => data_get($response->json(), 'account.type'),
            'avatarUrl' => data_get($response->json(), 'account.avatar_url'),
        ];
    }

    public function installationToken(int $installationId): string
    {
        $jwt = $this->appJwt();
        $response = Http::withToken($jwt, 'Bearer')
            ->accept('application/vnd.github+json')
            ->withHeaders(['X-GitHub-Api-Version' => '2022-11-28'])
            ->timeout(20)
            ->post("https://api.github.com/app/installations/{$installationId}/access_tokens");

        if ($response->failed()) {
            throw new StatusException('Could not create GitHub installation token (HTTP '.$response->status().').');
        }

        $token = (string) $response->json('token');
        if ($token === '') {
            throw new StatusException('GitHub installation token response was empty.');
        }

        return $token;
    }

    public function verifyWebhookSignature(string $payload, ?string $signatureHeader): bool
    {
        $secret = (string) config('github.webhook_secret');
        if ($secret === '' || $signatureHeader === null || $signatureHeader === '') {
            return false;
        }

        if (! str_starts_with($signatureHeader, 'sha256=')) {
            return false;
        }

        $expected = 'sha256='.hash_hmac('sha256', $payload, $secret);

        return hash_equals($expected, $signatureHeader);
    }

    private function appJwt(): string
    {
        $appId = (string) config('github.app_id');
        $privateKey = $this->privateKeyPem();
        if ($appId === '' || $privateKey === '') {
            throw new RuntimeException('GitHub App is not configured.');
        }

        $now = time();
        $header = $this->base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $payload = $this->base64UrlEncode(json_encode([
            'iat' => $now - 60,
            'exp' => $now + (9 * 60),
            'iss' => $appId,
        ], JSON_THROW_ON_ERROR));

        $data = $header.'.'.$payload;
        $signature = '';
        $ok = openssl_sign($data, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        if (! $ok) {
            throw new RuntimeException('Failed to sign GitHub App JWT.');
        }

        return $data.'.'.$this->base64UrlEncode($signature);
    }

    private function privateKeyPem(): string
    {
        $raw = (string) config('github.private_key');
        if ($raw === '') {
            return '';
        }

        // Support path to PEM file or inline PEM (with \n escapes).
        if (is_file($raw)) {
            return (string) file_get_contents($raw);
        }

        return str_replace('\\n', "\n", $raw);
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function stateCacheKey(string $nonce): string
    {
        return 'github_install_state:'.$nonce;
    }
}
