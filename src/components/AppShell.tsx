import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Route } from "../App";
import { MobileBottomNav } from "./MobileBottomNav";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { AccessibilitySheet } from "./AccessibilitySheet";

interface NavItem {
  route: Route;
  label: string;
  icon: LucideIcon;
  i18nKey?: string;
}

interface AppShellProps {
  children: ReactNode;
  navItems: NavItem[];
  activeRoute: Route;
  onNavigate: (route: Route) => void;
  stats: { open: number; high: number; total: number };
  onClearLocalDemoData?: () => Promise<void>;
}

export function AppShell({ children, navItems, activeRoute, onNavigate, stats, onClearLocalDemoData }: AppShellProps) {
  const isMap = activeRoute === "map";
  const { t } = useTranslation();
  const activeItem = navItems.find((n) => n.route === activeRoute);
  const [sheetOpen, setSheetOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const openSettings = (event: MouseEvent<HTMLButtonElement>) => {
    settingsButton.current = event.currentTarget;
    setSheetOpen(true);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("map-route", isMap);
    document.body.classList.toggle("map-route", isMap);
    return () => {
      document.documentElement.classList.remove("map-route");
      document.body.classList.remove("map-route");
    };
  }, [isMap]);

  return (
    <div className="flex h-[100svh] min-h-0 overflow-hidden app-backdrop">
      <a href="#main-content" className="skip-link">{t("a11y.skipToContent")}</a>

      {/* ── Left sidebar (Desktop) ── */}
      <aside
        className="hidden lg:flex h-full min-h-0 flex-col gap-2 py-4 px-3 flex-shrink-0 z-30"
        style={{
          width: "188px",
          background: "rgba(8,10,8,0.96)",
          borderRight: "1px solid var(--border)",
          boxShadow: "18px 0 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Logo mark */}
        <button
          onClick={() => onNavigate("map")}
          className="mb-3 flex h-12 w-full items-center gap-3 px-3 rounded-lg flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(132,240,106,0.16), rgba(104,215,222,0.08))",
            border: "1px solid rgba(232,239,226,0.1)",
          }}
          title="NagarNetra"
          aria-label="NagarNetra — go to map"
        >
          <span className="brand-mark">
            <span />
          </span>
          <span className="text-sm font-bold text-white">NagarNetra</span>
        </button>

        <nav aria-label={t("a11y.primaryNavigation")} className="grid gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.route === activeRoute;
          const label = item.i18nKey ? t(item.i18nKey) : item.label;
          return (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="relative flex items-center justify-start gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-all duration-150 min-h-[44px]"
              style={{
                color: active ? "var(--accent)" : "#64748b",
                background: active ? "rgba(0,224,122,0.08)" : "transparent",
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
              >
              {active && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              <span className="text-sm leading-tight" style={{ fontWeight: 700 }}>{label}</span>
            </button>
          );
        })}</nav>

        {/* Spacer */}
        <div className="flex-1" />

        <button type="button" onClick={openSettings} className="a11y-setting-button px-3" aria-label={t("a11y.openSettings")}>
          <Settings size={18} aria-hidden="true" />
          <span>Preferences</span>
        </button>

        {/* Live report count */}
        {stats.total > 0 && (
          <div className="mb-1 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--border)" }}>
            <div className="text-[18px] font-black" style={{ color: "var(--accent)" }}>{stats.total}</div>
            <div style={{ fontSize: "10px", color: "#6f786c", fontWeight: 700, textTransform: "uppercase" }}>{t("nav.capture")}</div>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 h-full min-h-0 flex flex-col">
        {isMap && <button type="button" onClick={openSettings} className="icon-button absolute right-3 top-3 z-[950] min-h-11 min-w-11 lg:hidden" aria-label={t("a11y.openSettings")} title={t("a11y.openSettings")}><Settings aria-hidden="true" /></button>}
        {/* Top bar — only for non-map pages */}
        {!isMap && (
          <header
            className="flex items-center gap-3 px-4 lg:px-7 shrink-0 min-h-16"
            style={{
              borderBottom: "1px solid var(--border)",
              background: "rgba(7,8,6,0.82)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500">{t("common.appName")}</p>
              <h1 className="text-lg lg:text-[16px] font-bold text-white">
                {activeItem?.i18nKey ? t(activeItem.i18nKey) : activeItem?.label ?? t("common.appName")}
              </h1>
            </div>
            <div className="flex-1" />
            <button type="button" onClick={openSettings} className="icon-button min-h-11 min-w-11 lg:hidden" aria-label={t("a11y.openSettings")} title={t("a11y.openSettings")}><Settings aria-hidden="true" /></button>
            {stats.high > 0 && (
              <span className="hidden sm:inline-flex text-[12px] font-semibold px-3 py-1 rounded-md"
                    style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)", color: "var(--moderate)" }}>
                {stats.high} {t("officer.highPriority")}
              </span>
            )}
            <span className="hidden sm:inline-flex metric-pill">{t("situation.openReports", { count: stats.open })}</span>
          </header>
        )}

        {/* Page content */}
        <div className={isMap ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain relative"}>
          {isMap ? (
            children
          ) : (
            <div className="min-h-full px-4 py-5 pb-[calc(112px+env(safe-area-inset-bottom))] lg:px-7 lg:py-7 lg:pb-7">
              {children}
            </div>
          )}
        </div>
      </main>

      {/* ── Bottom Nav (Mobile) ── */}
      <MobileBottomNav navItems={navItems} activeRoute={activeRoute} onNavigate={onNavigate} />
      <AccessibilitySheet open={sheetOpen} onClose={() => setSheetOpen(false)} opener={settingsButton} onClearLocalDemoData={onClearLocalDemoData} />
      <div id="route-announcer" className="sr-only" role="status" aria-live="polite" />
    </div>
  );
}
