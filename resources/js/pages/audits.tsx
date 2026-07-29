import { Head } from '@inertiajs/react';

import AuthControls from '@/components/status/AuthControls';
import DashboardShell from '@/components/status/DashboardShell';
import LiveClock from '@/components/status/LiveClock';
import ThemeToggle from '@/components/status/ThemeToggle';
import AuditsView from '@/components/status/views/AuditsView';
import type { AuditsPageProps } from '@/types/status';

export default function AuditsPage({ meta, frame, user, audits }: AuditsPageProps) {
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
                <AuditsView audits={audits} />
            </DashboardShell>
        </>
    );
}
