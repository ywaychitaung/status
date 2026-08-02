import { useMemo, useState } from 'react';
import PasswordChangeForm from '@/components/status/PasswordChangeForm';
import { csrfToken } from '@/lib/csrf';
import type { AuthUser } from '@/types/status';

export interface AccountViewProps {
    user: AuthUser;
    flash: string | null;
    error: string | null;
}

/** Practical email shape check while the user types. */
function isValidEmail(value: string): boolean {
    const email = value.trim();
    if (email === '') {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AccountView({ user, flash, error }: AccountViewProps) {
    const [email, setEmail] = useState(user.email ?? '');
    const [emailTouched, setEmailTouched] = useState(false);

    const emailFeedback = useMemo(() => {
        const trimmed = email.trim();
        if (trimmed === '') {
            return { ok: false, message: 'Email is required.' };
        }
        if (!isValidEmail(trimmed)) {
            return { ok: false, message: 'Enter a valid email address.' };
        }

        return { ok: true, message: null as string | null };
    }, [email]);

    const showEmailHint = emailTouched;

    return (
        <div className="w-full space-y-6">
            {flash && (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {flash}
                </p>
            )}
            {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </p>
            )}

            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <h2 className="text-sm font-semibold tracking-tight">Profile</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Update your display name, username, and email.
                </p>
                <form
                    method="post"
                    action="/account"
                    className="mt-4 grid gap-3 sm:grid-cols-2"
                    onSubmit={() => setEmailTouched(false)}
                >
                    <input type="hidden" name="_token" value={csrfToken()} />
                    <input type="hidden" name="action" value="update_profile" />
                    <label className="block sm:col-span-2">
                        <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Name</span>
                        <input
                            name="name"
                            required
                            defaultValue={user.name}
                            className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                    </label>
                    <label className="block sm:col-span-2">
                        <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Username</span>
                        <input
                            name="username"
                            required
                            defaultValue={user.username}
                            autoComplete="username"
                            className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                    </label>
                    <label className="block sm:col-span-2">
                        <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Email</span>
                        <input
                            type="email"
                            name="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(event) => {
                                setEmail(event.target.value);
                                setEmailTouched(true);
                            }}
                            aria-invalid={showEmailHint && !emailFeedback.ok}
                            aria-describedby={showEmailHint ? 'account-email-hint' : undefined}
                            className={[
                                'mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 dark:bg-zinc-950',
                                showEmailHint && !emailFeedback.ok
                                    ? 'border-red-300 ring-red-500/30 dark:border-red-800'
                                    : 'border-zinc-200 ring-emerald-500/40 dark:border-zinc-700',
                            ].join(' ')}
                        />
                        {showEmailHint && (
                            <p
                                id="account-email-hint"
                                className={[
                                    'mt-1.5 text-xs',
                                    emailFeedback.ok
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-red-600 dark:text-red-400',
                                ].join(' ')}
                            >
                                {emailFeedback.ok ? 'Email looks valid.' : emailFeedback.message}
                            </p>
                        )}
                    </label>
                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            disabled={!emailFeedback.ok}
                            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
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
