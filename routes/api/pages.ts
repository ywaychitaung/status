import { define } from "../../utils.ts";
import { metaForPath, normalizePath } from "@/lib/pageMeta.ts";
import {
  loadAccountPageData,
  loadAdminPageData,
  loadAuditsPageData,
  loadPublicPageData,
} from "@/lib/pageData.ts";

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const rawPath = url.searchParams.get("path");
    if (!rawPath) {
      return json({ error: "path query parameter is required" }, {
        status: 400,
      });
    }

    const path = normalizePath(rawPath);
    const meta = metaForPath(path);

    if (path === "/admin") {
      const result = await loadAdminPageData(ctx.req);
      if (result instanceof Response) {
        return json({ error: "unauthorized" }, { status: 401 });
      }
      const {
        frame,
        user,
        monitors,
        inactiveMonitors,
        flash,
        error,
        editingId,
      } = result;
      return json({
        path,
        meta,
        frame,
        user,
        monitors,
        inactiveMonitors,
        flash,
        error,
        editingId,
      });
    }

    if (path === "/audits") {
      const result = await loadAuditsPageData(ctx.req);
      if (result instanceof Response) {
        return json({ error: "unauthorized" }, { status: 401 });
      }
      const { frame, user, audits } = result;
      return json({ path, meta, frame, user, audits });
    }

    if (path === "/account") {
      const result = await loadAccountPageData(ctx.req);
      if (result instanceof Response) {
        return json({ error: "unauthorized" }, { status: 401 });
      }
      const { frame, user, flash, error } = result;
      return json({ path, meta, frame, user, flash, error });
    }

    const { frame, snapshot, user } = await loadPublicPageData(ctx.req);
    return json({ path, meta, frame, snapshot, user });
  },
});
