function safeTimezone(timezoneId: string): string {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezoneId }).format(
      new Date(),
    );
    return timezoneId;
  } catch {
    return "UTC";
  }
}

export function formatDashboardDatetimeWithTimezone(
  iso: string,
  timezoneId: string,
): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: safeTimezone(timezoneId),
  });
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const day = map.get("day");
  const month = map.get("month");
  const year = map.get("year");
  const hour = map.get("hour");
  const minute = map.get("minute");
  const second = map.get("second");
  const dayPeriod = map.get("dayPeriod");

  if (!day || !month || !year || !hour || !minute || !second || !dayPeriod) {
    return formatter.format(date);
  }

  return `${day} ${month} ${year}, ${hour}:${minute}:${second} ${dayPeriod}`;
}
