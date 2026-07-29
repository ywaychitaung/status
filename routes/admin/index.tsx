import {
  createMonitor,
  deleteMonitor,
  getMonitor,
  reactivateMonitor,
  updateMonitor,
} from "@/lib/monitorsDb.ts";
import { writeAuditSafe } from "@/lib/audit.ts";
import {
  redirect,
  requireAdminSession,
  withQuery,
} from "@/lib/dashboardAuth.ts";
import { define } from "../../utils.ts";
import AppShell from "../../islands/AppShell.tsx";
import { loadAdminPageData } from "@/lib/pageData.ts";
import { metaForPath } from "@/lib/pageMeta.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const result = await loadAdminPageData(ctx.req);
    if (result instanceof Response) return result;

    const path = "/admin" as const;
    return {
      data: {
        path,
        meta: metaForPath(path),
        frame: result.frame,
        user: result.user,
        monitors: result.monitors,
        inactiveMonitors: result.inactiveMonitors,
        flash: result.flash,
        error: result.error,
        editingId: result.editingId,
      },
    };
  },
  async POST(ctx) {
    const session = await requireAdminSession(ctx.req);
    if (session instanceof Response) return session;

    const form = await ctx.req.formData();
    const action = String(form.get("action") ?? "");

    try {
      if (action === "create") {
        const name = String(form.get("name") ?? "");
        const url = String(form.get("url") ?? "");
        const created = await createMonitor({ name, url });
        await writeAuditSafe({
          action: "monitor.create",
          actor: session,
          entityType: "monitor",
          entityId: created.id,
          summary: `${session.name} created website ${created.name}`,
          metadata: { name: created.name, url: created.url },
          req: ctx.req,
        });
        return redirect(withQuery("/admin", {
          flash: "Website added.",
          error: null,
          edit: null,
        }));
      }

      if (action === "update") {
        const id = String(form.get("id") ?? "");
        const before = await getMonitor(id);
        const updated = await updateMonitor(id, {
          name: String(form.get("name") ?? ""),
          url: String(form.get("url") ?? ""),
          sortOrder: Number(form.get("sort_order")),
        });
        await writeAuditSafe({
          action: "monitor.update",
          actor: session,
          entityType: "monitor",
          entityId: updated.id,
          summary: `${session.name} updated website ${updated.name}`,
          metadata: {
            before: before
              ? {
                name: before.name,
                url: before.url,
                sortOrder: before.sortOrder,
              }
              : null,
            after: {
              name: updated.name,
              url: updated.url,
              sortOrder: updated.sortOrder,
            },
          },
          req: ctx.req,
        });
        return redirect(withQuery("/admin", {
          flash: "Website updated.",
          error: null,
          edit: null,
        }));
      }

      if (action === "delete") {
        const id = String(form.get("id") ?? "");
        const before = await getMonitor(id);
        await deleteMonitor(id);
        await writeAuditSafe({
          action: "monitor.delete",
          actor: session,
          entityType: "monitor",
          entityId: id,
          summary: `${session.name} deleted website ${
            before?.name ?? id
          }`,
          metadata: before
            ? { name: before.name, url: before.url, sortOrder: before.sortOrder }
            : { id },
          req: ctx.req,
        });
        return redirect(withQuery("/admin", {
          flash: "Website deactivated.",
          error: null,
          edit: null,
        }));
      }

      if (action === "reactivate") {
        const id = String(form.get("id") ?? "");
        const restored = await reactivateMonitor(id);
        await writeAuditSafe({
          action: "monitor.reactivate",
          actor: session,
          entityType: "monitor",
          entityId: restored.id,
          summary: `${session.name} reactivated website ${restored.name}`,
          metadata: {
            name: restored.name,
            url: restored.url,
            sortOrder: restored.sortOrder,
          },
          req: ctx.req,
        });
        return redirect(withQuery("/admin", {
          flash: "Website reactivated.",
          error: null,
          edit: null,
        }));
      }

      return redirect(withQuery("/admin", {
        flash: null,
        error: "Unknown action.",
        edit: null,
      }));
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Something went wrong.";
      return redirect(withQuery("/admin", {
        flash: null,
        error: message,
        edit: String(form.get("id") ?? "") || null,
      }));
    }
  },
});

export default define.page<typeof handler>(function AdminPage({ data }) {
  return <AppShell initial={data} />;
});
