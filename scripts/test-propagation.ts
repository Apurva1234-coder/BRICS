import assert from "node:assert";
import {
  RuleBasedPropagationModel,
  pm25ToImpactLevel,
  pm25ToEstimatedAqi
} from "../server/services/propagationModel.js";
import {
  executePropagationSimulation,
  getActiveCrossBorderPredictions,
  getIncomingPlumesForCountry,
  getAffectedCountriesSummary
} from "../server/services/crossBorderPropagationService.js";
import {
  identifyCountryForCoordinate,
  isCoordinateInCountry,
  getCountryBoundary
} from "../server/data/bricsBoundaries.js";
import { getFederationEvents } from "../server/services/bricsFederationService.js";
import type { PropagationInput } from "../server/types.js";

async function runPropagationTests() {
  console.log("=== Testing Stage 3: Cross-Border Pollution Propagation Model ===\n");

  const model = new RuleBasedPropagationModel();

  // -------------------------------------------------------------
  // Test 1: Modular Interface & PM2.5 Mapping
  // -------------------------------------------------------------
  console.log("[Test 1] Testing Modular Interface & PM2.5 Impact Classification...");
  assert.strictEqual(model.name, "RuleBasedLagrangianPropagationModel");
  assert.strictEqual(model.version, "1.0.0");

  assert.strictEqual(pm25ToImpactLevel(300), "CRITICAL");
  assert.strictEqual(pm25ToImpactLevel(180), "HIGH");
  assert.strictEqual(pm25ToImpactLevel(85), "MEDIUM");
  assert.strictEqual(pm25ToImpactLevel(25), "LOW");

  assert.strictEqual(pm25ToEstimatedAqi(15), 25);
  assert.strictEqual(pm25ToEstimatedAqi(60), 100);
  assert.strictEqual(pm25ToEstimatedAqi(120), 300);
  console.log("✓ Modular model metadata and PM2.5 impact level thresholds verified.");

  // -------------------------------------------------------------
  // Test 2: Dynamic Country Boundary Identification (No Hardcoding)
  // -------------------------------------------------------------
  console.log("\n[Test 2] Testing Dynamic Geographic Country & Subregion Detection...");
  
  // Delhi, India (28.61, 77.20)
  const delhi = identifyCountryForCoordinate(28.6139, 77.2090);
  assert.strictEqual(delhi.countryCode, "IND");
  assert.strictEqual(delhi.countryName, "India");
  assert.strictEqual(delhi.isBrics, true);

  // Beijing, China (39.90, 116.40)
  const beijing = identifyCountryForCoordinate(39.9042, 116.4074);
  assert.strictEqual(beijing.countryCode, "CHN");
  assert.strictEqual(beijing.countryName, "China");
  assert.strictEqual(beijing.isBrics, true);

  // Moscow, Russia (55.75, 37.61)
  const moscow = identifyCountryForCoordinate(55.7558, 37.6173);
  assert.strictEqual(moscow.countryCode, "RUS");
  assert.strictEqual(moscow.countryName, "Russia");
  assert.strictEqual(moscow.isBrics, true);

  // São Paulo, Brazil (-23.55, -46.63)
  const saoPaulo = identifyCountryForCoordinate(-23.5505, -46.6333);
  assert.strictEqual(saoPaulo.countryCode, "BRA");
  assert.strictEqual(saoPaulo.countryName, "Brazil");

  // Dubai, UAE (25.20, 55.27)
  const dubai = identifyCountryForCoordinate(25.2048, 55.2708);
  assert.strictEqual(dubai.countryCode, "ARE");
  assert.strictEqual(dubai.countryName, "United Arab Emirates");

  console.log("✓ Dynamic geographic bounding lookup verified across BRICS territory coordinates.");

  // -------------------------------------------------------------
  // Test 3: Time-Step Simulation & Plume Horizontal Spreading
  // -------------------------------------------------------------
  console.log("\n[Test 3] Testing Step-by-Step Advection & Plume Width Expansion...");
  const simInput: PropagationInput = {
    sourceLatitude: 28.6139,
    sourceLongitude: 77.2090,
    sourceCountryCode: "IND",
    sourceLocality: "Delhi NCT",
    initialPm2_5: 350,
    initialSeverity: "critical",
    horizonHours: 6,
    timeStepHours: 1,
    meteorology: {
      source: "Test Met",
      observedAt: "2026-08-23T00:00:00Z",
      latitude: 28.6139,
      longitude: 77.2090,
      temperatureC: 28,
      relativeHumidityPercent: 60,
      windSpeedKmh: 20,
      windDirectionDegrees: 90, // From East (pushes West)
      windDirectionCompass: "E",
      movementDirectionDegrees: 270,
      movementDirectionCompass: "W",
      precipitationMm: 0,
      precipitationType: "NONE",
      dataStatus: "AVAILABLE"
    }
  };

  const simResult = await model.predictPropagation(simInput);
  assert.strictEqual(simResult.steps.length, 7, "6-hour horizon with 1h steps produces 7 points (T0 to T6)");
  assert.strictEqual(simResult.steps[0].hoursElapsed, 0);
  assert.strictEqual(simResult.steps[0].distanceFromSourceKm, 0);
  assert.strictEqual(simResult.steps[0].plumeRadiusKm, 2.0);

  // Check plume expansion over time: R(t) increases monotonically
  for (let i = 1; i < simResult.steps.length; i++) {
    assert.ok(
      simResult.steps[i].plumeRadiusKm > simResult.steps[i - 1].plumeRadiusKm,
      `Plume radius at T+${i}h must exceed T+${i - 1}h`
    );
    assert.ok(
      simResult.steps[i].distanceFromSourceKm > simResult.steps[i - 1].distanceFromSourceKm,
      `Travel distance at T+${i}h must exceed T+${i - 1}h`
    );
  }
  console.log(`✓ Plume advection and dispersion verified (T0: 2.0km -> T6: ${simResult.steps[6].plumeRadiusKm}km width).`);

  // -------------------------------------------------------------
  // Test 4: Atmospheric Dilution & Rain Washout Mechanics
  // -------------------------------------------------------------
  console.log("\n[Test 4] Testing Atmospheric Dilution & Rain Washout Decay...");
  
  // Dry run vs Wet run
  const dryResult = await model.predictPropagation(simInput);
  const wetInput: PropagationInput = {
    ...simInput,
    meteorology: {
      ...simInput.meteorology!,
      precipitationMm: 8.5,
      precipitationType: "RAIN"
    }
  };
  const wetResult = await model.predictPropagation(wetInput);

  const dryFinalPm25 = dryResult.steps[6].estimatedPm2_5;
  const wetFinalPm25 = wetResult.steps[6].estimatedPm2_5;

  assert.ok(
    dryFinalPm25 < simInput.initialPm2_5!,
    "Aerosol concentration must dilute and decay over time"
  );
  assert.ok(
    wetFinalPm25 < dryFinalPm25,
    "Precipitation washout must accelerate particulate decay (wet PM2.5 < dry PM2.5)"
  );
  console.log(`✓ Dilution and wet deposition verified: Initial 350 -> Dry T+6: ${dryFinalPm25} µg/m³ vs Wet T+6: ${wetFinalPm25} µg/m³.`);

  // -------------------------------------------------------------
  // Test 5: Cross-Border Trajectory & Country Intersection
  // -------------------------------------------------------------
  console.log("\n[Test 5] Testing Dynamic Cross-Border Plume Intersection (India 🇮🇳 → China 🇨🇳)...");
  
  // High-altitude Uttarakhand / Northern India near Himalayan frontier (29.8°N, 79.5°E)
  // Wind from SW (225°) at 30 km/h pushes plume North-East (45°) directly toward Tibet, China
  const crossBorderInput: PropagationInput = {
    sourceLatitude: 29.8,
    sourceLongitude: 79.5,
    sourceCountryCode: "IND",
    sourceLocality: "Northern Himalayan Industrial Corridor",
    initialPm2_5: 320,
    initialSeverity: "critical",
    horizonHours: 12,
    meteorology: {
      source: "Weather API",
      observedAt: "2026-08-23T00:00:00Z",
      latitude: 29.8,
      longitude: 79.5,
      temperatureC: 18,
      relativeHumidityPercent: 50,
      windSpeedKmh: 30,
      windDirectionDegrees: 225, // From SW -> pushes NE (45°)
      windDirectionCompass: "SW",
      movementDirectionDegrees: 45,
      movementDirectionCompass: "NE",
      precipitationMm: 0,
      precipitationType: "NONE",
      dataStatus: "AVAILABLE"
    }
  };

  const crossBorderResult = await model.predictPropagation(crossBorderInput);
  assert.strictEqual(crossBorderResult.hasCrossBorderImpact, true, "Must detect cross-border impact");
  assert.ok(crossBorderResult.crossBorderPrediction, "Cross-border prediction object must be generated");

  const prediction = crossBorderResult.crossBorderPrediction!;
  assert.strictEqual(prediction.sourceCountry, "IND");
  assert.strictEqual(prediction.affectedCountry, "CHN", "Must dynamically identify China as affected country");
  assert.strictEqual(prediction.affectedCountryName, "China");
  assert.strictEqual(prediction.affectedFlag, "🇨🇳");
  assert.ok(prediction.estimatedArrivalHours > 0 && prediction.estimatedArrivalHours <= 12);
  assert.ok(prediction.riskScore >= 50, "Critical source intensity + transboundary crossing must produce HIGH/CRITICAL risk");
  assert.ok(["HIGH", "CRITICAL"].includes(prediction.riskCategory));
  console.log(`✓ Cross-border intersection dynamically detected: India 🇮🇳 → China 🇨🇳 (Arrival in ~${prediction.estimatedArrivalHours}h, Risk: ${prediction.riskScore}% [${prediction.riskCategory}]).`);

  // -------------------------------------------------------------
  // Test 6: Second Sovereign Pair (China 🇨🇳 → Russia 🇷🇺)
  // -------------------------------------------------------------
  console.log("\n[Test 6] Testing Second Sovereign Pair (China 🇨🇳 → Russia 🇷🇺)...");
  
  // Heilongjiang industrial zone (47.5°N, 130.5°E) with WSW wind pushing ENE toward Russia
  const chnRusInput: PropagationInput = {
    sourceLatitude: 47.5,
    sourceLongitude: 130.5,
    sourceCountryCode: "CHN",
    sourceLocality: "Heilongjiang Frontier",
    initialPm2_5: 280,
    initialSeverity: "severe",
    horizonHours: 10,
    meteorology: {
      source: "Weather API",
      observedAt: "2026-08-23T00:00:00Z",
      latitude: 47.5,
      longitude: 130.5,
      temperatureC: 15,
      relativeHumidityPercent: 45,
      windSpeedKmh: 35,
      windDirectionDegrees: 240, // From WSW -> pushes ENE (60°)
      windDirectionCompass: "WSW",
      movementDirectionDegrees: 60,
      movementDirectionCompass: "ENE",
      precipitationMm: 0,
      precipitationType: "NONE",
      dataStatus: "AVAILABLE"
    }
  };

  const chnRusResult = await model.predictPropagation(chnRusInput);
  assert.strictEqual(chnRusResult.hasCrossBorderImpact, true);
  assert.strictEqual(chnRusResult.crossBorderPrediction?.affectedCountry, "RUS");
  assert.strictEqual(chnRusResult.crossBorderPrediction?.affectedCountryName, "Russia");
  console.log(`✓ Second sovereign pair verified: China 🇨🇳 → Russia 🇷🇺 (Arrival: ~${chnRusResult.crossBorderPrediction?.estimatedArrivalHours}h).`);

  // -------------------------------------------------------------
  // Test 7: Central Service & Automatic Federation Exchange
  // -------------------------------------------------------------
  console.log("\n[Test 7] Testing Central Service & Automatic Federation Event Dispatch...");
  const execResult = await executePropagationSimulation(crossBorderInput);
  assert.ok(execResult.predictionId);

  // Verify that an alert was automatically routed to the BRICS federation event pool
  const federationEvents = getFederationEvents({ limit: 50 });
  const matchingFedEvent = federationEvents.find((e) => e.targetCountries?.includes("CHN"));
  assert.ok(matchingFedEvent, "Federation event must be dispatched to China Node inbox");
  assert.ok(matchingFedEvent?.title?.includes("Cross-Border Plume"));
  console.log("✓ Automatic federated event broadcast to recipient node confirmed.");

  // -------------------------------------------------------------
  // Test 8: Query Handlers & Affected Countries Summary
  // -------------------------------------------------------------
  console.log("\n[Test 8] Testing Query Handlers & Recipient Countries Summary...");
  const activePreds = getActiveCrossBorderPredictions();
  assert.ok(activePreds.length >= 2, "Active store must contain cross-border predictions");

  const incomingChina = getIncomingPlumesForCountry("CHN");
  assert.ok(incomingChina.length >= 1, "Must find incoming plumes targeting China");
  assert.strictEqual(incomingChina[0].affectedCountry, "CHN");

  const affectedSummary = getAffectedCountriesSummary();
  assert.ok(affectedSummary.length >= 1, "Summary must aggregate affected countries");
  assert.ok(affectedSummary.some((c) => c.countryCode === "CHN" || c.countryCode === "RUS"));
  console.log(`✓ Affected summary aggregated ${affectedSummary.length} recipient nations.`);

  console.log("\n=== ALL STAGE 3 CROSS-BORDER PROPAGATION TESTS PASSED! ===");
}

runPropagationTests().catch((err) => {
  console.error("Propagation test failed:", err);
  process.exit(1);
});
