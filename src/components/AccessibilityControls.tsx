import { Contrast, ALargeSmall, Zap, TimerOff, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useA11y } from "../services/accessibility";

const settings = [
  ["highContrast", "a11y.highContrast", Contrast, "toggleHighContrast"],
  ["largeText", "a11y.largeText", ALargeSmall, "toggleLargeText"],
  ["reducedMotion", "a11y.reduceMotion", TimerOff, "toggleReducedMotion"],
  ["simpleMode", "a11y.simpleMode", Zap, "toggleSimpleMode"]
] as const;

export function AccessibilityControls() {
  const { t } = useTranslation();
  const a11y = useA11y();
  return <div className="grid gap-2" role="group" aria-label={t("a11y.openSettings")}>
    {settings.map(([key, label, Icon, action]) => <button key={key} type="button" aria-pressed={a11y[key]} onClick={a11y[action]} className="a11y-setting-button">
      <Icon size={18} aria-hidden="true" /><span>{t(label)}</span><span className="ml-auto text-xs">{a11y[key] ? t("a11y.on") : t("a11y.off")}</span>
    </button>)}
    <button type="button" onClick={a11y.reset} className="a11y-setting-button"><RotateCcw size={18} aria-hidden="true" /><span>{t("a11y.reset")}</span></button>
  </div>;
}
