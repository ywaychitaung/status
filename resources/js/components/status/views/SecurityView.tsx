import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { csrfToken } from '@/lib/csrf';
import { formatDashboardDatetime } from '@/lib/datetime';
import type { SecurityScanRecord, StatusSharedProps, ZapScanRunRecord } from '@/types/status';

export interface SecurityViewProps {
    scans: SecurityScanRecord[];
    zapReady: boolean;
    monitorCount: number;
    activeRun: ZapScanRunRecord | null;
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

function formatElapsed(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }

    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function formatScanSource(source: string): string {
    if (source === 'manual_trigger') {
        return 'manual trigger';
    }

    if (source === 'zap_weekly' || source === 'zap_daily') {
        return 'zap_weekly';
    }

    return source;
}

export default function SecurityView({
    scans,
    zapReady,
    monitorCount,
    activeRun: initialActiveRun,
    flash,
    error: initialError,
}: SecurityViewProps) {
    const { app } = usePage<StatusSharedProps>().props;
    const scheduleLabel = app.zap?.scheduleLabel ?? 'Every Saturday at 6:00 AM SGT';
    const [activeRun, setActiveRun] = useState<ZapScanRunRecord | null>(initialActiveRun);
    const [starting, setStarting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        setActiveRun(initialActiveRun);
    }, [initialActiveRun]);

    useEffect(() => {
        setLocalError(null);
    }, [initialError, flash]);

    const error = localError ?? initialError;
    const isScanning = Boolean(activeRun?.isActive && activeRun.status === 'running');

    useEffect(() => {
        if (!isScanning) {
            return;
        }

        const tick = window.setInterval(() => setNowMs(Date.now()), 1000);

        return () => window.clearInterval(tick);
    }, [isScanning]);

    useEffect(() => {
        if (!isScanning) {
            return;
        }

        let cancelled = false;

        const poll = async () => {
            try {
                const response = await fetch('/security/scan-status', {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': csrfToken(),
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok || cancelled) {
                    return;
                }

                const data = (await response.json()) as {
                    activeRun: ZapScanRunRecord | null;
                    lastRun?: ZapScanRunRecord | null;
                };
                if (cancelled) {
                    return;
                }

                if (data.activeRun) {
                    setActiveRun(data.activeRun);
                    return;
                }

                setActiveRun(null);

                if (data.lastRun?.status === 'failed' && data.lastRun.error) {
                    setLocalError(data.lastRun.error);
                }

                router.reload({ only: ['scans', 'activeRun', 'flash', 'error'] });
            } catch {
                // Keep polling; transient network errors are fine.
            }
        };

        const id = window.setInterval(poll, 5000);
        // Delay the first poll slightly so a just-spawned worker is visible.
        const first = window.setTimeout(() => {
            void poll();
        }, 1500);

        return () => {
            cancelled = true;
            window.clearInterval(id);
            window.clearTimeout(first);
        };
    }, [isScanning]);

    const elapsedLabel = useMemo(() => {
        if (!activeRun?.startedAtIso) {
            return '0m 00s';
        }

        const started = Date.parse(activeRun.startedAtIso);
        if (Number.isNaN(started)) {
            return '0m 00s';
        }

        return formatElapsed(Math.max(0, Math.floor((nowMs - started) / 1000)));
    }, [activeRun?.startedAtIso, nowMs]);

    const canScan = zapReady && monitorCount > 0 && !isScanning && !starting;

    const columns = useMemo<DataTableColumn<SecurityScanRecord>[]>(
        () => [
            {
                id: 'when',
                header: 'When',
                accessor: (row) => row.scannedAtIso ?? row.scannedAt,
                cell: (row) => (
                    <div className="min-w-0 max-w-[9.5rem] sm:max-w-none">
                        <time
                            dateTime={row.scannedAtIso ?? undefined}
                            className="block text-[12px] wrap-break-word text-zinc-500 tabular-nums sm:whitespace-nowrap dark:text-zinc-400"
                        >
                            {row.scannedAtIso
                                ? formatDashboardDatetime(row.scannedAtIso)
                                : row.scannedAt}
                        </time>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {formatScanSource(row.source)}
                        </div>
                    </div>
                ),
            },
            {
                id: 'status',
                header: 'Status',
                accessor: (row) => row.status,
                cell: (row) => (
                    <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusClass(row.status)}`}
                    >
                        {row.status}
                    </span>
                ),
            },
            {
                id: 'website',
                header: 'Website',
                accessor: (row) => `${row.monitorName} ${row.domainUrl}`,
                cell: (row) => (
                    <div className="min-w-0 max-w-[10rem] sm:max-w-xs">
                        <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                            {row.monitorName || '—'}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {row.domainUrl}
                        </div>
                    </div>
                ),
            },
            {
                id: 'summary',
                header: 'Summary',
                accessor: (row) =>
                    `ZAP baseline (${row.status}) ${row.alertHigh} high ${row.alertMedium} medium ${row.alertLow} low ${row.alertInfo} info ${row.summary}`,
                cell: (row) => (
                    <div className="min-w-0 max-w-[11rem] text-xs text-zinc-600 sm:max-w-none dark:text-zinc-300">
                        <p className="font-medium wrap-break-word text-zinc-800 dark:text-zinc-100">
                            ZAP baseline ({row.status})
                        </p>
                        <div className="mt-1.5 flex flex-col items-start gap-1">
                            <Badge className="border-transparent bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/50">
                                {row.alertHigh} high
                            </Badge>
                            <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/50">
                                {row.alertMedium} medium
                            </Badge>
                            <Badge className="border-transparent bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950/50">
                                {row.alertLow} low
                            </Badge>
                            <Badge className="border-transparent bg-zinc-200/80 text-zinc-700 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
                                {row.alertInfo} info
                            </Badge>
                        </div>
                    </div>
                ),
            },
            {
                id: 'details',
                header: 'Details',
                accessor: (row) => String(row.id),
                sortable: false,
                filterable: false,
                cell: (row) => (
                    <Link
                        href={`/security/scans/${row.id}`}
                        className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                    >
                        View
                    </Link>
                ),
            },
        ],
        [],
    );

    function startScan() {
        if (!canScan) {
            return;
        }

        setStarting(true);
        setLocalError(null);
        router.post(
            '/security/scan',
            {},
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const nextRun = (page.props as { activeRun?: ZapScanRunRecord | null }).activeRun ?? null;
                    if (nextRun) {
                        setActiveRun(nextRun);
                    }
                },
                onError: () => {
                    setLocalError('Could not start ZAP scan.');
                },
                onFinish: () => setStarting(false),
            },
        );
    }

    return (
        <div className="w-full min-w-0 max-w-full space-y-6">
            {flash && (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm break-words text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {flash}
                </p>
            )}
            {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm break-words text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </p>
            )}

            <section className="min-w-0 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold tracking-tight">OWASP ZAP</h2>
                        <p className="mt-1 text-xs break-words text-zinc-500 dark:text-zinc-400">
                            Baseline scans run {scheduleLabel.toLowerCase()} against every active website.
                        </p>
                        {isScanning && (
                            <p className="mt-3 text-sm font-medium break-words text-amber-800 dark:text-amber-200">
                                OWASP ZAP is scanning — time elapsed: {elapsedLabel}
                                {activeRun ? (
                                    <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                                        ({activeRun.monitorsCompleted}/{activeRun.monitorsTotal} sites)
                                    </span>
                                ) : null}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={startScan}
                        disabled={!canScan}
                        className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                        {isScanning ? 'Scanning…' : starting ? 'Starting…' : 'Scan all now'}
                    </button>
                </div>
                <p className="mt-3 text-xs break-words text-zinc-500 dark:text-zinc-400">
                    {monitorCount} active website{monitorCount === 1 ? '' : 's'}
                    {zapReady ? ' · ZAP ready' : ' · Docker / ZAP not available on this server'}
                    {' · '}
                    schedule: {scheduleLabel}
                </p>
            </section>

            <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
                <DataTable
                    data={scans}
                    columns={columns}
                    getRowId={(row) => String(row.id)}
                    defaultSortId="when"
                    defaultSortDir="desc"
                    defaultPageSize={10}
                    emptyMessage="No scans yet."
                    toolbar={
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
                                Scan history ({scans.length})
                            </h2>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                Newest first. Open Details for full findings and fixes by severity.
                            </p>
                        </div>
                    }
                />
            </section>
        </div>
    );
}
