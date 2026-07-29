import {
  getSessionUserId,
  getUserById,
  isAdminAuthenticated,
} from "@/lib/adminAuth.ts";
import {
  formatDashboardDatetime,
  getDashboardTimezoneConfig,
} from "@/lib/datetimeFormat.ts";
import { getSnapshot } from "@/lib/checks.ts";

export const LOGIN_REDIRECT = "/?login=1";

export type { AuthUser, DashboardFrame } from "@/lib/pageTypes.ts";
import type { AuthUser, DashboardFrame } from "@/lib/pageTypes.ts";

export { withQuery } from "@/lib/url.ts";

export function redirect(location: string, headers?: HeadersInit): Response {
  return new Response(null, {
    status: 303,
    headers: { location, ...headers },
  });
}

export async function requireAdminSession(
  req: Request,
): Promise<Response | AuthUser> {
  if (!(await isAdminAuthenticated(req))) {
    return redirect(LOGIN_REDIRECT);
  }
  const userId = await getSessionUserId(req);
  if (userId === null) return redirect(LOGIN_REDIRECT);
  const user = await getUserById(userId);
  if (!user) return redirect(LOGIN_REDIRECT);
  return user;
}

export async function getDashboardFrame(): Promise<DashboardFrame> {
  const snapshot = await getSnapshot();
  const timezone = getDashboardTimezoneConfig();
  const total = snapshot.statuses.length;
  const downCount = snapshot.statuses.filter((s) => !s.up).length;
  const allUp = downCount === 0 && total > 0;
  const healthLabel = allUp
    ? "All systems operational"
    : downCount === 1
    ? "1 service is down"
    : `${downCount} services are down`;

  return {
    healthLabel,
    allUp,
    timezoneName: timezone.name,
    timezoneUtcLabel: timezone.utcLabel,
    timezoneId: timezone.id,
    timestamp: formatDashboardDatetime(new Date().toISOString()),
  };
}
