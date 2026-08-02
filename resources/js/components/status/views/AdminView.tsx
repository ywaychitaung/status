import { Link } from '@inertiajs/react';
import { ExternalLink, RotateCcw, Trash2 } from 'lucide-react';

import { csrfToken } from '@/lib/csrf';
import { withQuery } from '@/lib/url';
import type { MonitorTarget } from '@/types/status';

export interface AdminViewProps {
    monitors: MonitorTarget[];
    inactiveMonitors: MonitorTarget[];
    flash: string | null;
    error: string | null;
    editingId: string | null;
}

export default function AdminView({ monitors, inactiveMonitors, flash, error, editingId }: AdminViewProps) {
    const token = csrfToken();

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
                <h2 className="text-sm font-semibold tracking-tight">Add website</h2>
                <form method="post" action="/admin" className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
                    <input type="hidden" name="_token" value={token} />
                    <input type="hidden" name="action" value="create" />
                    <label className="block">
                        <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Name</span>
                        <input
                            name="name"
                            required
                            placeholder="Portfolio"
                            className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">URL</span>
                        <input
                            name="url"
                            required
                            type="url"
                            placeholder="https://example.com"
                            className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                    </label>
                    <div className="flex items-end">
                        <button
                            type="submit"
                            className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                            Add
                        </button>
                    </div>
                </form>
            </section>

            <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold tracking-tight">Monitored sites ({monitors.length})</h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Change Order to reorder. If that number is taken, the other site swaps into this one&apos;s previous place.
                    </p>
                </div>

                {monitors.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-zinc-500 dark:text-zinc-400">No websites yet. Add one above.</p>
                ) : (
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {monitors.map((monitor) => (
                            <li key={monitor.id} className="px-5 py-4">
                                {editingId === monitor.id ? (
                                    <form method="post" action="/admin" className="grid gap-3 sm:grid-cols-[4.5rem_1fr_1.4fr]">
                                        <input type="hidden" name="_token" value={token} />
                                        <input type="hidden" name="action" value="update" />
                                        <input type="hidden" name="id" value={monitor.id} />
                                        <label className="block">
                                            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Order</span>
                                            <input
                                                name="sort_order"
                                                type="number"
                                                required
                                                min={1}
                                                step={1}
                                                defaultValue={monitor.sortOrder}
                                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm tabular-nums ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Name</span>
                                            <input
                                                name="name"
                                                required
                                                defaultValue={monitor.name}
                                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">URL</span>
                                            <input
                                                name="url"
                                                required
                                                type="url"
                                                defaultValue={monitor.url}
                                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                                            />
                                        </label>
                                        <div className="flex items-end gap-2 sm:col-span-3">
                                            <button
                                                type="submit"
                                                className="cursor-pointer rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                                            >
                                                Save
                                            </button>
                                            <Link href="/admin" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
                                                Cancel
                                            </Link>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="mt-0.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 px-2 text-xs font-semibold text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
                                                {monitor.sortOrder}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-medium">{monitor.name}</p>
                                                <a
                                                    href={monitor.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-0.5 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                                                >
                                                    <span className="truncate">{monitor.url.replace(/^https?:\/\//, '')}</span>
                                                    <ExternalLink size={12} />
                                                </a>
                                                <p className="mt-1 text-[11px] text-zinc-400 tabular-nums">id: {monitor.id}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={withQuery('/admin', {
                                                    flash: null,
                                                    error: null,
                                                    edit: monitor.id,
                                                })}
                                                className="cursor-pointer rounded-xl border border-zinc-200 px-3 py-2 text-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                            >
                                                Edit
                                            </Link>
                                            <form method="post" action="/admin">
                                                <input type="hidden" name="_token" value={token} />
                                                <input type="hidden" name="action" value="delete" />
                                                <input type="hidden" name="id" value={monitor.id} />
                                                <button
                                                    type="submit"
                                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-zinc-300/80 bg-zinc-50/80 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/40">
                <div className="border-b border-zinc-200/90 px-5 py-4 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-200">
                        Deleted websites ({inactiveMonitors.length})
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Soft-deleted sites stay in the database. Reactivate to monitor them again.
                    </p>
                </div>

                {inactiveMonitors.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-zinc-500 dark:text-zinc-400">No deleted websites.</p>
                ) : (
                    <ul className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                        {inactiveMonitors.map((monitor) => (
                            <li key={monitor.id} className="px-5 py-4 opacity-80">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-zinc-600 line-through decoration-zinc-400/80 dark:text-zinc-300 dark:decoration-zinc-600">
                                            {monitor.name}
                                        </p>
                                        <a
                                            href={monitor.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-0.5 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                                        >
                                            <span className="truncate">{monitor.url.replace(/^https?:\/\//, '')}</span>
                                            <ExternalLink size={12} />
                                        </a>
                                        <p className="mt-1 text-[11px] text-zinc-400 tabular-nums">id: {monitor.id}</p>
                                    </div>
                                    <form method="post" action="/admin">
                                        <input type="hidden" name="_token" value={token} />
                                        <input type="hidden" name="action" value="reactivate" />
                                        <input type="hidden" name="id" value={monitor.id} />
                                        <button
                                            type="submit"
                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                        >
                                            <RotateCcw size={14} />
                                            Reactivate
                                        </button>
                                    </form>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
