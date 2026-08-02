import { Link, usePage } from '@inertiajs/react';
import { Activity, Bell, ClipboardList, LayoutDashboard, Server, Settings, Shield, UserRound } from 'lucide-react';

import type { DashboardNavId, StatusLinks, StatusSharedProps } from '@/types/status';

type NavItem = {
    id: DashboardNavId;
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
};

function baseNav(links: StatusLinks): NavItem[] {
    return [
        {
            id: 'dashboard',
            href: links.home,
            label: 'Dashboard',
            icon: LayoutDashboard,
        },
        {
            id: 'services',
            href: links.services,
            label: 'Services',
            icon: Server,
        },
        {
            id: 'incidents',
            href: links.incidents,
            label: 'Incidents',
            icon: Activity,
        },
    ];
}

function authNav(links: StatusLinks): NavItem[] {
    return [
        {
            id: 'admin',
            href: links.admin,
            label: 'Admin',
            icon: Settings,
        },
        {
            id: 'security',
            href: links.security,
            label: 'Security',
            icon: Shield,
        },
        {
            id: 'alerts',
            href: links.alerts,
            label: 'Alerts',
            icon: Bell,
        },
        {
            id: 'audits',
            href: links.audits,
            label: 'Audits',
            icon: ClipboardList,
        },
        {
            id: 'account',
            href: links.account,
            label: 'Account',
            icon: UserRound,
        },
    ];
}

interface DashboardNavProps {
    active: DashboardNavId;
    authName: string | null;
    variant: 'side' | 'mobile';
}

function navClass(active: boolean): string {
    return active
        ? 'flex items-center gap-2.5 rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900'
        : 'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100';
}

function mobileClass(active: boolean): string {
    return `flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-medium ${
        active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
    }`;
}

export default function DashboardNav({ active, authName, variant }: DashboardNavProps) {
    const { app } = usePage<StatusSharedProps>().props;
    const items = authName ? [...baseNav(app.links), ...authNav(app.links)] : baseNav(app.links);

    return (
        <>
            {items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;

                return (
                    <Link
                        key={item.id}
                        href={item.href}
                        className={variant === 'mobile' ? mobileClass(isActive) : navClass(isActive)}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <Icon size={variant === 'mobile' ? 18 : 16} />
                        {item.label}
                    </Link>
                );
            })}
        </>
    );
}
