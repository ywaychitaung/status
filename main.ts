import { App, staticFiles } from "fresh";
import { runChecks } from "@/lib/kv.ts";
import type { State } from "./utils.ts";

export const app = new App<State>();

app.use(staticFiles());

const appGlobal = globalThis as typeof globalThis & {
  __statusCronRegistered?: boolean;
  __statusBootstrapCompleted?: boolean;
};

if (!appGlobal.__statusCronRegistered) {
  Deno.cron("uptime-monitor", "* * * * *", async () => {
    await runChecks();
  });
  appGlobal.__statusCronRegistered = true;
}

if (!appGlobal.__statusBootstrapCompleted) {
  appGlobal.__statusBootstrapCompleted = true;
  runChecks().catch((error) => {
    console.error("Initial monitor check failed:", error);
  });
}

// Include file-system based routes here
app.fsRoutes();
