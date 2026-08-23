import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Clock3, RefreshCw, Send, ShieldAlert, ShieldCheck, Sparkles, Truck, UserCheck } from "lucide-react";
import { apiClient } from "../services/apiClient";
import type { AlertResponseStatus, RegulatoryAlert, RegulatoryAuthority, RegulatoryResource } from "../types";

export function RegulatoryCoordinationPanel() {
  const [alerts, setAlerts] = useState<RegulatoryAlert[]>([]);
  const [authorities, setAuthorities] = useState<RegulatoryAuthority[]>([]);
  const [resources, setResources] = useState<RegulatoryResource[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [resolutionInput, setResolutionInput] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [alertsRes, authoritiesRes, resourcesRes] = await Promise.all([
        apiClient.getRegulatoryAlerts(),
        apiClient.getRegulatoryAuthorities(),
        apiClient.getRegulatoryResources()
      ]);
      setAlerts(alertsRes.alerts || []);
      setAuthorities(authoritiesRes.authorities || []);
      setResources(resourcesRes.resources || []);
      if (alertsRes.alerts?.length && !selectedAlertId) setSelectedAlertId(alertsRes.alerts[0].alertId);
    } catch (err) {
      console.error("Failed to load regulatory coordination data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectedAlert = alerts.find((alert) => alert.alertId === selectedAlertId) || alerts[0];
  const filteredAlerts = alerts.filter((alert) => selectedStatusFilter === "ALL" || alert.status === selectedStatusFilter);
  const availableResources = resources.filter((resource) => resource.status === "AVAILABLE");

  const handleAcknowledge = async (alertId: string) => {
    try {
      await apiClient.acknowledgeRegulatoryAlert(alertId, { actor: "Duty Environmental Officer (Central Ops)", notes: "Alert acknowledged via Sentinel Command Dashboard." });
      setActionMessage("Alert acknowledged.");
      await loadData();
    } catch (err) { console.error("Acknowledge failed:", err); }
  };

  const handleAssignResource = async (alertId: string) => {
    if (!selectedResourceId) return;
    try {
      await apiClient.assignRegulatoryAlert(alertId, { resourceId: selectedResourceId, actor: "Incident Commander", notes: "Dispatched specialized response asset to incident perimeter." });
      setSelectedResourceId(""); setActionMessage("Response unit dispatched."); await loadData();
    } catch (err) { console.error("Assign resource failed:", err); }
  };

  const handleSetInProgress = async (alertId: string) => {
    try {
      await apiClient.updateRegulatoryAlertStatus(alertId, { status: "ACTION_IN_PROGRESS", actor: "Field Operations Lead", notes: "Mitigation active: Industrial curtailment orders issued; mobile monitoring deployed." });
      setActionMessage("Action is now in progress."); await loadData();
    } catch (err) { console.error("Status update failed:", err); }
  };

  const handleResolve = async (alertId: string) => {
    if (!resolutionInput.trim()) return;
    try {
      await apiClient.resolveRegulatoryAlert(alertId, { resolutionNotes: resolutionInput, actor: "Senior Regulatory Inspector" });
      setResolutionInput(""); setActionMessage("Incident marked resolved."); await loadData();
    } catch (err) { console.error("Resolve failed:", err); }
  };

  const handleTriggerSimulatedAlert = async () => {
    try {
      await apiClient.createRegulatoryAlert({
        sourceCountry: "IND", sourceCountryName: "India", sourceFlag: "🇮🇳", affectedCountry: "CHN", affectedCountryName: "China", affectedFlag: "🇨🇳", affectedRegion: "Tibet / Himalayan Border Region", pollutionType: "industrial_smoke",
        sourcePollutionLevel: { pm2_5: 390, aqi: 420, severity: "critical" }, predictedPollutionLevel: { pm2_5: 175, aqi: 260, remainingRatio: 0.45 }, estimatedArrivalHours: 7, estimatedArrivalTime: new Date(Date.now() + 7 * 3600 * 1000).toISOString(), riskLevel: "CRITICAL", riskScore: 88, confidence: 85
      });
      setActionMessage("Critical alert created."); await loadData();
    } catch (err) { console.error("Trigger simulation failed:", err); }
  };

  const statusClass = (status: string) => {
    if (status === "RESOLVED") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-300";
    if (status === "ACTION_IN_PROGRESS") return "border-purple-400/35 bg-purple-500/10 text-purple-300";
    if (status === "ASSIGNED") return "border-cyan-400/35 bg-cyan-500/10 text-cyan-300";
    if (status === "ACKNOWLEDGED") return "border-amber-400/35 bg-amber-500/10 text-amber-300";
    return "border-red-400/35 bg-red-500/10 text-red-300";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300"><ShieldAlert size={14} /> Response coordination</div><h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">Regulatory Coordination</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Turn a cross-border pollution alert into a coordinated response.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={handleTriggerSimulatedAlert} className="inline-flex items-center gap-2 rounded-xl border border-purple-400/25 bg-purple-500/10 px-3 py-2.5 text-xs font-bold text-purple-200 transition hover:bg-purple-500/20"><Sparkles size={14} /> New critical alert</button><button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync alerts</button></div>
      </header>

      {actionMessage && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200"><CheckCircle2 size={15} className="text-emerald-400" />{actionMessage}</div>}

      <section className="grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Choose an incident</p><h2 className="mt-1 text-sm font-bold text-white">Pollution alerts</h2></div><select value={selectedStatusFilter} onChange={(event) => setSelectedStatusFilter(event.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-[10px] font-bold text-slate-300 outline-none"><option value="ALL">All statuses</option><option value="CREATED">New</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="ASSIGNED">Assigned</option><option value="ACTION_IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select></div><div className="space-y-2 lg:max-h-[730px] lg:overflow-y-auto lg:pr-1">{filteredAlerts.map((alert) => { const selected = selectedAlert?.alertId === alert.alertId; return <button key={alert.alertId} type="button" onClick={() => { setSelectedAlertId(alert.alertId); setActionMessage(null); }} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-purple-300 bg-purple-500/10 ring-1 ring-purple-300/35" : "border-white/10 bg-slate-950/65 hover:border-white/25 hover:bg-white/[0.04]"}`}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs font-black text-white">{alert.sourceFlag} {alert.sourceCountry}<ArrowRight size={12} className="text-purple-300" />{alert.affectedFlag} {alert.affectedCountry}</span><span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${statusClass(alert.status)}`}>{alert.status.replace(/_/g, " ")}</span></div><p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-300">{alert.title}</p><div className="mt-3 flex gap-4 border-t border-white/8 pt-2 text-[10px] text-slate-500"><span>Arrival <b className="text-purple-300">~{alert.estimatedArrivalHours ?? 0}h</b></span><span>Risk <b className="text-slate-300">{alert.riskLevel}</b></span></div></button>; })}</div></div>

        {selectedAlert ? <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/75 p-5 shadow-xl sm:p-7">
          <section className="rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-950/40 via-slate-950 to-slate-950 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">1 · Alert</p><h2 className="mt-2 text-lg font-black text-white sm:text-xl">{selectedAlert.title}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-200">{selectedAlert.sourceFlag} {selectedAlert.sourceCountryName}<ArrowRight size={15} className="text-red-300" />{selectedAlert.affectedFlag} {selectedAlert.affectedCountryName}</div><p className="mt-1 text-xs text-slate-400">{selectedAlert.affectedRegion}</p></div><span className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${statusClass(selectedAlert.status)}`}>{selectedAlert.riskLevel} RISK</span></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><MiniFact label="Source PM2.5" value={`${selectedAlert.sourcePollutionLevel.pm2_5} µg/m³`} /><MiniFact label="Predicted PM2.5" value={`${selectedAlert.predictedPollutionLevel?.pm2_5 ?? 120} µg/m³`} /><MiniFact label="Arrival" value={`~${selectedAlert.estimatedArrivalHours ?? 0} hours`} /><MiniFact label="Risk score" value={`${selectedAlert.riskScore}%`} /></div>{selectedAlert.status === "CREATED" && <button type="button" onClick={() => handleAcknowledge(selectedAlert.alertId)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-amber-300"><UserCheck size={14} /> Acknowledge alert</button>}</section>

          <section><StepHeading number="2" title="Responsible authority" description="This team owns the response in the affected area." /><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300"><ShieldCheck size={21} /></div><div><p className="text-sm font-black text-white">{selectedAlert.targetAuthority.authorityName}</p><p className="mt-1 text-xs text-slate-400">{selectedAlert.targetAuthority.jurisdiction}</p></div></div></section>

          <section><StepHeading number="3" title="Recommended actions" description="Start with the most important response steps." /><div className="grid gap-2 sm:grid-cols-2">{selectedAlert.recommendedActions.slice(0, 4).map((action, index) => <div key={index} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/15 font-black text-purple-200">{index + 1}</span><span>{action}</span></div>)}</div></section>

          <section><StepHeading number="4" title="Dispatch resource" description="Assign an available response unit to this incident." /><div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.05] p-4"><div className="flex flex-col gap-3 sm:flex-row"><select value={selectedResourceId} onChange={(event) => setSelectedResourceId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-xs text-white outline-none focus:border-cyan-300"><option value="">Choose available response unit ({availableResources.length})</option>{resources.map((resource) => <option key={resource.id} value={resource.id} disabled={resource.status !== "AVAILABLE"}>{resource.countryFlag} {resource.name} · {resource.status}</option>)}</select><button type="button" disabled={!selectedResourceId || selectedAlert.status === "RESOLVED"} onClick={() => handleAssignResource(selectedAlert.alertId)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-xs font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"><Send size={14} /> Dispatch</button></div>{selectedAlert.assignedResource && <p className="mt-3 text-xs text-cyan-200">Assigned: {selectedAlert.assignedResource.resourceName}</p>}{selectedAlert.status === "ASSIGNED" && <button type="button" onClick={() => handleSetInProgress(selectedAlert.alertId)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-200"><Truck size={14} /> Mark action in progress</button>}</div></section>

          <section><StepHeading number="5" title="Resolve incident" description="Record what was done, then close the alert." />{selectedAlert.status !== "RESOLVED" ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4"><textarea rows={3} value={resolutionInput} onChange={(event) => setResolutionInput(event.target.value)} placeholder="Briefly describe the resolution…" className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-emerald-300" /><button type="button" disabled={!resolutionInput.trim()} onClick={() => handleResolve(selectedAlert.alertId)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"><CheckCircle2 size={14} /> Mark Resolved</button></div> : <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4"><div className="flex items-center gap-2 text-sm font-black text-emerald-200"><CheckCircle2 size={17} /> Incident resolved</div><p className="mt-2 text-xs text-slate-300">{selectedAlert.resolutionNotes}</p></div>}<StatusTimeline alert={selectedAlert} /></section>

          <button type="button" onClick={() => setShowTechnicalDetails((open) => !open)} className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-bold text-slate-500 transition hover:text-white">{showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Technical details</button>{showTechnicalDetails && <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-slate-400"><p>Alert ID: {selectedAlert.alertId}</p><p className="mt-1">Confidence: {selectedAlert.confidence}% · Audit entries: {selectedAlert.auditTrail.length}</p><div className="mt-3 space-y-2">{selectedAlert.auditTrail.map((entry, index) => <p key={index}><span className="text-purple-300">{entry.action}</span> · {entry.notes}</p>)}</div></div>}
        </div> : <div className="flex min-h-80 items-center justify-center rounded-3xl border border-white/10 bg-slate-950/50 text-center text-sm text-slate-500">No alert selected.</div>}
      </section>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>;
}

function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300">{number} · {title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div>;
}

function StatusTimeline({ alert }: { alert: RegulatoryAlert }) {
  const entries = alert.auditTrail.slice(-4);
  return <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">{entries.map((entry, index) => <div key={index} className="flex items-center gap-2 text-[10px] text-slate-400"><span className={`rounded-full border px-2 py-1 font-bold ${index === entries.length - 1 ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.03]"}`}>{entry.action.replace(/_/g, " ")}</span>{index < entries.length - 1 && <ArrowRight size={12} className="text-slate-600" />}</div>)}</div>;
}

