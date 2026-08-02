import { Link } from '@inertiajs/react';

import { Badge } from '@/components/ui/badge';
import { formatDashboardDatetime } from '@/lib/datetime';
import type { SecurityScanFinding, SecurityScanRecord } from '@/types/status';

export interface SecurityScanDetailViewProps {
    scan: SecurityScanRecord;
}

const SEVERITY_SECTIONS = [
    {
        key: 'High',
        label: 'High',
        countKey: 'alertHigh' as const,
        shell: 'border-red-200/80 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20',
        badge: 'border-transparent bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/50',
    },
    {
        key: 'Medium',
        label: 'Medium',
        countKey: 'alertMedium' as const,
        shell: 'border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20',
        badge: 'border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/50',
    },
    {
        key: 'Low',
        label: 'Low',
        countKey: 'alertLow' as const,
        shell: 'border-sky-200/80 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20',
        badge: 'border-transparent bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950/50',
    },
    {
        key: 'Informational',
        label: 'Info',
        countKey: 'alertInfo' as const,
        shell: 'border-zinc-200/90 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/40',
        badge: 'border-transparent bg-zinc-200/80 text-zinc-700 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800',
    },
] as const;

function statusClass(status: string): string {
    if (status === 'pass') {
        return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
    }
    if (status === 'warn') {
        return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
    }

    return 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300';
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 1): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeRisk(risk: string): string {
    const normalized = risk.trim().toLowerCase();
    if (normalized === 'high') return 'High';
    if (normalized === 'medium') return 'Medium';
    if (normalized === 'low') return 'Low';
    if (normalized === 'informational' || normalized === 'info') return 'Informational';

    return risk.trim() || 'Unknown';
}

function findingsFromScan(scan: SecurityScanRecord): SecurityScanFinding[] {
    const details = scan.details ?? {};
    const rawFindings = details.findings;
    if (Array.isArray(rawFindings) && rawFindings.length > 0) {
        return rawFindings
            .map((item): SecurityScanFinding | null => {
                if (!item || typeof item !== 'object') {
                    return null;
                }

                const row = item as Record<string, unknown>;

                return {
                    name: asString(row.name) || 'Alert',
                    risk: normalizeRisk(asString(row.risk) || 'Unknown'),
                    count: asNumber(row.count, 1),
                    pluginId: asString(row.pluginId),
                    description: asString(row.description),
                    solution: asString(row.solution),
                    reference: asString(row.reference),
                };
            })
            .filter((item): item is SecurityScanFinding => item !== null);
    }

    const checks = details.checks;
    if (!Array.isArray(checks)) {
        return [];
    }

    return checks
        .map((item): SecurityScanFinding | null => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            const row = item as Record<string, unknown>;
            const meta =
                row.meta && typeof row.meta === 'object'
                    ? (row.meta as Record<string, unknown>)
                    : {};

            return {
                name: asString(meta.name) || asString(row.label) || 'Alert',
                risk: normalizeRisk(asString(meta.risk) || 'Unknown'),
                count: asNumber(meta.count, 1),
                pluginId: asString(meta.pluginId) || asString(row.id),
                description: asString(meta.description) || asString(row.message),
                solution: asString(meta.solution),
                reference: asString(meta.reference),
            };
        })
        .filter((item): item is SecurityScanFinding => item !== null);
}

function baselineHeadline(scan: SecurityScanRecord): string {
    return `ZAP baseline (${scan.status})`;
}

export default function SecurityScanDetailView({ scan }: SecurityScanDetailViewProps) {
    const findings = findingsFromScan(scan);

    return (
        <div className="w-full space-y-6">
            <div>
                <Link
                    href="/security"
                    className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                >
                    ← Back to Security
                </Link>
            </div>

            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
                            {scan.monitorName || 'Website scan'}
                        </h2>
                        <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">{scan.domainUrl}</p>
                        <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                            {baselineHeadline(scan)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {SEVERITY_SECTIONS.map((section) => (
                                <Badge key={section.key} className={section.badge}>
                                    {scan[section.countKey]} {section.label.toLowerCase()}
                                </Badge>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{scan.summary}</p>
                    </div>
                    <div className="text-right">
                        <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusClass(scan.status)}`}
                        >
                            {scan.status}
                        </span>
                        <p className="mt-2 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
                            {scan.scannedAtIso
                                ? formatDashboardDatetime(scan.scannedAtIso)
                                : scan.scannedAt}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {scan.source === 'manual_trigger'
                                ? 'manual trigger'
                                : scan.source === 'zap_daily'
                                  ? 'zap_weekly'
                                  : scan.source}
                        </p>
                    </div>
                </div>
            </section>

            {SEVERITY_SECTIONS.map((section) => {
                const sectionFindings = findings.filter((finding) => finding.risk === section.key);
                const count = scan[section.countKey];

                return (
                    <section
                        key={section.key}
                        className={`rounded-2xl border p-5 shadow-sm ${section.shell}`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold tracking-tight">
                                {section.label}
                            </h3>
                            <Badge className={section.badge}>{count}</Badge>
                        </div>

                        {sectionFindings.length === 0 ? (
                            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                                No {section.label.toLowerCase()} findings.
                            </p>
                        ) : (
                            <ul className="mt-4 space-y-4">
                                {sectionFindings.map((finding, index) => (
                                    <li
                                        key={`${section.key}-${finding.pluginId || finding.name}-${index}`}
                                        className="rounded-xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
                                    >
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                                {finding.name}
                                            </h4>
                                            <span className="text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
                                                ×{finding.count}
                                                {finding.pluginId ? ` · ${finding.pluginId}` : ''}
                                            </span>
                                        </div>

                                        <div className="mt-3 space-y-3 text-sm">
                                            <div>
                                                <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                                                    Detail
                                                </p>
                                                <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                                                    {finding.description || 'No detail stored for this finding.'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                                                    Fix
                                                </p>
                                                <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                                                    {finding.solution ||
                                                        'No fix guidance stored for this finding. Re-run the scan after deploying the latest scanner to capture remediation text.'}
                                                </p>
                                            </div>
                                            {finding.reference ? (
                                                <div>
                                                    <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                                                        Reference
                                                    </p>
                                                    <p className="mt-1 break-words whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                                                        {finding.reference}
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
