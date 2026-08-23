import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { frontendEnv } from "./env";

let configuredKey: string | null = null;

export async function loadGoogleMaps() {
  if (!frontendEnv.googleMapsBrowserKey) {
    throw new Error("Google Maps browser key is not configured.");
  }
  if (configuredKey !== frontendEnv.googleMapsBrowserKey) {
    setOptions({
      key: frontendEnv.googleMapsBrowserKey,
      v: "weekly"
    });
    configuredKey = frontendEnv.googleMapsBrowserKey;
  }
  const maps = await importLibrary("maps");
  const marker = await importLibrary("marker");
  return {
    Map: maps.Map,
    Circle: maps.Circle,
    AdvancedMarkerElement: marker.AdvancedMarkerElement
  };
}
