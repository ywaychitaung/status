import { Moon, Sun } from "lucide-preact";

/** Presentational toggle; theme switching is handled by /theme-bootstrap.js */
export default function ThemeToggle() {
  return (
    <button
      type="button"
      data-theme-toggle
      class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      aria-label="Toggle color theme"
      title="Toggle color theme (d)"
    >
      <Sun size={14} class="hidden dark:block" />
      <Moon size={14} class="dark:hidden" />
    </button>
  );
}
