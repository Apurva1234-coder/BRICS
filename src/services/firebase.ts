/**
 * src/services/firebase.ts
 *
 * Firebase frontend integration — safe for local dev without env vars.
 * All features are optional and degrade gracefully if not configured.
 *
 * Features:
 *   - Anonymous Auth (required for report ownership)
 *   - Firestore (optional — reports are backend-driven)
 *   - Firebase Storage (optional — media upload via backend)
 *   - Analytics (optional, privacy-safe events only)
 *   - Remote Config (optional, feature flags)
 *   - App Check (optional, reCAPTCHA, debug-token safe for localhost)
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// ── Lazy imports for optional features ─────────────────────────────────────
// Analytics, Remote Config, App Check are imported lazily to avoid
// bundle bloat when features are disabled.

// ── Config ──────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const FEATURE_FLAGS = {
  analytics:    import.meta.env.VITE_ENABLE_FIREBASE_ANALYTICS === "true",
  appCheck:     import.meta.env.VITE_ENABLE_APP_CHECK === "true",
  remoteConfig: import.meta.env.VITE_ENABLE_REMOTE_CONFIG === "true"
};

// Firebase is available only when the minimum required config is present
export const firebaseAvailable =
  import.meta.env.VITE_DEMO_BROWSER_STORAGE !== "true" && Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// ── Initialise app ───────────────────────────────────────────────────────────

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

if (firebaseAvailable) {
  _app     = initializeApp(firebaseConfig);
  _auth    = getAuth(_app);
  _db      = getFirestore(_app);
  _storage = getStorage(_app);
}

export const firebaseApp = _app;
export const auth        = _auth;
export const db          = _db;
export const storage     = _storage;

// ── App Check (optional) ─────────────────────────────────────────────────────
// Only enabled when VITE_ENABLE_APP_CHECK=true and site key present.
// Debug token is used automatically by Firebase on localhost.

async function initAppCheck() {
  if (!_app || !FEATURE_FLAGS.appCheck) return;
  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
  if (!siteKey) return;
  try {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");
    initializeAppCheck(_app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch {
    // App Check failure must never break the app
  }
}

initAppCheck();

// ── Analytics (optional, privacy-safe only) ──────────────────────────────────
// Only log events with coarse, non-personal params.

type SafeParams = Record<string, string | number | boolean>;

let _logEvent: ((name: string, params?: SafeParams) => void) | null = null;

async function initAnalytics() {
  if (!_app || !FEATURE_FLAGS.analytics) return;
  const measurementId = firebaseConfig.measurementId;
  if (!measurementId) return;
  try {
    const { getAnalytics, logEvent, isSupported } = await import("firebase/analytics");
    if (!(await isSupported())) return;
    const analyticsInstance = getAnalytics(_app);
    _logEvent = (name, params) => logEvent(analyticsInstance, name, params);
  } catch {
    // Analytics failure must never break the app
  }
}

initAnalytics();

/**
 * Log a privacy-safe analytics event.
 * Never include: exact lat/lng, user notes, image URLs, ticket IDs, names, emails.
 * Only include: pollution_type, status, priority, language, accessibility_mode.
 */
export function logSafeEvent(eventName: string, params?: SafeParams) {
  _logEvent?.(eventName, params);
}

// ── Remote Config (optional, feature flags) ──────────────────────────────────

export interface RemoteFeatureFlags {
  default_language: string;
  enabled_languages: string;
  high_contrast_default: boolean;
  large_text_default: boolean;
  simple_mode_default: boolean;
  aqi_enabled: boolean;
  analytics_enabled: boolean;
  app_check_enabled: boolean;
  maintenance_banner: string;
}

export const remoteConfigDefaults: RemoteFeatureFlags = {
  default_language:      "en",
  enabled_languages:     "en,hi,mr",
  high_contrast_default: false,
  large_text_default:    false,
  simple_mode_default:   false,
  aqi_enabled:           true,
  analytics_enabled:     false,
  app_check_enabled:     false,
  maintenance_banner:    ""
};

let _remoteConfigValues: RemoteFeatureFlags = { ...remoteConfigDefaults };

async function initRemoteConfig() {
  if (!_app || !FEATURE_FLAGS.remoteConfig) return;
  try {
    const { getRemoteConfig, fetchAndActivate, getValue } = await import("firebase/remote-config");
    const rc = getRemoteConfig(_app);
    rc.defaultConfig = { ...remoteConfigDefaults };
    rc.settings.minimumFetchIntervalMillis = 3600_000; // 1 hour cache
    await fetchAndActivate(rc);
    _remoteConfigValues = {
      default_language:      String(getValue(rc, "default_language").asString() || remoteConfigDefaults.default_language),
      enabled_languages:     String(getValue(rc, "enabled_languages").asString() || remoteConfigDefaults.enabled_languages),
      high_contrast_default: getValue(rc, "high_contrast_default").asBoolean(),
      large_text_default:    getValue(rc, "large_text_default").asBoolean(),
      simple_mode_default:   getValue(rc, "simple_mode_default").asBoolean(),
      aqi_enabled:           getValue(rc, "aqi_enabled").asBoolean(),
      analytics_enabled:     getValue(rc, "analytics_enabled").asBoolean(),
      app_check_enabled:     getValue(rc, "app_check_enabled").asBoolean(),
      maintenance_banner:    String(getValue(rc, "maintenance_banner").asString() || "")
    };
  } catch {
    // Remote Config failure uses defaults — never breaks app
  }
}

initRemoteConfig();

export function getRemoteFeatureFlags(): RemoteFeatureFlags {
  return _remoteConfigValues;
}

// ── Anonymous Auth ────────────────────────────────────────────────────────────

const STORAGE_KEY = "cleanair-user";

/** Returns the current Firebase uid or local fallback id, always as a string. */
export function getCurrentUserId(): string {
  return localStorage.getItem(STORAGE_KEY) || "anonymous";
}

/**
 * Ensures an anonymous session exists.
 * - If Firebase Auth is available: signs in anonymously and persists uid.
 * - If not available: generates a local UUID and persists it.
 * - Reuses any existing persisted id.
 * - Never throws — always returns a usable string id.
 */
export async function ensureAnonymousSession(): Promise<string> {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) return cached;

  if (auth) {
    try {
      return await new Promise<string>((resolve) => {
        const unsub = onAuthStateChanged(auth!, (user) => {
          unsub();
          if (user) {
            localStorage.setItem(STORAGE_KEY, user.uid);
            resolve(user.uid);
          } else {
            signInAnonymously(auth!).then((cred) => {
              localStorage.setItem(STORAGE_KEY, cred.user.uid);
              resolve(cred.user.uid);
            }).catch(() => {
              const fallback = `local-${crypto.randomUUID()}`;
              localStorage.setItem(STORAGE_KEY, fallback);
              resolve(fallback);
            });
          }
        });
      });
    } catch {
      // Fall through to local fallback
    }
  }

  const localId = `local-${crypto.randomUUID()}`;
  localStorage.setItem(STORAGE_KEY, localId);
  return localId;
}
