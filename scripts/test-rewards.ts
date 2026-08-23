import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PollutionReport } from "../server/types.js";
import { awardResolutionPoints, getPointsHistory, getRewards } from "../server/services/rewardsService.js";

const originalCwd = process.cwd();
const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cleanair-rewards-"));
process.chdir(tempDirectory);

function resolvedReport(id: string): PollutionReport {
  return {
    id, createdAt: "2026-07-16T10:00:00.000Z", updatedAt: "2026-07-16T10:00:00.000Z", userId: "citizen-1",
    status: "Resolved", lat: 18.5204, lng: 73.8567, areaText: "Pune", media: [], evidenceStatus: "verified",
    authenticityScore: 90, authenticityFlags: [], evidenceScore: 90, trustLevel: "Verified", evidenceReasons: [], actionLog: [],
    imageHash: `hash-${id}`, userDescription: "Visible waste", gemini: {} as PollutionReport["gemini"], airQuality: {} as PollutionReport["airQuality"],
    nearby: { similarReportCount: 0, nearbyReportIds: [] }, hotspotScore: 10, priority: "resolved"
  };
}

try {
  const report = resolvedReport("reward-high-priority");
  const [first, second] = await Promise.all([
    awardResolutionPoints(report, [report], "high"),
    awardResolutionPoints(report, [report], "high")
  ]);
  assert.ok(first || second, "one award should be created");
  assert.equal((first || second)!.transaction.points, 180, "new high-priority cleanup earns 50 + 100 + 30 points");
  assert.equal((await getPointsHistory("citizen-1")).length, 1, "duplicate concurrent approvals must create one transaction");
  assert.equal((await getRewards("citizen-1"))?.totalPoints, 180);

  const demo = { ...resolvedReport("demo-reward"), userId: "demo-citizen" };
  assert.equal(await awardResolutionPoints(demo, [demo], "high"), null, "demo reports never receive points");
  console.log("rewards: high-priority calculation, one-time award, and demo exclusion: ok");
} finally {
  process.chdir(originalCwd);
  await rm(tempDirectory, { recursive: true, force: true });
}
