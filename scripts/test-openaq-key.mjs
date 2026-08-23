import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const repositoryRoot = path.resolve(process.cwd());
const dotenvPath = path.join(repositoryRoot, ".env");
const inheritedRaw = process.env.OPENAQ_API_KEY;
const dotenvRaw = fs.existsSync(dotenvPath)
  ? parse(fs.readFileSync(dotenvPath, "utf8")).OPENAQ_API_KEY
  : undefined;
const inheritedKey = inheritedRaw?.trim();
const dotenvKey = dotenvRaw?.trim();
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="))?.split("=")[1];

function metadata(raw) {
  const key = raw?.trim() || "";
  return {
    configured: Boolean(key),
    rawLength: raw?.length ?? 0,
    trimmedLength: key.length,
    fingerprint: key ? crypto.createHash("sha256").update(key).digest("hex").slice(0, 12) : null
  };
}

const valuesMatch = Boolean(inheritedKey && dotenvKey && inheritedKey === dotenvKey);
const conflictDetected = Boolean(inheritedKey && dotenvKey && !valuesMatch);
const effectiveKey = sourceArg === "process"
  ? inheritedKey
  : sourceArg === "dotenv"
    ? dotenvKey
    : inheritedKey || dotenvKey;
const effectiveSource = sourceArg === "process"
  ? "process_environment"
  : sourceArg === "dotenv"
    ? "repository_dotenv"
    : inheritedKey && !dotenvKey
      ? "process_environment"
      : dotenvKey
        ? "repository_dotenv"
        : "unavailable";

console.log("OpenAQ environment diagnosis:", {
  cwd: process.cwd(),
  repositoryRoot,
  dotenvPath,
  processKey: metadata(inheritedRaw),
  dotenvFile: { exists: fs.existsSync(dotenvPath), ...metadata(dotenvRaw) },
  valuesMatch,
  effectiveSource,
  conflictDetected,
  sourceArg: sourceArg || "auto"
});

if (!effectiveKey) {
  console.error("OPENAQ_API_KEY was not loaded from the selected source.");
  process.exit(1);
}
if (conflictDetected && !sourceArg) {
  console.error("OPENAQ_ENV_CONFLICT: process environment and repository .env values differ. Use --source=process or --source=dotenv for development diagnostics.");
  process.exit(1);
}

try {
  const baseUrl = (process.env.OPENAQ_BASE_URL || "https://api.openaq.org/v3").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/locations/8118`, {
    headers: { Accept: "application/json", "X-API-Key": effectiveKey }
  });
  const body = await response.text();
  console.log("OpenAQ response:", {
    status: response.status,
    statusText: response.statusText,
    rateLimit: {
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
      reset: response.headers.get("x-ratelimit-reset"),
      used: response.headers.get("x-ratelimit-used")
    },
    body: body.slice(0, 500)
  });
  process.exitCode = response.ok ? 0 : 1;
} catch (error) {
  console.error("OpenAQ request failed:", error instanceof Error ? error.message : "network error");
  process.exitCode = 1;
}
