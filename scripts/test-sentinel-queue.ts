import assert from "node:assert/strict";
process.env.ENABLE_SENTINEL_HUB_VERIFICATION = "false"; process.env.SENTINEL_HUB_MAX_ATTEMPTS = "1";
const { enqueueSatelliteVerification, SatelliteQueueUnavailableError } = await import("../server/services/satelliteVerificationQueue.js");
await assert.rejects(
  () => enqueueSatelliteVerification("disabled-test-report", "revision-1"),
  (error: unknown) => error instanceof SatelliteQueueUnavailableError && error.status === "disabled"
);
console.log("sentinel queue readiness gate: ok");
