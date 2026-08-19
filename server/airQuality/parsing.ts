export type MeasurementFreshness = "fresh" | "usable" | "stale" | "expired" | "unknown";

export interface ParsedNumber {
  status: "valid" | "missing" | "invalid";
  value?: number;
  rawValue: unknown;
  reason?: string;
}

const MISSING_TOKENS = new Set(["", "NA", "N/A", "NULL", "NONE", "-", "--", "NIL"]);

export function parseCpcbNumber(value: unknown): ParsedNumber {
  if (value === undefined || value === null) return { status: "missing", rawValue: value, reason: "missing_source_value" };
  const normalized = String(value).trim();
  if (MISSING_TOKENS.has(normalized.toUpperCase())) return { status: "missing", rawValue: value, reason: "missing_source_value" };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return { status: "invalid", rawValue: value, reason: "invalid_numeric_value" };
  return { status: "valid", value: parsed, rawValue: value };
}

export interface ParsedTimestamp {
  rawTimestamp: unknown;
  parsedAt?: string;
  timezoneAssumption?: "Asia/Kolkata" | "source_timezone";
  valid: boolean;
  ageHours?: number;
  futureTimestamp: boolean;
  reason?: string;
}

function buildIstDate(year: number, month: number, day: number, hour: number, minute: number, second: number): Date | undefined {
  if (month < 1 || month > 12 || day < 1 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return undefined;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return undefined;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - 330 * 60_000;
  return new Date(utcMs);
}

export function parseCpcbTimestamp(value: unknown, now = new Date()): ParsedTimestamp {
  if (value === undefined || value === null || !String(value).trim()) return { rawTimestamp: value, valid: false, futureTimestamp: false, reason: "missing_timestamp" };
  const raw = String(value).trim();
  let parsed: Date | undefined;
  let timezoneAssumption: ParsedTimestamp["timezoneAssumption"];
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
  let match = raw.match(ddmmyyyy);
  if (match) {
    parsed = buildIstDate(Number(match[3]), Number(match[2]), Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
    timezoneAssumption = "Asia/Kolkata";
  } else {
    match = raw.match(yyyymmdd);
    if (match) {
      parsed = buildIstDate(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
      timezoneAssumption = "Asia/Kolkata";
    } else {
      const iso = new Date(raw);
      if (Number.isFinite(iso.getTime())) {
        parsed = iso;
        timezoneAssumption = /Z|[+-]\d{2}:?\d{2}$/.test(raw) ? "source_timezone" : undefined;
      }
    }
  }
  if (!parsed || !Number.isFinite(parsed.getTime())) return { rawTimestamp: value, valid: false, futureTimestamp: false, reason: "invalid_timestamp" };
  const ageHours = (now.getTime() - parsed.getTime()) / 3_600_000;
  const futureTimestamp = ageHours < -0.25;
  if (futureTimestamp) return { rawTimestamp: value, parsedAt: parsed.toISOString(), timezoneAssumption, valid: false, ageHours, futureTimestamp, reason: "future_timestamp" };
  return { rawTimestamp: value, parsedAt: parsed.toISOString(), timezoneAssumption, valid: true, ageHours, futureTimestamp };
}

export function freshnessFromAge(ageHours?: number): MeasurementFreshness {
  if (!Number.isFinite(ageHours)) return "unknown";
  if (ageHours! <= 3) return "fresh";
  if (ageHours! <= 12) return "usable";
  if (ageHours! <= 24) return "stale";
  return "expired";
}
