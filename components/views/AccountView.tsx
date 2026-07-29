import PasswordChangeForm from "../../islands/PasswordChangeForm.tsx";

export interface AccountViewProps {
  user: { id: number; username: string; name: string };
  flash: string | null;
  error: string | null;
}

export default function AccountView({ user, flash, error }: AccountViewProps) {
  return (
    <div class="mx-auto w-full max-w-3xl space-y-6">
      {flash && (
        <p class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          {flash}
        </p>
      )}
      {error && (
        <p class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <section class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 class="text-sm font-semibold tracking-tight">Profile</h2>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Update your display name and username.
        </p>
        <form
          method="post"
          action="/account"
          class="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="action" value="update_profile" />
          <label class="block sm:col-span-2">
            <span class="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Name
            </span>
            <input
              name="name"
              required
              value={user.name}
              class="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label class="block sm:col-span-2">
            <span class="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Username
            </span>
            <input
              name="username"
              required
              value={user.username}
              autocomplete="username"
              class="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <div class="sm:col-span-2">
            <button
              type="submit"
              class="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Save profile
            </button>
          </div>
        </form>
      </section>

      <PasswordChangeForm />
    </div>
  );
}
