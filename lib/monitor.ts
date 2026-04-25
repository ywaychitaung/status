export interface MonitorTarget {
  id: string;
  name: string;
  url: string;
}

export interface MonitorStatus {
  id: string;
  name: string;
  url: string;
  up: boolean;
  checkedAt: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

export interface MonitorSummary {
  updatedAt: string;
  lastOutageAt: string | null;
}

export const MONITORS: MonitorTarget[] = [
  {
    id: "ywaychitaung-dev",
    name: "Portfolio",
    url: "https://ywaychitaung.dev",
  },
  {
    id: "ywaychitaung-com",
    name: "Personal",
    url: "https://ywaychitaung.com",
  },
  {
    id: "utils-ywaychitaung-dev",
    name: "Utilities",
    url: "https://utils.ywaychitaung.dev",
  },
  {
    id: "recipes-ywaychitaung-dev",
    name: "Recipes",
    url: "https://recipes.ywaychitaung.dev",
  },
];

export function monitorKey(id: string): Deno.KvKey {
  return ["monitor", id];
}

export const SUMMARY_KEY: Deno.KvKey = ["summary"];
