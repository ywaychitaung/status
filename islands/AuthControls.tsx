import { createPortal } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { route } from "preact-router";
import { Eye, EyeOff, LogIn, LogOut, User, X } from "lucide-preact";
import { LINKS } from "@/lib/constants.ts";

interface AuthControlsProps {
  authName: string | null;
  /** Open the login modal on first paint (e.g. ?login=1). */
  openLogin?: boolean;
}

type Toast = { id: number; message: string; tone: "success" | "error" };

const TOAST_KEY = "status_toast";

export default function AuthControls({
  authName,
  openLogin = false,
}: AuthControlsProps) {
  const [open, setOpen] = useState(openLogin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

  async function onLogin(event: Event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "login",
          username,
          password,
        }),
      });
      const data = await response.json() as {
        ok?: boolean;
        error?: string;
        name?: string;
      };
      if (!response.ok || !data.ok) {
        setFormError(data.error ?? "Login failed.");
        return;
      }
      sessionStorage.setItem(TOAST_KEY, `Signed in as ${data.name ?? "admin"}`);
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
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
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
        class="fixed inset-0 z-200 flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-sm"
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-dialog-title"
          class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2
                id="login-dialog-title"
                class="text-lg font-semibold tracking-tight"
              >
                Log In
              </h2>
              <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Access the admin panel to manage monitored websites.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {formError && (
            <p class="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          )}

          <form class="mt-5 space-y-4" onSubmit={onLogin}>
            <label class="block">
              <span class="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Username
              </span>
              <input
                type="text"
                name="username"
                required
                autofocus
                autocomplete="username"
                value={username}
                onInput={(e) =>
                  setUsername((e.target as HTMLInputElement).value)}
                class="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>
            <label class="block">
              <span class="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Password
              </span>
              <div class="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  minLength={8}
                  autocomplete="current-password"
                  value={password}
                  onInput={(e) =>
                    setPassword((e.target as HTMLInputElement).value)}
                  class="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-3 pr-10 text-sm text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  class="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={submitting}
              class="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {submitting ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    )
    : null;

  const toastLayer = (
    <div class="pointer-events-none fixed right-4 top-4 z-210 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          class={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ${
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
            <a
              href={LINKS.account}
              onClick={(event) => {
                if (event.defaultPrevented) return;
                if (event.button !== 0) return;
                if (
                  event.metaKey || event.ctrlKey || event.shiftKey ||
                  event.altKey
                ) return;
                event.preventDefault();
                if (globalThis.location.pathname !== LINKS.account) {
                  route(LINKS.account);
                }
              }}
              class="inline-flex max-w-40 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              title="Account"
            >
              <User size={14} />
              <span class="truncate">{authName}</span>
            </a>
            <button
              type="button"
              onClick={onLogout}
              disabled={submitting}
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
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
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <LogIn size={14} />
            Login
          </button>
        )}

      {mounted && createPortal(
        <>
          {overlay}
          {toastLayer}
        </>,
        document.body,
      )}
    </>
  );
}
