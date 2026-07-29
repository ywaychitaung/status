import { Head } from '@inertiajs/react';

import AuthControls from '@/components/status/AuthControls';
import DashboardShell from '@/components/status/DashboardShell';
import LiveClock from '@/components/status/LiveClock';
import ThemeToggle from '@/components/status/ThemeToggle';
import AdminView from '@/components/status/views/AdminView';
import type { AdminPageProps } from '@/types/status';

export default function AdminPage({ meta, frame, user, monitors, inactiveMonitors, flash, error, editingId }: AdminPageProps) {
    return (
        <>
            <Head title={meta.title} />
            <DashboardShell
                active={meta.active}
                title={meta.title}
                subtitle={meta.subtitle}
                timezoneName={frame.timezoneName}
                timezoneUtcLabel={frame.timezoneUtcLabel}
                timezoneId={frame.timezoneId}
                timestamp={frame.timestamp}
                healthLabel={frame.healthLabel}
                allUp={frame.allUp}
                themeToggle={<ThemeToggle />}
                liveClock={<LiveClock timezoneId={frame.timezoneId} />}
                authControls={<AuthControls authName={user?.name ?? null} />}
                authName={user?.name ?? null}
            >
                <AdminView monitors={monitors} inactiveMonitors={inactiveMonitors} flash={flash} error={error} editingId={editingId} />
            </DashboardShell>
        </>
    );
}
