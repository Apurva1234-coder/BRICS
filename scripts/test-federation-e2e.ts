import assert from "node:assert";
import { openMeteoWeatherProvider } from "../server/services/openMeteoWeatherProvider.js";
import { defaultPropagationModel } from "../server/services/propagationModel.js";
import {
  executeLiveFederationExchange,
  getEventsRelevantToCountry,
  getNodeById,
  getFederationEvents
} from "../server/services/bricsFederationService.js";

async function runFederationEndToEndTests() {
  console.log("=== Testing End-to-End BRICS Environmental Federation Pipeline ===\n");

  // -------------------------------------------------------------
  // Test 1: Real-World Open-Meteo Meteorological Telemetry
  // -------------------------------------------------------------
  console.log("[Test 1] Testing Open-Meteo Atmospheric Telemetry for Delhi Airshed (28.6139, 77.2090)...");
  const meteo = await openMeteoWeatherProvider.getCurrentConditions(28.6139, 77.2090);

  assert.ok(meteo, "Must return meteorological context");
  assert.ok(meteo.source.includes("Open-Meteo"), "Source must be Open-Meteo Weather API");
  assert.ok(typeof meteo.windSpeedKmh === "number" && meteo.windSpeedKmh >= 0, "Wind speed must be numeric");
  assert.ok(typeof meteo.windDirectionDegrees === "number" && meteo.windDirectionDegrees >= 0 && meteo.windDirectionDegrees <= 360, "Wind direction must be 0-360 deg");
  assert.ok(typeof meteo.temperatureC === "number", "Temperature must be numeric");
  assert.ok(typeof meteo.relativeHumidityPercent === "number" && meteo.relativeHumidityPercent >= 0 && meteo.relativeHumidityPercent <= 100, "Humidity must be 0-100%");

  console.log(`✓ Open-Meteo Telemetry: Source='${meteo.source}' [${meteo.dataStatus}], Wind=${meteo.windSpeedKmh}km/h @ ${meteo.windDirectionDegrees}° (${meteo.windDirectionCompass}), Temp=${meteo.temperatureC}°C.`);

  // -------------------------------------------------------------
  // Test 2: Lagrangian Propagation Model Execution
  // -------------------------------------------------------------
  console.log("\n[Test 2] Testing Lagrangian Propagation Model with Open-Meteo Vector...");
  const propResult = await defaultPropagationModel.predictPropagation({
    sourceLatitude: 28.6139,
    sourceLongitude: 77.2090,
    sourceCountryCode: "IND",
    sourceLocality: "Delhi NCR Airshed",
    initialPm2_5: 380,
    pollutionType: "crop_burning",
    meteorologicalContext: meteo,
    horizonHours: 12,
    timeStepHours: 1
  });

  assert.ok(propResult.predictionId.startsWith("prop-ind-"), "Must assign prediction ID");
  assert.strictEqual(propResult.steps.length, 13, "Must compute 13 Lagrangian steps for 12h horizon (T0 to T12)");
  assert.ok(propResult.totalDistanceKm > 0, "Displacement must be greater than 0");

  // Verify dilution decay
  const initialStep = propResult.steps[0];
  const finalStep = propResult.steps[12];
  assert.strictEqual(initialStep.estimatedPm2_5, 380);
  assert.ok(finalStep.estimatedPm2_5 < initialStep.estimatedPm2_5, "PM2.5 must attenuate over time and distance");

  console.log(`✓ Lagrangian Simulation: Steps=${propResult.steps.length}, Total Displacement=${propResult.totalDistanceKm}km, PM2.5: ${initialStep.estimatedPm2_5} -> ${finalStep.estimatedPm2_5} µg/m³.`);

  // -------------------------------------------------------------
  // Test 3: Authentic End-to-End Live Federation Exchange Pipeline
  // -------------------------------------------------------------
  console.log("\n[Test 3] Testing Complete End-to-End Exchange (India 🇮🇳 → BRICS Mesh → China 🇨🇳)...");
  const indiaBefore = getNodeById("IND");
  const chinaBefore = getNodeById("CHN");
  const initialIndiaShared = indiaBefore?.sharedEventsCount || 0;
  const initialChinaReceived = chinaBefore?.receivedEventsCount || 0;

  const exchangeResult = await executeLiveFederationExchange({
    sourceCountry: "IND",
    targetCountry: "CHN",
    latitude: 28.6289,
    longitude: 77.2065,
    locality: "National Capital Region Frontier, India",
    pollutionType: "crop_burning",
    pm2_5: 395,
    severity: "critical",
    horizonHours: 12
  });

  assert.strictEqual(exchangeResult.success, true, "Exchange execution must succeed");
  assert.ok(exchangeResult.event.eventId.startsWith("brics-live-exchange-"), "Must generate standardized event ID");
  assert.strictEqual(exchangeResult.event.sourceCountry, "IND");
  assert.ok(exchangeResult.event.targetCountries.includes("CHN") || exchangeResult.event.targetCountries.includes("ALL"));
  assert.strictEqual(exchangeResult.executionTrace.length, 4, "Must execute all 4 distinct pipeline steps");

  // Verify node counter mutations
  const indiaAfter = getNodeById("IND");
  const chinaAfter = getNodeById("CHN");
  assert.strictEqual(indiaAfter?.sharedEventsCount, initialIndiaShared + 1, "India sharedEventsCount must increment by 1");
  assert.strictEqual(chinaAfter?.receivedEventsCount, initialChinaReceived + 1, "China receivedEventsCount must increment by 1");

  console.log(`✓ Exchange Pipeline: Event '${exchangeResult.event.eventId}' published by 🇮🇳 India (Shared: ${indiaAfter?.sharedEventsCount}) and delivered to 🇨🇳 China (Received: ${chinaAfter?.receivedEventsCount}).`);

  // -------------------------------------------------------------
  // Test 4: China Node Retrieval Verification
  // -------------------------------------------------------------
  console.log("\n[Test 4] Verifying China Node Ingestion & Relevance Filtering...");
  const chinaEvents = getEventsRelevantToCountry("CHN");

  assert.ok(chinaEvents.relevantEvents.some((e) => e.eventId === exchangeResult.event.eventId), "China node must have ingested the live exchange event");
  const ingestedEvent = chinaEvents.relevantEvents.find((e) => e.eventId === exchangeResult.event.eventId);
  assert.ok(ingestedEvent?.metadata?.meteoSource, "Ingested event must retain Open-Meteo telemetry metadata");
  assert.ok(ingestedEvent?.metadata?.propagationPredictionId, "Ingested event must retain propagation model prediction ID");

  console.log(`✓ China Node Verified: Ingested event '${ingestedEvent?.eventId}' containing live telemetry & propagation prediction.`);

  console.log("\n=== ALL BRICS FEDERATION END-TO-END TESTS PASSED! ===");
}

runFederationEndToEndTests().catch((err) => {
  console.error("Federation E2E test failed:", err);
  process.exit(1);
});
