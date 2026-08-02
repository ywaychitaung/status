import { usePage } from '@inertiajs/react';

import { csrfToken } from '@/lib/csrf';
import type { SecurityScanRecord, StatusSharedProps } from '@/types/status';

export interface SecurityViewProps {
    scans: SecurityScanRecord[];
    zapReady: boolean;
    monitorCount: number;
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

export default function SecurityView({ scans, zapReady, monitorCount, flash, error }: SecurityViewProps) {
    const { app } = usePage<StatusSharedProps>().props;
    const scheduleLabel = app.zap?.scheduleLabel ?? 'Every Saturday at 6:00 AM SGT';

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
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold tracking-tight">OWASP ZAP</h2>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Baseline scans run {scheduleLabel.toLowerCase()} against every active website in Admin.
                            Results are stored encrypted in <span className="font-mono">security_scans</span>.
                        </p>
                    </div>
                    <form action="/security/scan" method="post">
                        <input type="hidden" name="_token" value={csrfToken()} />
                        <button
                            type="submit"
                            disabled={!zapReady || monitorCount === 0}
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                            Scan all now
                        </button>
                    </form>
                </div>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {monitorCount} active website{monitorCount === 1 ? '' : 's'}
                    {zapReady ? ' · ZAP ready' : ' · Docker / ZAP not available on this server'}
                    {' · '}
                    schedule: {scheduleLabel}
                </p>
            </section>

            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <h2 className="text-sm font-semibold tracking-tight">Scan history</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Newest first.</p>

                {scans.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No scans yet.</p>
                ) : (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200/90 dark:border-zinc-800">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-zinc-50 text-[11px] font-medium tracking-wider text-zinc-500 uppercase dark:bg-zinc-950/60 dark:text-zinc-400">
                                <tr>
                                    <th className="px-3 py-2">When</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Website</th>
                                    <th className="px-3 py-2">Summary</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scans.map((scan) => (
                                    <tr key={scan.id} className="border-t border-zinc-200/90 dark:border-zinc-800">
                                        <td className="px-3 py-3 align-top text-xs text-zinc-500 dark:text-zinc-400">
                                            <div>{scan.scannedAt}</div>
                                            <div className="mt-0.5">{scan.source}</div>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <span
                                                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusClass(scan.status)}`}
                                            >
                                                {scan.status}
                                            </span>
                                            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                H{scan.alertHigh} / M{scan.alertMedium} / L{scan.alertLow} / I
                                                {scan.alertInfo}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <div className="font-medium">{scan.monitorName || '—'}</div>
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
                                                    )
                                                        .slice(0, 8)
                                                        .map((check, index) => (
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
