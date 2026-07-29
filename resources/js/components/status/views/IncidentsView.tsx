import { usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, History, Timer } from 'lucide-react';

import OutageTimer from '@/components/status/OutageTimer';
import { formatDashboardDatetime } from '@/lib/datetime';
import type { Snapshot, StatusSharedProps } from '@/types/status';

function formatIncidentDuration(startedAt: string, resolvedAt: string | null): string {
    const endMs = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
    const ms = endMs - new Date(startedAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '—';

    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;

    return `${seconds}s`;
}

export interface IncidentsViewProps {
    snapshot: Snapshot;
}

export default function IncidentsView({ snapshot }: IncidentsViewProps) {
    const { app } = usePage<StatusSharedProps>().props;

    const downServices = snapshot.statuses.filter((s) => !s.up);
    const previousIncidents = snapshot.incidents;
    const total = snapshot.statuses.length;
    const upCount = total - downServices.length;
    const allUp = downServices.length === 0 && total > 0;

    return (
        <>
            <section className="animate-rise grid gap-4 lg:grid-cols-3">
                <article className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900/80">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold tracking-tight">Active incidents</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Services currently failing health checks</p>
                        </div>
                        <span
                            className={`rounded-lg p-2 ${
                                allUp ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-red-500/10 text-red-600 dark:text-red-300'
                            }`}
                        >
                            {allUp ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        </span>
                    </div>

                    {allUp ? (
                        <div className="mt-8 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-5 py-10 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
                            <CheckCircle2 size={28} className="mx-auto text-emerald-600 dark:text-emerald-400" />
                            <p className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">No active incidents</p>
                            <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/60">
                                All {upCount} monitored services are responding normally.
                            </p>
                        </div>
                    ) : (
                        <ul className="mt-6 space-y-3">
                            {downServices.map((status) => (
                                <li
                                    key={status.id}
                                    className="rounded-2xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/50 dark:bg-red-950/30"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                                <p className="font-semibold tracking-tight">{status.name}</p>
                                            </div>
                                            <a
                                                href={status.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-1 block truncate text-xs text-red-700/70 hover:underline dark:text-red-300/70"
                                            >
                                                {status.url.replace(/^https?:\/\//, '')}
                                            </a>
                                        </div>
                                        <span className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-red-700 uppercase dark:text-red-300">
                                            Down
                                        </span>
                                    </div>
                                    <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                                        <div>
                                            <dt className="text-red-700/60 dark:text-red-300/50">Status code</dt>
                                            <dd className="mt-1 font-semibold tabular-nums">{status.statusCode ?? 'N/A'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-red-700/60 dark:text-red-300/50">Detected</dt>
                                            <dd className="mt-1 font-semibold">{formatDashboardDatetime(status.checkedAt)}</dd>
                                        </div>
                                        <div className="min-w-0 sm:col-span-1">
                                            <dt className="text-red-700/60 dark:text-red-300/50">Error</dt>
                                            <dd className="mt-1 min-w-0 font-medium break-all">{status.error || 'Non-success response'}</dd>
                                        </div>
                                    </dl>
                                </li>
                            ))}
                        </ul>
                    )}
                </article>

                <article className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold tracking-tight">Since last outage</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Time since the most recent failure</p>
                        </div>
                        <span className="rounded-lg bg-zinc-100 p-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            <Timer size={16} />
                        </span>
                    </div>
                    <div id="outage-timer" className="mt-6" data-last-outage-at={snapshot.summary.lastOutageAt ?? ''}>
                        <OutageTimer lastOutageAt={snapshot.summary.lastOutageAt} />
                    </div>
                    <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                        {snapshot.summary.lastOutageAt
                            ? `Last recorded at ${formatDashboardDatetime(snapshot.summary.lastOutageAt)}`
                            : 'No outages have been recorded yet.'}
                    </p>
                </article>
            </section>

            <section className="animate-rise-1 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold tracking-tight">Previous incidents</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">All recorded outages, newest first</p>
                    </div>
                    <span className="rounded-lg bg-zinc-100 p-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <History size={16} />
                    </span>
                </div>

                {previousIncidents.length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No previous incidents yet</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Past outages will show up here once they occur.</p>
                    </div>
                ) : (
                    <ul className="mt-6 space-y-3">
                        {previousIncidents.map((incident) => {
                            const isOpen = incident.resolvedAt === null;

                            return (
                                <li
                                    key={incident.id}
                                    className={`min-w-0 overflow-hidden rounded-2xl border p-4 ${
                                        isOpen
                                            ? 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/25'
                                            : 'border-zinc-200/90 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-950/40'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                <p className="font-semibold tracking-tight">{incident.name}</p>
                                            </div>
                                            <a
                                                href={incident.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`mt-1 block truncate text-xs hover:underline ${
                                                    isOpen ? 'text-red-700/70 dark:text-red-300/70' : 'text-zinc-500 dark:text-zinc-400'
                                                }`}
                                            >
                                                {incident.url.replace(/^https?:\/\//, '')}
                                            </a>
                                        </div>
                                        <span
                                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase ${
                                                isOpen
                                                    ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                            }`}
                                        >
                                            {isOpen ? 'Ongoing' : 'Resolved'}
                                        </span>
                                    </div>
                                    <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                                        <div>
                                            <dt className={isOpen ? 'text-red-700/60 dark:text-red-300/50' : 'text-zinc-500 dark:text-zinc-400'}>
                                                Started
                                            </dt>
                                            <dd className="mt-1 font-semibold">{formatDashboardDatetime(incident.startedAt)}</dd>
                                        </div>
                                        <div>
                                            <dt className={isOpen ? 'text-red-700/60 dark:text-red-300/50' : 'text-zinc-500 dark:text-zinc-400'}>
                                                Resolved
                                            </dt>
                                            <dd className="mt-1 font-semibold">
                                                {incident.resolvedAt ? formatDashboardDatetime(incident.resolvedAt) : '—'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className={isOpen ? 'text-red-700/60 dark:text-red-300/50' : 'text-zinc-500 dark:text-zinc-400'}>
                                                Duration
                                            </dt>
                                            <dd className="mt-1 font-semibold tabular-nums">
                                                {formatIncidentDuration(incident.startedAt, incident.resolvedAt)}
                                                {isOpen ? ' so far' : ''}
                                            </dd>
                                        </div>
                                        <div className="min-w-0 sm:col-span-2 lg:col-span-4">
                                            <dt className={isOpen ? 'text-red-700/60 dark:text-red-300/50' : 'text-zinc-500 dark:text-zinc-400'}>
                                                Last error
                                            </dt>
                                            <dd className="mt-1 min-w-0 font-medium break-all">
                                                {incident.error ||
                                                    (incident.statusCode != null ? `Status ${incident.statusCode}` : 'Non-success response')}
                                            </dd>
                                        </div>
                                    </dl>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="animate-rise-2 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <p className="text-sm font-semibold tracking-tight">Incident notes</p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <li className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                        Checks run every minute. A non-200 response opens an active incident here.
                    </li>
                    <li className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                        Discord and Telegram alerts fire to {app.author.name} on down/recovery when configured.
                    </li>
                    <li className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                        If an issue still hasn&apos;t been fixed, please report it to{' '}
                        <a
                            href={app.support.report_mailto}
                            className="font-medium text-zinc-800 underline underline-offset-2 transition-colors hover:text-emerald-600 dark:text-zinc-200 dark:hover:text-emerald-400"
                        >
                            {app.support.report_email}
                        </a>
                        .
                    </li>
                    <li className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                        This page refreshes live when monitor state changes.
                    </li>
                </ul>
            </section>
        </>
    );
}
