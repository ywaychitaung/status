<?php

namespace App\Http\Controllers;

use App\Services\GithubAppService;
use App\Services\SecurityScanService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Throwable;

class GithubWebhookController extends Controller
{
    public function __construct(
        private readonly GithubAppService $github,
        private readonly SecurityScanService $security,
    ) {}

    public function __invoke(Request $request): Response
    {
        $payload = $request->getContent();
        $signature = $request->header('X-Hub-Signature-256');

        if (! $this->github->verifyWebhookSignature($payload, $signature)) {
            Log::warning('GitHub webhook rejected: invalid signature');

            return response('Invalid signature', 401);
        }

        $event = (string) $request->header('X-GitHub-Event', '');
        $data = json_decode($payload, true);
        if (! is_array($data)) {
            return response('Bad payload', 400);
        }

        try {
            if ($event === 'push') {
                $created = $this->security->handlePush($data);
                Log::info("GitHub push webhook processed; scans created: {$created}");
            } elseif ($event === 'ping') {
                return response('pong', 200);
            }
        } catch (Throwable $error) {
            Log::error('GitHub webhook failed: '.$error->getMessage());

            return response('Webhook handler error', 500);
        }

        return response('ok', 200);
    }
}
