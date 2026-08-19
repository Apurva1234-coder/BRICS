import assert from "node:assert/strict";
process.env.ENABLE_SENTINEL_HUB_VERIFICATION = "true"; process.env.SENTINEL_HUB_PROVIDER = "cdse"; process.env.SENTINEL_HUB_CLIENT_ID = "test-client"; process.env.SENTINEL_HUB_CLIENT_SECRET = "test-secret";
let processBody: any;
const originalFetch = globalThis.fetch;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(80)]);
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("/token")) return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 });
  assert.match(String(input), /sh\.dataspace\.copernicus\.eu\/api\/v1\/process/);
  processBody = JSON.parse(String(init?.body)); return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
}) as typeof fetch;
try {
  const { getSentinel2NBRChip, getSentinel2TrueColorChip, narrowProcessingWindow } = await import("../server/services/sentinelHubProcessService.js");
  const { resetSentinelHubClientForTests, SentinelProviderError } = await import("../server/services/sentinelHubClient.js");
  const window = narrowProcessingWindow("2026-07-10T05:00:00Z");
  assert.ok(Date.parse(window.toTime) - Date.parse(window.fromTime) < 50 * 60000);
  await getSentinel2NBRChip({ bbox: [73, 18, 74, 19], ...window, maxCloudCoverage: 60 });
  assert.equal(processBody.input.data[0].type, "sentinel-2-l2a");
  assert.notEqual(processBody.input.data[0].dataFilter.mosaickingOrder, "leastCC");
  assert.match(processBody.evalscript, /B08 - sample\.B12/);
  resetSentinelHubClientForTests();
  globalThis.fetch = (async (input: RequestInfo | URL) => String(input).includes("/token")
    ? new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 })
    : new Response("<html>not an image</html>", { status: 200, headers: { "content-type": "text/html" } })) as typeof fetch;
  await assert.rejects(() => getSentinel2TrueColorChip({ bbox: [73, 18, 74, 19], ...window, maxCloudCoverage: 60 }), (error: unknown) => error instanceof SentinelProviderError && error.code === "SENTINEL_INVALID_RESPONSE");
  resetSentinelHubClientForTests();
  globalThis.fetch = (async (input: RequestInfo | URL) => String(input).includes("/token")
    ? new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 })
    : new Response(JSON.stringify({ error: "not an image" }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  await assert.rejects(() => getSentinel2TrueColorChip({ bbox: [73, 18, 74, 19], ...window, maxCloudCoverage: 60 }), (error: unknown) => error instanceof SentinelProviderError && error.code === "SENTINEL_INVALID_RESPONSE");
  resetSentinelHubClientForTests();
  const multipart = Buffer.concat([Buffer.from("--sentinel-boundary\r\nContent-Type: image/png\r\n\r\n", "latin1"), png, Buffer.from("\r\n--sentinel-boundary--\r\n", "latin1")]);
  globalThis.fetch = (async (input: RequestInfo | URL) => String(input).includes("/token")
    ? new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 })
    : new Response(multipart, { status: 200, headers: { "content-type": "multipart/mixed; boundary=sentinel-boundary" } })) as typeof fetch;
  const multipartProduct = await getSentinel2TrueColorChip({ bbox: [73, 18, 74, 19], ...window, maxCloudCoverage: 60 });
  assert.deepEqual(multipartProduct.buffer, png, "multipart Process responses must yield the image part");  console.log("sentinel narrow processing and NBR evalscript: ok");
} finally { globalThis.fetch = originalFetch; }
