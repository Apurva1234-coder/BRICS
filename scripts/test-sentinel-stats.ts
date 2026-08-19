import assert from "node:assert/strict";
process.env.ENABLE_SENTINEL_HUB_VERIFICATION = "true"; process.env.SENTINEL_HUB_CLIENT_ID = "test-client"; process.env.SENTINEL_HUB_CLIENT_SECRET = "test-secret";
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  if (String(input).includes("/token")) return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 });
  return new Response(JSON.stringify({ data: [{ outputs: { observability: { bands: { B0: { stats: { sampleCount: 100, mean: 1 } }, B1: { stats: { sampleCount: 100, mean: 0 } }, B2: { stats: { sampleCount: 100, mean: 1 } } } }, spectral: { bands: { B0: { stats: { mean: 0.2 } }, B1: { stats: { mean: 0.1 } } } } } }] }), { status: 200 });
}) as typeof fetch;
try {
  const { getSentinel2VerificationStats } = await import("../server/services/sentinelHubStatsService.js");
  const result = await getSentinel2VerificationStats({ bbox: [73, 18, 74, 19], fromTime: "2026-07-10T05:00:00Z", toTime: "2026-07-10T05:05:00Z", maxCloudCoverage: 60 });
  assert.equal(result.localCloudPercent, 0); assert.equal(result.validAnalysisPixelPercent, 100); assert.ok(result.metrics.some(metric => metric.name === "nbr"));
  console.log("sentinel statistics masks and zero preservation: ok");
} finally { globalThis.fetch = originalFetch; }
