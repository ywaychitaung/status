import { useState } from "preact/hooks";
import { Eye, EyeOff } from "lucide-preact";

function PasswordField({
  name,
  label,
  autocomplete,
  required = true,
  minLength,
}: {
  name: string;
  label: string;
  autocomplete: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label class="block">
      <span class="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div class="relative mt-1.5">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autocomplete={autocomplete}
          class="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-3 pr-10 text-sm outline-none ring-emerald-500/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          class="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

export default function PasswordChangeForm() {
  return (
    <section class="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
      <h2 class="text-sm font-semibold tracking-tight">Password</h2>
      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Enter your current password, then choose a new one.
      </p>
      <form method="post" class="mt-4 grid gap-3">
        <input type="hidden" name="action" value="change_password" />
        <PasswordField
          name="current_password"
          label="Current password"
          autocomplete="current-password"
        />
        <PasswordField
          name="new_password"
          label="New password"
          autocomplete="new-password"
          minLength={8}
        />
        <PasswordField
          name="confirm_password"
          label="Confirm new password"
          autocomplete="new-password"
          minLength={8}
        />
        <div>
          <button
            type="submit"
            class="inline-flex cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Change password
          </button>
        </div>
      </form>
    </section>
  );
}
