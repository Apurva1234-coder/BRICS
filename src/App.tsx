import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Camera, ClipboardList, MapPinned, ShieldCheck, HandHeart, Trophy, Globe } from "lucide-react";
import { AppShell } from "./components/AppShell";
import type { PollutionReport, PollutionSituation } from "./types";
import { listReports } from "./services/reportService";
import { useRouteAccessibility } from "./hooks/useRouteAccessibility";
import { clearLocalDemoData, DEMO_REPORTS_CHANGED_EVENT, revokeDemoObjectUrls } from "./services/demoBrowserStorage";
import { buildRankedSituationsClient } from "./utils/situationClient";
import { db as firebaseDb, storage as firebaseStorage, ensureAnonymousSession } from "./services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

export type Route = "map" | "federation" | "capture" | "my-reports" | "leaderboard" | "ngo" | "result" | "admin";

const NearbyPage = lazy(() => import("./pages/NearbyPage").then(({ NearbyPage }) => ({ default: NearbyPage })));
const ReportPage = lazy(() => import("./pages/ReportPage").then(({ ReportPage }) => ({ default: ReportPage })));
const ResultPage = lazy(() => import("./pages/ResultPage").then(({ ResultPage }) => ({ default: ResultPage })));
const MyReportsPage = lazy(() => import("./pages/MyReportsPage").then(({ MyReportsPage }) => ({ default: MyReportsPage })));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage").then(({ LeaderboardPage }) => ({ default: LeaderboardPage })));
const NgoPage = lazy(() => import("./pages/NgoPage").then(({ NgoPage }) => ({ default: NgoPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then(({ AdminPage }) => ({ default: AdminPage })));
const BricsFederationPanel = lazy(() => import("./components/BricsFederationPanel").then(({ BricsFederationPanel }) => ({ default: BricsFederationPanel })));

function RouteLoading() {
  return <div className="flex h-full min-h-[160px] items-center justify-center p-6" role="status" aria-live="polite"><span className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" /><span className="sr-only">Loading page</span></div>;
}

const navItems = [
  { route: "map"        as const, label: "Situation Map",    icon: MapPinned,    i18nKey: "nav.map" },
  { route: "federation" as const, label: "Federation",       icon: Globe },
  { route: "capture"    as const, label: "Report Pollution", icon: Camera,       i18nKey: "nav.capture" },
  { route: "my-reports" as const, label: "My Reports",       icon: ClipboardList,i18nKey: "nav.myReports" },
  { route: "leaderboard" as const, label: "Leaderboard",     icon: Trophy },
  { route: "ngo"        as const, label: "Municipal",        icon: HandHeart },
  { route: "admin"      as const, label: "Officer",          icon: ShieldCheck,  i18nKey: "nav.officer" },
];

function routeFromLocation(): Route {
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return "admin";
  const hash = window.location.hash.replace("#", "");
  if (["map", "federation", "capture", "my-reports", "leaderboard", "ngo", "result", "admin"].includes(hash)) return hash as Route;
  return "map";
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation);
  const [reports, setReports] = useState<PollutionReport[]>([]);
  const [situations, setSituations] = useState<PollutionSituation[]>([]);
  const [activeReport, setActiveReport] = useState<PollutionReport | null>(null);
  useRouteAccessibility(route);

  const refreshReports = async () => {
    try {
      const nextReports = await listReports();
      const situationResponse = { situations: buildRankedSituationsClient(nextReports) };

      setReports(nextReports);
      setSituations(situationResponse.situations);

      return nextReports;
    } catch {
      setReports([]);
      setSituations([]);
      return [];
    }
  };

  useEffect(() => {
    const seedPermanentDemo = async () => {
      if (import.meta.env.VITE_DEMO_BROWSER_STORAGE === "true") return;
      try {
        const response = await fetch("/demo-roadside-trash.webp");
        if (!response.ok) return;
        if (!firebaseDb || !firebaseStorage) return;
        await ensureAnonymousSession();
        const id = "NGR-DEMO-ROADSIDE-001";
        const reportRef = doc(firebaseDb, "reports", id);
        if ((await getDoc(reportRef)).exists()) return;
        const createdAt = "2026-08-17T17:36:51.000Z";
        const image = await response.blob();
        const path = `reports/${id}/MED-DEMO-ROADSIDE-001/original.webp`;
        const uploaded = await uploadBytes(storageRef(firebaseStorage, path), image, { contentType: "image/webp" });
        const displayUrl = await getDownloadURL(uploaded.ref);
        await setDoc(reportRef, { id, createdAt, updatedAt: createdAt, userId: "demo-seed", status: "Submitted", lat: 18.5204, lng: 73.8567, areaText: "Suburban roadside near Pune", userDescription: "Demo report: garbage accumulation along the roadside creates an eyesore and may obstruct drainage. Municipal cleanup is requested.", imageHash: "demo-roadside-trash-364566278", evidenceStatus: "verified", trustLevel: "Verified", evidenceScore: 82, authenticityScore: 100, authenticityFlags: ["demo_seed"], evidenceReasons: ["Permanent application demo seed"], priority: "high", hotspotScore: 72, gemini: { is_pollution_related: true, pollution_visible: true, image_quality: "usable", image_quality_score: 95, pollution_type: "open_waste", confidence: 95, severity: "high", evidence_strength: 90, visible_evidence: ["Multiple garbage bags and loose litter beside the road"], possible_pollutants: ["Particulate matter", "Bioaerosols"], public_summary: "Roadside garbage accumulation requiring municipal cleanup.", municipal_action: "Inspect and clear the roadside waste pile.", needs_manual_review: false, trust_decision: "verified", safety_note: "Avoid direct contact with waste." }, airQuality: { provider: "unavailable", category: "AQI unavailable", pollutants: {}, rawSummary: "Demo report seed." }, media: [{ mediaId: "MED-DEMO-ROADSIDE-001", type: "photo", storagePath: path, cloudUri: `gs://${uploaded.metadata.bucket}/${path}`, displayUrl, publicUrl: displayUrl, storageProvider: "firebase_storage", mimeType: "image/webp", sizeBytes: image.size, sha256Hash: "demo-roadside-trash-364566278", uploadedAt: createdAt, capturedAt: createdAt, width: 800, height: 533, exifAvailable: false, metadataWarnings: [] }], primaryMediaId: "MED-DEMO-ROADSIDE-001", captureEvidence: { captureMethod: "uploaded_image", photoCapturedAt: createdAt, cameraFacingMode: "environment", captureLocation: { lat: 18.5204, lng: 73.8567, accuracyMeters: 25, capturedAt: createdAt } }, nearby: { similarReportCount: 0, nearbyReportIds: [] }, actionLog: [{ type: "report_created", at: createdAt, note: "Permanent demo seed." }], statusHistory: [{ status: "Submitted", label: "Submitted", timestamp: createdAt, updatedByRole: "system", message: "Permanent demo seed." }] }, { merge: true });
      } catch (error) { console.error("[DemoSeed] Firebase seed failed", error); }
    };
    void seedPermanentDemo().finally(() => { void refreshReports(); });
    const onPop = () => setRoute(routeFromLocation());
    const onDemoReportsChanged = () => { void refreshReports(); };
    window.addEventListener("popstate", onPop);
    window.addEventListener(DEMO_REPORTS_CHANGED_EVENT, onDemoReportsChanged);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener(DEMO_REPORTS_CHANGED_EVENT, onDemoReportsChanged); revokeDemoObjectUrls(); };
  }, []);

  const navigate = (next: Route) => {
    setRoute(next);
    const target = next === "admin" ? "/admin" : `/#${next === "map" ? "" : next}`;
    window.history.pushState({}, "", target);
  };

  const stats = useMemo(() => {
    const open = reports.filter((r) => r.status !== "Resolved").length;
    const high = reports.filter((r) => ["high", "severe"].includes(r.priority)).length;
    return { open, high, total: reports.length };
  }, [reports]);

  const clearDemoData = async () => {
    await clearLocalDemoData();
    setReports([]);
    setSituations([]);
    setActiveReport(null);
  };

  return (
  <AppShell navItems={navItems} activeRoute={route} onNavigate={navigate} stats={stats} onClearLocalDemoData={clearDemoData}>
      <Suspense fallback={<RouteLoading />}>
        {route === "map" && (
          <NearbyPage reports={reports} situations={situations} focusReport={activeReport} onNavigate={navigate} />
        )}
        {route === "federation" && <BricsFederationPanel />}
        {route === "capture" && (
          <ReportPage
            onSubmitted={async (report) => {
              setActiveReport(report);
              setReports((cur) => [report, ...cur.filter((r) => r.id !== report.id)]);
            navigate("my-reports");
              await refreshReports();
            }}
          />
        )}
        {route === "result" && <ResultPage report={activeReport || reports[0]} onNavigate={navigate} />}
        {route === "my-reports" && <MyReportsPage situations={situations} onNavigate={navigate} />}
        {route === "leaderboard" && <LeaderboardPage />}
        {route === "ngo" && <NgoPage reports={reports} onReportsChanged={refreshReports} onNavigate={navigate} />}
        {route === "admin" && (
          <AdminPage reports={reports} onReportsChanged={async () => { await refreshReports(); }} />
        )}
      </Suspense>
    </AppShell>
  );
}
