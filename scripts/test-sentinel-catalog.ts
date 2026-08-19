import assert from "node:assert/strict";
process.env.ENABLE_SENTINEL_HUB_VERIFICATION = "true";
process.env.SENTINEL_HUB_CLIENT_ID = "test-client";
process.env.SENTINEL_HUB_CLIENT_SECRET = "test-secret";
let page = 0;
const requests: any[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/token")) return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 });
  requests.push(JSON.parse(String(init?.body)));
  page++;
  const feature = { id: `scene-${page}`, bbox: [73, 18, 74, 19], properties: { datetime: `2026-07-1${page}T05:00:00Z`, ...(page === 2 ? { "eo:cloud_cover": 0 } : {}) } };
  return new Response(JSON.stringify({ features: [feature], context: page === 1 ? { next: 1 } : {} }), { status: 200 });
}) as typeof fetch;
try {
  const { searchSentinel2Scenes } = await import("../server/services/sentinelHubCatalogService.js");
  const result = await searchSentinel2Scenes({ lat: 18.52, lng: 73.85, createdAt: "2026-07-10T05:00:00Z", radiusMeters: 500, maxCloudCover: 60, primaryWindowDays: 3, fallbackLookbackDays: 45 });
  assert.equal(result.scenes.length, 2);
  assert.equal(result.scenes.find(scene => scene.sceneId === "scene-2")?.cloudCover, 0);
  assert.equal(requests[1].next, 1);
  console.log("sentinel catalog pagination and cloud metadata: ok");
} finally { globalThis.fetch = originalFetch; }
