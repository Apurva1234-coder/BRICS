import crypto from "node:crypto";
import { getEffectiveOpenAqApiKey, inspectOpenAqEnvironment, type OpenAqEnvironmentDiagnostics } from "../config/openAqEnvironment.js";

export type OpenAqErrorCode =
  | "OPENAQ_NOT_CONFIGURED"
  | "OPENAQ_ENV_CONFLICT"
  | "OPENAQ_UNAUTHORIZED"
  | "OPENAQ_FORBIDDEN"
  | "OPENAQ_INVALID_REQUEST"
  | "OPENAQ_RATE_LIMITED"
  | "OPENAQ_TIMEOUT"
  | "OPENAQ_NETWORK_ERROR"
  | "OPENAQ_SERVER_ERROR"
  | "OPENAQ_INVALID_RESPONSE";

const messages: Record<OpenAqErrorCode, string> = {
  OPENAQ_NOT_CONFIGURED: "OPENAQ_API_KEY is not configured.",
  OPENAQ_ENV_CONFLICT: "OPENAQ_API_KEY from the inherited process environment differs from the repository .env value.",
  OPENAQ_UNAUTHORIZED: "OpenAQ rejected the configured API key.",
  OPENAQ_FORBIDDEN: "The OpenAQ key is valid but is not permitted to access this resource.",
  OPENAQ_INVALID_REQUEST: "OpenAQ rejected the request parameters.",
  OPENAQ_RATE_LIMITED: "OpenAQ rate limit reached. Try again later.",
  OPENAQ_TIMEOUT: "The OpenAQ request timed out.",
  OPENAQ_NETWORK_ERROR: "The OpenAQ request could not reach the provider.",
  OPENAQ_SERVER_ERROR: "OpenAQ is temporarily unavailable.",
  OPENAQ_INVALID_RESPONSE: "OpenAQ returned an invalid response."
};

export class OpenAqError extends Error {
  constructor(public readonly code: OpenAqErrorCode, message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "OpenAqError";
  }
}

let lastSuccessfulRequestAt: string | undefined;
let lastStatus: { code?: OpenAqErrorCode; statusCode?: number; message?: string } = {};
let rateLimits: Record<string, string> = {};
let checkPromise: Promise<OpenAqCheckResult> | undefined;
let checkExpiresAt = 0;
let checkCacheKey = "";

export function getOpenAqRateLimits(): Record<string, string> {
  return { ...rateLimits };
}

export interface OpenAqCheckResult {
  authenticationChecked: boolean;
  authenticationSuccessful: boolean;
  statusCode?: number;
  errorCode?: OpenAqErrorCode;
  message: string;
  lastSuccessfulRequestAt?: string;
}

export interface OpenAqStatus {
  configured: boolean;
  baseUrl: string;
  keyLength: number;
  keyFingerprint: string | null;
  authenticationChecked: boolean;
  authenticationSuccessful: boolean;
  statusCode?: number;
  errorCode?: OpenAqErrorCode;
  message: string;
  lastSuccessfulRequestAt?: string;
  environment: OpenAqEnvironmentDiagnostics;
  rateLimits?: Record<string, string>;
}

export function getOpenAqApiKey(): string {
  try {
    return getEffectiveOpenAqApiKey();
  } catch (error) {
    const code = error instanceof Error && error.message === "OPENAQ_ENV_CONFLICT"
      ? "OPENAQ_ENV_CONFLICT"
      : "OPENAQ_NOT_CONFIGURED";
    throw new OpenAqError(code, messages[code]);
  }
}

export function getOpenAqBaseUrl(): string {
  return (process.env.OPENAQ_BASE_URL || "https://api.openaq.org/v3").replace(/\/+$/, "");
}

export function openAqKeyFingerprint(key = process.env.OPENAQ_API_KEY?.trim()): string | null {
  return key ? crypto.createHash("sha256").update(key).digest("hex").slice(0, 12) : null;
}

export function buildOpenAqRequest(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
      "X-API-Key": getOpenAqApiKey()
    }
  };
}

export function classifyOpenAqStatus(status: number): OpenAqError {
  if (status === 401) return new OpenAqError("OPENAQ_UNAUTHORIZED", messages.OPENAQ_UNAUTHORIZED, status);
  if (status === 403) return new OpenAqError("OPENAQ_FORBIDDEN", messages.OPENAQ_FORBIDDEN, status);
  if (status === 422) return new OpenAqError("OPENAQ_INVALID_REQUEST", messages.OPENAQ_INVALID_REQUEST, status);
  if (status === 429) return new OpenAqError("OPENAQ_RATE_LIMITED", messages.OPENAQ_RATE_LIMITED, status);
  if (status === 408) return new OpenAqError("OPENAQ_TIMEOUT", messages.OPENAQ_TIMEOUT, status);
  if (status >= 500) return new OpenAqError("OPENAQ_SERVER_ERROR", messages.OPENAQ_SERVER_ERROR, status);
  return new OpenAqError("OPENAQ_INVALID_RESPONSE", messages.OPENAQ_INVALID_RESPONSE, status);
}

function saveRateLimits(response: Response) {
  const safeHeaders = ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "x-ratelimit-used"];
  rateLimits = Object.fromEntries(safeHeaders.flatMap((header) => {
    const value = response.headers.get(header);
    return value === null ? [] : [[header, value]];
  }));
}

export async function fetchOpenAq(pathname: string, init: RequestInit = {}): Promise<Response> {
  const url = `${getOpenAqBaseUrl()}/${pathname.replace(/^\/+/, "")}`;
  let response: Response;
  try {
    response = await fetch(url, buildOpenAqRequest({ ...init, signal: init.signal || AbortSignal.timeout(12_000) }));
  } catch (error) {
    if (error instanceof OpenAqError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") throw new OpenAqError("OPENAQ_TIMEOUT", messages.OPENAQ_TIMEOUT);
    throw new OpenAqError("OPENAQ_NETWORK_ERROR", messages.OPENAQ_NETWORK_ERROR);
  }
  if (!response.ok) {
    const mapped = classifyOpenAqStatus(response.status);
    lastStatus = { code: mapped.code, statusCode: mapped.statusCode, message: mapped.message };
    throw mapped;
  }
  saveRateLimits(response);
  lastSuccessfulRequestAt = new Date().toISOString();
  lastStatus = {};
  return response;
}

export async function checkOpenAqAuthentication(force = false): Promise<OpenAqCheckResult> {
  const key = process.env.OPENAQ_API_KEY?.trim();
  const currentCacheKey = `${getOpenAqBaseUrl()}:${openAqKeyFingerprint(key) || "none"}`;
  if (currentCacheKey !== checkCacheKey) {
    checkPromise = undefined;
    checkExpiresAt = 0;
    checkCacheKey = currentCacheKey;
  }
  if (!force && checkPromise && checkExpiresAt > Date.now()) return checkPromise;
  const environment = inspectOpenAqEnvironment();
  if (environment.conflictDetected) {
    lastStatus = { code: "OPENAQ_ENV_CONFLICT", message: messages.OPENAQ_ENV_CONFLICT };
    return { authenticationChecked: false, authenticationSuccessful: false, errorCode: "OPENAQ_ENV_CONFLICT", message: messages.OPENAQ_ENV_CONFLICT, lastSuccessfulRequestAt };
  }
  checkPromise = (async () => {
    try {
      await fetchOpenAq("locations/8118");
      return { authenticationChecked: true, authenticationSuccessful: true, statusCode: 200, message: "OpenAQ accepted the configured API key.", lastSuccessfulRequestAt };
    } catch (error) {
      const openAqError = error instanceof OpenAqError ? error : new OpenAqError("OPENAQ_NETWORK_ERROR", messages.OPENAQ_NETWORK_ERROR);
      return { authenticationChecked: true, authenticationSuccessful: false, statusCode: openAqError.statusCode, errorCode: openAqError.code, message: openAqError.message, lastSuccessfulRequestAt };
    }
  })();
  checkExpiresAt = Date.now() + 30_000;
  return checkPromise;
}

export async function getOpenAqStatus(check = false): Promise<OpenAqStatus> {
  const environment = inspectOpenAqEnvironment();
  const key = process.env.OPENAQ_API_KEY?.trim();
  const result = check
    ? await checkOpenAqAuthentication(true)
    : {
        authenticationChecked: Boolean(lastStatus.code || lastSuccessfulRequestAt),
        authenticationSuccessful: Boolean(lastSuccessfulRequestAt && !lastStatus.code),
        statusCode: lastStatus.statusCode,
        errorCode: lastStatus.code,
        message: lastStatus.message || (environment.conflictDetected ? messages.OPENAQ_ENV_CONFLICT : key ? "OpenAQ authentication has not been checked." : messages.OPENAQ_NOT_CONFIGURED),
        lastSuccessfulRequestAt
      };
  return { configured: environment.processEnvironment.configured || environment.dotenvFile.configured, baseUrl: getOpenAqBaseUrl(), keyLength: key?.length || environment.dotenvFile.trimmedLength, keyFingerprint: openAqKeyFingerprint(key || undefined), ...result, environment, rateLimits: Object.keys(rateLimits).length ? rateLimits : undefined };
}
