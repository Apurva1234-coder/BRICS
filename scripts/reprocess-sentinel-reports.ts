import "dotenv/config";
import { listReports, updateReport } from "../server/services/reportStore.js";
import { enqueueSatelliteVerification } from "../server/services/satelliteVerificationQueue.js";
import { eligibleSentinelReports, pendingSentinelEvidenceForReprocess, type SentinelReprocessMode } from "../server/services/sentinelReprocessingService.js";

type Options = { mode: SentinelReprocessMode; reportId?: string; dryRun: boolean; limit: number; includeResolved: boolean };

function parseOptions(argv: string[]): Options {
  let mode: SentinelReprocessMode = "missing";
  let reportId: string | undefined;
  let dryRun = true;
  let limit = 20;
  let includeResolved = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--report-id") { reportId = argv[index + 1]; mode = "report"; index += 1; }
    else if (argument === "--failed") mode = "failed";
    else if (argument === "--pending") mode = "pending";
    else if (argument === "--missing") mode = "missing";
    else if (argument === "--all-eligible") mode = "all-eligible";
    else if (argument === "--confirm") dryRun = false;
    else if (argument === "--dry-run") dryRun = true;
    else if (argument === "--include-resolved") includeResolved = true;
    else if (argument === "--limit") { limit = Number(argv[index + 1]); index += 1; }
  }
  return { mode, reportId, dryRun, limit: Number.isFinite(limit) ? limit : 20, includeResolved };
}

const options = parseOptions(process.argv.slice(2));
const candidates = eligibleSentinelReports(await listReports(), options);
let queued = 0;
if (!options.dryRun) {
  for (const report of candidates) {
    const pending = pendingSentinelEvidenceForReprocess(report);
    if (pending) await updateReport(report.id, { satelliteEvidence: pending });
    await enqueueSatelliteVerification(report.id, report.updatedAt);
    queued += 1;
  }
}
console.log(JSON.stringify({ mode: options.mode, dryRun: options.dryRun, selected: candidates.length, queued, reportIds: candidates.map((report) => report.id) }, null, 2));
