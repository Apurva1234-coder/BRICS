import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "aqua"
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "aqua" | "civic" | "warning" | "severe";
}) {
  const toneClass = {
    aqua: "text-aqua bg-aqua/10 border-aqua/30",
    civic: "text-civic bg-civic/10 border-civic/30",
    warning: "text-warning bg-warning/10 border-warning/30",
    severe: "text-severe bg-severe/10 border-severe/30"
  }[tone];
  return (
    <div className="panel flex items-center gap-4">
      <span className={`grid h-12 w-12 place-items-center rounded-lg border ${toneClass}`}>
        <Icon size={22} />
      </span>
      <span>
        <span className="block text-2xl font-semibold text-white">{value}</span>
        <span className="text-sm text-slate-400">{label}</span>
      </span>
    </div>
  );
}
