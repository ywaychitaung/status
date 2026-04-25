import { useEffect, useMemo, useState } from "preact/hooks";

interface OutageTimerProps {
  lastOutageAt: string | null;
}

declare global {
  var __lastOutageAt: string | null | undefined;
}

function formatDuration(seconds: number): string {
  if (seconds < 0) return "0s";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

export default function OutageTimer({ lastOutageAt }: OutageTimerProps) {
  const [latestOutage, setLatestOutage] = useState<string | null>(lastOutageAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    globalThis.__lastOutageAt = lastOutageAt;
    const sync = setInterval(() => {
      setLatestOutage(globalThis.__lastOutageAt ?? null);
    }, 1000);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(sync);
    };
  }, [lastOutageAt]);

  const label = useMemo(() => {
    if (!latestOutage) return "No outage recorded yet";
    const outageTime = Date.parse(latestOutage);
    if (Number.isNaN(outageTime)) return "No outage recorded yet";
    const elapsed = Math.floor((now - outageTime) / 1000);
    return formatDuration(elapsed);
  }, [latestOutage, now]);

  return (
    <p class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {label}
    </p>
  );
}
