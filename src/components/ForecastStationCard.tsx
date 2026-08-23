import { useEffect, useMemo, useState } from "react";
import { RotateCw } from "lucide-react";
import { apiClient } from "../services/apiClient";
import type { AqiForecastResult, ForecastStationItem } from "../types";
import { ForecastPanel } from "./ForecastPanel";

function stationNameFromItem(item: ForecastStationItem) {
  if (typeof item === "string") return item;
  return item.stationName || item.station_name || item.station || item.name || "";
}

export function ForecastStationCard({
  defaultStation,
  compact = false
}: {
  defaultStation?: string;
  compact?: boolean;
}) {
  const [stations, setStations] = useState<string[]>([]);
  const [selectedStation, setSelectedStation] = useState(defaultStation || "");
  const [forecast, setForecast] = useState<AqiForecastResult | undefined>();
  const [stationError, setStationError] = useState<string | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);

  const stationOptions = useMemo(() => {
    const values = new Set(stations);
    if (defaultStation) values.add(defaultStation);
    return [...values].sort();
  }, [defaultStation, stations]);

  useEffect(() => {
    let cancelled = false;
    setLoadingStations(true);
    setStationError(null);
    apiClient
      .getForecastStations()
      .then((response) => {
        if (cancelled) return;
        const stationNames = response.stations.map(stationNameFromItem).filter(Boolean);
        setStations(stationNames);
        const preferred = defaultStation && stationNames.includes(defaultStation)
          ? defaultStation
          : stationNames[0] || defaultStation || "";
        setSelectedStation((current) => current || preferred);
        if (response.reason && !stationNames.length) setStationError(response.reason);
      })
      .catch((error) => {
        if (!cancelled) setStationError(error instanceof Error ? error.message : "Unable to load forecast stations.");
      })
      .finally(() => {
        if (!cancelled) setLoadingStations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultStation]);

  useEffect(() => {
    if (!selectedStation) return;
    let cancelled = false;
    setLoadingForecast(true);
    setForecastError(null);
    apiClient
      .getForecast(selectedStation)
      .then((value) => {
        if (!cancelled) setForecast(value);
      })
      .catch((error) => {
        if (!cancelled) {
          setForecast(undefined);
          setForecastError(error instanceof Error ? error.message : "Unable to load station forecast.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingForecast(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStation]);

  const refresh = () => {
    if (!selectedStation) return;
    setLoadingForecast(true);
    setForecastError(null);
    apiClient
      .getForecast(selectedStation)
      .then(setForecast)
      .catch((error) => setForecastError(error instanceof Error ? error.message : "Unable to load station forecast."))
      .finally(() => setLoadingForecast(false));
  };

  return (
    <section className="forecast-station-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow">Station-level AQI Forecast</span>
          <h2 className={compact ? "mt-2 text-xl font-semibold text-white" : "mt-2 text-2xl font-semibold text-white"}>
            Station-level model forecast
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Not live official AQI. Not exact street-level AQI.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Forecast stations available in selector. Map coordinates not mapped yet.
          </p>
        </div>
        <button type="button" className="secondary-button min-h-9 px-3 py-2" onClick={refresh} disabled={!selectedStation || loadingForecast}>
          <RotateCw size={16} /> Refresh
        </button>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-200">
        Forecast station
        <select
          className="mt-2 w-full rounded-lg border border-line bg-ink/80 p-3 text-sm text-white outline-none ring-civic/30 focus:ring-4"
          value={selectedStation}
          onChange={(event) => setSelectedStation(event.target.value)}
          disabled={loadingStations || !stationOptions.length}
        >
          {!stationOptions.length && <option value="">No stations available</option>}
          {stationOptions.map((station) => (
            <option key={station} value={station}>
              {station}
            </option>
          ))}
        </select>
      </label>

      {(stationError || forecastError) && (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          {stationError || forecastError}
        </p>
      )}
      {loadingForecast && <p className="mt-3 text-sm text-aqua">Loading model forecast...</p>}

      <div className="mt-4">
        <ForecastPanel forecast={forecast} compact={compact} framed={false} />
      </div>
    </section>
  );
}
