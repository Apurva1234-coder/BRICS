import { LucideIcon } from "lucide-react";
import type { Route } from "../App";
import { useTranslation } from "react-i18next";

interface NavItem {
  route: Route;
  label: string;
  icon: LucideIcon;
  i18nKey?: string;
}

interface MobileBottomNavProps {
  navItems: NavItem[];
  activeRoute: Route;
  onNavigate: (route: Route) => void;
}

export function MobileBottomNav({ navItems, activeRoute, onNavigate }: MobileBottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t("a11y.primaryNavigation")} data-mobile-bottom-nav
      className="fixed bottom-0 left-0 right-0 z-[900] lg:hidden flex items-center justify-around px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2"
      style={{
        background: "rgba(7,11,10,0.96)",
        borderTop: "1px solid var(--border)",
        backdropFilter: "blur(20px)",
      }}
    >
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
            className="relative flex flex-col items-center justify-center gap-1 w-full min-h-[44px] py-1.5 rounded-xl transition-all"
            style={{
              color: active ? "var(--accent)" : "#64748b",
            }}
          >
            {active && (
              <span 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full"
                style={{ background: "var(--accent)" }}
              />
            )}
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} className="mb-0.5" />
            <span style={{ fontSize: "10px", fontWeight: 700, lineHeight: 1 }}>{label.split(" ")[0]}</span>
          </button>
        );
      })}
    </nav>
  );
}
