import { Link, usePage } from '@inertiajs/react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import DashboardNav from '@/components/status/DashboardNav';
import type { DashboardNavId, StatusSharedProps } from '@/types/status';

const NAV_COLLAPSED_KEY = 'status:nav-collapsed';

interface DashboardShellProps {
    active: DashboardNavId;
    title: string;
    subtitle: string;
    timezoneName: string;
    timezoneUtcLabel: string;
    timezoneId: string;
    timestamp: string;
    healthLabel: string;
    allUp: boolean;
    themeToggle: ReactNode;
    liveClock: ReactNode;
    /** Header auth controls island (login modal, logout, toasts). */
    authControls: ReactNode;
    /** Decrypted display name when signed in; null when signed out. */
    authName?: string | null;
    children: ReactNode;
}

function BrandMark({ sizeClass }: { sizeClass: string }) {
    return <img src="/favicon.svg" alt="" width={36} height={36} className={`${sizeClass} shadow-sm shadow-emerald-500/30`} aria-hidden="true" />;
}

/** Lucide dropped brand icons; keep a simple GitHub mark locally. */
function GithubIcon({ size = 14 }: { size?: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
    );
}

export default function DashboardShell({
    active,
    title,
    subtitle,
    timezoneName,
    timezoneUtcLabel,
    timezoneId,
    timestamp,
    healthLabel,
    allUp,
    themeToggle,
    liveClock,
    authControls,
    authName = null,
    children,
}: DashboardShellProps) {
    const { app } = usePage<StatusSharedProps>().props;
    const mobileCols = authName ? 'grid-cols-4' : 'grid-cols-3';
    const [navOpen, setNavOpen] = useState(true);

    useEffect(() => {
        try {
            if (window.localStorage.getItem(NAV_COLLAPSED_KEY) === '1') {
                setNavOpen(false);
            }
        } catch {
            // Ignore storage access failures.
        }
    }, []);

    const toggleNav = () => {
        setNavOpen((current) => {
            const next = !current;
            try {
                window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? '0' : '1');
            } catch {
                // Ignore storage access failures.
            }
            return next;
        });
    };

    return (
        <div
            id="dashboard-root"
            className="bg-dashboard relative min-h-screen max-w-[100vw] overflow-x-hidden text-zinc-900 lg:h-dvh lg:min-h-0 lg:overflow-hidden dark:text-zinc-50"
            data-timezone-id={timezoneId}
        >
            <div className="flex min-h-screen w-full min-w-0 lg:h-full lg:min-h-0">
                <aside
                    className={[
                        'hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-zinc-200/80 bg-white/70 backdrop-blur-md transition-[width,padding,opacity] duration-200 ease-out lg:flex dark:border-zinc-800/80 dark:bg-zinc-950/60',
                        navOpen ? 'w-56 px-4 py-6 opacity-100' : 'pointer-events-none w-0 border-transparent px-0 py-6 opacity-0',
                    ].join(' ')}
                    aria-hidden={!navOpen}
                >
                    <div className="flex h-full w-48 flex-col">
                        <Link href={app.links.home} className="flex items-center gap-2.5 px-2">
                            <BrandMark sizeClass="h-9 w-9" />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold tracking-tight">{app.name}</p>
                                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{app.tagline}</p>
                            </div>
                        </Link>

                        <nav className="mt-8 space-y-1">
                            <DashboardNav active={active} authName={authName} variant="side" />
                        </nav>

                        <div className="mt-auto space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                            <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">Live clock</p>
                            <p id="current-timestamp" className="text-xs leading-relaxed text-zinc-700 tabular-nums dark:text-zinc-200">
                                {timestamp}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {timezoneName} ({timezoneUtcLabel})
                            </p>
                        </div>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col pb-20 lg:min-h-0 lg:overflow-y-auto lg:pb-0">
                    <header className="bg-dashboard-header sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800">
                        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
                            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={toggleNav}
                                    className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white/80 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 lg:inline-flex dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                                    aria-label={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                                    aria-expanded={navOpen}
                                    title={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                                >
                                    {navOpen ? <PanelLeftClose size={16} aria-hidden /> : <PanelLeft size={16} aria-hidden />}
                                </button>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 lg:hidden">
                                        <BrandMark sizeClass="h-8 w-8 shrink-0" />
                                        <h1 className="truncate text-base font-semibold tracking-tight">{app.name}</h1>
                                    </div>
                                    <div className="hidden min-w-0 lg:block">
                                        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
                                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <div
                                    id="dashboard-health-chip"
                                    className={`hidden max-w-48 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium md:inline-flex xl:max-w-none ${
                                        allUp
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300'
                                    }`}
                                >
                                    <span
                                        id="dashboard-health-dot"
                                        className={`animate-pulse-dot h-2 w-2 shrink-0 rounded-full ${allUp ? 'bg-emerald-500' : 'bg-red-500'}`}
                                    />
                                    <span id="dashboard-health-label" className="truncate">
                                        {healthLabel}
                                    </span>
                                </div>
                                <a
                                    href={app.links.github}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white/80 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                                    aria-label="View source on GitHub"
                                    title="GitHub"
                                >
                                    <GithubIcon size={14} />
                                </a>
                                {themeToggle}
                                {authControls}
                            </div>
                        </div>
                    </header>

                    <main className="min-w-0 flex-1 space-y-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                        <div className="min-w-0 lg:hidden">
                            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
                        </div>
                        <div className="min-w-0 max-w-full">{children}</div>
                    </main>

                    <footer className="mt-auto flex flex-col gap-2 border-t border-zinc-200/80 px-4 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 dark:border-zinc-800/80 dark:text-zinc-400">
                        <p className="hidden sm:block">
                            Press{' '}
                            <kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-sans text-[10px] dark:border-zinc-700">
                                {app.theme.shortcutKey}
                            </kbd>{' '}
                            to toggle theme
                        </p>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-zinc-400 tabular-nums dark:text-zinc-500">v{app.version}</span>
                            <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                                ·
                            </span>
                            <span>
                                Built by{' '}
                                <a
                                    href={app.author.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-zinc-700 transition-colors hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400"
                                >
                                    {app.author.name}
                                </a>
                            </span>
                        </p>
                    </footer>
                </div>
            </div>

            <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/90 bg-white/90 backdrop-blur-md lg:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
                <div className={`mx-auto grid w-full max-w-full min-w-0 ${mobileCols}`}>
                    <DashboardNav active={active} authName={authName} variant="mobile" />
                </div>
            </nav>

            {liveClock}
        </div>
    );
}
