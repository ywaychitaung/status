import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  getCurrentUser,
  hasUsers,
  seedAdminIfEmpty,
  attemptUserLogin,
} from "@/lib/adminAuth.ts";
import { writeAuditSafe } from "@/lib/audit.ts";
import { define } from "../../utils.ts";

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export const handler = define.handlers({
  async POST(ctx) {
    let body: {
      action?: string;
      username?: string;
      password?: string;
    };
    try {
      body = await ctx.req.json();
    } catch {
      await writeAuditSafe({
        action: "auth.login_failed",
        entityType: "session",
        summary: "Failed login attempt (invalid request body)",
        metadata: {
          error: "Invalid JSON body",
          reason: "invalid_json",
        },
        req: ctx.req,
      });
      return json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const action = String(body.action ?? "login");

    if (action === "logout") {
      const current = await getCurrentUser(ctx.req);
      if (current) {
        await writeAuditSafe({
          action: "auth.logout",
          actor: current,
          entityType: "session",
          summary: `${current.name} logged out`,
          req: ctx.req,
        });
      }
      return json(
        { ok: true },
        { headers: { "set-cookie": clearAdminSessionCookie() } },
      );
    }

    if (action !== "login") {
      return json({ ok: false, error: "Unknown action." }, { status: 400 });
    }

    try {
      await seedAdminIfEmpty();
    } catch {
      // Login will report a clear error if DB is unavailable.
    }

    const username = String(body.username ?? "");
    const password = String(body.password ?? "");
    const attemptedUsername = username.trim() || null;

    try {
      if (!(await hasUsers())) {
        const error =
          "No admin user found. Check DATABASE_URL and restart the app.";
        await writeAuditSafe({
          action: "auth.login_failed",
          actorUsername: attemptedUsername,
          entityType: "session",
          summary: `Failed login attempt for ${
            attemptedUsername ?? "(empty)"
          }: ${error}`,
          metadata: { error, reason: "no_users" },
          req: ctx.req,
        });
        return json({ ok: false, error }, { status: 503 });
      }

      const result = await attemptUserLogin(username, password);
      if (!result.ok) {
        await writeAuditSafe({
          action: "auth.login_failed",
          actorUsername: attemptedUsername,
          entityType: "session",
          summary: `Failed login attempt for ${
            attemptedUsername ?? "(empty)"
          }: ${result.message}`,
          metadata: {
            error: result.message,
            reason: result.reason,
          },
          req: ctx.req,
        });
        return json(
          { ok: false, error: "Incorrect username or password." },
          { status: 401 },
        );
      }

      const user = result.user;
      await writeAuditSafe({
        action: "auth.login",
        actor: user,
        entityType: "session",
        entityId: String(user.id),
        summary: `${user.name} logged in`,
        req: ctx.req,
      });

      const cookie = await createAdminSessionCookie(user.id);
      return json(
        { ok: true, name: user.name, username: user.username },
        { headers: { "set-cookie": cookie } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed.";
      await writeAuditSafe({
        action: "auth.login_failed",
        actorUsername: attemptedUsername,
        entityType: "session",
        summary: `Failed login attempt for ${
          attemptedUsername ?? "(empty)"
        }: ${message}`,
        metadata: { error: message, reason: "server_error" },
        req: ctx.req,
      });
      return json({ ok: false, error: message }, { status: 500 });
    }
  },
});
