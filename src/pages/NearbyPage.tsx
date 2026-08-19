import { useEffect, useState } from "react";
import type { Route } from "../App";
import { MapWorkspace } from "../components/MapWorkspace";
import { apiClient } from "../services/apiClient";
import type { AirQualityMapResponse, PollutionReport, PollutionSituation } from "../types";

export function NearbyPage({
  reports,
  situations,
  focusReport,
  onNavigate
}: {
  reports: PollutionReport[];
  situations: PollutionSituation[];
  focusReport?: PollutionReport | null;
  onNavigate: (route: Route) => void;
}) {
  const [mapLayer, setMapLayer] = useState<AirQualityMapResponse | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [viewerLocation, setViewerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationResolved, setLocationResolved] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationResolved(true);
      return undefined;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!cancelled) {
          setViewerLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationResolved(true);
        }
      },
      () => {
        if (!cancelled) setLocationResolved(true);
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
    );
    return () => { cancelled = true; };
  }, []);

  // Load air quality map layer
  useEffect(() => {
    if (!locationResolved) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    setLoadingMap(true);
    setMapError(null);
    apiClient
      .getAirQualityMap(viewerLocation || undefined, { signal: controller.signal })
      .then((value) => {
        if (!cancelled) setMapLayer(value);
      })
      .catch((error) => {
        if (!cancelled) {
          if ((error as Error)?.name === "AbortError") return;
          setMapError(error instanceof Error ? error.message : "Unable to load map.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMap(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, [locationResolved, mapRefreshKey, viewerLocation]);

  // The first map response can arrive while the backend is still calculating
  // hourly AQI. Poll status and replace the map whenever coverage changes so
  // the user never has to reload the page to see completed station results.
  const shouldPollAqi = Boolean(mapLayer?.aqiCoverage && !mapLayer.aqiCoverage.snapshotComplete);
  useEffect(() => {
    if (!shouldPollAqi) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | undefined;
    let lastSignature = mapLayer?.aqiCoverage
      ? JSON.stringify([mapLayer.aqiCoverage.totalPhysicalStations, mapLayer.aqiCoverage.processedStations, mapLayer.aqiCoverage.queuedStations, mapLayer.aqiCoverage.validatedEligibleStations, mapLayer.aqiCoverage.indicativeEligibleStations, mapLayer.aqiCoverage.pendingStations, mapLayer.aqiCoverage.nationalSnapshotRefreshing, mapLayer.aqiCoverage.snapshotComplete])
      : "";

    const poll = async () => {
      activeController?.abort();
      activeController = new AbortController();
      try {
        const progress = await apiClient.getAqiStatus(false, { signal: activeController.signal });
        if (cancelled) return;
        const signature = JSON.stringify([progress.coverage.totalPhysicalStations, progress.snapshot.processedStations, progress.snapshot.queuedStations, progress.coverage.rollingValidated, progress.coverage.indicative, progress.coverage.pending, progress.snapshot.refreshing, progress.snapshot.complete]);
        const changed = signature !== lastSignature;
        lastSignature = signature;
        if (changed) {
          const refreshedMap = await apiClient.getAirQualityMap(viewerLocation || undefined, { signal: activeController.signal });
          if (cancelled) return;
          setMapLayer(refreshedMap);
        }
        const nationalSyncRunning = progress.warnings.some((warning) => warning.includes("national station synchronization is still running"));
        const terminal = !nationalSyncRunning && (progress.snapshot.complete || progress.warnings.some((warning) => warning.includes("no_open_aq_station_history_candidates")));
        if (!terminal && !cancelled) timer = setTimeout(() => void poll(), 3500);
      } catch (error) {
        if (!cancelled && (error as Error)?.name !== "AbortError") timer = setTimeout(() => void poll(), 5000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      activeController?.abort();
    };
  }, [shouldPollAqi, viewerLocation]);

  return (
    <div className="w-full h-full">
      <MapWorkspace
        reports={reports}
        situations={situations}
        mapLayer={mapLayer}
        loadingMap={loadingMap}
        mapError={mapError}
        onRetryMap={() => setMapRefreshKey((v) => v + 1)}
        onNavigate={onNavigate}
        focusReport={focusReport}
      />
    </div>
  );
}
