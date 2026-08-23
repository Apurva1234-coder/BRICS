import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface A11yPrefs {
  highContrast: boolean;
  largeText: boolean;
  simpleMode: boolean;
  reducedMotion: boolean;
}

interface A11yContextValue extends A11yPrefs {
  toggleHighContrast: () => void;
  toggleLargeText: () => void;
  toggleSimpleMode: () => void;
  toggleReducedMotion: () => void;
  reset: () => void;
}

const defaults: A11yPrefs = { highContrast: false, largeText: false, simpleMode: false, reducedMotion: false };
const A11yContext = createContext<A11yContextValue>({
  ...defaults,
  toggleHighContrast: () => {}, toggleLargeText: () => {}, toggleSimpleMode: () => {}, toggleReducedMotion: () => {}, reset: () => {}
});

function load(): A11yPrefs {
  try {
    const raw = localStorage.getItem("cleanair-a11y");
    if (!raw) return defaults;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return defaults;
    const record = value as Record<string, unknown>;
    return {
      highContrast: typeof record.highContrast === "boolean" ? record.highContrast : false,
      largeText: typeof record.largeText === "boolean" ? record.largeText : false,
      simpleMode: typeof record.simpleMode === "boolean" ? record.simpleMode : false,
      reducedMotion: typeof record.reducedMotion === "boolean" ? record.reducedMotion : false
    };
  } catch { return defaults; }
}

function applyClasses(prefs: A11yPrefs) {
  const root = document.documentElement;
  root.classList.toggle("a11y-high-contrast", prefs.highContrast);
  root.classList.toggle("a11y-large-text", prefs.largeText);
  root.classList.toggle("a11y-simple-mode", prefs.simpleMode);
  root.classList.toggle("a11y-reduced-motion", prefs.reducedMotion);
}

export function A11yProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<A11yPrefs>(load);
  useEffect(() => { applyClasses(prefs); localStorage.setItem("cleanair-a11y", JSON.stringify(prefs)); }, [prefs]);
  const toggle = useCallback((key: keyof A11yPrefs) => setPrefs(p => ({ ...p, [key]: !p[key] })), []);
  const reset = useCallback(() => setPrefs(defaults), []);
  const value = useMemo(() => ({
    ...prefs,
    toggleHighContrast: () => toggle("highContrast"),
    toggleLargeText: () => toggle("largeText"),
    toggleSimpleMode: () => toggle("simpleMode"),
    toggleReducedMotion: () => toggle("reducedMotion"),
    reset
  }), [prefs, reset, toggle]);
  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y() { return useContext(A11yContext); }
