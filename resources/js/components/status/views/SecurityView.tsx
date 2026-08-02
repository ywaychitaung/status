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
    lastRun?: ZapScanRunRecord | null;
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

function runProgressPercent(run: ZapScanRunRecord | null | undefined): number {
    if (!run) {
        return 0;
    }

    if (typeof run.progressPercent === 'number') {
        return Math.max(0, Math.min(100, run.progressPercent));
    }

    if (run.status === 'completed') {
        return 100;
    }

    if (run.monitorsTotal <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round((run.monitorsCompleted / run.monitorsTotal) * 100)));
}

function isRecentRun(run: ZapScanRunRecord | null | undefined, withinMs = 24 * 60 * 60 * 1000): boolean {
    if (!run) {
        return false;
    }

    const iso = run.finishedAtIso ?? run.startedAtIso;
    if (!iso) {
        return false;
    }

    const ms = Date.parse(iso);

    return !Number.isNaN(ms) && Date.now() - ms < withinMs;
}

export default function SecurityView({
    scans,
    zapReady,
    monitorCount,
    activeRun: initialActiveRun,
    lastRun: initialLastRun = null,
    flash,
    error: initialError,
}: SecurityViewProps) {
    const { app } = usePage<StatusSharedProps>().props;
    const scheduleLabel = app.zap?.scheduleLabel ?? 'Every Saturday at 6:00 AM SGT';
    const [activeRun, setActiveRun] = useState<ZapScanRunRecord | null>(initialActiveRun);
    const [lastRun, setLastRun] = useState<ZapScanRunRecord | null>(initialLastRun);
    const [starting, setStarting] = useState(false);
    /** Keep polling after a start even if the first Inertia payload briefly misses activeRun (prod race). */
    const [watching, setWatching] = useState(() => Boolean(initialActiveRun?.isActive && initialActiveRun.status === 'running'));
    const [localError, setLocalError] = useState<string | null>(null);
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        setActiveRun(initialActiveRun);
        if (initialActiveRun?.isActive && initialActiveRun.status === 'running') {
            setWatching(true);
        }
    }, [initialActiveRun]);

    useEffect(() => {
        setLastRun(initialLastRun);
    }, [initialLastRun]);

    useEffect(() => {
        // Success flash without an active run still means we should poll status (prod redirect race).
        if (flash && !initialActiveRun) {
            setLocalError(null);
            setWatching(true);
        }
    }, [flash, initialActiveRun]);

    useEffect(() => {
        if (initialError) {
            setLocalError(null);
            setWatching(false);
        }
    }, [initialError]);

    const error = localError ?? initialError;
    const isScanning = Boolean(activeRun?.isActive && activeRun.status === 'running');
    const showScanningUi = isScanning || starting || (watching && !error);
    const progressRun = showScanningUi ? activeRun : null;
    const progressPercent = showScanningUi
        ? runProgressPercent(progressRun)
        : lastRun?.status === 'completed'
          ? 100
          : runProgressPercent(lastRun);
    const showCompletedBanner = !showScanningUi && lastRun?.status === 'completed' && isRecentRun(lastRun);
    const showFailedBanner = !showScanningUi && lastRun?.status === 'failed' && isRecentRun(lastRun);

    useEffect(() => {
        if (!watching || isScanning) {
            return;
        }

        // Don't leave the button disabled forever if status never resolves.
        const timeout = window.setTimeout(() => setWatching(false), 180_000);

        return () => window.clearTimeout(timeout);
    }, [watching, isScanning]);

    useEffect(() => {
        if (!showScanningUi) {
            return;
        }

        const tick = window.setInterval(() => setNowMs(Date.now()), 1000);

        return () => window.clearInterval(tick);
    }, [showScanningUi]);

    useEffect(() => {
        if (!watching && !isScanning) {
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

                if (data.activeRun?.isActive && data.activeRun.status === 'running') {
                    setActiveRun(data.activeRun);
                    setWatching(true);
                    return;
                }

                setActiveRun(null);
                setWatching(false);

                if (data.lastRun) {
                    setLastRun(data.lastRun);
                    if (data.lastRun.status === 'failed' && data.lastRun.error && isRecentRun(data.lastRun, 15 * 60 * 1000)) {
                        setLocalError(data.lastRun.error);
                    }
                }

                router.reload({ only: ['scans', 'activeRun', 'lastRun', 'flash', 'error'] });
            } catch {
                // Keep polling; transient network errors are fine.
            }
        };

        const id = window.setInterval(poll, 5000);
        // First poll quickly so elapsed UI appears even if Inertia props lagged.
        const first = window.setTimeout(() => {
            void poll();
        }, 400);

        return () => {
            cancelled = true;
            window.clearInterval(id);
            window.clearTimeout(first);
        };
    }, [watching, isScanning]);

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

    const canScan = zapReady && monitorCount > 0 && !showScanningUi;

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
        setWatching(true);
        setLocalError(null);
        setLastRun(null);
        router.post(
            '/security/scan',
            {},
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const props = page.props as {
                        activeRun?: ZapScanRunRecord | null;
                        lastRun?: ZapScanRunRecord | null;
                    };
                    const nextRun = props.activeRun ?? null;
                    if (nextRun?.isActive && nextRun.status === 'running') {
                        setActiveRun(nextRun);
                        setWatching(true);
                    } else {
                        setWatching(true);
                    }
                    if (props.lastRun) {
                        setLastRun(props.lastRun);
                    }
                },
                onError: () => {
                    setLocalError('Could not start ZAP scan.');
                    setWatching(false);
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
                    </div>
                    <button
                        type="button"
                        onClick={startScan}
                        disabled={!canScan}
                        className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                        {showScanningUi ? 'Scanning…' : 'Scan all now'}
                    </button>
                </div>

                {showScanningUi && (
                    <div className="mt-4 min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm">
                            <p className="font-medium break-words text-amber-800 dark:text-amber-200">
                                OWASP ZAP is scanning — {elapsedLabel}
                            </p>
                            <p className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
                                {progressPercent}%
                                {activeRun ? (
                                    <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                                        ({activeRun.monitorsCompleted}/{activeRun.monitorsTotal} sites)
                                    </span>
                                ) : null}
                            </p>
                        </div>
                        <div
                            className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progressPercent}
                            aria-label="ZAP scan progress"
                        >
                            <div
                                className="h-full rounded-full bg-amber-500 transition-[width] duration-500 ease-out dark:bg-amber-400"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {showCompletedBanner && lastRun && (
                    <div className="mt-4 min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm">
                            <p className="font-medium break-words text-emerald-800 dark:text-emerald-200">
                                Scan completed
                                {lastRun.finishedAt ? (
                                    <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                                        · {lastRun.finishedAt}
                                    </span>
                                ) : null}
                            </p>
                            <p className="shrink-0 tabular-nums text-emerald-700 dark:text-emerald-300">
                                100%
                                <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                                    ({lastRun.monitorsCompleted}/{lastRun.monitorsTotal} sites)
                                </span>
                            </p>
                        </div>
                        <div
                            className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/50"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={100}
                            aria-label="ZAP scan completed"
                        >
                            <div className="h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        </div>
                    </div>
                )}

                {showFailedBanner && lastRun && !error && (
                    <div className="mt-4 min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm">
                            <p className="font-medium break-words text-red-800 dark:text-red-200">
                                Scan failed
                                {lastRun.finishedAt ? (
                                    <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                                        · {lastRun.finishedAt}
                                    </span>
                                ) : null}
                            </p>
                            <p className="shrink-0 tabular-nums text-red-700 dark:text-red-300">
                                {progressPercent}%
                                <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                                    ({lastRun.monitorsCompleted}/{lastRun.monitorsTotal} sites)
                                </span>
                            </p>
                        </div>
                        <div
                            className="h-2.5 w-full overflow-hidden rounded-full bg-red-100 dark:bg-red-950/40"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progressPercent}
                            aria-label="ZAP scan failed"
                        >
                            <div
                                className="h-full rounded-full bg-red-500 dark:bg-red-400"
                                style={{ width: `${Math.max(progressPercent, 8)}%` }}
                            />
                        </div>
                        {lastRun.error ? (
                            <p className="text-xs break-words text-red-700 dark:text-red-300">{lastRun.error}</p>
                        ) : null}
                    </div>
                )}

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
