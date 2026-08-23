export const frontendEnv = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
  googleMapsBrowserKey: import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || "",
  mapProvider: (import.meta.env.VITE_MAP_PROVIDER || "leaflet").toLowerCase(),
  demoBrowserStorage: import.meta.env.VITE_DEMO_BROWSER_STORAGE === "true"
};

export const isDemoBrowserStorage = frontendEnv.demoBrowserStorage;

export function hasGoogleMapsKey() {
  return Boolean(frontendEnv.googleMapsBrowserKey);
}
