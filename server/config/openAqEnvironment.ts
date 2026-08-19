import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

export interface OpenAqKeyMetadata {
  configured: boolean;
  rawLength: number;
  trimmedLength: number;
  fingerprint: string | null;
}

export interface OpenAqEnvironmentDiagnostics {
  cwd: string;
  repositoryRoot: string;
  dotenvPath: string;
  processEnvironment: OpenAqKeyMetadata;
  dotenvFile: OpenAqKeyMetadata & { exists: boolean };
  valuesMatch: boolean;
  effectiveSource: "process_environment" | "repository_dotenv" | "unavailable";
  conflictDetected: boolean;
}

function keyMetadata(value: string | undefined): OpenAqKeyMetadata {
  const trimmed = value?.trim() || "";
  return {
    configured: Boolean(trimmed),
    rawLength: value?.length || 0,
    trimmedLength: trimmed.length,
    fingerprint: trimmed
      ? crypto.createHash("sha256").update(trimmed).digest("hex").slice(0, 12)
      : null
  };
}

function repositoryDotenv(cwd: string) {
  const repositoryRoot = path.resolve(cwd);
  const dotenvPath = path.join(repositoryRoot, ".env");
  if (!fs.existsSync(dotenvPath)) {
    return { repositoryRoot, dotenvPath, exists: false, value: undefined as string | undefined };
  }
  const parsed = parse(fs.readFileSync(dotenvPath, "utf8"));
  return { repositoryRoot, dotenvPath, exists: true, value: parsed.OPENAQ_API_KEY };
}

export function inspectOpenAqEnvironment(options: { cwd?: string; processKey?: string; dotenvKey?: string } = {}): OpenAqEnvironmentDiagnostics {
  const cwd = options.cwd || process.cwd();
  const file = repositoryDotenv(cwd);
  const processKey = options.processKey === undefined ? process.env.OPENAQ_API_KEY : options.processKey;
  const dotenvKey = options.dotenvKey === undefined ? file.value : options.dotenvKey;
  const processTrimmed = processKey?.trim() || "";
  const dotenvTrimmed = dotenvKey?.trim() || "";
  const bothConfigured = Boolean(processTrimmed && dotenvTrimmed);
  const valuesMatch = bothConfigured && processTrimmed === dotenvTrimmed;
  const conflictDetected = bothConfigured && !valuesMatch;
  const effectiveSource = conflictDetected
    ? "process_environment"
    : processTrimmed && !dotenvTrimmed
      ? "process_environment"
      : dotenvTrimmed
        ? "repository_dotenv"
        : "unavailable";

  return {
    cwd,
    repositoryRoot: file.repositoryRoot,
    dotenvPath: file.dotenvPath,
    processEnvironment: keyMetadata(processKey),
    dotenvFile: { ...keyMetadata(dotenvKey), exists: file.exists },
    valuesMatch,
    effectiveSource,
    conflictDetected
  };
}

export function getEffectiveOpenAqApiKey(): string {
  const diagnostics = inspectOpenAqEnvironment();
  if (diagnostics.conflictDetected) {
    throw new Error("OPENAQ_ENV_CONFLICT");
  }
  const current = process.env.OPENAQ_API_KEY?.trim();
  if (current) return current;
  if (diagnostics.effectiveSource === "repository_dotenv") {
    const parsed = parse(fs.readFileSync(diagnostics.dotenvPath, "utf8"));
    const fromFile = parsed.OPENAQ_API_KEY?.trim();
    if (fromFile) return fromFile;
  }
  throw new Error("OPENAQ_NOT_CONFIGURED");
}
