import { useEffect, useRef, useState } from "preact/hooks";
import { Router, type RouterOnChangeArgs } from "preact-router";
import DashboardShell from "../components/DashboardShell.tsx";
import ThemeToggle from "../components/ThemeToggle.tsx";
import LiveClock from "./LiveClock.tsx";
import AuthControls from "./AuthControls.tsx";
import DashboardView from "../components/views/DashboardView.tsx";
import ServicesView from "../components/views/ServicesView.tsx";
import IncidentsView from "../components/views/IncidentsView.tsx";
import AdminView from "../components/views/AdminView.tsx";
import AuditsView from "../components/views/AuditsView.tsx";
import AccountView from "../components/views/AccountView.tsx";
import type { PagePayload } from "@/lib/pageTypes.ts";
import { metaForPath, normalizePath, type PagePath } from "@/lib/pageMeta.ts";
import { getAppName } from "@/lib/appConfig.ts";

interface AppShellProps {
  initial: PagePayload;
  openLogin?: boolean;
}

/**
 * Catch-all so preact-router accepts every in-app path.
 * Using `default` avoids SSR crashes from undefined route paths.
 */
function CatchAll(_props: { default?: boolean }) {
  return null;
}

function renderView(payload: PagePayload) {
  switch (payload.path) {
    case "/":
      return payload.snapshot
        ? <DashboardView snapshot={payload.snapshot} />
        : null;
    case "/services":
      return payload.snapshot
        ? <ServicesView snapshot={payload.snapshot} />
        : null;
    case "/incidents":
      return payload.snapshot
        ? <IncidentsView snapshot={payload.snapshot} />
        : null;
    case "/admin":
      return (
        <AdminView
          monitors={payload.monitors ?? []}
          inactiveMonitors={payload.inactiveMonitors ?? []}
          flash={payload.flash ?? null}
          error={payload.error ?? null}
          editingId={payload.editingId ?? null}
        />
      );
    case "/audits":
      return <AuditsView audits={payload.audits ?? []} />;
    case "/account":
      return payload.user
        ? (
          <AccountView
            user={payload.user}
            flash={payload.flash ?? null}
            error={payload.error ?? null}
          />
        )
        : null;
  }
}

function buildPagesUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl, "http://local");
  const path = normalizePath(parsed.pathname);
  const api = new URL("/api/pages", "http://local");
  api.searchParams.set("path", path);
  for (const key of ["edit", "flash", "error"] as const) {
    const value = parsed.searchParams.get(key);
    if (value) api.searchParams.set(key, value);
  }
  return `${api.pathname}?${api.searchParams.toString()}`;
}

export default function AppShell({
  initial,
  openLogin = false,
}: AppShellProps) {
  const [payload, setPayload] = useState(initial);
  const [meta, setMeta] = useState(initial.meta);
  const [busy, setBusy] = useState(false);
  const cacheRef = useRef(
    new Map<PagePath, PagePayload>([[initial.path, initial]]),
  );
  const requestIdRef = useRef(0);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    document.title = `${meta.title} · ${getAppName()}`;
  }, [meta.title]);

  async function loadPath(rawUrl: string) {
    const parsed = new URL(rawUrl, "http://local");
    const path = normalizePath(parsed.pathname);
    const nextMeta = metaForPath(path);
    setMeta(nextMeta);

    const hasQuery = parsed.search.length > 1;
    const cached = !hasQuery ? cacheRef.current.get(path) : undefined;
    if (cached) {
      setPayload(cached);
    }

    const requestId = ++requestIdRef.current;
    if (!cached) setBusy(true);

    try {
      const res = await fetch(buildPagesUrl(rawUrl), {
        headers: { accept: "application/json" },
      });

      if (requestId !== requestIdRef.current) return;

      if (res.status === 401) {
        globalThis.location.assign("/?login=1");
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load page (${res.status})`);
      }

      const data = await res.json() as PagePayload;
      if (requestId !== requestIdRef.current) return;

      if (!hasQuery) {
        cacheRef.current.set(data.path, data);
      }
      setPayload(data);
      setMeta(data.meta);
    } catch {
      if (requestId !== requestIdRef.current) return;
      if (!cacheRef.current.has(path)) {
        globalThis.location.assign(parsed.pathname + parsed.search);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setBusy(false);
      }
    }
  }

  function onRouteChange(args: RouterOnChangeArgs) {
    // Skip the hydrate tick — SSR already shipped this page's data.
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      return;
    }
    void loadPath(args.url || "/");
  }

  const frame = payload.frame;
  const authName = payload.user?.name ?? null;

  return (
    <>
      <Router url={initial.path} onChange={onRouteChange}>
        <CatchAll default />
      </Router>

      <DashboardShell
        active={meta.active}
        title={meta.title}
        subtitle={meta.subtitle}
        timezoneName={frame.timezoneName}
        timezoneUtcLabel={frame.timezoneUtcLabel}
        timezoneId={frame.timezoneId}
        timestamp={frame.timestamp}
        healthLabel={frame.healthLabel}
        allUp={frame.allUp}
        authName={authName}
        themeToggle={<ThemeToggle />}
        authControls={
          <AuthControls authName={authName} openLogin={openLogin} />
        }
        liveClock={<LiveClock timezoneId={frame.timezoneId} />}
      >
        <div
          aria-busy={busy ? "true" : undefined}
          class={`space-y-6${busy ? " opacity-70 transition-opacity" : ""}`}
        >
          {renderView(payload)}
        </div>
      </DashboardShell>
    </>
  );
}
