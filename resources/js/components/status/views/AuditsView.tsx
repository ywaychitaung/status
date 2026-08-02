import { useMemo } from 'react';

import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { formatAuditAction } from '@/lib/audit';
import { formatDashboardDatetime } from '@/lib/datetime';
import type { AuditRecord } from '@/types/status';

export interface AuditsViewProps {
    audits: AuditRecord[];
}

function actorLabel(audit: AuditRecord): string {
    return audit.actorName || audit.actorUsername || (audit.actorUserId != null ? `User #${audit.actorUserId}` : '—');
}

function auditError(audit: AuditRecord): string | null {
    const meta = audit.metadata;
    if (!meta) return null;
    const error = meta.error;

    return typeof error === 'string' && error.trim() ? error.trim() : null;
}

function profileChangeLines(audit: AuditRecord): string[] {
    if (audit.action !== 'account.profile_update' || !audit.metadata) {
        return [];
    }

    const parts: string[] = [];
    const changes = audit.metadata.changes as
        | Record<string, { previous?: string; new?: string }>
        | undefined;

    if (changes && typeof changes === 'object') {
        for (const field of ['name', 'username', 'email'] as const) {
            const change = changes[field];
            if (!change) continue;
            parts.push(`${field}: ${change.previous ?? '—'} → ${change.new ?? '—'}`);
        }
        return parts;
    }

    const before = audit.metadata.before as
        | { name?: string; username?: string; email?: string }
        | undefined;
    const after = audit.metadata.after as
        | { name?: string; username?: string; email?: string }
        | undefined;
    if (!before || !after) return [];

    for (const field of ['name', 'username', 'email'] as const) {
        if (before[field] !== after[field]) {
            parts.push(`${field}: ${before[field] ?? '—'} → ${after[field] ?? '—'}`);
        }
    }

    return parts;
}

function passwordChangeNote(audit: AuditRecord): string | null {
    if (audit.action !== 'account.password_change') {
        return null;
    }

    return 'Password updated (values not logged).';
}

function detailsText(audit: AuditRecord): string {
    const parts = [audit.summary, ...profileChangeLines(audit)];
    const passwordNote = passwordChangeNote(audit);
    const error = auditError(audit);

    if (passwordNote) parts.push(passwordNote);
    if (error) parts.push(`Error: ${error}`);
    if (audit.entityType === 'monitor' && audit.entityId) {
        parts.push(`monitor ${audit.entityId}`);
    }

    return parts.join(' ');
}

export default function AuditsView({ audits }: AuditsViewProps) {
    const columns = useMemo<DataTableColumn<AuditRecord>[]>(
        () => [
            {
                id: 'time',
                header: 'Time',
                accessor: (row) => row.createdAt,
                cell: (row) => (
                    <time dateTime={row.createdAt} className="text-[12px] whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
                        {formatDashboardDatetime(row.createdAt)}
                    </time>
                ),
            },
            {
                id: 'action',
                header: 'Action',
                accessor: (row) => formatAuditAction(row.action),
                cell: (row) => (
                    <span
                        className={
                            row.action === 'auth.login_failed'
                                ? 'font-medium text-red-700 dark:text-red-300'
                                : 'font-medium text-zinc-800 dark:text-zinc-100'
                        }
                    >
                        {formatAuditAction(row.action)}
                    </span>
                ),
            },
            {
                id: 'user',
                header: 'User',
                accessor: (row) => actorLabel(row),
                cell: (row) => (
                    <span className="wrap-break-word text-zinc-600 dark:text-zinc-300">{actorLabel(row)}</span>
                ),
                className: 'max-w-40',
            },
            {
                id: 'details',
                header: 'Details',
                accessor: (row) => detailsText(row),
                cell: (row) => {
                    const error = auditError(row);
                    const profileLines = profileChangeLines(row);
                    const passwordNote = passwordChangeNote(row);

                    return (
                        <div className="wrap-break-word max-w-md min-w-0">
                            <p className="text-zinc-600 dark:text-zinc-300">{row.summary}</p>
                            {profileLines.map((line) => (
                                <p key={line} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    {line}
                                </p>
                            ))}
                            {passwordNote ? (
                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{passwordNote}</p>
                            ) : null}
                            {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">Error: {error}</p> : null}
                            {row.entityType === 'monitor' && row.entityId ? (
                                <p className="mt-1 text-[11px] break-all text-zinc-400 tabular-nums">monitor {row.entityId}</p>
                            ) : null}
                        </div>
                    );
                },
            },
            {
                id: 'ip',
                header: 'IP',
                accessor: (row) => row.ip ?? '—',
                cell: (row) => (
                    <span className="text-[12px] whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
                        {row.ip ?? '—'}
                    </span>
                ),
            },
        ],
        [],
    );

    return (
        <div className="w-full min-w-0 max-w-full space-y-6">
            <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
                <DataTable
                    data={audits}
                    columns={columns}
                    getRowId={(row) => row.id}
                    defaultSortId="time"
                    defaultSortDir="desc"
                    defaultPageSize={25}
                    emptyMessage="No audit events yet."
                    toolbar={
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
                                Audit log ({audits.length})
                            </h2>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                Successful and failed logins, logouts, profile/password changes, alert settings,
                                website create / update / delete / reactivate, and OWASP ZAP weekly / manual scans.
                            </p>
                        </div>
                    }
                />
            </section>
        </div>
    );
}
