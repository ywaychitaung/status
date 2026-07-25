import { App, staticFiles } from "fresh";
import { runChecks } from "@/lib/kv.ts";
import { applySecurityHeaders } from "@/lib/securityHeaders.ts";
import { MONITOR } from "@/lib/constants.ts";
import type { State } from "./utils.ts";

export const app = new App<State>();

app.use(staticFiles());

app.use(async (ctx) => {
  const res = await ctx.next();
  applySecurityHeaders(res);
  return res;
});

const appGlobal = globalThis as typeof globalThis & {
  __statusCronRegistered?: boolean;
  __statusBootstrapCompleted?: boolean;
};

if (!appGlobal.__statusCronRegistered) {
  Deno.cron("uptime-monitor", MONITOR.cronExpression, async () => {
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
