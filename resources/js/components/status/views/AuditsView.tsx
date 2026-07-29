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

function profileChangeNote(audit: AuditRecord): string | null {
    if (audit.action !== 'account.profile_update' || !audit.metadata) {
        return null;
    }
    const before = audit.metadata.before as { name?: string; username?: string } | undefined;
    const after = audit.metadata.after as { name?: string; username?: string } | undefined;
    if (!before || !after) return null;
    const parts: string[] = [];
    if (before.name !== after.name) {
        parts.push(`name: ${before.name ?? '—'} → ${after.name ?? '—'}`);
    }
    if (before.username !== after.username) {
        parts.push(`username: ${before.username ?? '—'} → ${after.username ?? '—'}`);
    }

    return parts.length > 0 ? parts.join(' · ') : null;
}

export default function AuditsView({ audits }: AuditsViewProps) {
    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="border-b border-zinc-200/90 px-5 py-4 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">Audit log ({audits.length})</h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Successful and failed logins, logouts, profile/password changes, and website create / update / delete / reactivate events.
                    </p>
                </div>

                {audits.length === 0 ? (
                    <p className="px-5 py-10 text-sm text-zinc-500 dark:text-zinc-400">No audit events yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-160 text-left text-sm">
                            <thead>
                                <tr className="border-b border-zinc-200/90 text-[11px] font-medium tracking-wider text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
                                    <th className="px-5 py-3 font-medium">Time</th>
                                    <th className="px-5 py-3 font-medium">Action</th>
                                    <th className="px-5 py-3 font-medium">User</th>
                                    <th className="px-5 py-3 font-medium">Details</th>
                                    <th className="px-5 py-3 font-medium">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {audits.map((audit) => {
                                    const error = auditError(audit);
                                    const profileNote = profileChangeNote(audit);
                                    const failed = audit.action === 'auth.login_failed';

                                    return (
                                        <tr key={audit.id} className="align-top text-zinc-700 dark:text-zinc-200">
                                            <td className="px-5 py-3.5 text-[12px] whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
                                                <time dateTime={audit.createdAt}>{formatDashboardDatetime(audit.createdAt)}</time>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span
                                                    className={
                                                        failed
                                                            ? 'font-medium text-red-700 dark:text-red-300'
                                                            : 'font-medium text-zinc-800 dark:text-zinc-100'
                                                    }
                                                >
                                                    {formatAuditAction(audit.action)}
                                                </span>
                                            </td>
                                            <td className="wrap-break-word max-w-40 px-5 py-3.5 text-zinc-600 dark:text-zinc-300">
                                                {actorLabel(audit)}
                                            </td>
                                            <td className="wrap-break-word max-w-md min-w-0 px-5 py-3.5">
                                                <p className="text-zinc-600 dark:text-zinc-300">{audit.summary}</p>
                                                {profileNote ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{profileNote}</p> : null}
                                                {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">Error: {error}</p> : null}
                                                {audit.entityType === 'monitor' && audit.entityId ? (
                                                    <p className="mt-1 text-[11px] break-all text-zinc-400 tabular-nums">monitor {audit.entityId}</p>
                                                ) : null}
                                            </td>
                                            <td className="px-5 py-3.5 text-[12px] whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
                                                {audit.ip ?? '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
