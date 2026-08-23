import assert from "node:assert/strict";
import { getSentinelConfig } from "../server/config/sentinelConfig.js";
import {
  getSentinelHubAccessToken,
  getSentinelHubAuthStatus,
  getSentinelVerificationReadiness,
  resetSentinelHubClientForTests,
  SentinelProviderError
} from "../server/services/sentinelHubClient.js";
import { enqueueSatelliteVerification, SatelliteQueueUnavailableError } from "../server/services/satelliteVerificationQueue.js";
import { verifyReportObjectWithSatellite } from "../server/services/satelliteVerificationService.js";
import type { PollutionReport } from "../server/types.js";

const keys = [
  "ENABLE_SENTINEL_HUB_VERIFICATION", "SENTINEL_HUB_PROVIDER", "SENTINEL_HUB_BASE_URL", "SENTINEL_HUB_TOKEN_URL",
  "SENTINEL_HUB_CLIENT_ID", "SENTINEL_HUB_CLIENT_SECRET", "SENTINEL_HUB_MAX_ATTEMPTS", "SENTINEL_HUB_AUTH_FAILURE_COOLDOWN_MINUTES"
] as const;
const originalEnvironment = new Map(keys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function setEnvironment(values: Partial<Record<(typeof keys)[number], string | undefined>>) {
  for (const key of keys) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetSentinelHubClientForTests();
}

function configured(provider: "cdse" | "commercial" = "cdse", extra: Partial<Record<(typeof keys)[number], string | undefined>> = {}) {
  setEnvironment({
    ENABLE_SENTINEL_HUB_VERIFICATION: "true",
    SENTINEL_HUB_PROVIDER: provider,
    SENTINEL_HUB_CLIENT_ID: "test-client",
    SENTINEL_HUB_CLIENT_SECRET: "test-secret",
    SENTINEL_HUB_MAX_ATTEMPTS: "2",
    SENTINEL_HUB_AUTH_FAILURE_COOLDOWN_MINUTES: "15",
    ...extra
  });
}

function mockFetch(handlers: Array<(input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response> | never>) {
  let calls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const handler = handlers[Math.min(calls, handlers.length - 1)];
    calls += 1;
    return handler(input, init);
  }) as typeof fetch;
  return () => calls;
}

async function expectSentinelError(work: () => Promise<unknown>, code: string) {
  await assert.rejects(work, (error: unknown) => error instanceof SentinelProviderError && error.code === code);
}

try {
  let calls = () => 0;
  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "true", SENTINEL_HUB_PROVIDER: "cdse", SENTINEL_HUB_CLIENT_ID: "id", SENTINEL_HUB_CLIENT_SECRET: "secret" });
  let config = getSentinelConfig();
  assert.equal(config.baseUrl, "https://sh.dataspace.copernicus.eu");
  assert.equal(config.tokenUrl, "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token");

  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "true", SENTINEL_HUB_PROVIDER: "commercial", SENTINEL_HUB_CLIENT_ID: "id", SENTINEL_HUB_CLIENT_SECRET: "secret" });
  config = getSentinelConfig();
  assert.equal(config.baseUrl, "https://services.sentinel-hub.com");
  assert.equal(config.tokenUrl, "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token");

  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "true", SENTINEL_HUB_PROVIDER: "custom", SENTINEL_HUB_CLIENT_ID: "id", SENTINEL_HUB_CLIENT_SECRET: "secret" });
  assert.equal(getSentinelConfig().credentialState, "invalid_configuration");
  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "true", SENTINEL_HUB_PROVIDER: "custom", SENTINEL_HUB_BASE_URL: "https://sentinel.example.test", SENTINEL_HUB_TOKEN_URL: "https://identity.example.test/token", SENTINEL_HUB_CLIENT_ID: "id", SENTINEL_HUB_CLIENT_SECRET: "secret" });
  assert.equal(getSentinelConfig().credentialState, "configured");
  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "true", SENTINEL_HUB_PROVIDER: "cdse", SENTINEL_HUB_BASE_URL: "https://sh.dataspace.copernicus.eu", SENTINEL_HUB_TOKEN_URL: "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token", SENTINEL_HUB_CLIENT_ID: "id", SENTINEL_HUB_CLIENT_SECRET: "secret" });
  assert.equal(getSentinelConfig().credentialState, "invalid_configuration");
  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "true", SENTINEL_HUB_PROVIDER: "cdse", SENTINEL_HUB_CLIENT_ID: "YOUR_CLIENT", SENTINEL_HUB_CLIENT_SECRET: "secret" });
  assert.equal(getSentinelConfig().credentialState, "placeholder_credentials");
  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "true", SENTINEL_HUB_PROVIDER: "cdse" });
  assert.equal(getSentinelConfig().credentialState, "missing_credentials");
  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "false", SENTINEL_HUB_PROVIDER: "cdse" });
  assert.equal(getSentinelConfig().credentialState, "disabled");
  calls = mockFetch([() => { throw new Error("disabled integration must not fetch"); }]);
  await expectSentinelError(() => getSentinelHubAccessToken(), "SENTINEL_DISABLED");
  assert.equal(calls(), 0, "disabled integration must not authenticate");

  configured();
  let requestBody = "";
  let requestContentType = "";
  calls = mockFetch([(_input, init) => {
    requestBody = String(init?.body || "");
    requestContentType = new Headers(init?.headers).get("content-type") || "";
    return new Response(JSON.stringify({ access_token: "token-one", expires_in: 3600 }), { status: 200 });
  }]);
  assert.equal(await getSentinelHubAccessToken(), "token-one");
  assert.equal(await getSentinelHubAccessToken(), "token-one");
  assert.equal(calls(), 1, "successful token must be cached");
  assert.equal(requestContentType, "application/x-www-form-urlencoded");
  assert.equal(requestBody.includes("grant_type=client_credentials"), true);
  assert.equal(requestBody.includes("client_id=test-client"), true);
  assert.equal(requestBody.includes("client_secret=test-secret"), true);

  configured();
  calls = mockFetch([
    () => new Response(JSON.stringify({ access_token: "token-short", expires_in: 60 }), { status: 200 }),
    () => new Response(JSON.stringify({ access_token: "token-refreshed", expires_in: 3600 }), { status: 200 })
  ]);
  assert.equal(await getSentinelHubAccessToken(), "token-short");
  assert.equal(await getSentinelHubAccessToken(), "token-refreshed");
  assert.equal(calls(), 2, "near-expiry token must be refreshed");

  configured();
  calls = mockFetch([() => new Response("denied", { status: 401 })]);
  await expectSentinelError(() => getSentinelHubAccessToken(), "SENTINEL_AUTH_FAILED");
  await expectSentinelError(() => getSentinelHubAccessToken(), "SENTINEL_AUTH_FAILED");
  assert.equal(calls(), 1, "401 must activate cooldown instead of retrying");
  await expectSentinelError(() => getSentinelHubAccessToken(true), "SENTINEL_AUTH_FAILED");
  assert.equal(calls(), 2, "forced checks may bypass cooldown");
  assert.equal(getSentinelVerificationReadiness().ready, false);
  mockFetch([() => new Response(JSON.stringify({ access_token: "recovered", expires_in: 3600 }), { status: 200 })]);
  assert.equal(await getSentinelHubAccessToken(true), "recovered");
  assert.equal(getSentinelVerificationReadiness().ready, true, "successful auth must clear the failure cooldown");

  configured();
  mockFetch([() => new Response("forbidden", { status: 403 })]);
  await expectSentinelError(() => getSentinelHubAccessToken(), "SENTINEL_FORBIDDEN");

  configured();
  calls = mockFetch([() => new Response("slow", { status: 429, headers: { "retry-after": "0" } }), () => new Response(JSON.stringify({ access_token: "rate-ok", expires_in: 3600 }), { status: 200 })]);
  assert.equal(await getSentinelHubAccessToken(), "rate-ok");
  assert.equal(calls(), 2, "429 must use a bounded retry");

  configured();
  calls = mockFetch([() => new Response("upstream", { status: 500 }), () => new Response(JSON.stringify({ access_token: "provider-ok", expires_in: 3600 }), { status: 200 })]);
  assert.equal(await getSentinelHubAccessToken(), "provider-ok");
  assert.equal(calls(), 2, "5xx must use a bounded retry");

  configured();
  mockFetch([() => { const error = new Error("AbortError"); error.name = "AbortError"; throw error; }]);
  await expectSentinelError(() => getSentinelHubAccessToken(), "SENTINEL_TIMEOUT");
  configured();
  mockFetch([() => { throw new TypeError("fetch failed"); }]);
  await expectSentinelError(() => getSentinelHubAccessToken(), "SENTINEL_NETWORK_ERROR");
  assert.equal(getSentinelVerificationReadiness().ready, true, "network failures must not poison authentication readiness");

  configured();
  mockFetch([() => new Response(JSON.stringify({ expires_in: 3600 }), { status: 200 })]);
  await expectSentinelError(() => getSentinelHubAccessToken(), "SENTINEL_INVALID_RESPONSE");

  configured();
  mockFetch([() => new Response("denied", { status: 401 })]);
  let safeError = "";
  try { await getSentinelHubAccessToken(); } catch (error) { safeError = error instanceof Error ? error.message : String(error); }
  assert.equal(safeError.includes("test-secret"), false);
  assert.equal(safeError.includes("token-one"), false);
  const status = await getSentinelHubAuthStatus();
  assert.equal(status.authenticationErrorCode, "SENTINEL_AUTH_FAILED");
  assert.equal(status.cooldownActive, true);

  setEnvironment({ ENABLE_SENTINEL_HUB_VERIFICATION: "true", SENTINEL_HUB_PROVIDER: "custom", SENTINEL_HUB_CLIENT_ID: "id", SENTINEL_HUB_CLIENT_SECRET: "secret" });
  await assert.rejects(() => enqueueSatelliteVerification("invalid-config-report"), (error: unknown) => error instanceof SatelliteQueueUnavailableError && error.status === "invalid_configuration");
  configured();
  mockFetch([() => new Response("denied", { status: 401 })]);
  await expectSentinelError(() => getSentinelHubAccessToken(), "SENTINEL_AUTH_FAILED");
  await assert.rejects(() => enqueueSatelliteVerification("cooldown-report"), (error: unknown) => error instanceof SatelliteQueueUnavailableError && error.status === "authentication_failed");

  configured();
  mockFetch([() => { throw new TypeError("fetch failed"); }]);
  const report = {
    id: "network-usable-report",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lat: 18.5204,
    lng: 73.8567,
    media: [],
    gemini: { pollution_type: "garbage_burning" }
  } as PollutionReport;
  const networkResult = await verifyReportObjectWithSatellite(report, { persist: false });
  assert.equal(networkResult.retryable, true, "network failure remains retryable");
  assert.equal(networkResult.evidence?.evidenceContributionPoints, 0, "unavailable Sentinel context contributes zero points");
  assert.equal(networkResult.evidence?.status, "failed", "network failure leaves the report usable rather than invalidating it");

  console.log("Sentinel provider configuration and authentication tests passed.");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    const value = originalEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetSentinelHubClientForTests();
}
