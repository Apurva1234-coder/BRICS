import { BadgeCheck, Database, Flag, MapPinOff, ShieldAlert, UsersRound } from "lucide-react";
import type { PollutionReport } from "../types";

function badgeClass(tone: "blue" | "green" | "yellow" | "orange" | "red" | "gray") {
  return `evidence-badge evidence-badge-${tone}`;
}

export function EvidenceBadges({ report, compact = false }: { report: PollutionReport; compact?: boolean }) {
  const badges = [
    report.trustLevel === "Verified" || report.trustLevel === "Likely Valid"
      ? { label: report.trustLevel, tone: "blue" as const, icon: BadgeCheck }
      : { label: "Needs Manual Review", tone: "gray" as const, icon: ShieldAlert },
    report.media?.length ? { label: "Stored Evidence", tone: "blue" as const, icon: Database } : undefined,
    report.authenticityFlags?.includes("duplicate_image_hash")
      ? { label: "Duplicate Suspected", tone: "orange" as const, icon: Flag }
      : undefined,
    report.authenticityFlags?.includes("possible_screenshot")
      ? { label: "Possible Screenshot", tone: "orange" as const, icon: Flag }
      : undefined,
    report.authenticityFlags?.includes("location_needs_review")
      ? { label: "Location Weak", tone: "gray" as const, icon: MapPinOff }
      : undefined,
    (report.locality?.nearby_500m_count || report.nearby.similarReportCount) > 0
      ? { label: "Community Corroborated", tone: "green" as const, icon: UsersRound }
      : undefined,
    report.evidenceScore < 60 ? { label: "Low Confidence", tone: "yellow" as const, icon: ShieldAlert } : undefined
  ].filter(Boolean);

  return (
    <div className={compact ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2"}>
      {badges.map((badge) => {
        const Icon = badge!.icon;
        return (
          <span key={badge!.label} className={badgeClass(badge!.tone)}>
            <Icon size={compact ? 12 : 14} /> {badge!.label}
          </span>
        );
      })}
    </div>
  );
}
