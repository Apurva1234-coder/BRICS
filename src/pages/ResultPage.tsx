import { CheckCircle2, MapPinned, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Route } from "../App";
import { LocalRiskAdvisorCard } from "../components/LocalRiskAdvisorCard";
import { SeverityBadge } from "../components/SeverityBadge";
import { StatusPill } from "../components/StatusPill";
import { PhotoEvidence } from "../components/PhotoEvidence";
import { ForecastPanel } from "../components/ForecastPanel";
import type { PollutionReport } from "../types";
import { resolveMediaUrl, reportPhotoUrl } from "../utils/mediaUrl";

export function ResultPage({
  report,
  onNavigate
}: {
  report?: PollutionReport;
  onNavigate: (route: Route) => void;
}) {
  const [showVerification, setShowVerification] = useState(false);

  if (!report) {
    return (
      <div className="mx-auto max-w-md py-12 text-center border border-slate-900 bg-slate-950/40 rounded-2xl p-6">
        <h1 className="text-lg font-bold text-white">No Report Submitted Yet</h1>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Create a report with clear photo evidence to begin AI-assisted tracking.
        </p>
        <button
          onClick={() => onNavigate("capture")}
          className="mt-6 px-4 py-2 bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs rounded-xl transition shadow-md"
        >
          Create Report
        </button>
      </div>
    );
  }

  const displayUrl = reportPhotoUrl(report);

  return (
    <div className="mx-auto max-w-5xl py-4">
      {/* Title */}
      <div className="mb-8">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Submission Receipt</span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
          <CheckCircle2 size={24} className="text-emerald-500" />
          Report Submitted Successfully
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">
          Your pollution report has been received and verified. You can track this ticket's status on the public portal.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left Column: Photo, Status, Resolution */}
        <section className="space-y-6">
          <div className="border border-slate-900 bg-slate-950/20 rounded-2xl p-5 space-y-4 shadow-sm">
            <PhotoEvidence
              src={displayUrl}
              alt="Report photo"
              mode="main"
              className="w-full h-64 rounded-xl object-cover border border-slate-900 shadow-md bg-slate-950"
            />
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <SeverityBadge severity={report.gemini.severity} />
              <StatusPill status={report.status} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-0.5 rounded border border-slate-800/80 bg-slate-900/30">
                {report.trustLevel}
              </span>
            </div>
          </div>

          {/* Resolution Proof */}
          {report.resolutionProof && (
            <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 space-y-4 shadow-sm">
              <p className="font-bold text-white text-xs flex items-center gap-1.5 uppercase tracking-wide">
                <CheckCircle2 size={14} className="text-emerald-500" /> Resolution proof
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-[10px] text-slate-500 font-bold uppercase">Before</p>
                  <PhotoEvidence
                    src={reportPhotoUrl(report)}
                    alt="Before"
                    mode="main"
                    className="h-24 w-full rounded-xl object-cover bg-slate-950"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-slate-500 font-bold uppercase">After</p>
                  <PhotoEvidence
                    src={resolveMediaUrl(report.resolutionProof.afterMedia?.displayUrl)}
                    alt="After"
                    mode="main"
                    className="h-24 w-full rounded-xl object-cover bg-slate-950"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-350 leading-relaxed">{report.resolutionProof.actionTaken}</p>
            </div>
          )}
        </section>

        {/* Right Column: Ticket details & AI breakdown */}
        <section className="space-y-6">
          <div className="border border-slate-900 bg-slate-950/20 rounded-2xl p-5 space-y-4 shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ticket ID</span>
              <h2 className="text-base font-mono font-bold text-white mt-0.5">{report.id}</h2>
            </div>

            {report.rejectionReason && (
              <p className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-xs text-red-400 leading-relaxed">
                Rejection reason: {report.rejectionReason}
              </p>
            )}

            {/* What was detected */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detected Hazard</span>
              <h3 className="text-lg font-bold text-slate-200 capitalize tracking-tight">
                {report.gemini.pollution_type.replace(/_/g, " ")}
              </h3>
              <p className="text-xs text-slate-350 leading-relaxed">{report.gemini.public_summary}</p>
            </div>

            {/* Coordinates / Meta */}
            <div className="grid grid-cols-2 gap-4.5 pt-2 border-t border-slate-900">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Location</span>
                <span className="text-xs text-slate-300 font-semibold mt-1 block">{report.areaText}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Submitted</span>
                <span className="text-xs text-slate-300 font-semibold mt-1 block">
                  {new Date(report.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            </div>

            {/* Risk Guidance */}
            <ForecastPanel forecast={report.forecast} compact />

            {report.riskAdvisor && (
              <div className="pt-2">
                <LocalRiskAdvisorCard advisor={report.riskAdvisor} />
              </div>
            )}

            {/* Verification details — collapsible */}
            <div className="pt-2">
              <button
                className="flex w-full items-center justify-between rounded-xl border border-slate-850 bg-slate-900/10 px-4 py-3 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 transition"
                onClick={() => setShowVerification((v) => !v)}
              >
                <span>AI Verification Audit Log</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showVerification ? "rotate-180" : ""}`} />
              </button>
              {showVerification && (
                <div className="mt-2.5 rounded-xl border border-slate-900 bg-slate-950/40 p-4 space-y-3.5 text-xs text-slate-400">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-900/40">
                      <span>Evidence confidence</span>
                      <strong className="text-slate-200">{report.evidenceScore}/100</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900/40">
                      <span>Location match</span>
                      <strong className="text-slate-200">{report.authenticityScore}/100</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900/40">
                      <span>Visual authenticity</span>
                      <strong className="text-slate-200">{Math.round(report.gemini.confidence || 0)}/100</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900/40">
                      <span>Image check</span>
                      <strong className="text-slate-200 capitalize">{report.gemini.image_quality || "unknown"}</strong>
                    </div>
                  </div>
                  {report.evidenceReasons?.length > 0 && (
                    <div className="pt-2 border-t border-slate-900">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Acceptance Audits</span>
                      <ul className="space-y-1 text-slate-400 leading-relaxed text-[11px]">
                        {report.evidenceReasons.slice(0, 4).map((r) => (
                          <li key={r}>· {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-2.5 pt-4 border-t border-slate-900">
              <button
                onClick={() => onNavigate("map")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs transition"
              >
                <MapPinned size={14} />
                <span>Situation Map</span>
              </button>
              <button
                onClick={() => onNavigate("my-reports")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-bold transition"
              >
                <span>My Reports History</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
