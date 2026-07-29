import { useEffect, useMemo, useState } from 'react';

interface OutageTimerProps {
    lastOutageAt: string | null;
}

function formatDuration(seconds: number): string {
    if (seconds < 0) return '0s';
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
}

export default function OutageTimer({ lastOutageAt }: OutageTimerProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);

        return () => clearInterval(timer);
    }, []);

    const label = useMemo(() => {
        if (!lastOutageAt) return 'No outage recorded yet';
        const outageTime = Date.parse(lastOutageAt);
        if (Number.isNaN(outageTime)) return 'No outage recorded yet';
        const elapsed = Math.floor((now - outageTime) / 1000);

        return formatDuration(elapsed);
    }, [lastOutageAt, now]);

    return <p className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-50">{label}</p>;
}
