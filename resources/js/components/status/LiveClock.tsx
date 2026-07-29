import { router } from '@inertiajs/react';
import { useEffect } from 'react';

import { formatDashboardDatetimeWithTimezone } from '@/lib/datetime';

interface LiveClockProps {
    timezoneId: string;
}

/** Shared live clock + SSE refresh for all dashboard pages. */
export default function LiveClock({ timezoneId }: LiveClockProps) {
    useEffect(() => {
        const updateTimestamp = () => {
            const currentTimestamp = document.getElementById('current-timestamp');
            if (!currentTimestamp) return;
            currentTimestamp.textContent = formatDashboardDatetimeWithTimezone(new Date().toISOString(), timezoneId);
        };
        updateTimestamp();
        const timestampTimer = setInterval(updateTimestamp, 1000);

        const source = new EventSource('/api/stream');
        let initialSignature: string | null = null;
        let reloadTimer: ReturnType<typeof setTimeout> | null = null;

        const onSnapshot = (event: MessageEvent<string>) => {
            const payload = JSON.parse(event.data);
            const signature = JSON.stringify(payload);
            if (initialSignature === null) {
                initialSignature = signature;
                return;
            }
            if (signature === initialSignature) return;
            initialSignature = signature;
            if (reloadTimer !== null) clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => router.reload(), 250);
        };

        source.addEventListener('snapshot', onSnapshot as EventListener);

        return () => {
            clearInterval(timestampTimer);
            if (reloadTimer !== null) clearTimeout(reloadTimer);
            source.removeEventListener('snapshot', onSnapshot as EventListener);
            source.close();
        };
    }, [timezoneId]);

    return null;
}
