export type DashboardNavId =
  | "dashboard"
  | "services"
  | "incidents"
  | "admin"
  | "audits"
  | "account";

export type PagePath =
  | "/"
  | "/services"
  | "/incidents"
  | "/admin"
  | "/audits"
  | "/account";

const KNOWN_PATHS: readonly PagePath[] = [
  "/",
  "/services",
  "/incidents",
  "/admin",
  "/audits",
  "/account",
];

const META: Record<
  PagePath,
  { active: DashboardNavId; title: string; subtitle: string }
> = {
  "/": {
    active: "dashboard",
    title: "Dashboard",
    subtitle: "Overview of monitored websites and live health",
  },
  "/services": {
    active: "services",
    title: "Services",
    subtitle: "All monitored endpoints and latest check results",
  },
  "/incidents": {
    active: "incidents",
    title: "Incidents",
    subtitle: "Active outages and recovery timeline",
  },
  "/admin": {
    active: "admin",
    title: "Admin",
    subtitle: "Manage monitored websites",
  },
  "/audits": {
    active: "audits",
    title: "Audits",
    subtitle: "Login, logout, account, and website change history",
  },
  "/account": {
    active: "account",
    title: "Account",
    subtitle: "Update your profile and sign-in credentials",
  },
};

/** Strip query/hash and map unknown paths back to the dashboard root. */
export function normalizePath(path: string): PagePath {
  const withoutHash = path.split("#")[0] ?? path;
  const withoutQuery = withoutHash.split("?")[0] ?? withoutHash;
  const trimmed = withoutQuery.length > 1
    ? withoutQuery.replace(/\/+$/, "")
    : withoutQuery;
  const candidate = trimmed === "" ? "/" : trimmed;
  return (KNOWN_PATHS as readonly string[]).includes(candidate)
    ? candidate as PagePath
    : "/";
}

export function pathToNavId(path: string): DashboardNavId {
  return META[normalizePath(path)].active;
}

export function metaForPath(
  path: string,
): { active: DashboardNavId; title: string; subtitle: string } {
  return META[normalizePath(path)];
}
