import { useEffect, useMemo, useState } from "react";
import { Award, Medal, Trophy } from "lucide-react";
import { apiClient, type LeaderboardEntry, type RewardProfile } from "../services/apiClient";
import { isDemoBrowserStorage } from "../services/env";

type Period = "monthly" | "all";
type Scope = "citywide" | "locality";

export function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [scope, setScope] = useState<Scope>("citywide");
  const [profile, setProfile] = useState<RewardProfile | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const userId = isDemoBrowserStorage
        ? localStorage.getItem("cleanair-user") || "anonymous"
        : await import("../services/firebase").then(async ({ ensureAnonymousSession, getCurrentUserId }) => ensureAnonymousSession().catch(() => getCurrentUserId()));
      const reward = await apiClient.getRewards(userId).catch(() => ({ profile: null }));
      const result = await apiClient.getLeaderboard({ period, locality: scope === "locality" ? reward.profile?.locality : undefined }).catch(() => ({ entries: [] }));
      if (!cancelled) { setProfile(reward.profile); setEntries(result.entries); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [period, scope]);

  const badge = useMemo(() => profile?.badges[0] || "Civic Contributor", [profile]);
  return <div className="mx-auto max-w-5xl space-y-6 pb-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="section-eyebrow">Citizen rewards</p><h1 className="mt-1 text-[28px] font-bold tracking-tight text-white">Leaderboard</h1><p className="mt-1 text-[15px] text-slate-400">Recognition for verified reports that led to approved cleanups.</p></div>
      <Trophy className="mt-1 text-amber-300" size={30} aria-hidden="true" />
    </div>
    <section className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="section-eyebrow">Your rank</p><p className="mt-2 text-3xl font-black text-[var(--accent)]">{profile ? `#${profile.rank}` : "—"}</p></div>
      <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="section-eyebrow">Civic points</p><p className="mt-2 text-3xl font-black text-white">{profile?.totalPoints ?? 0}</p></div>
      <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="section-eyebrow">Resolved cleanups</p><p className="mt-2 text-3xl font-black text-white">{profile?.resolvedReports ?? 0}</p></div>
    </section>
    <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.04] p-4"><div className="flex items-center gap-3"><Award className="text-emerald-300" size={20} /><div><p className="text-sm font-semibold text-white">{badge}</p><p className="text-xs text-slate-400">Badges are earned from verified civic impact, not uploads alone.</p></div></div>{profile?.badges.length ? <div className="mt-3 flex flex-wrap gap-2">{profile.badges.map((item) => <span key={item} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">{item}</span>)}</div> : null}</section>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Leaderboard filters">
      <button onClick={() => setPeriod("monthly")} className={`filter-chip ${period === "monthly" ? "filter-chip-active" : ""}`}>This Month</button>
      <button onClick={() => setPeriod("all")} className={`filter-chip ${period === "all" ? "filter-chip-active" : ""}`}>All Time</button>
      <button onClick={() => setScope("locality")} className={`filter-chip ${scope === "locality" ? "filter-chip-active" : ""}`}>My Locality</button>
      <button onClick={() => setScope("citywide")} className={`filter-chip ${scope === "citywide" ? "filter-chip-active" : ""}`}>Citywide</button>
    </div>
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.02]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3"><Medal size={18} className="text-amber-300" /><h2 className="font-semibold text-white">Top contributors</h2><span className="ml-auto text-xs text-slate-500">Demo entries are labelled</span></div>
      {loading ? <p className="p-6 text-sm text-slate-400">Loading leaderboard…</p> : entries.length === 0 ? <p className="p-6 text-sm text-slate-400">No eligible civic-impact rewards yet.</p> : <ol>{entries.map((entry) => <li key={`${entry.rank}-${entry.displayName}`} className="flex items-center gap-3 border-b border-white/[.06] px-4 py-3 last:border-0"><span className="w-8 text-center text-sm font-black text-amber-300">#{entry.rank}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{entry.displayName} {entry.isDemo && <span className="ml-1 rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200">Demo</span>}</p><p className="text-xs text-slate-500">{entry.locality} · {entry.resolvedReports} resolved</p></div><div className="text-right"><p className="text-sm font-bold text-[var(--accent)]">{entry.totalPoints}</p><p className="text-[10px] text-slate-500">{entry.badges[0] || "Contributor"}</p></div></li>)}</ol>}
    </section>
  </div>;
}
