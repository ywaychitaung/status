import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { csrfToken } from '@/lib/csrf';

function PasswordField({
    name,
    label,
    autoComplete,
    required = true,
    minLength,
}: {
    name: string;
    label: string;
    autoComplete: string;
    required?: boolean;
    minLength?: number;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <label className="block">
            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">{label}</span>
            <div className="relative mt-1.5">
                <input
                    name={name}
                    type={visible ? 'text' : 'password'}
                    required={required}
                    minLength={minLength}
                    autoComplete={autoComplete}
                    className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pr-10 pl-3 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
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
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <h2 className="text-sm font-semibold tracking-tight">Password</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Enter your current password, then choose a new one.</p>
            <form method="post" action="/account" className="mt-4 grid gap-3">
                <input type="hidden" name="_token" value={csrfToken()} />
                <input type="hidden" name="action" value="change_password" />
                <PasswordField name="current_password" label="Current password" autoComplete="current-password" />
                <PasswordField name="new_password" label="New password" autoComplete="new-password" minLength={8} />
                <PasswordField name="confirm_password" label="Confirm new password" autoComplete="new-password" minLength={8} />
                <div>
                    <button
                        type="submit"
                        className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                        Change password
                    </button>
                </div>
            </form>
        </section>
    );
}
