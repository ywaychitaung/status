import { define } from "../utils.ts";
import AppShell from "../islands/AppShell.tsx";
import { loadAuditsPageData } from "@/lib/pageData.ts";
import { metaForPath } from "@/lib/pageMeta.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const result = await loadAuditsPageData(ctx.req);
    if (result instanceof Response) return result;

    const path = "/audits" as const;
    return {
      data: {
        path,
        meta: metaForPath(path),
        frame: result.frame,
        user: result.user,
        audits: result.audits,
      },
    };
  },
});

export default define.page<typeof handler>(function AuditsPage({ data }) {
  return <AppShell initial={data} />;
});
