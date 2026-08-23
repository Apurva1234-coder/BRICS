import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PollutionReport } from "../types.js";
import { distanceMeters } from "../utils/geo.js";

export interface RewardTransaction {
  transactionId: string;
  userId: string;
  reportId: string;
  points: number;
  reason: string;
  createdAt: string;
}

export interface CitizenRewardProfile {
  userId: string;
  displayName: string;
  locality: string;
  totalPoints: number;
  resolvedReports: number;
  validReports: number;
  rank: number;
  badges: string[];
  lastPointsAwardedAt?: string;
}

interface ResolutionAward {
  transaction: RewardTransaction;
  profile: CitizenRewardProfile;
}

export interface LeaderboardEntry extends Omit<CitizenRewardProfile, "userId"> {
  isDemo?: boolean;
}

interface RewardsStore { profiles: CitizenRewardProfile[]; transactions: RewardTransaction[]; }

// Local development uses a JSON store rather than a database transaction. Serialize
// awards so two Officer approval requests cannot both create a transaction for one report.
let awardQueue = Promise.resolve();

const DEMO_LEADERBOARD: LeaderboardEntry[] = [
  { displayName: "Asha P.", locality: "Pune", totalPoints: 680, resolvedReports: 5, validReports: 7, rank: 1, badges: ["Clean City Champion"], isDemo: true },
  { displayName: "Rahul K.", locality: "Pimpri", totalPoints: 430, resolvedReports: 3, validReports: 4, rank: 2, badges: ["Locality Contributor"], isDemo: true },
  { displayName: "Meera S.", locality: "Pune", totalPoints: 275, resolvedReports: 2, validReports: 3, rank: 3, badges: ["First Resolved Cleanup"], isDemo: true }
];

function serverlessRuntime() { return process.env.NODE_ENV === "production" || Boolean(process.env.NETLIFY) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME); }
function rewardsFile() { return path.join(process.cwd(), "storage", "rewards.json"); }
async function readStore(): Promise<RewardsStore> {
  if (serverlessRuntime()) return { profiles: [], transactions: [] };
  try { return JSON.parse(await readFile(rewardsFile(), "utf8")) as RewardsStore; }
  catch { return { profiles: [], transactions: [] }; }
}
async function writeStore(store: RewardsStore) {
  if (serverlessRuntime()) return;
  await mkdir(path.dirname(rewardsFile()), { recursive: true });
  await writeFile(rewardsFile(), JSON.stringify(store, null, 2), "utf8");
}

function isDemoReport(report: PollutionReport) {
  return report.id.startsWith("demo-") || Boolean((report as PollutionReport & { isDemo?: boolean }).isDemo);
}
function localityFor(report: PollutionReport) {
  const locality = report.locality?.locality_name || report.areaText || "Locality not shared";
  return locality.split(",").slice(-2).join(",").trim().slice(0, 80) || "Locality not shared";
}
function nameFor(userId: string) { return `Citizen ${userId.slice(-4).toUpperCase()}`; }
function badgesFor(profile: CitizenRewardProfile): string[] {
  const badges: string[] = [];
  if (profile.validReports >= 1) badges.push("First Report");
  if (profile.resolvedReports >= 1) badges.push("First Resolved Cleanup");
  if (profile.resolvedReports >= 5) badges.push("5 Resolved Reports", "Clean City Champion");
  if (profile.resolvedReports >= 2) badges.push("Locality Contributor");
  return badges;
}
function ranked(profiles: CitizenRewardProfile[]) {
  return [...profiles].sort((a, b) => b.totalPoints - a.totalPoints || b.resolvedReports - a.resolvedReports || a.displayName.localeCompare(b.displayName)).map((profile, index) => ({ ...profile, rank: index + 1 }));
}

export async function awardResolutionPoints(report: PollutionReport, reports: PollutionReport[], priorityBeforeResolution = report.priority): Promise<ResolutionAward | null> {
  let result: ResolutionAward | null = null;
  const next = awardQueue.then(async () => { result = await awardResolutionPointsInternal(report, reports, priorityBeforeResolution); });
  awardQueue = next.catch(() => undefined);
  await next;
  return result;
}

async function awardResolutionPointsInternal(report: PollutionReport, reports: PollutionReport[], priorityBeforeResolution: PollutionReport["priority"]): Promise<ResolutionAward | null> {
  if (isDemoReport(report) || report.status !== "Resolved" || report.evidenceStatus !== "verified" || report.trustLevel === "Rejected") return null;
  const store = await readStore();
  if (report.reward || store.transactions.some((transaction) => transaction.reportId === report.id)) return null;

  const createdAt = new Date(report.createdAt).getTime();
  const sameUserRepeat = reports.some((other) => other.id !== report.id && other.userId === report.userId && Math.abs(createdAt - new Date(other.createdAt).getTime()) < 86_400_000 && distanceMeters(report.lat, report.lng, other.lat, other.lng) <= 100);
  if (sameUserRepeat) return null;

  const nearby = reports.filter((other) => other.id !== report.id && distanceMeters(report.lat, report.lng, other.lat, other.lng) <= 500);
  const newHotspot = nearby.length === 0;
  const corroborated = nearby.some((other) => other.userId !== report.userId);
  const recurring = report.nearby.similarReportCount > 0 || nearby.length > 0;
  const highPriority = priorityBeforeResolution === "high" || priorityBeforeResolution === "severe" || report.hotspotScore >= 70;
  const parts = [
    ...(newHotspot ? ["First valid report at a new hotspot: 50"] : []),
    "Cleanup successfully resolved: 100",
    ...(highPriority ? ["High-priority hotspot resolved: 30"] : []),
    ...(corroborated ? ["Another citizen confirmed the hotspot: 20"] : []),
    ...(recurring && !newHotspot ? ["Valid recurring hotspot report: 25"] : [])
  ];
  const points = parts.reduce((sum, part) => sum + Number(part.match(/(\d+)$/)?.[1] || 0), 0);
  if (!points) return null;

  const now = new Date().toISOString();
  const transaction: RewardTransaction = { transactionId: `RWD-${report.id}-${Date.now()}`, userId: report.userId, reportId: report.id, points, reason: parts.join("; "), createdAt: now };
  const existing = store.profiles.find((profile) => profile.userId === report.userId);
  const validReports = reports.filter((item) => item.userId === report.userId && item.evidenceStatus === "verified" && !isDemoReport(item)).length;
  const resolvedReports = reports.filter((item) => item.userId === report.userId && item.status === "Resolved" && !isDemoReport(item)).length;
  const profile: CitizenRewardProfile = {
    userId: report.userId, displayName: existing?.displayName || nameFor(report.userId), locality: localityFor(report),
    totalPoints: (existing?.totalPoints || 0) + points, resolvedReports, validReports, rank: 0,
    badges: [], lastPointsAwardedAt: now
  };
  profile.badges = badgesFor(profile);
  store.profiles = ranked([...store.profiles.filter((item) => item.userId !== report.userId), profile]);
  store.transactions.push(transaction);
  await writeStore(store);
  return { transaction, profile: store.profiles.find((item) => item.userId === report.userId)! };
}

export async function getRewards(userId: string) {
  const store = await readStore();
  return store.profiles.find((profile) => profile.userId === userId) || null;
}
export async function getPointsHistory(userId: string) {
  const store = await readStore();
  return store.transactions.filter((transaction) => transaction.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getLeaderboard(options: { period?: string; locality?: string } = {}) {
  const store = await readStore();
  const monthly = options.period === "monthly";
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const monthlyTotals = new Map<string, number>();
  if (monthly) for (const transaction of store.transactions) if (new Date(transaction.createdAt) >= start) monthlyTotals.set(transaction.userId, (monthlyTotals.get(transaction.userId) || 0) + transaction.points);
  const localityFilter = options.locality?.toLowerCase();
  const profiles = store.profiles.map((profile) => monthly ? { ...profile, totalPoints: monthlyTotals.get(profile.userId) || 0 } : profile).filter((profile) => !localityFilter || profile.locality.toLowerCase() === localityFilter);
  const real = ranked(profiles).map(({ userId: _userId, ...entry }) => entry);
  const demo = localityFilter ? DEMO_LEADERBOARD.filter((entry) => entry.locality.toLowerCase() === localityFilter) : DEMO_LEADERBOARD;
  return [...demo, ...real].sort((a, b) => b.totalPoints - a.totalPoints || b.resolvedReports - a.resolvedReports).map((entry, index) => ({ ...entry, rank: index + 1 }));
}
