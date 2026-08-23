import { useState, useEffect } from "react";
import { apiClient } from "../services/apiClient";
import type {
  MeteorologicalContext,
  PollutionMovementEstimate
} from "../types";
import {
  Wind,
  Thermometer,
  Droplets,
  CloudRain,
  Navigation,
  Compass,
  Clock,
  AlertTriangle,
  Info,
  ShieldCheck,
  RefreshCw
} from "lucide-react";

interface MeteorologyCardProps {
  latitude: number;
  longitude: number;
  timestamp?: string;
  eventId?: string;
  horizonHours?: number;
  onPredictionLoaded?: (prediction: PollutionMovementEstimate | null) => void;
  className?: string;
}

export function MeteorologyCard({
  latitude,
  longitude,
  timestamp,
  eventId,
  horizonHours = 6,
  onPredictionLoaded,
  className = ""
}: MeteorologyCardProps) {
  const [meteorology, setMeteorology] = useState<MeteorologicalContext | null>(null);
  const [prediction, setPrediction] = useState<PollutionMovementEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeteorologicalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.predictMovement({
        eventId,
        latitude,
        longitude,
        timestamp,
        horizonHours
      });

      setMeteorology(res.meteorology);
      setPrediction(res.prediction);
      if (onPredictionLoaded) {
        onPredictionLoaded(res.prediction);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meteorological intelligence.");
      if (onPredictionLoaded) {
        onPredictionLoaded(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeteorologicalData();
  }, [latitude, longitude, timestamp, eventId, horizonHours]);

  if (loading) {
    return (
      <div className={`rounded-xl border border-white/10 bg-slate-950/80 p-4 backdrop-blur-md ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Meteorological Intelligence</span>
          <RefreshCw size={12} className="animate-spin text-emerald-400" />
        </div>
        <p className="text-xs text-slate-500 mt-2">Fetching atmospheric context & wind vectors...</p>
      </div>
    );
  }

  if (error || !meteorology || !prediction) {
    return (
      <div className={`rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <AlertTriangle size={14} />
            <span>Meteorological Context Unavailable</span>
          </div>
          <button
            type="button"
            onClick={fetchMeteorologicalData}
            className="text-[10px] text-slate-400 hover:text-white underline"
          >
            Retry
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">{error || "Could not retrieve atmospheric data."}</p>
      </div>
    );
  }

  const isDemo = meteorology.source.includes("DEMO") || meteorology.dataStatus === "DEMO_DATA";
  const confidenceColor =
    prediction.confidence === "HIGH"
      ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
      : prediction.confidence === "MEDIUM"
      ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
      : "text-slate-400 bg-slate-400/10 border-slate-400/20";

  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-950/90 p-4 shadow-xl backdrop-blur-xl space-y-3.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Wind size={15} className="text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Meteorological Intelligence</h3>
        </div>
        <span
          className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            isDemo ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          }`}
        >
          {isDemo ? "DEMO DATA" : meteorology.source}
        </span>
      </div>

      {/* Atmospheric Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Wind */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <Compass size={12} className="text-cyan-400" />
            <span>Wind (From)</span>
          </div>
          <div className="text-sm font-black text-white mt-1 flex items-center gap-1">
            <span>{meteorology.windDirectionCompass}</span>
            <span className="text-slate-400 text-xs font-normal">→ {meteorology.windSpeedKmh} km/h</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono block mt-0.5">{meteorology.windDirectionDegrees}° bearing</span>
        </div>

        {/* Temperature */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <Thermometer size={12} className="text-orange-400" />
            <span>Temperature</span>
          </div>
          <div className="text-sm font-black text-white mt-1">
            {meteorology.temperatureC}°C
          </div>
          <span className="text-[9px] text-slate-500 block mt-0.5">{meteorology.weatherCondition || "Surface Ambient"}</span>
        </div>

        {/* Humidity */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <Droplets size={12} className="text-blue-400" />
            <span>Humidity</span>
          </div>
          <div className="text-sm font-black text-white mt-1">
            {meteorology.relativeHumidityPercent}%
          </div>
          <span className="text-[9px] text-slate-500 block mt-0.5">Relative Moisture</span>
        </div>

        {/* Rain */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <CloudRain size={12} className="text-indigo-400" />
            <span>Rainfall</span>
          </div>
          <div className="text-sm font-black text-white mt-1">
            {meteorology.precipitationMm} mm
          </div>
          <span className="text-[9px] text-slate-500 block mt-0.5 uppercase">{meteorology.precipitationType}</span>
        </div>
      </div>

      {/* Estimated Movement Trajectory Box */}
      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-slate-900/60 to-slate-950/90 p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Navigation size={13} className="text-cyan-400" />
            <span className="font-bold text-white">Estimated Movement</span>
          </div>
          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${confidenceColor}`}>
            {prediction.confidence} CONFIDENCE
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-white/5">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Trajectory Vector</span>
            <span className="text-cyan-300 font-bold text-xs mt-0.5 flex items-center gap-1">
              <span>Pushed toward {prediction.dominantMovementDirection}</span>
              <span className="text-[10px] text-slate-500 font-mono">({Math.round(prediction.dominantMovementBearingDegrees)}°)</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Estimated Travel</span>
            <span className="text-white font-bold text-xs mt-0.5">
              ~{prediction.estimatedTotalDistanceKm} km <span className="text-slate-400 font-normal">/ {prediction.horizonHours}h</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Estimated Arrival</span>
            <span className="text-white font-bold text-xs mt-0.5 flex items-center gap-1">
              <Clock size={11} className="text-slate-400" />
              <span>{new Date(prediction.estimatedArrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </span>
          </div>
        </div>

        {/* Confidence Reason */}
        <p className="text-[10px] text-slate-400 bg-white/[0.02] rounded-lg p-1.5 border border-white/5">
          <strong className="text-slate-300 font-medium">Confidence Rationale:</strong> {prediction.confidenceReason}
        </p>

        {/* Warnings if any */}
        {prediction.warnings && prediction.warnings.length > 0 && (
          <div className="space-y-1 pt-1">
            {prediction.warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 rounded-md p-1.5 border border-amber-500/20">
                <AlertTriangle size={11} className="shrink-0 mt-0.5 text-amber-400" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-center gap-1 text-[9px] text-slate-500 pt-1">
          <Info size={10} className="shrink-0" />
          <span>⚠ Application-generated wind-based estimate. For operational guidance only.</span>
        </div>
      </div>
    </div>
  );
}
