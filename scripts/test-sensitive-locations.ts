import assert from "node:assert/strict";
import {
  CuratedReferenceLocationProvider,
  findNearbySensitiveLocations,
  evaluateSensitiveLocationsSync,
  type SensitiveLocationProvider
} from "../server/services/sensitiveLocationService.js";
import type { SensitiveLocation } from "../server/types.js";

// 1. Coordinates with no facilities nearby (e.g. remote ocean coordinate)
{
  const result = await findNearbySensitiveLocations(0.0, 0.0, 1000);
  assert.equal(result.hasSensitiveLocations, false);
  assert.equal(result.totalCount, 0);
  assert.equal(result.impactScore, 0);
  assert.equal(result.locations.length, 0);
  assert.equal(result.categoryCounts.school, 0);
  assert.equal(result.categoryCounts.hospital, 0);
  console.log("✓ test-sensitive-locations: empty area returns 0 locations");
}

// 2. Proximity detection in Pune Camp / Deccan area (near Ruby Hall & Jehangir Hospital)
{
  // Point near Ruby Hall Clinic (18.5312, 73.8765)
  const result = await findNearbySensitiveLocations(18.5310, 73.8760, 1200);
  assert.equal(result.hasSensitiveLocations, true);
  assert.ok(result.totalCount >= 1, "Must find at least Ruby Hall or Jehangir Hospital");
  assert.ok(result.categoryCounts.hospital >= 1);
  assert.ok(result.impactScore > 0);

  // Check distance sorting
  for (let i = 1; i < result.locations.length; i++) {
    assert.ok(result.locations[i].distanceMeters >= result.locations[i - 1].distanceMeters, "locations must be sorted by distance ascending");
  }
  console.log("✓ test-sensitive-locations: facility detection and distance sorting passed");
}

// 3. Category count aggregation
{
  const provider: SensitiveLocationProvider = {
    getNearbyLocations: (lat, lng) => [
      { id: "S1", name: "School 1", category: "school", lat: lat + 0.001, lng, distanceMeters: 100, impactRadiusMeters: 1000, source: "curated_demo" },
      { id: "S2", name: "School 2", category: "school", lat: lat + 0.002, lng, distanceMeters: 200, impactRadiusMeters: 1000, source: "curated_demo" },
      { id: "H1", name: "Hospital 1", category: "hospital", lat: lat + 0.003, lng, distanceMeters: 300, impactRadiusMeters: 1200, source: "curated_demo" },
      { id: "C1", name: "Childcare 1", category: "childcare", lat: lat + 0.004, lng, distanceMeters: 400, impactRadiusMeters: 800, source: "curated_demo" },
      { id: "E1", name: "Elderly Care 1", category: "elderly_care", lat: lat + 0.005, lng, distanceMeters: 500, impactRadiusMeters: 800, source: "curated_demo" }
    ]
  };

  const result = await findNearbySensitiveLocations(18.5, 73.8, 1000, provider);
  assert.equal(result.totalCount, 5);
  assert.equal(result.categoryCounts.school, 2);
  assert.equal(result.categoryCounts.hospital, 1);
  assert.equal(result.categoryCounts.childcare, 1);
  assert.equal(result.categoryCounts.elderly_care, 1);
  assert.ok(result.summary.includes("2 schools"));
  assert.ok(result.summary.includes("1 hospital"));
  assert.ok(result.summary.includes("1 childcare centre"));
  assert.ok(result.summary.includes("1 elderly-care facility"));
  console.log("✓ test-sensitive-locations: multi-category aggregation and summary passed");
}

// 4. Synchronous evaluation helper
{
  const syncResult = evaluateSensitiveLocationsSync(18.5310, 73.8760, 1200);
  assert.equal(syncResult.hasSensitiveLocations, true);
  assert.ok(syncResult.locations.length > 0);
  console.log("✓ test-sensitive-locations: sync evaluation helper passed");
}

console.log("\nAll sensitive location tests passed successfully!");
