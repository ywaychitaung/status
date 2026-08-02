import { router } from '@inertiajs/react';
import { useEffect } from 'react';

import { formatDashboardDatetimeWithTimezone } from '@/lib/datetime';

interface LiveClockProps {
    timezoneId: string;
}

export const PAUSE_STREAM_EVENT = 'status:pause-stream';

/** Close the live SSE feed so single-worker PHP can handle other requests. */
export function pauseStatusStream(): void {
    window.dispatchEvent(new Event(PAUSE_STREAM_EVENT));
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

        let source: EventSource | null = new EventSource('/api/stream');
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

        const pause = () => {
            if (source === null) return;
            source.removeEventListener('snapshot', onSnapshot as EventListener);
            source.close();
            source = null;
        };
        window.addEventListener(PAUSE_STREAM_EVENT, pause);

        return () => {
            clearInterval(timestampTimer);
            if (reloadTimer !== null) clearTimeout(reloadTimer);
            window.removeEventListener(PAUSE_STREAM_EVENT, pause);
            pause();
        };
    }, [timezoneId]);

    return null;
}
