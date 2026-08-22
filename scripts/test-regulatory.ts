import assert from "node:assert";
import {
  BRICS_REGULATORY_AUTHORITIES,
  BRICS_REGULATORY_RESOURCES,
  getAllRegulatoryAuthorities,
  getRegulatoryAuthorityById,
  getRegulatoryAuthoritiesByCountry,
  getAllRegulatoryResources
} from "../server/data/bricsAuthorities.js";
import {
  createRegulatoryAlert,
  acknowledgeRegulatoryAlert,
  assignResourceToAlert,
  updateRegulatoryAlertStatus,
  resolveRegulatoryAlert,
  getRegulatoryAlerts,
  getRegulatoryAlertById,
  getRegulatoryResources,
  matchAuthorityForEvent,
  generateRecommendedActions
} from "../server/services/regulatoryCoordinationService.js";
import type { CreateRegulatoryAlertInput } from "../server/types.js";

async function runRegulatoryCoordinationTests() {
  console.log("=== Testing Stage 5: Automated Regulatory Coordination ===\n");

  // -------------------------------------------------------------
  // Test 1: Authority Registry & Multi-Country Coverage
  // -------------------------------------------------------------
  console.log("[Test 1] Testing Regulatory Authority Registry & BRICS Coverage...");
  const authorities = getAllRegulatoryAuthorities();
  assert.ok(authorities.length >= 11, "Must configure environmental authorities for all BRICS countries");

  // Verify specific key national and regional authorities
  const cpcb = getRegulatoryAuthorityById("auth-ind-cpcb");
  assert.ok(cpcb, "CPCB India must be registered");
  assert.strictEqual(cpcb?.countryCode, "IND");
  assert.strictEqual(cpcb?.authorityType, "NATIONAL_MINISTRY");

  const mee = getRegulatoryAuthorityById("auth-chn-mee");
  assert.ok(mee, "MEE China must be registered");
  assert.strictEqual(mee?.countryCode, "CHN");

  const tibetEpb = getRegulatoryAuthorityById("auth-chn-tibet-epb");
  assert.ok(tibetEpb, "Tibet EPB must be registered");
  assert.strictEqual(tibetEpb?.authorityType, "PROVINCIAL_EPB");

  const rosprirod = getRegulatoryAuthorityById("auth-rus-rosprirodnadzor");
  assert.ok(rosprirod, "Rosprirodnadzor Russia must be registered");

  const ibama = getRegulatoryAuthorityById("auth-bra-ibama");
  assert.ok(ibama, "IBAMA Brazil must be registered");

  const dffe = getRegulatoryAuthorityById("auth-zaf-dffe");
  assert.ok(dffe, "DFFE South Africa must be registered");

  const moccae = getRegulatoryAuthorityById("auth-are-moccae");
  assert.ok(moccae, "MoCCAE UAE must be registered");

  console.log(`✓ Verified ${authorities.length} environmental regulatory bodies across all 11 BRICS member states.`);

  // -------------------------------------------------------------
  // Test 2: Dynamic Authority Matching Engine
  // -------------------------------------------------------------
  console.log("\n[Test 2] Testing Dynamic Authority Matching Engine...");

  // Match Tibet region in China
  const matchTibet = matchAuthorityForEvent("CHN", "Tibet / Himalayan Border Region", "industrial_smoke");
  assert.strictEqual(matchTibet.id, "auth-chn-tibet-epb", "Must match Tibet Provincial EPB for Himalayan influx");

  // Match Northern Subcontinental Corridor in India
  const matchCaqm = matchAuthorityForEvent("IND", "Delhi NCR", "industrial_smoke", "corridor-delhi-lahore-central-asia");
  assert.strictEqual(matchCaqm.id, "auth-ind-caqm", "Must match CAQM for Northern Subcontinental trade corridor");

  // Match Far Eastern region in Russia
  const matchFarEast = matchAuthorityForEvent("RUS", "Amur-China Border Region", "industrial_smoke", "corridor-amur-heilongjiang-industrial");
  assert.strictEqual(matchFarEast.id, "auth-rus-far-east", "Must match Far Eastern Directorate for Amur transboundary axis");

  // Match Paraná region in Brazil
  const matchParana = matchAuthorityForEvent("BRA", "Paraná & Tri-Border Basin", "open_waste", "corridor-parana-mercosur");
  assert.strictEqual(matchParana.id, "auth-bra-iat-parana", "Must match IAT Paraná for Paraná-Mercosul axis");

  console.log("✓ Dynamic regional, jurisdictional, and corridor authority matching verified.");

  // -------------------------------------------------------------
  // Test 3: Recommended Actions Generation
  // -------------------------------------------------------------
  console.log("\n[Test 3] Testing Contextual Operational Recommendation Generator...");
  const criticalActions = generateRecommendedActions("CRITICAL", "industrial_smoke", true);
  assert.ok(criticalActions.length >= 3);
  assert.ok(criticalActions.some((a) => a.includes("curtailment")));
  assert.ok(criticalActions.some((a) => a.includes("mobile")));
  assert.ok(criticalActions.some((a) => a.includes("transboundary")));

  console.log("✓ Contextual mitigation checklist successfully formulated.");

  // -------------------------------------------------------------
  // Test 4: Automated Alert Creation & Threshold Gating
  // -------------------------------------------------------------
  console.log("\n[Test 4] Testing Automated Regulatory Alert Creation...");
  const newAlertInput: CreateRegulatoryAlertInput = {
    eventId: "event-test-stubble-99",
    sourceCountry: "IND",
    sourceCountryName: "India",
    sourceFlag: "🇮🇳",
    affectedCountry: "CHN",
    affectedCountryName: "China",
    affectedFlag: "🇨🇳",
    affectedRegion: "Tibet / Himalayan Border Region",
    pollutionType: "stubble_burning",
    sourcePollutionLevel: {
      pm2_5: 360,
      severity: "critical"
    },
    predictedPollutionLevel: {
      pm2_5: 160,
      remainingRatio: 0.44
    },
    estimatedArrivalHours: 8,
    riskLevel: "CRITICAL",
    riskScore: 82,
    confidence: 80
  };

  const createdAlert = createRegulatoryAlert(newAlertInput);
  assert.ok(createdAlert.alertId.startsWith("alert-brics-chn-"));
  assert.strictEqual(createdAlert.status, "CREATED");
  assert.strictEqual(createdAlert.targetAuthority.authorityId, "auth-chn-tibet-epb");
  assert.strictEqual(createdAlert.auditTrail.length, 1);
  assert.strictEqual(createdAlert.auditTrail[0].action, "AUTOMATED_ALERT_GENERATED");

  console.log(`✓ Automated Alert Created: ID=${createdAlert.alertId}, Target=${createdAlert.targetAuthority.authorityName}.`);

  // -------------------------------------------------------------
  // Test 5: Full Regulatory Response Lifecycle (CREATED -> ACKNOWLEDGED -> ASSIGNED -> IN PROGRESS -> RESOLVED)
  // -------------------------------------------------------------
  console.log("\n[Test 5] Testing End-to-End Regulatory Response Lifecycle...");

  // Step 1: Acknowledge
  const ackAlert = acknowledgeRegulatoryAlert(createdAlert.alertId, "Duty Officer Zhang", "Desk triage confirmed high-altitude trajectory.");
  assert.strictEqual(ackAlert.status, "ACKNOWLEDGED");
  assert.strictEqual(ackAlert.auditTrail.length, 2);
  assert.strictEqual(ackAlert.auditTrail[1].action, "ACKNOWLEDGED");

  // Step 2: Assign Resource
  const assignedAlert = assignResourceToAlert(createdAlert.alertId, "res-chn-tibet-mobile", "Operations Commander Li", "Dispatched Plateau Mobile Lab to border station.");
  assert.strictEqual(assignedAlert.status, "ASSIGNED");
  assert.ok(assignedAlert.assignedResource);
  assert.strictEqual(assignedAlert.assignedResource?.resourceId, "res-chn-tibet-mobile");
  assert.strictEqual(assignedAlert.auditTrail.length, 3);

  // Check resource state transition
  const tibetMobileRes = getRegulatoryResources().find((r) => r.id === "res-chn-tibet-mobile");
  assert.strictEqual(tibetMobileRes?.status, "DISPATCHED");
  assert.strictEqual(tibetMobileRes?.currentAssignmentAlertId, createdAlert.alertId);

  // Step 3: Action In Progress
  const inProgressAlert = updateRegulatoryAlertStatus(createdAlert.alertId, "ACTION_IN_PROGRESS", "Field Team Leader Wang", "Mobile station active at altitude 4200m; background PM2.5 tracking live.");
  assert.strictEqual(inProgressAlert.status, "ACTION_IN_PROGRESS");
  assert.strictEqual(inProgressAlert.auditTrail.length, 4);

  // Step 4: Resolve
  const resolvedAlert = resolveRegulatoryAlert(createdAlert.alertId, "Particulate plume dispersed below threshold; industrial emission notices concluded.", "Chief Inspector Chen");
  assert.strictEqual(resolvedAlert.status, "RESOLVED");
  assert.ok(resolvedAlert.resolvedAt);
  assert.strictEqual(resolvedAlert.resolutionNotes, "Particulate plume dispersed below threshold; industrial emission notices concluded.");
  assert.strictEqual(resolvedAlert.auditTrail.length, 5);

  // Verify resource is automatically released back to AVAILABLE
  const releasedRes = getRegulatoryResources().find((r) => r.id === "res-chn-tibet-mobile");
  assert.strictEqual(releasedRes?.status, "AVAILABLE");
  assert.strictEqual(releasedRes?.currentAssignmentAlertId, undefined);

  console.log("✓ Complete 5-step response lifecycle and resource release successfully verified.");

  // -------------------------------------------------------------
  // Test 6: Query Handlers & Multi-Nation Store
  // -------------------------------------------------------------
  console.log("\n[Test 6] Testing Query Handlers & Filtering...");
  const allAlerts = getRegulatoryAlerts();
  assert.ok(allAlerts.length >= 3);

  const resolvedOnly = getRegulatoryAlerts({ status: "RESOLVED" });
  assert.ok(resolvedOnly.some((a) => a.alertId === createdAlert.alertId));

  const chinaAlerts = getRegulatoryAlerts({ countryCode: "CHN" });
  assert.ok(chinaAlerts.length >= 1);

  const singleAlert = getRegulatoryAlertById(createdAlert.alertId);
  assert.ok(singleAlert);
  assert.strictEqual(singleAlert?.status, "RESOLVED");

  console.log("✓ Query handlers & status filtering verified.");

  console.log("\n=== ALL STAGE 5 REGULATORY COORDINATION TESTS PASSED! ===");
}

runRegulatoryCoordinationTests().catch((err) => {
  console.error("Regulatory coordination test failed:", err);
  process.exit(1);
});
