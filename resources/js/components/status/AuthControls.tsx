import { Link, usePage } from "@inertiajs/react";
import { Eye, EyeOff, LogIn, LogOut, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { pauseStatusStream } from "@/components/status/LiveClock";
import { Checkbox } from "@/components/ui/checkbox";
import { csrfToken } from "@/lib/csrf";
import type { StatusSharedProps } from "@/types/status";

interface AuthControlsProps {
    authName: string | null;
    /** Open the login modal on first paint (e.g. ?login=1). */
    openLogin?: boolean;
}

type Toast = { id: number; message: string; tone: "success" | "error" };

const TOAST_KEY = "status_toast";

/** Same-origin JSON request that Laravel treats as an AJAX (non-Inertia) call. */
function postJson(
    url: string,
    body?: Record<string, unknown>,
): Promise<Response> {
    return fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRF-TOKEN": csrfToken(),
        },
        body: JSON.stringify(body ?? {}),
    });
}

export default function AuthControls(
    { authName, openLogin = false }: AuthControlsProps,
) {
    const { app } = usePage<StatusSharedProps>().props;
    const [open, setOpen] = useState(openLogin);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    function pushToast(message: string, tone: Toast["tone"] = "success") {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((prev) => [...prev, { id, message, tone }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3200);
    }

    useEffect(() => {
        const pending = sessionStorage.getItem(TOAST_KEY);
        if (!pending) return;
        sessionStorage.removeItem(TOAST_KEY);
        pushToast(pending, "success");
    }, []);

    useEffect(() => {
        if (!open) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    async function onLogin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);
        // Free the PHP built-in server worker held by EventSource.
        pauseStatusStream();
        try {
            const response = await postJson("/login", {
                username,
                password,
                remember,
            });
            const data = (await response.json()) as {
                ok?: boolean;
                error?: string;
                name?: string;
            };
            if (!response.ok || !data.ok) {
                setFormError(data.error ?? "Login failed.");
                return;
            }
            sessionStorage.setItem(
                TOAST_KEY,
                `Signed in as ${data.name ?? "admin"}`,
            );
            setOpen(false);
            location.reload();
        } catch {
            setFormError("Network error. Try again.");
        } finally {
            setSubmitting(false);
        }
    }

    async function onLogout() {
        setSubmitting(true);
        pauseStatusStream();
        try {
            await postJson("/logout");
            sessionStorage.setItem(TOAST_KEY, "Signed out");
            location.reload();
        } catch {
            pushToast("Logout failed.", "error");
            setSubmitting(false);
        }
    }

    const overlay = open
        ? (
            <div
                className="fixed inset-0 z-200 flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-sm"
                onClick={(event) => {
                    if (event.target === event.currentTarget) setOpen(false);
                }}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="login-dialog-title"
                    className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2
                                id="login-dialog-title"
                                className="text-lg font-semibold tracking-tight"
                            >
                                Log In
                            </h2>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                Access the admin panel to manage monitored
                                websites.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            aria-label="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {formError && (
                        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                            {formError}
                        </p>
                    )}

                    <form className="mt-5 space-y-4" onSubmit={onLogin}>
                        <label className="block">
                            <span className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
                                Username or email
                            </span>
                            <input
                                type="text"
                                name="username"
                                required
                                autoFocus
                                autoComplete="username"
                                value={username}
                                onChange={(event) =>
                                    setUsername(event.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
                                Password
                            </span>
                            <div className="relative mt-1.5">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    required
                                    minLength={8}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pr-10 pl-3 text-sm text-zinc-900 ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
                                    aria-label={showPassword
                                        ? "Hide password"
                                        : "Show password"}
                                >
                                    {showPassword
                                        ? <EyeOff size={16} />
                                        : <Eye size={16} />}
                                </button>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                            <Checkbox
                                checked={remember}
                                onCheckedChange={(value) =>
                                    setRemember(value === true)}
                                className="border-zinc-300 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 dark:border-zinc-600"
                            />
                            Remember me
                        </label>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                            {submitting ? "Logging in…" : "Log in"}
                        </button>
                    </form>
                </div>
            </div>
        )
        : null;

    const toastLayer = (
        <div className="pointer-events-none fixed right-4 bottom-20 z-210 flex w-[calc(100%-2rem)] max-w-sm flex-col-reverse gap-2 sm:right-6 lg:bottom-6">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ${
                        toast.tone === "success"
                            ? "border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/90 dark:text-emerald-200"
                            : "border-red-200 bg-red-50/95 text-red-700 dark:border-red-900/50 dark:bg-red-950/90 dark:text-red-200"
                    }`}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );

    return (
        <>
            {authName
                ? (
                    <>
                        <Link
                            href={app.links.account}
                            className="inline-flex max-w-40 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                            title="Account"
                        >
                            <User size={14} />
                            <span className="truncate">{authName}</span>
                        </Link>
                        <button
                            type="button"
                            onClick={onLogout}
                            disabled={submitting}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                        >
                            <LogOut size={14} />
                            Logout
                        </button>
                    </>
                )
                : (
                    <button
                        type="button"
                        onClick={() => {
                            setFormError(null);
                            setOpen(true);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    >
                        <LogIn size={14} />
                        Login
                    </button>
                )}

            {mounted &&
                createPortal(
                    <>
                        {overlay}
                        {toastLayer}
                    </>,
                    document.body,
                )}
        </>
    );
}
