import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatDashboardDatetime } from '@/lib/datetime';
import type { MonitorStatus, Snapshot } from '@/types/status';

export interface ServicesViewProps {
    snapshot: Snapshot;
}

type SortKey = 'no' | 'name' | 'status' | 'code' | 'latency' | 'checkedAt' | 'url';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
    { key: 'no', label: 'No.' },
    { key: 'name', label: 'Service' },
    { key: 'status', label: 'Status' },
    { key: 'code', label: 'Code' },
    { key: 'latency', label: 'Latency' },
    { key: 'checkedAt', label: 'Last checked' },
    { key: 'url', label: 'URL' },
];

function compareStatuses(
    a: MonitorStatus & { index: number },
    b: MonitorStatus & { index: number },
    key: SortKey,
    dir: SortDir,
): number {
    const mul = dir === 'asc' ? 1 : -1;
    let result = 0;

    switch (key) {
        case 'no':
            result = a.index - b.index;
            break;
        case 'name':
            result = a.name.localeCompare(b.name);
            break;
        case 'status':
            result = Number(b.up) - Number(a.up);
            break;
        case 'code':
            result = (a.statusCode ?? -1) - (b.statusCode ?? -1);
            break;
        case 'latency':
            result = (a.responseTimeMs ?? Number.POSITIVE_INFINITY) - (b.responseTimeMs ?? Number.POSITIVE_INFINITY);
            break;
        case 'checkedAt':
            result = a.checkedAt.localeCompare(b.checkedAt);
            break;
        case 'url':
            result = a.url.localeCompare(b.url);
            break;
    }

    return result * mul;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) {
        return <ArrowUpDown size={12} className="shrink-0 opacity-40" aria-hidden />;
    }

    return dir === 'asc' ? (
        <ArrowUp size={12} className="shrink-0 text-zinc-700 dark:text-zinc-200" aria-hidden />
    ) : (
        <ArrowDown size={12} className="shrink-0 text-zinc-700 dark:text-zinc-200" aria-hidden />
    );
}

export default function ServicesView({ snapshot }: ServicesViewProps) {
    const [sortKey, setSortKey] = useState<SortKey>('no');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const total = snapshot.statuses.length;
    const upCount = snapshot.statuses.filter((s) => s.up).length;
    const downCount = total - upCount;

    const rows = useMemo(() => {
        const indexed = snapshot.statuses.map((status, index) => ({ ...status, index }));
        return [...indexed].sort((a, b) => compareStatuses(a, b, sortKey, sortDir));
    }, [snapshot.statuses, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDir('asc');
    };

    return (
        <>
            <section className="animate-rise grid gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                    <p className="text-xs tracking-wider text-zinc-500 uppercase">Total</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">{total}</p>
                </article>
                <article className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
                    <p className="text-xs tracking-wider text-emerald-700/80 uppercase dark:text-emerald-300/80">Up</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">{upCount}</p>
                </article>
                <article className="rounded-2xl border border-red-200/80 bg-red-50 p-4 shadow-sm dark:border-red-900/40 dark:bg-red-950/30">
                    <p className="text-xs tracking-wider text-red-700/80 uppercase dark:text-red-300/80">Down</p>
                    <p className="mt-2 text-2xl font-semibold text-red-700 tabular-nums dark:text-red-300">{downCount}</p>
                </article>
            </section>

            <section className="animate-rise-1 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <div>
                        <h2 className="text-sm font-semibold tracking-tight">Service catalog</h2>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            Updated {formatDashboardDatetime(snapshot.summary.updatedAt)}
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-zinc-50 text-[11px] tracking-wider text-zinc-500 uppercase dark:bg-zinc-950/60 dark:text-zinc-400">
                            <tr>
                                {COLUMNS.map((column) => {
                                    const active = sortKey === column.key;
                                    return (
                                        <th key={column.key} className="px-5 py-3 font-medium">
                                            <button
                                                type="button"
                                                onClick={() => toggleSort(column.key)}
                                                className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
                                                aria-label={`Sort by ${column.label}`}
                                                aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                            >
                                                <span>{column.label}</span>
                                                <SortIcon active={active} dir={sortDir} />
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {rows.map((status, rowIndex) => (
                                <tr key={status.id} className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-950/40">
                                    <td className="px-5 py-4 text-zinc-500 tabular-nums dark:text-zinc-400">{rowIndex + 1}</td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${status.up ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            <span className="font-medium">{status.name}</span>
                                        </div>
                                        {status.error && (
                                            <p className="mt-1 max-w-xs truncate text-xs text-red-600 dark:text-red-300">{status.error}</p>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span
                                            className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold tracking-wider uppercase ${
                                                status.up
                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                    : 'bg-red-500/10 text-red-700 dark:text-red-300'
                                            }`}
                                        >
                                            {status.up ? 'Up' : 'Down'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-zinc-600 tabular-nums dark:text-zinc-300">{status.statusCode ?? 'N/A'}</td>
                                    <td className="px-5 py-4 text-zinc-600 tabular-nums dark:text-zinc-300">
                                        {status.responseTimeMs != null ? `${status.responseTimeMs} ms` : 'N/A'}
                                    </td>
                                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{formatDashboardDatetime(status.checkedAt)}</td>
                                    <td className="px-5 py-4">
                                        <a
                                            href={status.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-zinc-600 transition-colors hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400"
                                        >
                                            <span className="max-w-45 truncate">{status.url.replace(/^https?:\/\//, '')}</span>
                                            <ExternalLink size={12} />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
