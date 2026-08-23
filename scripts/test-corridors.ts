import assert from "node:assert";
import {
  BRICS_ECONOMIC_CORRIDORS,
  getAllEconomicCorridors,
  getEconomicCorridorById,
  getEconomicCorridorsForCountry
} from "../server/data/bricsEconomicCorridors.js";
import {
  evaluateCorridorImpact,
  predictEconomicCorridorImpact,
  calculateCityDisruptionRisk,
  calculateCorridorRiskScore,
  getActiveCorridorPredictions,
  getAffectedCorridors,
  getCorridorPredictionById
} from "../server/services/economicCorridorService.js";
import { RuleBasedPropagationModel } from "../server/services/propagationModel.js";
import type { PropagationInput, PropagationResult } from "../server/types.js";

async function runEconomicCorridorTests() {
  console.log("=== Testing Stage 4: Economic Corridor Intelligence ===\n");

  // -------------------------------------------------------------
  // Test 1: Corridor Data Structure & Multi-Nation Registry
  // -------------------------------------------------------------
  console.log("[Test 1] Testing Economic Corridor Registry & Configuration...");
  const allCorridors = getAllEconomicCorridors();
  assert.ok(allCorridors.length >= 5, "Must configure at least 5 major trade corridors across BRICS");

  // Test individual corridor properties
  const delhiLahore = getEconomicCorridorById("corridor-delhi-lahore-central-asia");
  assert.ok(delhiLahore, "Delhi-Lahore corridor must be registered");
  assert.strictEqual(delhiLahore?.importance, "CRITICAL");
  assert.ok(delhiLahore?.countries.includes("IND") && delhiLahore?.countries.includes("PAK"));
  assert.ok(delhiLahore?.cities.length >= 5, "Must contain at least 5 economic city hubs");
  assert.ok(delhiLahore?.waypoints.length >= 6, "Must contain geographic route waypoints");

  const amurHeilongjiang = getEconomicCorridorById("corridor-amur-heilongjiang-industrial");
  assert.ok(amurHeilongjiang, "Amur-Heilongjiang corridor must be registered");
  assert.ok(amurHeilongjiang?.countries.includes("CHN") && amurHeilongjiang?.countries.includes("RUS"));

  const gulfEnergy = getEconomicCorridorById("corridor-gulf-maritime-energy");
  assert.ok(gulfEnergy, "Persian Gulf corridor must be registered");
  assert.ok(gulfEnergy?.countries.includes("ARE") && gulfEnergy?.countries.includes("IRN"));

  const southAfricaHighveld = getEconomicCorridorById("corridor-highveld-maputo");
  assert.ok(southAfricaHighveld, "South Africa Highveld-Maputo corridor must be registered");
  assert.ok(southAfricaHighveld?.countries.includes("ZAF"));

  const paranaMercosur = getEconomicCorridorById("corridor-parana-mercosur");
  assert.ok(paranaMercosur, "Paraná Mercosul corridor must be registered");
  assert.ok(paranaMercosur?.countries.includes("BRA"));

  // Test country filtering helper
  const indiaCorridors = getEconomicCorridorsForCountry("IND");
  assert.ok(indiaCorridors.length >= 1, "Must find corridors touching India");
  assert.strictEqual(indiaCorridors[0].id, "corridor-delhi-lahore-central-asia");

  console.log(`✓ Configured ${allCorridors.length} representative trade arteries spanning all BRICS regions.`);

  // -------------------------------------------------------------
  // Test 2: City Economic Disruption & Risk Scoring Formulas
  // -------------------------------------------------------------
  console.log("\n[Test 2] Testing City Economic Disruption & Multi-Factor Risk Scoring...");
  assert.strictEqual(calculateCityDisruptionRisk("CRITICAL", 10), "CRITICAL");
  assert.strictEqual(calculateCityDisruptionRisk("HIGH", 8), "CRITICAL");
  assert.strictEqual(calculateCityDisruptionRisk("HIGH", 5), "HIGH");
  assert.strictEqual(calculateCityDisruptionRisk("MEDIUM", 8), "HIGH");
  assert.strictEqual(calculateCityDisruptionRisk("LOW", 4), "LOW");

  const scoreHigh = calculateCorridorRiskScore(320, [{ cityId: "c1" }, { cityId: "c2" }, { cityId: "c3" }] as any, true, 2, "CRITICAL");
  assert.ok(scoreHigh.score >= 75, "High PM2.5 + multiple cities + border crossing + early arrival = CRITICAL score");
  assert.strictEqual(scoreHigh.category, "CRITICAL");

  const scoreLow = calculateCorridorRiskScore(40, [{ cityId: "c1" }] as any, false, 14, "MEDIUM");
  assert.ok(scoreLow.score < 30, "Low PM2.5 + single city + no border crossing = LOW score");
  assert.strictEqual(scoreLow.category, "LOW");

  console.log("✓ Explainable multi-factor risk scoring verified.");

  // -------------------------------------------------------------
  // Test 3: Spatial Corridor Intersection & Affected City Detection
  // -------------------------------------------------------------
  console.log("\n[Test 3] Testing Spatial Corridor Intersection (Delhi NCR Stubble Release)...");
  const model = new RuleBasedPropagationModel();

  // Delhi NCR source with NW/NNW wind advecting along NH44 corridor
  const propagationInput: PropagationInput = {
    sourceLatitude: 28.6139,
    sourceLongitude: 77.2090,
    sourceCountryCode: "IND",
    sourceLocality: "Delhi NCR Trade Hub",
    initialPm2_5: 350,
    initialSeverity: "critical",
    horizonHours: 12,
    meteorology: {
      source: "Weather Engine",
      observedAt: "2026-08-23T00:00:00Z",
      latitude: 28.6139,
      longitude: 77.2090,
      temperatureC: 25,
      relativeHumidityPercent: 55,
      windSpeedKmh: 28,
      windDirectionDegrees: 140, // From SE -> pushes NW (320°) directly along NH44 corridor toward Panipat & Ludhiana
      windDirectionCompass: "SE",
      movementDirectionDegrees: 320,
      movementDirectionCompass: "NW",
      precipitationMm: 0,
      precipitationType: "NONE",
      dataStatus: "AVAILABLE"
    }
  };

  const propagationResult: PropagationResult = await model.predictPropagation(propagationInput);
  assert.ok(propagationResult.steps.length > 5);

  const corridorPrediction = evaluateCorridorImpact(propagationResult, delhiLahore!);
  assert.ok(corridorPrediction, "Must detect impact along Delhi-Lahore economic corridor");
  assert.strictEqual(corridorPrediction?.corridorId, "corridor-delhi-lahore-central-asia");
  assert.ok(corridorPrediction!.affectedCities.length >= 2, "Must identify at least 2 impacted cities along path");

  // Check affected cities
  const cityNames = corridorPrediction!.affectedCities.map((c) => c.cityName);
  assert.ok(cityNames.some((n) => n.includes("Delhi")), "Delhi must be in impacted list");
  assert.ok(cityNames.some((n) => n.includes("Panipat")), "Panipat must be in impacted list");

  console.log(`✓ Corridor impact detected: ${corridorPrediction?.corridorName} (${corridorPrediction?.affectedCities.length} cities affected: ${cityNames.join(", ")}).`);

  // -------------------------------------------------------------
  // Test 4: Sequential Arrival Timeline Forecasting ($T_0 \to \text{City A} \to \text{City B}$)
  // -------------------------------------------------------------
  console.log("\n[Test 4] Testing Sequential Arrival Timeline & Chronological Order...");
  const timeline = corridorPrediction!.timelineSummary;
  assert.ok(timeline.length >= 3, "Timeline must contain source and subsequent city milestones");

  // Verify chronological ordering
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(
      timeline[i].stepHours >= timeline[i - 1].stepHours,
      `Milestone at index ${i} (T+${timeline[i].stepHours}h) must occur after index ${i - 1} (T+${timeline[i - 1].stepHours}h)`
    );
  }

  // First milestone must be source release
  assert.strictEqual(timeline[0].type, "source");
  assert.strictEqual(timeline[0].stepHours, 0);

  console.log("✓ Sequential timeline milestones verified:");
  for (const m of timeline) {
    console.log(`   • T+${m.stepHours}h: ${m.label} -> PM2.5: ${m.pm2_5} µg/m³ (${m.type})`);
  }

  // -------------------------------------------------------------
  // Test 5: Multi-Corridor Predictions across Different BRICS Regions
  // -------------------------------------------------------------
  console.log("\n[Test 5] Testing Multi-Corridor Central Service (Amur-Heilongjiang Corridor)...");
  const predictions = await predictEconomicCorridorImpact({
    corridorId: "corridor-amur-heilongjiang-industrial",
    sourceLatitude: 45.8038,
    sourceLongitude: 126.5349,
    sourceLocality: "Harbin Industrial Basin",
    sourceCountryCode: "CHN",
    initialPm2_5: 300,
    horizonHours: 14
  });

  assert.ok(predictions.length >= 1, "Must generate prediction for Amur-Heilongjiang corridor");
  const amurPred = predictions[0];
  assert.strictEqual(amurPred.corridorId, "corridor-amur-heilongjiang-industrial");
  assert.ok(amurPred.affectedCities.length >= 1);
  assert.ok(amurPred.corridorRiskScore >= 40);
  console.log(`✓ China-Russia trade axis predicted: Risk=${amurPred.corridorRiskScore}% (${amurPred.corridorRiskCategory}).`);

  // -------------------------------------------------------------
  // Test 6: Query Handlers & Active Store
  // -------------------------------------------------------------
  console.log("\n[Test 6] Testing Query Handlers & Active Impact Cache...");
  const activePreds = getActiveCorridorPredictions();
  assert.ok(activePreds.length >= 2, "Active predictions store must contain baseline & calculated predictions");

  const affectedCorridors = getAffectedCorridors();
  assert.ok(affectedCorridors.length >= 2, "Affected corridors must return threatened trade arteries");

  const single = getCorridorPredictionById("corridor-delhi-lahore-central-asia");
  assert.ok(single, "Must look up prediction by corridor ID");
  assert.strictEqual(single?.corridorId, "corridor-delhi-lahore-central-asia");

  console.log("✓ Central service query handlers verified.");

  console.log("\n=== ALL STAGE 4 ECONOMIC CORRIDOR INTELLIGENCE TESTS PASSED! ===");
}

runEconomicCorridorTests().catch((err) => {
  console.error("Economic corridor test failed:", err);
  process.exit(1);
});
