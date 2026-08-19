import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { hi } from "./locales/hi";
import { mr } from "./locales/mr";

export type Language = "en" | "hi" | "mr";

export const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English",  nativeLabel: "English" },
  { code: "hi", label: "Hindi",    nativeLabel: "हिन्दी" },
  { code: "mr", label: "Marathi",  nativeLabel: "मराठी" }
];

const STORAGE_KEY = "cleanair-lang";

function loadLanguage(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ["en", "hi", "mr"].includes(stored)) return stored;
  const browser = navigator.language.split("-")[0].toLowerCase();
  if (browser === "hi") return "hi";
  if (browser === "mr") return "mr";
  return "en";
}

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr }
    },
    lng: loadLanguage(),
    fallbackLng: "en",
    returnNull: false,
    returnEmptyString: false,
    missingKeyHandler: (_lngs, _ns, key) => {
      if (import.meta.env.DEV) console.warn(`[i18n] Missing translation key: ${key}`);
    },
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

// Set initial lang attribute
document.documentElement.lang = i18n.language;

export default i18n;
