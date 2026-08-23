import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, HandHeart, ImageUp, MapPin, Upload, Wind } from "lucide-react";
import type { PollutionReport } from "../types";
import type { Route } from "../App";
import { reportPhotoUrl, resolveMediaUrl } from "../utils/mediaUrl";
import { MunicipalHotspotMap } from "../components/MunicipalHotspotMap";
import { submitCleanupProof, updateMunicipalProgress } from "../services/reportService";

const TEAM = "Demo Municipal Team";

function normalize(value?: string) {
  return String(value || "").toLowerCase().replace(/[ -]+/g, "_");
}

function stateOf(report: PollutionReport) {
  const status = normalize(report.status);
  const assignmentStatus = normalize(report.municipalAssignment?.status || report.ngoAssignment?.status);
  if (status === "resolved") return "resolved";
  if (report.cleanupProof || status.includes("cleanup_proof")) return "proof";
  if (status === "in_progress" || status === "cleanup_in_progress" || assignmentStatus === "cleanup_in_progress") return "progress";
  if (status === "accepted" || assignmentStatus === "accepted") return "accepted";
  return "assigned";
}

function statusLabel(state: ReturnType<typeof stateOf>) {
  if (state === "resolved") return "Resolved";
  if (state === "proof") return "Waiting for Officer Approval";
  if (state === "progress") return "Cleanup In Progress";
  if (state === "accepted") return "Accepted";
  return "Assigned";
}

function validCoordinates(report: PollutionReport) {
  return Number.isFinite(report.lat) && Number.isFinite(report.lng) && report.lat >= -90 && report.lat <= 90 && report.lng >= -180 && report.lng <= 180;
}

export function NgoPage({ reports, onReportsChanged, onNavigate: _onNavigate }: { reports: PollutionReport[]; onReportsChanged: () => Promise<unknown>; onNavigate: (route: Route) => void }) {
  const assigned = useMemo(() => {
    const real = reports.filter((report) => report.municipalAssignment?.teamId === "demo-municipal-team" || report.municipalAssignment?.teamName === TEAM || report.assignedDepartment === "Sanitation" || report.ngoAssignment?.ngoName === TEAM);
    return real;
  }, [reports]);
  const [selectedId, setSelectedId] = useState(assigned[0]?.id);
  const [busy, setBusy] = useState<"accept" | "start" | "proof" | null>(null);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [actionTaken, setActionTaken] = useState("");
  const [note, setNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selected = assigned.find((report) => report.id === selectedId) || assigned[0];
  if (!selected) return <div className="text-slate-400">No cleanup cases are currently assigned.</div>;

  const state = stateOf(selected);
  const coordsOk = validCoordinates(selected);
  const proofAllowed = state === "progress";
  const proofReady = Boolean(file && actionTaken.trim() && proofAllowed);

  const progress = async (status: "Accepted" | "Cleanup In Progress", kind: "accept" | "start") => {
    if (busy || state === "resolved") return;
    setBusy(kind);
    setMessage("");
    try {
      const updated = await updateMunicipalProgress(selected.id, status);
      if (updated) {
        setSelectedId(updated.id);
        setMessage(status === "Accepted" ? "Cleanup task accepted successfully." : "Cleanup work marked as started.");
      }
      await onReportsChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this cleanup case.");
    } finally {
      setBusy(null);
    }
  };

  const submitProof = async () => {
    if (!file || !actionTaken.trim() || !proofAllowed || busy) return;
    setBusy("proof");
    setMessage("");
    try {
      const coords = await new Promise<{ lat?: number; lng?: number; accuracy?: number }>((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
          () => resolve({}),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
      await submitCleanupProof(selected.id, file, {
        actionTaken: actionTaken.trim(), locality: selected.areaText, lat: coords.lat, lng: coords.lng, gpsAccuracy: coords.accuracy, note
      });
      await onReportsChanged();
      setMessage("Cleanup proof submitted for Officer review.");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setActionTaken("");
      setNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit cleanup proof.");
    } finally {
      setBusy(null);
    }
  };

  return <div className="mx-auto max-w-6xl space-y-5 pb-8">
    <div className="flex items-start justify-between">
      <div><p className="section-eyebrow">Temporary demo workspace</p><h2 className="text-xl font-bold text-white">Municipal Field Team <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-1 text-[10px] text-amber-200">Demo Data</span></h2></div>
      <HandHeart className="text-emerald-300" />
    </div>
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-2">
        {assigned.map((report) => <button key={report.id} onClick={() => { setSelectedId(report.id); setMessage(""); setMapOpen(false); }} className={`w-full rounded-xl border p-3 text-left ${report.id === selected.id ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/10 bg-white/[.03]"}`}>
          <div className="flex gap-3"><img src={reportPhotoUrl(report)} className="h-12 w-12 rounded-lg object-cover" /><div><p className="text-sm font-semibold text-white">{report.areaText}</p><p className="text-xs text-slate-400">{report.gemini.pollution_type.replace(/_/g, " ")} · {report.priority}</p><p className="mt-1 text-[11px] text-emerald-300">{statusLabel(stateOf(report))}</p></div></div>
        </button>)}
      </aside>
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="flex flex-wrap justify-between gap-2"><div><p className="section-eyebrow">Assigned cleanup case</p><h3 className="font-semibold text-white">{selected.areaText}</h3><p className="text-sm text-slate-400">{selected.gemini.pollution_type.replace(/_/g, " ")} · Hotspot score {selected.hotspotScore}</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">{statusLabel(state)}</span></div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {state === "assigned" && <button disabled={busy !== null} onClick={() => progress("Accepted", "accept")} className="btn-secondary">{busy === "accept" ? "Accepting…" : "Accept Task"}</button>}
            {state === "accepted" && <button disabled={busy !== null} onClick={() => progress("Cleanup In Progress", "start")} className="btn-primary min-h-[44px] w-full justify-center"><CheckCircle2 size={15} /> {busy === "start" ? "Starting…" : "Start Cleanup"}</button>}
            {state === "progress" && <button disabled className="btn-secondary min-h-[44px] w-full justify-center"><CheckCircle2 size={14} /> Cleanup In Progress</button>}
            <button disabled={!coordsOk} title={coordsOk ? "" : "Hotspot coordinates are unavailable for this report."} onClick={() => { setMapError(false); setMapOpen(true); setRecenter((value) => value + 1); }} className="btn-secondary min-h-[44px] w-full justify-center"><MapPin size={14} /> View Hotspot Map</button>
          </div>
          {state === "proof" && <p className="mt-3 text-xs text-amber-200">Waiting for Officer approval</p>}
          {!coordsOk && <p className="mt-3 text-xs text-amber-200">Hotspot coordinates are unavailable for this report.</p>}
          {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
        </div>
        {mapOpen && <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="mb-3 flex items-center justify-between"><p className="section-eyebrow">Hotspot map</p><div className="flex gap-2"><button onClick={() => setRecenter((value) => value + 1)} className="btn-secondary">Re-centre hotspot</button><button onClick={() => setMapOpen(false)} className="btn-secondary">Close map</button></div></div>{mapError ? <p className="text-sm text-amber-200">Map is temporarily unavailable.</p> : <MunicipalHotspotMap report={selected} recenter={recenter} onTilesError={() => setMapError(true)} />}</div>}
        <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="section-eyebrow">Before evidence</p><img src={reportPhotoUrl(selected)} className="mt-3 h-48 w-full rounded-xl object-cover" /><p className="mt-3 text-xs text-slate-400">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} · {selected.areaText}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="section-eyebrow">AQI & local context</p><Wind className="mt-3 text-cyan-300" /><p className="mt-3 text-xs text-slate-500">AQI and CPCB readings are environmental context only.</p></div></div>
        {state === "progress" && <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="section-eyebrow">After Photo</p><div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Photo evidence</p><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy !== null} onChange={(event) => { setFile(event.target.files?.[0] || null); setMessage(""); event.target.value = ""; }} /><input ref={captureInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={busy !== null} onChange={(event) => { setFile(event.target.files?.[0] || null); setMessage(""); event.target.value = ""; }} /><div className="grid grid-cols-2 gap-2"><button type="button" className="btn-primary min-h-[46px] justify-center" disabled={busy !== null} onClick={() => captureInput.current?.click()}><Camera size={15} /> Capture</button><button type="button" className="btn-secondary min-h-[46px] justify-center" disabled={busy !== null} onClick={() => fileInput.current?.click()}><ImageUp size={15} /> Upload</button></div>{file && <p className="mt-2 truncate text-xs text-slate-400" title={file.name}>Selected: {file.name}</p>}{previewUrl ? <img src={previewUrl} alt="Selected after-cleanup evidence preview" className="mt-3 h-40 w-full rounded-lg object-cover ring-1 ring-white/10" /> : <div className="mt-3 flex h-40 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-slate-500">No after photo selected</div>}</div><div className="space-y-4"><label className="block text-sm text-slate-300">Action Taken <span className="text-amber-300">(required)</span><input aria-required="true" disabled={busy !== null} value={actionTaken} placeholder="Example: Waste collected and area cleaned" onChange={(event) => { setActionTaken(event.target.value); setMessage(""); }} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10" /></label><label className="block text-sm text-slate-300">Optional Cleanup Note<textarea disabled={busy !== null} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a short note about the work completed" className="mt-2 min-h-[112px] w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10" /></label></div></div><p className="mt-4 text-xs text-slate-500">Municipal Department / Ward Team: {TEAM} · Related report ID: {selected.id}</p>{!proofReady && <p className="mt-3 text-sm text-amber-200">Choose an after-cleanup photo and enter the Action Taken description to enable submission.</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}<button disabled={!proofReady || busy !== null} onClick={submitProof} className="btn-primary mt-4 min-h-[46px] w-full justify-center sm:w-auto"><Upload size={15} /> {busy === "proof" ? "Submitting…" : "Submit Cleanup Proof"}</button></div>}
        {selected.cleanupProof && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.04] p-4"><p className="section-eyebrow">Before and after comparison</p><p className="mt-2 text-sm text-slate-300"><span className="font-semibold text-white">Action taken:</span> {selected.cleanupProof.actionTaken || "Cleanup work completed."}</p>{selected.cleanupProof.note && <p className="mt-1 text-sm text-slate-300">{selected.cleanupProof.note}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><img src={reportPhotoUrl(selected)} className="h-44 w-full rounded-xl object-cover" /><img src={resolveMediaUrl(selected.cleanupProof.afterMedia.displayUrl)} className="h-44 w-full rounded-xl object-cover" /></div></div>}
      </section>
    </div>
  </div>;
}
