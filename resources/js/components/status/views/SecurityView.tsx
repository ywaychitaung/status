import { useMemo, useState } from 'react';

import { csrfToken } from '@/lib/csrf';
import type {
    GithubAvailableRepo,
    GithubInstallationSummary,
    LinkedGithubRepo,
    SecurityScanRecord,
} from '@/types/status';

export interface SecurityViewProps {
    configured: boolean;
    installUrl: string | null;
    installations: GithubInstallationSummary[];
    availableRepos: GithubAvailableRepo[];
    linkedRepos: LinkedGithubRepo[];
    scans: SecurityScanRecord[];
    flash: string | null;
    error: string | null;
}

function statusClass(status: string): string {
    if (status === 'pass') {
        return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
    }
    if (status === 'warn') {
        return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
    }

    return 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300';
}

export default function SecurityView({
    configured,
    installations,
    availableRepos,
    linkedRepos,
    scans,
    flash,
    error,
}: SecurityViewProps) {
    const unlinked = useMemo(
        () => availableRepos.filter((repo) => !linkedRepos.some((linked) => linked.githubRepoId === repo.id)),
        [availableRepos, linkedRepos],
    );

    const [selectedRepoId, setSelectedRepoId] = useState('');
    const selectedInstallationId = useMemo(() => {
        const match = unlinked.find((repo) => String(repo.id) === selectedRepoId);

        return match ? String(match.installationId) : '';
    }, [selectedRepoId, unlinked]);

    return (
        <div className="w-full space-y-6">
            {flash && (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {flash}
                </p>
            )}
            {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </p>
            )}

            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <h2 className="text-sm font-semibold tracking-tight">Connect GitHub</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Install the Status GitHub App on a customer account or org. Every push to a linked repo triggers a
                    domain security scan and saves the report here.
                </p>

                {!configured ? (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                        GitHub App env vars are not configured yet (`GITHUB_APP_ID`, `GITHUB_APP_SLUG`,
                        `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`).
                    </p>
                ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <a
                            href="/security/connect"
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                            {installations.length > 0 ? 'Add / manage GitHub install' : 'Connect GitHub'}
                        </a>
                        {installations.length > 0 && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Connected:{' '}
                                {installations.map((item) => item.accountLogin || `#${item.installationId}`).join(', ')}
                            </p>
                        )}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <h2 className="text-sm font-semibold tracking-tight">Link repository + domain</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Choose a repo from the installation and set the public website domain to scan on each push.
                </p>

                {unlinked.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {installations.length === 0
                            ? 'Connect GitHub first to see repositories.'
                            : 'All available repositories are already linked, or none were returned by GitHub.'}
                    </p>
                ) : (
                    <form method="post" action="/security/repos" className="mt-4 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="_token" value={csrfToken()} />
                        <input type="hidden" name="installation_id" value={selectedInstallationId} />
                        <label className="block sm:col-span-2">
                            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                                Repository
                            </span>
                            <select
                                name="github_repo_id"
                                required
                                value={selectedRepoId}
                                onChange={(event) => setSelectedRepoId(event.target.value)}
                                className="mt-1.5 w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                            >
                                <option value="" disabled>
                                    Select a repository…
                                </option>
                                {unlinked.map((repo) => (
                                    <option key={repo.id} value={repo.id}>
                                        {repo.fullName}
                                        {repo.private ? ' (private)' : ''}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block sm:col-span-2">
                            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                                Domain URL
                            </span>
                            <input
                                type="url"
                                name="domain_url"
                                required
                                placeholder="https://example.com"
                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                            />
                        </label>
                        <div className="sm:col-span-2">
                            <button
                                type="submit"
                                disabled={!selectedRepoId || !selectedInstallationId}
                                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                            >
                                Link repository
                            </button>
                        </div>
                    </form>
                )}
            </section>

            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <h2 className="text-sm font-semibold tracking-tight">Linked repositories</h2>
                {linkedRepos.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No repositories linked yet.</p>
                ) : (
                    <ul className="mt-4 space-y-4">
                        {linkedRepos.map((repo) => (
                            <li
                                key={repo.id}
                                className="rounded-xl border border-zinc-200/90 p-4 dark:border-zinc-800"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium">{repo.fullName}</p>
                                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{repo.domainUrl}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <form method="post" action={`/security/repos/${repo.id}/scan`}>
                                            <input type="hidden" name="_token" value={csrfToken()} />
                                            <button
                                                type="submit"
                                                className="cursor-pointer rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                            >
                                                Scan now
                                            </button>
                                        </form>
                                        <form method="post" action={`/security/repos/${repo.id}`}>
                                            <input type="hidden" name="_token" value={csrfToken()} />
                                            <input type="hidden" name="_method" value="DELETE" />
                                            <button
                                                type="submit"
                                                className="cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                                            >
                                                Unlink
                                            </button>
                                        </form>
                                    </div>
                                </div>
                                <form
                                    method="post"
                                    action={`/security/repos/${repo.id}`}
                                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
                                >
                                    <input type="hidden" name="_token" value={csrfToken()} />
                                    <input type="hidden" name="_method" value="PATCH" />
                                    <input type="hidden" name="scan_on_push" value="0" />
                                    <input
                                        type="url"
                                        name="domain_url"
                                        defaultValue={repo.domainUrl}
                                        required
                                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                                    />
                                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                                        <input
                                            type="checkbox"
                                            name="scan_on_push"
                                            value="1"
                                            defaultChecked={repo.scanOnPush}
                                            className="cursor-pointer"
                                        />
                                        Scan on push
                                    </label>
                                    <button
                                        type="submit"
                                        className="cursor-pointer rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                                    >
                                        Save
                                    </button>
                                </form>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <h2 className="text-sm font-semibold tracking-tight">Scan history</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Results from GitHub pushes and manual scans (newest first).
                </p>

                {scans.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No scans yet.</p>
                ) : (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200/90 dark:border-zinc-800">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-zinc-50 text-[11px] font-medium tracking-wider text-zinc-500 uppercase dark:bg-zinc-950/60 dark:text-zinc-400">
                                <tr>
                                    <th className="px-3 py-2">When</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Repo / domain</th>
                                    <th className="px-3 py-2">Summary</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scans.map((scan) => (
                                    <tr key={scan.id} className="border-t border-zinc-200/90 dark:border-zinc-800">
                                        <td className="px-3 py-3 align-top text-xs text-zinc-500 dark:text-zinc-400">
                                            <div>{scan.scannedAt}</div>
                                            <div className="mt-0.5">{scan.source}</div>
                                            {scan.commitSha ? (
                                                <div className="mt-0.5 font-mono">{scan.commitSha.slice(0, 7)}</div>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <span
                                                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusClass(scan.status)}`}
                                            >
                                                {scan.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <div className="font-medium">{scan.repoFullName || '—'}</div>
                                            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                                {scan.domainUrl}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 align-top text-xs text-zinc-600 dark:text-zinc-300">
                                            <div>{scan.summary}</div>
                                            {Array.isArray(scan.details?.checks) && (
                                                <ul className="mt-2 space-y-1">
                                                    {(
                                                        scan.details.checks as Array<{
                                                            label?: string;
                                                            message?: string;
                                                        }>
                                                    ).map((check, index) => (
                                                        <li key={`${scan.id}-${index}`}>
                                                            <span className="font-medium">{check.label}:</span>{' '}
                                                            {check.message}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
