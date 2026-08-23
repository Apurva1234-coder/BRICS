import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";
import { AccessibilityControls } from "./AccessibilityControls";

export function AccessibilitySheet({ open, onClose, opener, onClearLocalDemoData }: { open: boolean; onClose: () => void; opener: React.RefObject<HTMLButtonElement | null>; onClearLocalDemoData?: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = Array.from(document.querySelectorAll<HTMLElement>("[data-a11y-sheet] button"));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [open, onClose]);
  useEffect(() => { if (!open) opener.current?.focus(); }, [open, opener]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[1000] flex items-end bg-black/60 lg:items-center lg:justify-center lg:p-4" role="presentation">
    <section data-a11y-sheet role="dialog" aria-modal="true" aria-labelledby="a11y-sheet-title" className="w-full max-h-[88svh] overflow-y-auto rounded-t-xl border border-white/20 bg-[var(--surface)] p-5 pb-[calc(24px+env(safe-area-inset-bottom))] lg:max-h-[min(720px,calc(100svh-2rem))] lg:max-w-xl lg:rounded-lg lg:p-6">
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id="a11y-sheet-title" className="text-lg font-bold text-white">{t("a11y.openSettings")}</h2><button ref={closeRef} type="button" onClick={onClose} className="icon-button min-h-11 min-w-11" aria-label={t("a11y.closeSettings")}><X aria-hidden="true" /></button></div>
      <fieldset className="mb-5"><legend className="mb-2 text-sm font-semibold text-white">{t("a11y.language")}</legend><div className="grid grid-cols-3 gap-2">{LANGUAGES.map(language => <button key={language.code} type="button" aria-pressed={i18n.language === language.code} onClick={() => i18n.changeLanguage(language.code)} className="a11y-language-button">{language.nativeLabel}</button>)}</div></fieldset>
      <AccessibilityControls />
      {onClearLocalDemoData && <div className="mt-5 border-t border-white/10 pt-5"><p className="mb-2 text-sm font-semibold text-white">Netlify demonstration</p><button type="button" onClick={() => void onClearLocalDemoData()} className="ghost-button border-red-400/30 text-red-200 hover:bg-red-400/10">Clear local demo data</button><p className="mt-2 text-xs text-slate-500">Removes reports and evidence saved only in this browser.</p></div>}
    </section>
  </div>;
}
