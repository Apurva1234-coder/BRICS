import { LANGUAGES } from "../i18n";
import { useTranslation } from "react-i18next";
import { AccessibilityControls } from "./AccessibilityControls";

export function LanguageA11yBar() {
  const { t, i18n } = useTranslation();
  return <div className="px-1 pb-3 space-y-3">
    <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t("a11y.language")}</legend>
      <div className="grid grid-cols-3 gap-1.5">{LANGUAGES.map(lang => <button key={lang.code} type="button" aria-pressed={i18n.language === lang.code} onClick={() => i18n.changeLanguage(lang.code)} className="a11y-language-button px-1">{lang.nativeLabel}</button>)}</div>
    </fieldset>
    <AccessibilityControls />
  </div>;
}
