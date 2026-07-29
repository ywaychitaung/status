import { define } from "../utils.ts";
import AppShell from "../islands/AppShell.tsx";
import { loadPublicPageData } from "@/lib/pageData.ts";
import { metaForPath } from "@/lib/pageMeta.ts";
import type { PagePayload } from "@/lib/pageTypes.ts";

export default define.page(async function Home(ctx) {
  const openLogin = new URL(ctx.req.url).searchParams.get("login") === "1";
  const { frame, snapshot, user } = await loadPublicPageData(ctx.req);
  const path = "/" as const;
  const initial: PagePayload = {
    path,
    meta: metaForPath(path),
    frame,
    snapshot,
    user,
  };

  return <AppShell openLogin={openLogin} initial={initial} />;
});
