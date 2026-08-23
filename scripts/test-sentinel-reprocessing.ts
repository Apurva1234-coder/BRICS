import assert from "node:assert/strict";
import { eligibleSentinelReports, pendingSentinelEvidenceForReprocess } from "../server/services/sentinelReprocessingService.js";
import type { PollutionReport } from "../server/types.js";

const base = (id: string, satelliteEvidence?: PollutionReport["satelliteEvidence"], status: PollutionReport["status"] = "Submitted") => ({ id, status, lat: 18.63, lng: 73.8, satelliteEvidence } as PollutionReport);
const failed = base("failed", { status: "failed", products: {}, error: { code: "SENTINEL_AUTH_FAILED", message: "Satellite context is temporarily unavailable." }, checkedAt: "2026-07-15T00:00:00.000Z" } as PollutionReport["satelliteEvidence"]);
const ready = base("ready", { status: "ready", products: { nearTrueColor: "/media/reports/ready/satellite/near.png" } } as PollutionReport["satelliteEvidence"]);
const resolved = base("resolved", undefined, "Resolved");
const selected = eligibleSentinelReports([failed, ready, resolved], { mode: "all-eligible", limit: 10 });
assert.deepEqual(selected.map((report) => report.id), ["failed"]);
assert.deepEqual(eligibleSentinelReports([failed, ready], { mode: "report", reportId: "ready", limit: 1 }).map((report) => report.id), ["ready"]);
const pending = pendingSentinelEvidenceForReprocess(failed)!;
assert.equal(pending.status, "pending");
assert.equal(pending.error, undefined);
assert.equal(pending.previousFailures?.[0]?.code, "SENTINEL_AUTH_FAILED");
console.log("sentinel reprocessing selection and failure audit: ok");
