import { define } from "../utils.ts";
import AppShell from "../islands/AppShell.tsx";
import { loadPublicPageData } from "@/lib/pageData.ts";
import { metaForPath } from "@/lib/pageMeta.ts";
import type { PagePayload } from "@/lib/pageTypes.ts";

export default define.page(async function IncidentsPage(ctx) {
  const { frame, snapshot, user } = await loadPublicPageData(ctx.req);
  const path = "/incidents" as const;
  const initial: PagePayload = {
    path,
    meta: metaForPath(path),
    frame,
    snapshot,
    user,
  };

  return <AppShell initial={initial} />;
});
