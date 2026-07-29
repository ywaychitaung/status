import {
  changeUserPassword,
  getSessionUserId,
  updateUserAccount,
} from "@/lib/adminAuth.ts";
import {
  redirect,
  requireAdminSession,
  withQuery,
} from "@/lib/dashboardAuth.ts";
import { define } from "../utils.ts";
import AppShell from "../islands/AppShell.tsx";
import { loadAccountPageData } from "@/lib/pageData.ts";
import { metaForPath } from "@/lib/pageMeta.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const result = await loadAccountPageData(ctx.req);
    if (result instanceof Response) return result;

    const path = "/account" as const;
    return {
      data: {
        path,
        meta: metaForPath(path),
        frame: result.frame,
        user: result.user,
        flash: result.flash,
        error: result.error,
      },
    };
  },
  async POST(ctx) {
    const session = await requireAdminSession(ctx.req);
    if (session instanceof Response) return session;

    const form = await ctx.req.formData();
    const action = String(form.get("action") ?? "update_profile");
    const userId = await getSessionUserId(ctx.req);
    if (userId === null) {
      return redirect("/?login=1");
    }

    try {
      if (action === "change_password") {
        await changeUserPassword(userId, {
          currentPassword: String(form.get("current_password") ?? ""),
          newPassword: String(form.get("new_password") ?? ""),
          confirmPassword: String(form.get("confirm_password") ?? ""),
        });
        return redirect(withQuery("/account", {
          flash: "Password changed.",
          error: null,
        }));
      }

      await updateUserAccount(userId, {
        name: String(form.get("name") ?? ""),
        username: String(form.get("username") ?? ""),
      });
      return redirect(withQuery("/account", {
        flash: "Profile updated.",
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Something went wrong.";
      return redirect(withQuery("/account", {
        flash: null,
        error: message,
      }));
    }
  },
});

export default define.page<typeof handler>(function AccountPage({ data }) {
  return <AppShell initial={data} />;
});
