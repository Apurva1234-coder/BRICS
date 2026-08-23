import assert from "node:assert";
import {
  getFederationNodes,
  getNodeById,
  registerOrHeartbeatNode,
  publishFederationEvent,
  getFederationEvents,
  getEventsRelevantToCountry,
  getFederationStatus,
  bridgeReportToFederation
} from "../server/services/bricsFederationService.js";
import type { PollutionReport } from "../server/types.js";

async function runBricsFederationTests() {
  console.log("=== Testing BRICS Environmental Federation Layer ===\n");

  // -------------------------------------------------------------
  // Test 1: Node Registry
  // -------------------------------------------------------------
  console.log("[Test 1] Verifying BRICS country node registry...");
  const nodes = getFederationNodes();
  assert.strictEqual(nodes.length, 11, "Must contain all 11 BRICS member country nodes");

  const requiredCountryCodes = ["IND", "CHN", "BRA", "RUS", "ZAF", "EGY", "ETH", "IDN", "IRN", "ARE", "SAU"];
  for (const code of requiredCountryCodes) {
    const node = getNodeById(code);
    assert.ok(node, `Node for country ${code} must exist in registry`);
    assert.strictEqual(node.nodeStatus, "active", `Node ${code} must have active status`);
    assert.ok(node.flag, `Node ${code} must have a flag icon`);
    assert.ok(node.geographicRegion, `Node ${code} must have a geographic region`);
  }
  console.log("✓ All 11 BRICS member country nodes verified and active.");

  // -------------------------------------------------------------
  // Test 2: Node Registration and Heartbeat
  // -------------------------------------------------------------
  console.log("\n[Test 2] Testing node heartbeat and dynamic registration...");
  const initialIndia = getNodeById("IND")!;
  const updatedIndia = registerOrHeartbeatNode({
    countryCode: "IND",
    contactEmail: "nodal-updated@cpcb.gov.in"
  });
  assert.strictEqual(updatedIndia.contactEmail, "nodal-updated@cpcb.gov.in");
  assert.ok(new Date(updatedIndia.lastHeartbeatAt).getTime() > 0);
  console.log("✓ Node heartbeat and registration update successfully applied.");

  // -------------------------------------------------------------
  // Test 3: Standardized Event Schema Validation
  // -------------------------------------------------------------
  console.log("\n[Test 3] Testing standardized event schema validation...");
  
  // Missing required country
  assert.throws(
    () => {
      // @ts-expect-error test invalid schema
      publishFederationEvent({
        latitude: 28.6,
        longitude: 77.2,
        pollutionType: "crop_burning",
        pollutantValues: { pm2_5: 200 },
        severity: "critical"
      });
    },
    /sourceCountry/,
    "Should reject event without sourceCountry"
  );

  // Invalid coordinates
  assert.throws(
    () => {
      publishFederationEvent({
        sourceCountry: "IND",
        latitude: 145.0, // Invalid latitude > 90
        longitude: 77.2,
        pollutionType: "industrial_smoke",
        pollutantValues: { pm2_5: 180 },
        severity: "high"
      });
    },
    /latitude/,
    "Should reject event with invalid latitude coordinate"
  );

  assert.throws(
    () => {
      publishFederationEvent({
        sourceCountry: "IND",
        latitude: 28.6,
        longitude: -210.0, // Invalid longitude < -180
        pollutionType: "industrial_smoke",
        pollutantValues: { pm2_5: 180 },
        severity: "high"
      });
    },
    /longitude/,
    "Should reject event with invalid longitude coordinate"
  );
  console.log("✓ Schema validation correctly rejects malformed event submissions.");

  // -------------------------------------------------------------
  // Test 4: Cross-Country Exchange: India 🇮🇳 → BRICS → China 🇨🇳
  // -------------------------------------------------------------
  console.log("\n[Test 4] Testing Cross-Country Data Exchange (India 🇮🇳 → China 🇨🇳)...");
  
  const testEventId = `test-brics-ind-chn-${Date.now()}`;
  const indiaPublished = publishFederationEvent({
    eventId: testEventId,
    sourceCountry: "IND",
    latitude: 29.1,
    longitude: 76.8,
    locality: "Northern Airshed Agricultural Belt, India",
    pollutionType: "crop_burning",
    pollutantValues: {
      pm2_5: 420,
      pm10: 560,
      no2: 95,
      co: 4.2,
      aqi: 460
    },
    severity: "critical",
    confidence: 0.95,
    sourceType: "satellite_sentinel5p",
    windDirectionDeg: 300,
    windSpeedKmh: 24,
    predictedAffectedRegion: "Himalayan Corridor & East Asian Airshed",
    predictionConfidence: 0.89,
    targetCountries: ["CHN", "ALL"],
    title: "Severe Transboundary Stubble Emission Plume",
    description: "High-density aerosol optical depth plume tracked moving eastward."
  });

  assert.strictEqual(indiaPublished.eventId, testEventId);
  assert.strictEqual(indiaPublished.sourceCountry, "IND");
  assert.strictEqual(indiaPublished.severity, "critical");
  assert.strictEqual(indiaPublished.pollutantValues.pm2_5, 420);

  // China Node queries relevant events
  const chinaQuery = getEventsRelevantToCountry("CHN");
  assert.ok(chinaQuery.relevantEvents.length > 0, "China Node must receive shared events");
  
  const receivedByChina = chinaQuery.relevantEvents.find((e) => e.eventId === testEventId);
  assert.ok(receivedByChina, "China Node must have received the specific event published by India");
  assert.strictEqual(receivedByChina?.pollutantValues.pm2_5, 420, "Pollutant metrics must be preserved intact");
  assert.strictEqual(receivedByChina?.sourceCountry, "IND");
  console.log(`✓ India Node published event '${testEventId}'.`);
  console.log(`✓ China Node successfully retrieved event '${receivedByChina?.eventId}' with PM2.5=${receivedByChina?.pollutantValues.pm2_5} µg/m³.`);

  // -------------------------------------------------------------
  // Test 5: Reverse Exchange: China 🇨🇳 → Russia 🇷🇺 & Brazil 🇧🇷
  // -------------------------------------------------------------
  console.log("\n[Test 5] Testing Multi-Nation Broadcast (China 🇨🇳 → Russia 🇷🇺 & Brazil 🇧🇷)...");
  const chinaEventId = `test-brics-chn-${Date.now()}`;
  publishFederationEvent({
    eventId: chinaEventId,
    sourceCountry: "CHN",
    latitude: 39.9,
    longitude: 116.4,
    locality: "Hebei Industrial Zone, China",
    pollutionType: "industrial_smoke",
    pollutantValues: {
      pm2_5: 280,
      so2: 90,
      no2: 110,
      aqi: 320
    },
    severity: "high",
    confidence: 0.92,
    sourceType: "ground_station",
    targetCountries: ["ALL"]
  });

  const russiaQuery = getEventsRelevantToCountry("RUS");
  const receivedByRussia = russiaQuery.relevantEvents.find((e) => e.eventId === chinaEventId);
  assert.ok(receivedByRussia, "Russia Node must receive broadcast event from China");

  const brazilQuery = getEventsRelevantToCountry("BRA");
  const receivedByBrazil = brazilQuery.relevantEvents.find((e) => e.eventId === chinaEventId);
  assert.ok(receivedByBrazil, "Brazil Node must receive broadcast event from China");
  console.log("✓ Multi-nation broadcast successfully received across all member nodes.");

  // -------------------------------------------------------------
  // Test 6: Filtering & Status Aggregation
  // -------------------------------------------------------------
  console.log("\n[Test 6] Testing event filtering and federation status...");
  const criticalEvents = getFederationEvents({ severity: "critical" });
  assert.ok(criticalEvents.every((e) => e.severity === "critical"), "All filtered events must have critical severity");

  const status = getFederationStatus();
  assert.strictEqual(status.federationActive, true);
  assert.strictEqual(status.totalNodes, 11);
  assert.strictEqual(status.activeNodes, 11);
  assert.ok(status.totalSharedEvents >= 6, "Total shared events count must reflect stored events");
  console.log(`✓ Federation status verified: ${status.activeNodes}/${status.totalNodes} nodes active, ${status.totalSharedEvents} events exchanged.`);

  // -------------------------------------------------------------
  // Test 7: Bridge Local Indian Report to BRICS Federation
  // -------------------------------------------------------------
  console.log("\n[Test 7] Testing local Indian Report bridging to Federation...");
  const mockReport: PollutionReport = {
    id: "rep-delhi-industrial-998",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: "user-123",
    status: "Submitted",
    lat: 28.7041,
    lng: 77.1025,
    areaText: "Wazirpur Industrial Area, Delhi",
    media: [],
    evidenceStatus: "verified",
    authenticityScore: 95,
    authenticityFlags: [],
    evidenceScore: 88,
    trustLevel: "Verified",
    evidenceReasons: ["Multi-angle ground photography"],
    actionLog: [],
    imageHash: "hash-998",
    userDescription: "Dense dark smoke billowing from chemical factory smokestack.",
    gemini: {
      is_pollution_related: true,
      pollution_visible: true,
      image_quality: "usable",
      image_quality_score: 90,
      pollution_type: "industrial_emission",
      confidence: 94,
      severity: "high",
      evidence_strength: 88,
      visible_evidence: ["Heavy black particulate smoke"],
      possible_pollutants: ["PM2.5", "SO2"],
      public_summary: "Industrial smoke emission.",
      municipal_action: "Inspect emission scrubbing filters.",
      needs_manual_review: false,
      trust_decision: "verified",
      safety_note: "Wear protective mask."
    },
    airQuality: {
      provider: "cpcb_data_gov",
      category: "Severe",
      pollutants: { PM25: { value: 310, unit: "µg/m³" } },
      aqi: 340,
      rawSummary: "CPCB Station AQI: 340"
    },
    nearby: { similarReportCount: 2, nearbyReportIds: [] },
    hotspotScore: 84,
    priority: "high"
  };

  const bridged = bridgeReportToFederation(mockReport);
  assert.strictEqual(bridged.sourceCountry, "IND");
  assert.strictEqual(bridged.pollutionType, "industrial_smoke");
  assert.strictEqual(bridged.severity, "high");
  assert.strictEqual(bridged.metadata?.localReportId, "rep-delhi-industrial-998");
  console.log(`✓ Local report '${mockReport.id}' successfully bridged to standardized event '${bridged.eventId}'.`);

  console.log("\n=== ALL BRICS FEDERATION TESTS PASSED SUCCESSFULLY! ===");
}

runBricsFederationTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
