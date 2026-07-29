import { Head } from '@inertiajs/react';

import AuthControls from '@/components/status/AuthControls';
import DashboardShell from '@/components/status/DashboardShell';
import LiveClock from '@/components/status/LiveClock';
import ThemeToggle from '@/components/status/ThemeToggle';
import DashboardView from '@/components/status/views/DashboardView';
import type { DashboardPageProps } from '@/types/status';

export default function DashboardPage({ meta, frame, snapshot, user, openLogin = false }: DashboardPageProps) {
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
                authControls={<AuthControls authName={user?.name ?? null} openLogin={openLogin} />}
                authName={user?.name ?? null}
            >
                <DashboardView snapshot={snapshot} />
            </DashboardShell>
        </>
    );
}
