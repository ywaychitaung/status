import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';

import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { formatDashboardDatetime } from '@/lib/datetime';
import type { MonitorStatus, Snapshot } from '@/types/status';

export interface ServicesViewProps {
    snapshot: Snapshot;
}

export default function ServicesView({ snapshot }: ServicesViewProps) {
    const total = snapshot.statuses.length;
    const upCount = snapshot.statuses.filter((s) => s.up).length;
    const downCount = total - upCount;

    const columns = useMemo<DataTableColumn<MonitorStatus>[]>(
        () => [
            {
                id: 'name',
                header: 'Website',
                accessor: (row) => row.name,
                cell: (row) => (
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${row.up ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="font-medium text-zinc-800 dark:text-zinc-100">{row.name}</span>
                        </div>
                        {row.error ? (
                            <p className="mt-1 max-w-xs truncate text-xs text-red-600 dark:text-red-300">{row.error}</p>
                        ) : null}
                    </div>
                ),
            },
            {
                id: 'status',
                header: 'Status',
                accessor: (row) => (row.up ? 'Up' : 'Down'),
                cell: (row) => (
                    <span
                        className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold tracking-wider uppercase ${
                            row.up
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-500/10 text-red-700 dark:text-red-300'
                        }`}
                    >
                        {row.up ? 'Up' : 'Down'}
                    </span>
                ),
            },
            {
                id: 'code',
                header: 'Code',
                accessor: (row) => row.statusCode ?? '',
                cell: (row) => (
                    <span className="text-zinc-600 tabular-nums dark:text-zinc-300">{row.statusCode ?? 'N/A'}</span>
                ),
            },
            {
                id: 'latency',
                header: 'Latency',
                accessor: (row) => row.responseTimeMs ?? '',
                cell: (row) => (
                    <span className="text-zinc-600 tabular-nums dark:text-zinc-300">
                        {row.responseTimeMs != null ? `${row.responseTimeMs} ms` : 'N/A'}
                    </span>
                ),
            },
            {
                id: 'checkedAt',
                header: 'Last checked',
                accessor: (row) => row.checkedAt,
                cell: (row) => (
                    <span className="text-zinc-600 dark:text-zinc-300">{formatDashboardDatetime(row.checkedAt)}</span>
                ),
            },
            {
                id: 'url',
                header: 'URL',
                accessor: (row) => row.url,
                cell: (row) => (
                    <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-zinc-600 transition-colors hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400"
                    >
                        <span className="max-w-45 truncate">{row.url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink size={12} />
                    </a>
                ),
            },
        ],
        [],
    );

    return (
        <div className="min-w-0 max-w-full space-y-4 md:space-y-6">
            <section className="animate-rise grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
                <article className="min-w-0 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                    <p className="text-xs tracking-wider text-zinc-500 uppercase">Total</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">{total}</p>
                </article>
                <article className="min-w-0 rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
                    <p className="text-xs tracking-wider text-emerald-700/80 uppercase dark:text-emerald-300/80">Up</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">{upCount}</p>
                </article>
                <article className="min-w-0 rounded-2xl border border-red-200/80 bg-red-50 p-4 shadow-sm dark:border-red-900/40 dark:bg-red-950/30">
                    <p className="text-xs tracking-wider text-red-700/80 uppercase dark:text-red-300/80">Down</p>
                    <p className="mt-2 text-2xl font-semibold text-red-700 tabular-nums dark:text-red-300">{downCount}</p>
                </article>
            </section>

            <section className="animate-rise-1 min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
                <DataTable
                    data={snapshot.statuses}
                    columns={columns}
                    getRowId={(row) => row.id}
                    defaultSortId="name"
                    defaultPageSize={10}
                    emptyMessage="No services yet."
                    toolbar={
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold tracking-tight">Service catalog</h2>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                Updated {formatDashboardDatetime(snapshot.summary.updatedAt)}
                            </p>
                        </div>
                    }
                />
            </section>
        </div>
    );
}
