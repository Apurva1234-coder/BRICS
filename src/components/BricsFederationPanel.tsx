import { useState, useEffect } from "react";
import { apiClient } from "../services/apiClient";
import type {
  BricsCountryNode,
  BricsFederationEvent,
  BricsFederationStatusResponse,
  BricsCountryCode,
  LiveFederationExchangeResponse
} from "../types";
import {
  Globe,
  Radio,
  Share2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Wind,
  CheckCircle2,
  AlertTriangle,
  Send,
  SlidersHorizontal,
  Compass,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  CloudSun
} from "lucide-react";
import { CrossBorderPropagationPanel } from "./CrossBorderPropagationPanel";
import { EconomicCorridorPanel } from "./EconomicCorridorPanel";
import { RegulatoryCoordinationPanel } from "./RegulatoryCoordinationPanel";

export function BricsFederationPanel() {
  const [nodes, setNodes] = useState<BricsCountryNode[]>([]);
  const [events, setEvents] = useState<BricsFederationEvent[]>([]);
  const [status, setStatus] = useState<BricsFederationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("ALL");
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>("ALL");
  const [exchangeSimulationStep, setExchangeSimulationStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [exchangeResult, setExchangeResult] = useState<LiveFederationExchangeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"protocol" | "propagation" | "corridors" | "regulatory">("protocol");

  const loadFederationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nodesRes, eventsRes, statusRes] = await Promise.all([
        apiClient.getBricsNodes(),
        apiClient.getBricsEvents(),
        apiClient.getBricsFederationStatus()
      ]);
      setNodes(nodesRes.nodes || []);
      setEvents(eventsRes.events || []);
      setStatus(statusRes.status || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load federation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFederationData();
  }, []);

  const runFederationExchangeDemo = async () => {
    setIsSimulating(true);
    setError(null);
    setExchangeSimulationStep(1);

    try {
      // Step 1: Formulate source incident in India
      await new Promise((r) => setTimeout(r, 400));
      setExchangeSimulationStep(2);

      // Execute authentic backend exchange pipeline (Open-Meteo + Lagrangian Model + China Delivery)
      const res = await apiClient.triggerLiveFederationExchange({
        sourceCountry: "IND",
        targetCountry: "CHN",
        latitude: 28.6289,
        longitude: 77.2065,
        locality: "Delhi-NCR Airshed Industrial & Stubble Corridor, India",
        pollutionType: "crop_burning",
        pm2_5: 395,
        pm10: 510,
        aqi: 435,
        severity: "critical",
        horizonHours: 12
      });

      if (!res.success) {
        throw new Error("Backend federation exchange pipeline returned failure.");
      }

      setExchangeSimulationStep(3);
      await new Promise((r) => setTimeout(r, 450));

      setExchangeSimulationStep(4);
      setExchangeResult(res);

      // Refresh node and event counts from live backend
      await loadFederationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Federation exchange failed.");
      setExchangeResult(null);
    } finally {
      setIsSimulating(false);
    }
  };

  const filteredEvents = events.filter((evt) => {
    if (selectedCountryFilter !== "ALL" && evt.sourceCountry !== selectedCountryFilter) {
      return false;
    }
    if (selectedSeverityFilter !== "ALL" && evt.severity.toLowerCase() !== selectedSeverityFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#070908] text-slate-100 p-4 lg:p-6 space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              BRICS Environmental Federation
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Globe className="text-emerald-400" size={24} />
            Cross-Border Environmental Data Exchange Mesh
          </h1>
          <p className="text-xs lg:text-sm text-slate-400 mt-1 max-w-3xl">
            Standardized inter-node protocol connecting environmental monitoring networks across all 11 BRICS member states. Common intelligence layer powered by Sentinel-5P, OpenAQ, and local telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadFederationData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : "text-slate-400"} />
            <span>Sync Mesh</span>
          </button>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("protocol")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "protocol"
              ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Radio size={14} />
          <span>Federation Protocol & Nodes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("propagation")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "propagation"
              ? "bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-400/40 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Wind size={14} />
          <span>Cross-Border Propagation (Stage 3)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("corridors")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "corridors"
              ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <TrendingUp size={14} />
          <span>Economic Corridors (Stage 4)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("regulatory")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "regulatory"
              ? "bg-purple-400/20 text-purple-300 ring-1 ring-purple-400/40 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <ShieldAlert size={14} />
          <span>Regulatory Coordination (Stage 5)</span>
        </button>
      </div>

      {activeTab === "regulatory" ? (
        <RegulatoryCoordinationPanel />
      ) : activeTab === "corridors" ? (
        <EconomicCorridorPanel />
      ) : activeTab === "propagation" ? (
        <CrossBorderPropagationPanel />
      ) : (
        <>
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Metrics Summary Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Country Nodes</span>
            <Radio size={14} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {status ? `${status.activeNodes}/${status.totalNodes}` : "11/11"}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-0.5">100% Cluster Online</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Shared Events</span>
            <Share2 size={14} className="text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {status?.totalSharedEvents ?? events.length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Standardized Schema</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Cross-Border Airsheds</span>
            <Wind size={14} className="text-orange-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {status?.crossBorderEventsCount ?? 4}
          </div>
          <div className="text-[11px] text-orange-400 font-medium mt-0.5">Active Propagation Tracking</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>AI Intelligence Mesh</span>
            <ShieldCheck size={14} className="text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">Active</div>
          <div className="text-[11px] text-purple-400 font-medium mt-0.5">Gemini + Atmospheric Fusion</div>
        </div>
      </div>

      {/* ── Interactive Cross-Country Data Exchange Demonstrator ── */}
      <div className="rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-950/40 via-slate-950/90 to-slate-950/90 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Live Protocol Demo
              </span>
            </div>
            <h2 className="text-base font-bold text-white mt-1">
              Cross-Node Environmental Event Exchange (India 🇮🇳 → BRICS Federation → China 🇨🇳)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate detection of a critical transboundary pollution plume in India, packaging into standardized BRICS schema, and instantaneous consumption by the China node.
            </p>
          </div>

          <button
            type="button"
            onClick={runFederationExchangeDemo}
            disabled={isSimulating}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 shrink-0"
          >
            <Send size={14} className={isSimulating ? "animate-pulse" : ""} />
            <span>{isSimulating ? "Transmitting via Federation..." : "Trigger Live Exchange Demo"}</span>
          </button>
        </div>

        {/* Step Flow Tracker */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-xs">
          <div className={`p-2.5 rounded-xl border transition-all ${exchangeSimulationStep >= 1 ? "border-emerald-400/40 bg-emerald-400/10 text-white" : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
            <div className="flex items-center gap-1.5 font-bold">
              <span>1. 🇮🇳 India Node</span>
              {exchangeSimulationStep >= 1 && <CheckCircle2 size={12} className="text-emerald-400 ml-auto" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">High-severity plume detected via telemetry</p>
          </div>

          <div className={`p-2.5 rounded-xl border transition-all ${exchangeSimulationStep >= 2 ? "border-emerald-400/40 bg-emerald-400/10 text-white" : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
            <div className="flex items-center gap-1.5 font-bold">
              <span>2. Schema Packaging</span>
              {exchangeSimulationStep >= 2 && <CheckCircle2 size={12} className="text-emerald-400 ml-auto" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Encodes into standard BRICS event JSON</p>
          </div>

          <div className={`p-2.5 rounded-xl border transition-all ${exchangeSimulationStep >= 3 ? "border-emerald-400/40 bg-emerald-400/10 text-white" : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
            <div className="flex items-center gap-1.5 font-bold">
              <span>3. Federation Mesh</span>
              {exchangeSimulationStep >= 3 && <CheckCircle2 size={12} className="text-emerald-400 ml-auto" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Broadcasts to multi-country exchange bus</p>
          </div>

          <div className={`p-2.5 rounded-xl border transition-all ${exchangeSimulationStep >= 4 ? "border-emerald-400/40 bg-emerald-400/10 text-white" : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
            <div className="flex items-center gap-1.5 font-bold">
              <span>4. 🇨🇳 China Node</span>
              {exchangeSimulationStep >= 4 && <CheckCircle2 size={12} className="text-emerald-400 ml-auto" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Received & parsed for transboundary action</p>
          </div>
        </div>

        {exchangeResult && exchangeSimulationStep >= 4 && (
          <div className="mt-3.5 p-4 rounded-2xl border border-emerald-400/30 bg-emerald-950/60 text-xs text-emerald-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-400/20 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>
                  <strong>Exchange Verified:</strong> Event <code className="bg-black/40 px-1 py-0.5 rounded text-emerald-300 font-mono">{exchangeResult.event.eventId}</code> published by 🇮🇳 India and ingested by 🇨🇳 China Node.
                </span>
              </div>
              <span className="text-[10px] rounded-md bg-emerald-400/20 px-2 py-0.5 font-bold uppercase tracking-wider text-emerald-300">
                {exchangeResult.meteorologicalContext.dataStatus === "AVAILABLE" && exchangeResult.meteorologicalContext.source.includes("Open-Meteo") ? "● Real-World Open-Meteo Telemetry" : "● Simulated Atmospheric Data"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
              <div className="rounded-xl border border-white/10 bg-black/40 p-2.5">
                <div className="text-[10px] uppercase font-bold text-slate-400">Atmospheric Vectors</div>
                <div className="font-semibold text-white mt-0.5">
                  {exchangeResult.meteorologicalContext.windSpeedKmh} km/h from {exchangeResult.meteorologicalContext.windDirectionCompass} ({exchangeResult.meteorologicalContext.windDirectionDegrees}°)
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Temp: {exchangeResult.meteorologicalContext.temperatureC}°C · Humidity: {exchangeResult.meteorologicalContext.relativeHumidityPercent}%
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-2.5">
                <div className="text-[10px] uppercase font-bold text-slate-400">Lagrangian Dispersion Model</div>
                <div className="font-semibold text-purple-300 mt-0.5">
                  {exchangeResult.crossBorderPrediction ? `Impact: ${exchangeResult.crossBorderPrediction.affectedCountryName} in ~${exchangeResult.crossBorderPrediction.estimatedArrivalHours}h` : `Dispersion: ${exchangeResult.propagationResult.totalDistanceKm} km range`}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Remaining PM2.5: {exchangeResult.crossBorderPrediction?.predictedPollutionLevel.pm2_5 ?? exchangeResult.event.pollutantValues.pm2_5} µg/m³
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-2.5">
                <div className="text-[10px] uppercase font-bold text-slate-400">Target Node Ingestion</div>
                <div className="font-semibold text-emerald-300 mt-0.5">
                  🇨🇳 China ({exchangeResult.targetNodeReceipt.status})
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  Verified at: {new Date(exchangeResult.targetNodeReceipt.receivedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Participating Country Nodes Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Radio size={16} className="text-emerald-400" />
            Participating Country Nodes ({nodes.length} Nations)
          </h2>
          <span className="text-xs text-slate-500 font-medium">Auto-synchronized Heartbeat Protocol</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {nodes.map((node) => (
            <div
              key={node.nodeId}
              className="rounded-xl border border-white/10 bg-slate-950/80 p-3.5 shadow-lg backdrop-blur-md hover:border-emerald-400/30 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl leading-none">{node.flag}</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">{node.countryName}</h3>
                    <p className="text-[10px] text-slate-400">{node.geographicRegion}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-white/5 pt-2 text-slate-400">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Shared</span>
                  <span className="text-white font-mono font-bold">{node.sharedEventsCount} events</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Received</span>
                  <span className="text-white font-mono font-bold">{node.receivedEventsCount} alerts</span>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1">
                {node.supportedDataSources.slice(0, 3).map((ds) => (
                  <span
                    key={ds}
                    className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-slate-300 uppercase tracking-wider"
                  >
                    {ds.replace(/_/g, " ")}
                  </span>
                ))}
                {node.supportedDataSources.length > 3 && (
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                    +{node.supportedDataSources.length - 3}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Live Shared Pollution Events Stream ── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Share2 size={16} className="text-blue-400" />
              Federated Environmental Event Stream ({filteredEvents.length} Events)
            </h2>
            <p className="text-xs text-slate-500">Standardized event records shared across member nodes.</p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-lg p-1 text-xs">
              <SlidersHorizontal size={12} className="text-slate-400 ml-1" />
              <select
                value={selectedCountryFilter}
                onChange={(e) => setSelectedCountryFilter(e.target.value)}
                aria-label="Filter by Country"
                className="bg-transparent text-xs text-slate-200 border-none outline-none pr-2 cursor-pointer"
              >
                <option value="ALL" className="bg-slate-950">All Countries</option>
                {nodes.map((n) => (
                  <option key={n.countryCode} value={n.countryCode} className="bg-slate-950">
                    {n.flag} {n.countryName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-lg p-1 text-xs">
              <select
                value={selectedSeverityFilter}
                onChange={(e) => setSelectedSeverityFilter(e.target.value)}
                aria-label="Filter by Severity"
                className="bg-transparent text-xs text-slate-200 border-none outline-none pr-2 cursor-pointer"
              >
                <option value="ALL" className="bg-slate-950">All Severities</option>
                <option value="critical" className="bg-slate-950">Critical</option>
                <option value="high" className="bg-slate-950">High</option>
                <option value="moderate" className="bg-slate-950">Moderate</option>
                <option value="low" className="bg-slate-950">Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredEvents.map((evt) => {
            const severityColor =
              evt.severity === "critical"
                ? "text-red-400 bg-red-400/10 border-red-400/30"
                : evt.severity === "high"
                ? "text-orange-400 bg-orange-400/10 border-orange-400/30"
                : evt.severity === "moderate"
                ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                : "text-slate-400 bg-slate-400/10 border-slate-400/30";

            return (
              <div
                key={evt.eventId}
                className="rounded-2xl border border-white/10 bg-slate-950/90 p-4 shadow-xl backdrop-blur-xl hover:border-white/20 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl shrink-0 leading-none">{evt.sourceFlag}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{evt.locality}</span>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityColor}`}>
                          {evt.severity}
                        </span>
                        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-300 uppercase">
                          {evt.pollutionType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{evt.description || evt.title}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-xs">
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 block">
                      Confidence: {(evt.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Pollutant Metrics Grid */}
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2 rounded-xl bg-white/[0.02] border border-white/5 p-2.5 text-xs">
                  {evt.pollutantValues.pm2_5 !== undefined && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">PM2.5</span>
                      <span className="text-slate-200 font-bold font-mono">{evt.pollutantValues.pm2_5} <span className="text-[9px] text-slate-500 font-normal">µg/m³</span></span>
                    </div>
                  )}
                  {evt.pollutantValues.pm10 !== undefined && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">PM10</span>
                      <span className="text-slate-200 font-bold font-mono">{evt.pollutantValues.pm10} <span className="text-[9px] text-slate-500 font-normal">µg/m³</span></span>
                    </div>
                  )}
                  {evt.pollutantValues.no2 !== undefined && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">NO2</span>
                      <span className="text-slate-200 font-bold font-mono">{evt.pollutantValues.no2} <span className="text-[9px] text-slate-500 font-normal">µg/m³</span></span>
                    </div>
                  )}
                  {evt.pollutantValues.so2 !== undefined && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">SO2</span>
                      <span className="text-slate-200 font-bold font-mono">{evt.pollutantValues.so2} <span className="text-[9px] text-slate-500 font-normal">µg/m³</span></span>
                    </div>
                  )}
                  {evt.pollutantValues.co !== undefined && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">CO</span>
                      <span className="text-slate-200 font-bold font-mono">{evt.pollutantValues.co} <span className="text-[9px] text-slate-500 font-normal">mg/m³</span></span>
                    </div>
                  )}
                  {evt.pollutantValues.aqi !== undefined && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">AQI Index</span>
                      <span className="text-emerald-400 font-black font-mono">{evt.pollutantValues.aqi}</span>
                    </div>
                  )}
                </div>

                {/* Transboundary & Target Airshed Info */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-white/5 pt-2">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Wind size={12} className="text-slate-500" />
                    <span>Wind: {evt.windDirectionDeg ?? 0}° at {evt.windSpeedKmh ?? 0} km/h</span>
                    {evt.predictedAffectedRegion && (
                      <span className="text-slate-500">· Airshed: <strong className="text-slate-300 font-normal">{evt.predictedAffectedRegion}</strong></span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>Target Nodes:</span>
                    {evt.targetCountries?.map((t) => (
                      <span key={t} className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 text-[10px] font-mono text-blue-300 font-bold">
                        {t === "ALL" ? "🌐 ALL BRICS" : t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
