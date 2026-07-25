import { useEffect } from "preact/hooks";
import { formatDashboardDatetimeWithTimezone } from "@/lib/datetimeShared.ts";

interface LiveClockProps {
  timezoneId: string;
}

/** Shared live clock + SSE reload for all dashboard pages. */
export default function LiveClock({ timezoneId }: LiveClockProps) {
  useEffect(() => {
    const updateTimestamp = () => {
      const currentTimestamp = document.getElementById("current-timestamp");
      if (!currentTimestamp) return;
      currentTimestamp.textContent = formatDashboardDatetimeWithTimezone(
        new Date().toISOString(),
        timezoneId,
      );
    };
    updateTimestamp();
    const timestampTimer = setInterval(updateTimestamp, 1000);

    const source = new EventSource("/api/stream");
    let initialSignature: string | null = null;
    let reloadTimer: number | null = null;

    const onSnapshot = (event: MessageEvent) => {
      const payload = JSON.parse(event.data);
      const signature = JSON.stringify(payload);
      if (initialSignature === null) {
        initialSignature = signature;
        return;
      }
      if (signature === initialSignature) return;
      if (reloadTimer !== null) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => location.reload(), 250);
    };

    source.addEventListener("snapshot", onSnapshot as EventListener);

    return () => {
      clearInterval(timestampTimer);
      if (reloadTimer !== null) clearTimeout(reloadTimer);
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.close();
    };
  }, [timezoneId]);

  return null;
}
