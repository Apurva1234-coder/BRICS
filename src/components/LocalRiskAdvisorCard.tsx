import { AlertTriangle, CheckSquare, HeartPulse, ShieldCheck } from "lucide-react";
import type { LocalRiskAdvisor } from "../types";

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="risk-advisor-section">
      <p>{title}</p>
      <ul>
        {items.slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function LocalRiskAdvisorCard({
  advisor,
  officer = false
}: {
  advisor?: LocalRiskAdvisor;
  officer?: boolean;
}) {
  if (!advisor) return null;
  return (
    <section className="risk-advisor-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Risk & action advisor</span>
          <h3>{advisor.likelyCause}</h3>
          <p className="capitalize">Cause confidence: {advisor.causeConfidence}</p>
        </div>
        <ShieldCheck className="text-civic" size={22} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Section title="Possible health concerns" items={advisor.healthConcerns} />
        <Section title="Citizen safety advice" items={advisor.citizenAdvice} />
        <div className="risk-advisor-section md:col-span-2">
          <p>{officer ? "Municipal action checklist" : "Municipal actions"}</p>
          <ul>
            {advisor.municipalActions.slice(0, 5).map((item) => (
              <li key={item} className={officer ? "risk-check-item" : ""}>
                {officer && <CheckSquare size={14} />} {item}
              </li>
            ))}
          </ul>
        </div>
        <Section title="Reduction measures" items={advisor.reductionMeasures} />
        <Section title="Priority reasons" items={advisor.priorityReasons} />
      </div>
      {advisor.recurringHotspot?.isRecurring && (
        <div className="mt-3 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle size={18} />
          <span>{advisor.recurringHotspot.recommendation}</span>
        </div>
      )}
      <p className="mt-3 flex gap-2 text-xs text-slate-500">
        <HeartPulse size={14} /> {advisor.disclaimer}
      </p>
    </section>
  );
}
