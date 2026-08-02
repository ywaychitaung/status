/** Shared types for the status dashboard (port of _legacy/lib/pageTypes.ts). */

export type DashboardNavId = 'dashboard' | 'services' | 'incidents' | 'admin' | 'alerts' | 'audits' | 'account';

export type PagePath = '/' | '/services' | '/incidents' | '/admin' | '/alerts' | '/audits' | '/account';

export interface MonitorTarget {
    id: string;
    name: string;
    url: string;
    sortOrder: number;
    isActive: boolean;
}

export interface MonitorStatus {
    id: string;
    name: string;
    url: string;
    up: boolean;
    checkedAt: string;
    statusCode: number | null;
    responseTimeMs: number | null;
    error: string | null;
}

export interface MonitorSummary {
    updatedAt: string;
    lastOutageAt: string | null;
}

/** Incident history entry (open or resolved). */
export interface IncidentRecord {
    id: string;
    monitorId: string;
    name: string;
    url: string;
    startedAt: string;
    /** Null while the outage is still ongoing. */
    resolvedAt: string | null;
    statusCode: number | null;
    error: string | null;
}

export interface Snapshot {
    statuses: MonitorStatus[];
    summary: MonitorSummary;
    incidents: IncidentRecord[];
}

export type AuditAction =
    | 'auth.login'
    | 'auth.login_failed'
    | 'auth.logout'
    | 'account.profile_update'
    | 'account.password_change'
    | 'monitor.create'
    | 'monitor.update'
    | 'monitor.delete'
    | 'monitor.reactivate'
    | 'alerts.update';

export type AuditEntityType = 'user' | 'monitor' | 'session' | 'alert_settings' | 'alert_channel';

export interface AuditRecord {
    id: string;
    createdAt: string;
    action: AuditAction;
    actorUserId: number | null;
    actorUsername: string | null;
    actorName: string | null;
    entityType: AuditEntityType | null;
    entityId: string | null;
    summary: string;
    metadata: Record<string, unknown> | null;
    ip: string | null;
    userAgent: string | null;
}

export interface PageMeta {
    active: DashboardNavId;
    title: string;
    subtitle: string;
}

/** Chrome fields shared by every dashboard page. */
export interface Frame {
    healthLabel: string;
    allUp: boolean;
    timezoneName: string;
    timezoneUtcLabel: string;
    timezoneId: string;
    timestamp: string;
}

/** Serializable identity shown in the dashboard chrome. */
export interface AuthUser {
    id: number;
    username: string;
    name: string;
    email: string;
}

export interface StatusLinks {
    home: string;
    services: string;
    incidents: string;
    admin: string;
    alerts: string;
    audits: string;
    account: string;
    github: string;
}

export interface StatusAppConfig {
    name: string;
    tagline: string;
    description: string;
    version: string;
    author: { name: string; url: string; email: string };
    support: { report_email: string; report_mailto: string };
    monitor: {
        intervalLabel: string;
        intervalMinutes: number;
        engine: string;
        storage: string;
        stream: string;
    };
    theme: { storageKey: string; shortcutKey: string; defaultMode: string };
    links: StatusLinks;
}

/** Props injected on every Inertia response by HandleInertiaRequests. */
export interface StatusSharedProps {
    app: StatusAppConfig;
    auth: { user: AuthUser | null };
    [key: string]: unknown;
}

/** Fields every dashboard page controller returns. */
export interface StatusPageProps {
    path: PagePath;
    meta: PageMeta;
    frame: Frame;
    user: AuthUser | null;
}

export interface PublicPageProps extends StatusPageProps {
    snapshot: Snapshot;
}

export interface DashboardPageProps extends PublicPageProps {
    openLogin?: boolean;
}

export interface AdminPageProps extends StatusPageProps {
    monitors: MonitorTarget[];
    inactiveMonitors: MonitorTarget[];
    flash: string | null;
    error: string | null;
    editingId: string | null;
}

export interface AuditsPageProps extends StatusPageProps {
    audits: AuditRecord[];
}

export interface AccountPageProps extends StatusPageProps {
    user: AuthUser;
    flash: string | null;
    error: string | null;
}

export interface AlertsPageProps extends StatusPageProps {
    settings: {
        discordWebhookUrl: string;
        telegramBotToken: string;
        telegramChatId: string;
    };
    flash: string | null;
    error: string | null;
}
