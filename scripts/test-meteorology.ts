import assert from "node:assert";
import {
  GoogleWeatherProvider,
  degreesToCompass,
  oppositeBearingDegrees,
  normalizePrecipitationType,
  generateDeterministicMockWeather,
  generateDeterministicMockForecast
} from "../server/services/googleWeatherProvider.js";
import {
  computeDestinationPoint,
  haversineDistanceKm,
  calculateBearingDegrees,
  estimatePollutionMovement
} from "../server/services/pollutionMovementEstimator.js";
import {
  getMeteorologyForCoordinates,
  getHourlyForecastForCoordinates,
  predictMovement,
  attachMeteorologyToEvent
} from "../server/services/meteorologyService.js";
import {
  getCachedCurrentConditions,
  setCachedCurrentConditions,
  clearMeteorologyCache
} from "../server/services/meteorologyCache.js";
import type { BricsFederationEvent, MeteorologicalContext } from "../server/types.js";

async function runMeteorologyTests() {
  console.log("=== Testing Stage 2: Meteorological Intelligence & Movement Estimation ===\n");

  // -------------------------------------------------------------
  // Test 1: Wind Direction & Bearing Inversion
  // -------------------------------------------------------------
  console.log("[Test 1] Testing Wind Direction & Movement Vector Inversion...");
  assert.strictEqual(degreesToCompass(0), "N");
  assert.strictEqual(degreesToCompass(90), "E");
  assert.strictEqual(degreesToCompass(180), "S");
  assert.strictEqual(degreesToCompass(270), "W");
  assert.strictEqual(degreesToCompass(45), "NE");
  assert.strictEqual(degreesToCompass(135), "SE");
  assert.strictEqual(degreesToCompass(225), "SW");
  assert.strictEqual(degreesToCompass(315), "NW");

  // Critical vector test: Wind FROM East (90°) pushes pollution TOWARD West (270°)
  assert.strictEqual(oppositeBearingDegrees(90), 270, "Wind from East (90°) must push toward West (270°)");
  assert.strictEqual(degreesToCompass(oppositeBearingDegrees(90)), "W");

  // Wind FROM North (0°) pushes pollution TOWARD South (180°)
  assert.strictEqual(oppositeBearingDegrees(0), 180, "Wind from North (0°) must push toward South (180°)");
  assert.strictEqual(degreesToCompass(oppositeBearingDegrees(0)), "S");

  // Wind FROM South-West (225°) pushes pollution TOWARD North-East (45°)
  assert.strictEqual(oppositeBearingDegrees(225), 45, "Wind from SW (225°) must push toward NE (45°)");
  assert.strictEqual(degreesToCompass(oppositeBearingDegrees(225)), "NE");
  console.log("✓ Wind direction conversion and opposite movement bearing verified.");

  // -------------------------------------------------------------
  // Test 2: Google Weather Response Normalization
  // -------------------------------------------------------------
  console.log("\n[Test 2] Testing Google Weather Response Normalization...");
  const mockProvider = new GoogleWeatherProvider("dummy_key", true);

  const rawGoogleCurrent = {
    currentConditions: {
      currentTime: "2026-08-23T00:00:00Z",
      temperature: { degrees: 31.4, unit: "CELSIUS" },
      relativeHumidity: 65,
      wind: {
        speed: { value: 25.0, unit: "KILOMETERS_PER_HOUR" },
        direction: { degrees: 90, cardinal: "EAST" }
      },
      precipitation: {
        qpf: { quantity: 0, unit: "MILLIMETERS" },
        type: "NONE"
      },
      weatherCondition: {
        description: { text: "Haze" }
      },
      visibility: { distance: 6.0 }
    }
  };

  const normalized = mockProvider.normalizeCurrentConditions(rawGoogleCurrent, 28.6139, 77.2090);
  assert.strictEqual(normalized.source, "Google Weather API");
  assert.strictEqual(normalized.temperatureC, 31.4);
  assert.strictEqual(normalized.relativeHumidityPercent, 65);
  assert.strictEqual(normalized.windSpeedKmh, 25.0);
  assert.strictEqual(normalized.windDirectionDegrees, 90);
  assert.strictEqual(normalized.windDirectionCompass, "E");
  assert.strictEqual(normalized.movementDirectionDegrees, 270);
  assert.strictEqual(normalized.movementDirectionCompass, "W");
  assert.strictEqual(normalized.precipitationMm, 0);
  assert.strictEqual(normalized.precipitationType, "NONE");
  assert.strictEqual(normalized.dataStatus, "AVAILABLE");
  console.log("✓ Google Weather response structure successfully parsed and normalized.");

  // -------------------------------------------------------------
  // Test 3: Geodesic Destination & Distance Calculation
  // -------------------------------------------------------------
  console.log("\n[Test 3] Testing Geodesic Destination & Distance Calculations...");
  const startLat = 28.6139;
  const startLng = 77.2090;

  // 25 km/h wind blowing TOWARD West (270°) for 2 hours = 50 km displacement
  const dest50kmWest = computeDestinationPoint(startLat, startLng, 50, 270);
  const actualDistance = haversineDistanceKm(startLat, startLng, dest50kmWest.latitude, dest50kmWest.longitude);
  
  assert.ok(Math.abs(actualDistance - 50) < 0.5, `Calculated distance ${actualDistance}km should be ~50km`);
  assert.ok(dest50kmWest.longitude < startLng, "Moving West must decrease longitude");
  assert.ok(Math.abs(dest50kmWest.latitude - startLat) < 0.1, "Moving strictly West maintains approximate latitude");

  const bearing = calculateBearingDegrees(startLat, startLng, dest50kmWest.latitude, dest50kmWest.longitude);
  assert.ok(Math.abs(bearing - 270) < 1.0, `Bearing ${bearing}° should be ~270° (West)`);
  console.log(`✓ Geodesic calculation verified: 50km displacement -> ${actualDistance}km measured at bearing ${bearing}°.`);

  // -------------------------------------------------------------
  // Test 4: Variable Wind Movement Estimator (Hour-by-Hour)
  // -------------------------------------------------------------
  console.log("\n[Test 4] Testing Variable Wind Multi-Hour Movement Polyline...");
  const mockBaseContext: MeteorologicalContext = {
    source: "Google Weather API",
    observedAt: "2026-08-23T00:00:00Z",
    latitude: startLat,
    longitude: startLng,
    temperatureC: 30,
    relativeHumidityPercent: 60,
    windSpeedKmh: 20,
    windDirectionDegrees: 90, // From East
    windDirectionCompass: "E",
    movementDirectionDegrees: 270, // Toward West
    movementDirectionCompass: "W",
    precipitationMm: 0,
    precipitationType: "NONE",
    dataStatus: "AVAILABLE"
  };

  const mockHourlyForecast = [
    {
      timestamp: "2026-08-23T01:00:00Z",
      hoursAhead: 1,
      temperatureC: 29,
      relativeHumidityPercent: 62,
      windSpeedKmh: 20,
      windDirectionDegrees: 90,
      windDirectionCompass: "E",
      movementDirectionDegrees: 270,
      movementDirectionCompass: "W",
      precipitationMm: 0,
      precipitationType: "NONE" as const
    },
    {
      timestamp: "2026-08-23T02:00:00Z",
      hoursAhead: 2,
      temperatureC: 28,
      relativeHumidityPercent: 65,
      windSpeedKmh: 25,
      windDirectionDegrees: 110, // Shifts toward ESE (pushes WNW)
      windDirectionCompass: "ESE",
      movementDirectionDegrees: 290,
      movementDirectionCompass: "WNW",
      precipitationMm: 0,
      precipitationType: "NONE" as const
    },
    {
      timestamp: "2026-08-23T03:00:00Z",
      hoursAhead: 3,
      temperatureC: 27,
      relativeHumidityPercent: 70,
      windSpeedKmh: 25,
      windDirectionDegrees: 120, // Shifts toward SE (pushes NW)
      windDirectionCompass: "ESE",
      movementDirectionDegrees: 300,
      movementDirectionCompass: "WNW",
      precipitationMm: 0,
      precipitationType: "NONE" as const
    }
  ];

  const estimate = estimatePollutionMovement({
    latitude: startLat,
    longitude: startLng,
    timestamp: "2026-08-23T00:00:00Z",
    horizonHours: 3,
    meteorology: mockBaseContext,
    hourlyForecast: mockHourlyForecast
  });

  assert.strictEqual(estimate.horizonHours, 3);
  assert.strictEqual(estimate.movementPath.length, 4, "Movement path should contain source + 3 hourly waypoints");
  assert.strictEqual(estimate.estimatedTotalDistanceKm, 70, "Total distance should equal 20km + 25km + 25km = 70km");
  assert.strictEqual(estimate.method, "WIND_BASED_APPLICATION_ESTIMATE");
  assert.ok(["W", "WNW", "NW"].includes(estimate.dominantMovementDirection));
  assert.ok(["HIGH", "MEDIUM"].includes(estimate.confidence));
  console.log(`✓ 3-hour variable wind estimation produced polyline with ${estimate.movementPath.length} points, total ~${estimate.estimatedTotalDistanceKm}km.`);

  // -------------------------------------------------------------
  // Test 5: Confidence Scoring & Warning Triggering
  // -------------------------------------------------------------
  console.log("\n[Test 5] Testing Confidence Scoring & Environmental Warnings...");
  
  // High rain scenario
  const rainyContext: MeteorologicalContext = {
    ...mockBaseContext,
    precipitationMm: 12.5,
    precipitationType: "RAIN"
  };
  const rainyEstimate = estimatePollutionMovement({
    latitude: startLat,
    longitude: startLng,
    horizonHours: 3,
    meteorology: rainyContext,
    hourlyForecast: mockHourlyForecast
  });
  assert.ok(rainyEstimate.warnings.some((w) => w.toLowerCase().includes("precipitation") || w.toLowerCase().includes("rain")), "Must generate rain warning");
  assert.ok(rainyEstimate.confidenceScore < estimate.confidenceScore, "Rain must lower confidence score");

  // Calm air scenario
  const calmContext: MeteorologicalContext = {
    ...mockBaseContext,
    windSpeedKmh: 1.5
  };
  const calmEstimate = estimatePollutionMovement({
    latitude: startLat,
    longitude: startLng,
    horizonHours: 2,
    meteorology: calmContext
  });
  assert.strictEqual(calmEstimate.confidence, "LOW", "Calm wind (<3km/h) must yield LOW confidence");
  assert.ok(calmEstimate.warnings.some((w) => w.toLowerCase().includes("calm")), "Must warn about calm wind thermal convection");
  console.log("✓ Confidence degradation and warning generation verified.");

  // -------------------------------------------------------------
  // Test 6: Caching Layer Behavior
  // -------------------------------------------------------------
  console.log("\n[Test 6] Testing In-Memory Meteorological Cache...");
  clearMeteorologyCache();
  assert.strictEqual(getCachedCurrentConditions(startLat, startLng), null);

  setCachedCurrentConditions(startLat, startLng, mockBaseContext, 5);
  const cachedHit = getCachedCurrentConditions(startLat, startLng);
  assert.ok(cachedHit, "Must retrieve cached weather data");
  assert.strictEqual(cachedHit?.temperatureC, 30);

  // Coordinate rounding test (~1.1 km precision)
  const nearbyLat = startLat + 0.0004;
  const nearbyLng = startLng + 0.0004;
  const nearbyHit = getCachedCurrentConditions(nearbyLat, nearbyLng);
  assert.ok(nearbyHit, "Nearby coordinates within 2 decimal places must share cache");
  console.log("✓ Meteorological cache hit, coordinate bucketing, and clearing verified.");

  // -------------------------------------------------------------
  // Test 7: Event Association & Immutability
  // -------------------------------------------------------------
  console.log("\n[Test 7] Testing Pollution Event Association & Immutability...");
  const mockEvent: BricsFederationEvent = {
    eventId: "brics-evt-test-999",
    sourceNodeId: "node-ind-delhi",
    sourceCountry: "IND",
    sourceCountryName: "India",
    sourceFlag: "🇮🇳",
    latitude: startLat,
    longitude: startLng,
    locality: "National Capital Territory, India",
    timestamp: new Date().toISOString(),
    pollutionType: "industrial_smoke",
    pollutantValues: { pm2_5: 310, aqi: 360 },
    severity: "critical",
    confidence: 0.93,
    sourceType: "satellite_sentinel5p",
    verificationStatus: "verified",
    sharedAt: new Date().toISOString()
  };

  const enrichedEvent = await attachMeteorologyToEvent(mockEvent, 6);
  assert.ok(enrichedEvent.meteorology, "Enriched event must have meteorology context attached");
  assert.ok(enrichedEvent.movementEstimate, "Enriched event must have movementEstimate attached");
  assert.strictEqual(enrichedEvent.eventId, mockEvent.eventId, "Event ID must remain identical");
  assert.strictEqual(enrichedEvent.sourceCountry, "IND", "Source country must remain intact");
  assert.strictEqual(enrichedEvent.pollutantValues.pm2_5, 310, "Pollutant values must remain unchanged");
  assert.strictEqual((mockEvent as any).meteorology, undefined, "Original event object must not be mutated");
  console.log("✓ Event meteorology attachment verified without mutating original event object.");

  // -------------------------------------------------------------
  // Test 8: End-to-End Prediction Service
  // -------------------------------------------------------------
  console.log("\n[Test 8] Testing predictMovement Service Method...");
  const predictionResult = await predictMovement({
    latitude: 28.6139,
    longitude: 77.2090,
    horizonHours: 6
  });

  assert.ok(predictionResult.source);
  assert.ok(predictionResult.meteorology);
  assert.ok(predictionResult.prediction);
  assert.strictEqual(predictionResult.method, "WIND_BASED_APPLICATION_ESTIMATE");
  assert.strictEqual(predictionResult.prediction.movementPath.length, 7, "6-hour horizon gives 7 points (T0 to T6)");
  console.log(`✓ Prediction service executed successfully (Destination: ${predictionResult.prediction.dominantMovementDirection}, ~${predictionResult.prediction.estimatedTotalDistanceKm}km).`);

  console.log("\n=== ALL STAGE 2 METEOROLOGICAL INTELLIGENCE TESTS PASSED! ===");
}

runMeteorologyTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
