import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Route } from "../App";

export function useRouteAccessibility(route: Route) {
  const { t } = useTranslation();
  useEffect(() => {
    const names: Record<Route, string> = { map: t("nav.map"), capture: t("nav.capture"), "my-reports": t("nav.myReports"), leaderboard: "Leaderboard", ngo: t("nav.municipal"), result: t("report.ticket"), admin: t("nav.officer") };
    const name = names[route];
    document.title = `${name} | ${t("common.appName")}`;
    const timer = window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>("main h1, main [data-page-heading]");
      (heading ?? document.getElementById("main-content"))?.focus({ preventScroll: true });
      const announcer = document.getElementById("route-announcer");
      if (announcer) announcer.textContent = t("a11y.pageLoaded", { page: name });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [route, t]);
}
