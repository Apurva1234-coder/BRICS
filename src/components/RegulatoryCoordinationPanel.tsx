import { useState, useEffect } from "react";
import { apiClient } from "../services/apiClient";
import type {
  RegulatoryAlert,
  RegulatoryAuthority,
  RegulatoryResource,
  AlertResponseStatus
} from "../types";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Send,
  UserCheck,
  Truck,
  FileText,
  AlertTriangle,
  Radio,
  Building,
  Activity,
  CheckSquare
} from "lucide-react";

export function RegulatoryCoordinationPanel() {
  const [alerts, setAlerts] = useState<RegulatoryAlert[]>([]);
  const [authorities, setAuthorities] = useState<RegulatoryAuthority[]>([]);
  const [resources, setResources] = useState<RegulatoryResource[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Resource Assignment State
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [resolutionInput, setResolutionInput] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [alertsRes, authRes, resRes] = await Promise.all([
        apiClient.getRegulatoryAlerts(),
        apiClient.getRegulatoryAuthorities(),
        apiClient.getRegulatoryResources()
      ]);
      setAlerts(alertsRes.alerts || []);
      setAuthorities(authRes.authorities || []);
      setResources(resRes.resources || []);

      if (alertsRes.alerts && alertsRes.alerts.length > 0 && !selectedAlertId) {
        setSelectedAlertId(alertsRes.alerts[0].alertId);
      }
    } catch (err) {
      console.error("Failed to load regulatory coordination data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedAlert = alerts.find((a) => a.alertId === selectedAlertId) || alerts[0];

  const handleAcknowledge = async (alertId: string) => {
    try {
      await apiClient.acknowledgeRegulatoryAlert(alertId, {
        actor: "Duty Environmental Officer (Central Ops)",
        notes: "Alert acknowledged via Sentinel Command Dashboard."
      });
      setActionMessage("Alert acknowledged successfully.");
      await loadData();
    } catch (err) {
      console.error("Acknowledge failed:", err);
    }
  };

  const handleAssignResource = async (alertId: string) => {
    if (!selectedResourceId) return;
    try {
      await apiClient.assignRegulatoryAlert(alertId, {
        resourceId: selectedResourceId,
        actor: "Incident Commander",
        notes: "Dispatched specialized response asset to incident perimeter."
      });
      setSelectedResourceId("");
      setActionMessage("Resource dispatched and alert transitioned to ASSIGNED.");
      await loadData();
    } catch (err) {
      console.error("Assign resource failed:", err);
    }
  };

  const handleSetInProgress = async (alertId: string) => {
    try {
      await apiClient.updateRegulatoryAlertStatus(alertId, {
        status: "ACTION_IN_PROGRESS",
        actor: "Field Operations Lead",
        notes: "Mitigation active: Industrial curtailment orders issued; mobile monitoring deployed."
      });
      setActionMessage("Alert status transitioned to ACTION IN PROGRESS.");
      await loadData();
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const handleResolve = async (alertId: string) => {
    if (!resolutionInput.trim()) return;
    try {
      await apiClient.resolveRegulatoryAlert(alertId, {
        resolutionNotes: resolutionInput,
        actor: "Senior Regulatory Inspector"
      });
      setResolutionInput("");
      setActionMessage("Incident successfully marked RESOLVED. Resources released.");
      await loadData();
    } catch (err) {
      console.error("Resolve failed:", err);
    }
  };

  const handleTriggerSimulatedAlert = async () => {
    try {
      await apiClient.createRegulatoryAlert({
        sourceCountry: "IND",
        sourceCountryName: "India",
        sourceFlag: "🇮🇳",
        affectedCountry: "CHN",
        affectedCountryName: "China",
        affectedFlag: "🇨🇳",
        affectedRegion: "Tibet / Himalayan Border Region",
        pollutionType: "industrial_smoke",
        sourcePollutionLevel: {
          pm2_5: 390,
          aqi: 420,
          severity: "critical"
        },
        predictedPollutionLevel: {
          pm2_5: 175,
          aqi: 260,
          remainingRatio: 0.45
        },
        estimatedArrivalHours: 7,
        estimatedArrivalTime: new Date(Date.now() + 7 * 3600 * 1000).toISOString(),
        riskLevel: "CRITICAL",
        riskScore: 88,
        confidence: 85
      });
      setActionMessage("Automated High-Risk Regulatory Alert triggered!");
      await loadData();
    } catch (err) {
      console.error("Trigger simulation failed:", err);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (selectedStatusFilter !== "ALL" && a.status !== selectedStatusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: AlertResponseStatus) => {
    switch (status) {
      case "CREATED":
        return "bg-red-500/20 text-red-300 border-red-500/40";
      case "ACKNOWLEDGED":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "ASSIGNED":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "ACTION_IN_PROGRESS":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "RESOLVED":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  const availableResources = resources.filter((r) => r.status === "AVAILABLE");

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-slate-900/80 to-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/40 bg-purple-500/10 text-purple-400 shadow-inner">
              <ShieldAlert size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-300">
                  Stage 5 Architecture (Capstone)
                </span>
                <span className="text-[11px] font-bold text-slate-400">Automated Governance & Enforcement</span>
              </div>
              <h2 className="text-lg font-black text-white sm:text-xl">Automated Regulatory Coordination</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerSimulatedAlert}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-3.5 py-1.5 text-xs font-black text-white shadow-lg transition hover:from-purple-400 hover:to-indigo-400"
            >
              <Sparkles size={13} />
              <span>Simulate Critical Alert</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Sync Alerts</span>
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300">
          Closes the climate-action loop by dynamically matching high-risk cross-border or corridor pollution events with responsible regulatory authorities across BRICS member states. Automates alert generation, operational recommendations, field resource dispatch, and complete auditable resolution workflows.
        </p>

        {actionMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-200">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}
      </div>

      {/* ── Status Metrics Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setSelectedStatusFilter("ALL")}
          className={`rounded-2xl p-3 text-left border transition ${
            selectedStatusFilter === "ALL" ? "border-purple-400 bg-purple-400/10" : "border-white/10 bg-slate-950/80"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Alerts</span>
          <div className="text-xl font-black text-white mt-0.5">{alerts.length}</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatusFilter("CREATED")}
          className={`rounded-2xl p-3 text-left border transition ${
            selectedStatusFilter === "CREATED" ? "border-red-400 bg-red-400/10" : "border-white/10 bg-slate-950/80"
          }`}
        >
          <span className="text-[10px] font-bold text-red-300 uppercase">Created (Unread)</span>
          <div className="text-xl font-black text-red-300 mt-0.5">
            {alerts.filter((a) => a.status === "CREATED").length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatusFilter("ASSIGNED")}
          className={`rounded-2xl p-3 text-left border transition ${
            selectedStatusFilter === "ASSIGNED" ? "border-blue-400 bg-blue-400/10" : "border-white/10 bg-slate-950/80"
          }`}
        >
          <span className="text-[10px] font-bold text-blue-300 uppercase">Assigned</span>
          <div className="text-xl font-black text-blue-300 mt-0.5">
            {alerts.filter((a) => a.status === "ASSIGNED").length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatusFilter("ACTION_IN_PROGRESS")}
          className={`rounded-2xl p-3 text-left border transition ${
            selectedStatusFilter === "ACTION_IN_PROGRESS" ? "border-purple-400 bg-purple-400/10" : "border-white/10 bg-slate-950/80"
          }`}
        >
          <span className="text-[10px] font-bold text-purple-300 uppercase">In Progress</span>
          <div className="text-xl font-black text-purple-300 mt-0.5">
            {alerts.filter((a) => a.status === "ACTION_IN_PROGRESS").length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatusFilter("RESOLVED")}
          className={`rounded-2xl p-3 text-left border transition ${
            selectedStatusFilter === "RESOLVED" ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-slate-950/80"
          }`}
        >
          <span className="text-[10px] font-bold text-emerald-300 uppercase">Resolved</span>
          <div className="text-xl font-black text-emerald-300 mt-0.5">
            {alerts.filter((a) => a.status === "RESOLVED").length}
          </div>
        </button>
      </div>

      {/* ── Main Two-Column Workflow Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Alert Feed */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Active Incident Alerts ({filteredAlerts.length})
          </h3>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {filteredAlerts.map((alert) => {
              const isSelected = selectedAlert?.alertId === alert.alertId;

              return (
                <button
                  key={alert.alertId}
                  type="button"
                  onClick={() => {
                    setSelectedAlertId(alert.alertId);
                    setActionMessage(null);
                  }}
                  className={`w-full rounded-2xl p-4 text-left border transition relative backdrop-blur-md ${
                    isSelected
                      ? "border-purple-400 bg-purple-500/10 ring-1 ring-purple-400/40 shadow-lg"
                      : "border-white/10 bg-slate-950/80 hover:bg-white/[0.04] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-white">
                      <span>{alert.sourceFlag} {alert.sourceCountry}</span>
                      <ArrowRight size={12} className="text-purple-400" />
                      <span>{alert.affectedFlag} {alert.affectedCountry}</span>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusBadge(alert.status)}`}>
                      {alert.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white mt-1.5 line-clamp-2">{alert.title}</h4>

                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 border-t border-white/5 pt-2">
                    <div>
                      <span>Arrival: </span>
                      <strong className="text-purple-300 font-normal">~{alert.estimatedArrivalHours ?? 0}h</strong>
                    </div>
                    <div>
                      <span>Risk: </span>
                      <strong className="text-white font-normal">{alert.riskScore}% ({alert.riskLevel})</strong>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                    <Building size={11} className="shrink-0 text-slate-500" />
                    <span className="truncate">{alert.targetAuthority.authorityName}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Alert Detailed Operational Workspace */}
        {selectedAlert ? (
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-xl space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${getStatusBadge(selectedAlert.status)}`}>
                    {selectedAlert.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">ID: {selectedAlert.alertId}</span>
                </div>
                <h3 className="text-base font-black text-white mt-2 sm:text-lg">{selectedAlert.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Affecting: <strong>{selectedAlert.affectedCountryName}</strong> ({selectedAlert.affectedRegion})
                </p>
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedAlert.status === "CREATED" && (
                  <button
                    type="button"
                    onClick={() => handleAcknowledge(selectedAlert.alertId)}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-400"
                  >
                    <UserCheck size={14} />
                    <span>Acknowledge Alert</span>
                  </button>
                )}

                {selectedAlert.status === "ASSIGNED" && (
                  <button
                    type="button"
                    onClick={() => handleSetInProgress(selectedAlert.alertId)}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-500 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-purple-400"
                  >
                    <Activity size={14} />
                    <span>Set Action In Progress</span>
                  </button>
                )}
              </div>
            </div>

            {/* Incident Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Source Pollution</span>
                <p className="text-xs font-black text-white mt-0.5">{selectedAlert.sourcePollutionLevel.pm2_5} µg/m³ PM2.5</p>
                <span className="text-[10px] text-slate-500">{selectedAlert.sourceCountryName} ({selectedAlert.sourceFlag})</span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Predicted Arrival</span>
                <p className="text-xs font-black text-purple-300 mt-0.5">
                  ~{selectedAlert.estimatedArrivalHours ?? 0} Hours
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  {selectedAlert.estimatedArrivalTime ? new Date(selectedAlert.estimatedArrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Imminent"}
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Predicted Influx PM2.5</span>
                <p className="text-xs font-black text-white mt-0.5">
                  {selectedAlert.predictedPollutionLevel?.pm2_5 ?? 120} µg/m³
                </p>
                <span className="text-[10px] text-slate-500">Risk Score: {selectedAlert.riskScore}%</span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Resource</span>
                <p className="text-xs font-bold text-cyan-300 mt-0.5 truncate">
                  {selectedAlert.assignedResource?.resourceName || "Unassigned"}
                </p>
                <span className="text-[10px] text-slate-500">
                  {selectedAlert.assignedResource ? "Active Patrol" : "Awaiting Dispatch"}
                </span>
              </div>
            </div>

            {/* Target Authority Matching Contract */}
            <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                <Building size={15} />
                <span>Matched Responsible Authority</span>
              </div>
              <p className="text-sm font-black text-white">{selectedAlert.targetAuthority.authorityName}</p>
              <p className="text-xs text-slate-400">Jurisdiction: {selectedAlert.targetAuthority.jurisdiction}</p>
            </div>

            {/* Recommended Regulatory Actions */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckSquare size={14} className="text-purple-400" />
                <span>Recommended Operational Mitigations</span>
              </h4>

              <div className="space-y-1.5">
                {selectedAlert.recommendedActions.map((action, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-black text-purple-300">
                      {idx + 1}
                    </span>
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resource Dispatch & Assignment Toolbar */}
            {selectedAlert.status !== "RESOLVED" && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Truck size={14} className="text-cyan-400" />
                  <span>Dispatch Field Unit / Resource</span>
                </h4>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedResourceId}
                    onChange={(e) => setSelectedResourceId(e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                  >
                    <option value="">Select Deployable Resource ({availableResources.length} Available)...</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id} disabled={r.status !== "AVAILABLE"}>
                        {r.countryFlag} {r.name} ({r.resourceType}) — {r.status}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!selectedResourceId}
                    onClick={() => handleAssignResource(selectedAlert.alertId)}
                    className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition hover:bg-cyan-400 disabled:opacity-50"
                  >
                    <Send size={13} />
                    <span>Dispatch Asset</span>
                  </button>
                </div>
              </div>
            )}

            {/* Resolution Form */}
            {selectedAlert.status !== "RESOLVED" && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Complete Incident & Record Resolution</span>
                </h4>

                <div className="space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Enter resolution notes (e.g. Industrial curtailment enforced; PM2.5 normalized below threshold; civil advisory concluded)..."
                    value={resolutionInput}
                    onChange={(e) => setResolutionInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!resolutionInput.trim()}
                      onClick={() => handleResolve(selectedAlert.alertId)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} />
                      <span>Mark Incident Resolved</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Resolution Notes Display if already resolved */}
            {selectedAlert.resolutionNotes && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <CheckCircle2 size={15} />
                  <span>Incident Resolution Record</span>
                </div>
                <p className="text-xs text-white">{selectedAlert.resolutionNotes}</p>
                <span className="text-[10px] text-slate-400">
                  Resolved at: {new Date(selectedAlert.resolvedAt || selectedAlert.updatedAt).toLocaleString()}
                </span>
              </div>
            )}

            {/* Full Audit Trail Timeline */}
            <div className="space-y-3 border-t border-white/10 pt-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText size={14} className="text-purple-400" />
                <span>Auditable Action Log ({selectedAlert.auditTrail.length} Steps)</span>
              </h4>

              <div className="space-y-2">
                {selectedAlert.auditTrail.map((entry, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-purple-300 font-bold">{entry.action}</span>
                      <span className="text-slate-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-sans">{entry.notes}</p>
                    <span className="text-[10px] text-slate-500">Actor: {entry.actor}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-950/40 p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <ShieldAlert size={36} className="text-slate-600 mb-2" />
            <p className="text-sm font-bold">No Alert Selected</p>
            <p className="text-xs mt-1">Select an incident alert from the left feed or trigger a simulated event.</p>
          </div>
        )}
      </div>

      {/* ── Active Deployable Resources Fleet ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
          BRICS Deployable Environmental Response Fleet
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {resources.map((res) => {
            const isDispatched = res.status === "DISPATCHED";

            return (
              <div
                key={res.id}
                className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-lg backdrop-blur-md space-y-2 transition hover:border-purple-500/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{res.countryFlag}</span>
                    <div>
                      <h4 className="text-xs font-black text-white truncate max-w-[140px]">{res.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">{res.contactCallsign}</span>
                    </div>
                  </div>

                  <span
                    className={`rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      isDispatched
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}
                  >
                    {res.status}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 border-t border-white/5 pt-2">
                  <span>Station: </span>
                  <strong className="text-slate-300 font-normal">{res.stationLocation.name}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
