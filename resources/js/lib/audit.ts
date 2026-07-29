import type { AuditAction } from '@/types/status';

/** Port of formatAuditAction from _legacy/lib/auditShared.ts. */
export function formatAuditAction(action: AuditAction): string {
    switch (action) {
        case 'auth.login':
            return 'Logged in';
        case 'auth.login_failed':
            return 'Login failed';
        case 'auth.logout':
            return 'Logged out';
        case 'account.profile_update':
            return 'Profile updated';
        case 'account.password_change':
            return 'Password changed';
        case 'monitor.create':
            return 'Website created';
        case 'monitor.update':
            return 'Website updated';
        case 'monitor.delete':
            return 'Website deleted';
        case 'monitor.reactivate':
            return 'Website reactivated';
        default:
            return action;
    }
}
