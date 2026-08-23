import assert from "node:assert/strict";
import { calculateRollingIndianAqi, calculateIndicativeCpcbAqi, calculateProviderAverageAqi } from "../server/airQuality/aqi.js";
import { classifyCpcbRow, cpcbMeasurementEligibility, clearCpcbCache, fetchCpcbDataset } from "../server/services/cpcbService.js";
import { readFile } from "node:fs/promises";

const now = new Date("2026-07-14T00:00:00.000Z");
const base = {
  station: "Fixture Station",
  city: "Pune",
  state: "Maharashtra",
  latitude: "18.52",
  longitude: "73.85",
  pollutant_id: "PM25",
  last_update: "2026-07-13T23:00:00.000Z"
};

const average = classifyCpcbRow({ ...base, pollutant_avg: "42", pollutant_min: "40", pollutant_max: "45" }, now);
assert.equal(average.classification, "valid_average");
assert.equal(cpcbMeasurementEligibility(average, now).displayAsCurrentMeasurement, true);
assert.equal(cpcbMeasurementEligibility(classifyCpcbRow({ ...base, pollutant_max: "80" }, now), now).displayAsCurrentMeasurement, false);
assert.equal(cpcbMeasurementEligibility(classifyCpcbRow({ ...base, pollutant_avg: "-1" }, now), now).displayAsCurrentMeasurement, false);
assert.equal(cpcbMeasurementEligibility(classifyCpcbRow({ ...base, pollutant_avg: "42", last_update: "2026-07-12T00:00:00.000Z" }, now), now).displayAsCurrentMeasurement, false);

process.env.DATA_GOV_API_KEY = "fixture";
process.env.CPCB_HARD_MAX_PAGES = "1000";
process.env.CPCB_PAGE_LIMIT = "1000";
clearCpcbCache();
const originalFetch = globalThis.fetch;
const pageSize = 2;
const total = 52;
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const offset = Number(url.searchParams.get("offset") || 0);
  const records = offset < total
    ? Array.from({ length: Math.min(pageSize, total - offset) }, (_, index) => ({ ...base, station: `Station ${offset + index}`, pollutant_avg: String(20 + ((offset + index) % 30)) }))
    : [];
  return new Response(JSON.stringify({ total, limit: pageSize, offset, records }), { status: 200, headers: { "content-type": "application/json" } });
};
const dataset = await fetchCpcbDataset();
assert.equal(dataset.metadata.apiReportedTotal, total);
assert.equal(dataset.metadata.uniqueFetchedCount, total);
assert.equal(dataset.metadata.fetchedPageCount, 26);
assert.equal(dataset.metadata.complete, true);
assert.equal(dataset.metadata.stopReason, "api_total_reached");
globalThis.fetch = originalFetch;
clearCpcbCache();

globalThis.fetch = async () => new Response(JSON.stringify({ total: 4, limit: 2, records: [{ ...base, station: "Repeated Station", pollutant_avg: "40" }, { ...base, station: "Repeated Station 2", pollutant_avg: "41" }] }), { status: 200, headers: { "content-type": "application/json" } });
const repeated = await fetchCpcbDataset();
assert.equal(repeated.metadata.complete, false);
assert.equal(repeated.metadata.stopReason, "repeated_page_before_total");
globalThis.fetch = originalFetch;
clearCpcbCache();

const rolling = calculateRollingIndianAqi([
  { pollutant: "PM2.5", value: 42, averagingHours: 24, stationId: "fixture", coverage: { averagingHours: 24, observedHourlySlots: 24, expectedHourlySlots: 24 } },
  { pollutant: "PM10", value: 80, averagingHours: 24, stationId: "fixture", coverage: { averagingHours: 24, observedHourlySlots: 24, expectedHourlySlots: 24 } },
  { pollutant: "NO2", value: 24, averagingHours: 24, stationId: "fixture", coverage: { averagingHours: 24, observedHourlySlots: 24, expectedHourlySlots: 24 } }
]);
assert.equal(rolling.status, "available");
assert.equal(rolling.isOfficial, false);
assert.equal(rolling.quality, "rolling_validated");
const indicative = calculateIndicativeCpcbAqi([
  { pollutant: "PM2.5", value: 42, valueKind: "average", stationId: "cpcb-fixture", measuredAt: "2026-07-14T00:00:00.000Z", freshness: "fresh", unitCompatible: true },
  { pollutant: "PM10", value: 80, valueKind: "average", stationId: "cpcb-fixture", measuredAt: "2026-07-14T00:00:00.000Z", freshness: "fresh", unitCompatible: true },
  { pollutant: "NO2", value: 24, valueKind: "average", stationId: "cpcb-fixture", measuredAt: "2026-07-14T00:00:00.000Z", freshness: "fresh", unitCompatible: true }
]);
assert.equal(indicative.status, "available");
assert.equal(indicative.quality, "indicative");
assert.equal(indicative.averagingPeriodsVerified, false);
const staleIndicative = calculateIndicativeCpcbAqi([{ pollutant: "PM2.5", value: 42, valueKind: "average", stationId: "cpcb-fixture", measuredAt: "2026-07-12T00:00:00.000Z", freshness: "stale", unitCompatible: true }]);
assert.equal(staleIndicative.aqi, undefined);
const snapshot = calculateProviderAverageAqi([{ pollutant: "PM2.5", value: 42, averagingHours: 24, averagingPeriodVerified: false }]);
assert.equal(snapshot.status, "unverified_averaging_period");
assert.equal(snapshot.isOfficial, false);

const airQualityServiceSource = await readFile("server/services/airQualityService.ts", "utf8");
const nationalServiceSource = await readFile("server/services/openAqNationalSnapshotService.ts", "utf8");
assert.equal(airQualityServiceSource.includes("REFERENCE_CITIES"), false);
assert.equal(airQualityServiceSource.includes("getOpenAqNationalSnapshot"), true);
assert.equal(nationalServiceSource.includes('iso: \"IN\"'), true);
assert.equal(nationalServiceSource.includes('mobile: \"false\"'), true);
assert.equal(nationalServiceSource.includes("OPENAQ_SYNC_CONCURRENCY"), true);

console.log("Air-data truth tests passed: dynamic CPCB pagination, eligibility, and AQI provenance.");
