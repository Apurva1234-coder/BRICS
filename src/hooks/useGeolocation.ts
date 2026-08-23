import { useCallback, useEffect, useRef, useState } from "react";
import { approxArea } from "../utils/geo";

export type LocationSource = "unset" | "gps" | "manual" | "fallback";

export interface LocationState {
  lat: number;
  lng: number;
  areaText: string;
  source: LocationSource;
  accuracy?: number;
  updatedAt?: string;
}

export interface CaptureLocationFix {
  lat: number;
  lng: number;
  accuracyMeters: number;
  capturedAt: string;
}

export type CaptureLocationStatus = "idle" | "requesting" | "ready" | "error";

export interface CaptureLocationState {
  status: CaptureLocationStatus;
  bestFix: CaptureLocationFix | null;
  error: string | null;
}

export const CAPTURE_GPS_PREFERRED_ACCURACY_METERS = 50;
export const CAPTURE_GPS_MAX_ACCURACY_METERS = 150;
export const CAPTURE_GPS_MAX_AGE_SECONDS = 30;

const defaultLocation: LocationState = {
  lat: 18.5912,
  lng: 73.7389,
  areaText: "Location not set",
  source: "unset"
};

export function isCaptureFixUsable(fix: CaptureLocationFix | null, now = Date.now()) {
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return false;
  if (!Number.isFinite(fix.accuracyMeters) || fix.accuracyMeters > CAPTURE_GPS_MAX_ACCURACY_METERS) return false;
  const ageSeconds = (now - Date.parse(fix.capturedAt)) / 1000;
  return Number.isFinite(ageSeconds) && ageSeconds >= -300 && ageSeconds <= CAPTURE_GPS_MAX_AGE_SECONDS;
}

export function chooseBestCaptureFix(previous: CaptureLocationFix | null, next: CaptureLocationFix) {
  if (!previous) return next;
  if (next.accuracyMeters < previous.accuracyMeters - 1) return next;
  if (Math.abs(next.accuracyMeters - previous.accuracyMeters) <= 1 && Date.parse(next.capturedAt) >= Date.parse(previous.capturedAt)) return next;
  return previous;
}

export function useGeolocation() {
  const [location, setLocation] = useState<LocationState>(defaultLocation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          areaText: approxArea(position.coords.latitude, position.coords.longitude),
          source: "gps",
          accuracy: position.coords.accuracy,
          updatedAt: new Date().toISOString()
        });
        setLoading(false);
      },
      () => {
        setError("Location permission was not granted. Try GPS again.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  }, []);

  return { location, setLocation, refresh, loading, error };
}

export function useCaptureGeolocation() {
  const [state, setState] = useState<CaptureLocationState>({ status: "idle", bestFix: null, error: null });
  const watchIdRef = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startTracking = useCallback(() => {
    stopTracking();
    setState({ status: "requesting", bestFix: null, error: null });
    if (!navigator.geolocation) {
      setState({ status: "error", bestFix: null, error: "Location is not available in this browser." });
      return;
    }
    const saveFix = (position: GeolocationPosition) => {
      const next: CaptureLocationFix = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date(position.timestamp || Date.now()).toISOString()
      };
      setState((current) => {
        const bestFix = chooseBestCaptureFix(current.bestFix, next);
        return { status: isCaptureFixUsable(bestFix) ? "ready" : "requesting", bestFix, error: null };
      });
    };

    // A recent network/cached position is normally available much sooner than a
    // cold high-accuracy GPS lock. Use it first when it meets the same capture
    // validation rules, then keep refining with GPS in the background.
    navigator.geolocation.getCurrentPosition(
      saveFix,
      () => undefined,
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 20_000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      saveFix,
      () => setState((current) => ({ ...current, status: "error", error: "Location permission was not granted." })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [stopTracking]);

  useEffect(() => stopTracking, [stopTracking]);

  return { ...state, startTracking, stopTracking, retry: startTracking };
}
