import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRollingWindow, dedupeHourlySeries } from "../server/airQuality/hourlySeries.js";
import { calculateIndicativeCpcbAqi, calculateRollingIndianAqi } from "../server/airQuality/aqi.js";

const endAt = "2026-07-14T00:00:00.000Z";
const hourly = (value: number, pollutant: "PM2.5" | "PM10" | "NO2") => Array.from({ length: 24 }, (_, index) => ({
  sensorId: pollutant === "PM2.5" ? 1 : pollutant === "PM10" ? 2 : 3,
  pollutant,
  dateTime: new Date(Date.parse(endAt) - (23 - index) * 3_600_000).toISOString(),
  value,
  unit: pollutant === "NO2" ? "µg/m³" : "µg/m³",
  unitCompatible: true
}));

const duplicate = dedupeHourlySeries([...hourly(20, "PM2.5"), { ...hourly(20, "PM2.5")[0], value: 22 }]);
assert.equal(duplicate.length, 24);
assert.equal(duplicate[0].value, 20);

const windows = [
  buildRollingWindow("PM2.5", hourly(20, "PM2.5"), { endAt, maxAgeHours: 1000 }),
  buildRollingWindow("PM10", hourly(40, "PM10"), { endAt, maxAgeHours: 1000 }),
  buildRollingWindow("NO2", hourly(18, "NO2"), { endAt, maxAgeHours: 1000 })
];
assert.ok(windows.every((window) => window.valid && window.rollingConcentration !== undefined));
const rolling = calculateRollingIndianAqi(windows.map((window) => ({
  pollutant: window.pollutant,
  value: window.rollingConcentration!,
  averagingHours: window.averagingHours,
  stationId: "fixture-station",
  coverage: { averagingHours: window.averagingHours, observedHourlySlots: window.observedHourlySlots + window.interpolatedHourlySlots, expectedHourlySlots: window.expectedHourlySlots }
})));
assert.equal(rolling.quality, "rolling_validated");
assert.equal(rolling.calculationType, "rolling_history_calculated");

const gapSeries = hourly(20, "PM2.5").filter((_, index) => index !== 5 && index !== 6 && index !== 7 && index !== 8);
const gapWindow = buildRollingWindow("PM2.5", gapSeries, { endAt, maxAgeHours: 1000, maxInterpolatedGapHours: 2 });
assert.equal(gapWindow.valid, false);
assert.ok(gapWindow.invalidReasons.includes("long_or_unfillable_gap"));

const insufficient = calculateRollingIndianAqi([{ pollutant: "PM2.5", value: 20, averagingHours: 24, stationId: "fixture-station", coverage: { averagingHours: 24, observedHourlySlots: 24, expectedHourlySlots: 24 } }]);
assert.equal(insufficient.status, "insufficient_pollutants");
assert.ok(insufficient.warnings?.includes("insufficient_pollutants"));

const mixedStations = calculateRollingIndianAqi([
  { pollutant: "PM2.5", value: 20, averagingHours: 24, stationId: "a", coverage: { averagingHours: 24, observedHourlySlots: 24, expectedHourlySlots: 24 } },
  { pollutant: "PM10", value: 40, averagingHours: 24, stationId: "b", coverage: { averagingHours: 24, observedHourlySlots: 24, expectedHourlySlots: 24 } },
  { pollutant: "NO2", value: 18, averagingHours: 24, stationId: "a", coverage: { averagingHours: 24, observedHourlySlots: 24, expectedHourlySlots: 24 } }
]);
assert.equal(mixedStations.status, "insufficient_pollutants");
assert.ok(mixedStations.warnings?.includes("multiple_physical_stations"));

const indicative = calculateIndicativeCpcbAqi([
  { pollutant: "PM2.5", value: 20, valueKind: "average", stationId: "cpcb", measuredAt: "2026-07-14T00:00:00.000Z", freshness: "fresh", unitCompatible: true },
  { pollutant: "PM10", value: 40, valueKind: "average", stationId: "cpcb", measuredAt: "2026-07-14T00:00:00.000Z", freshness: "fresh", unitCompatible: true },
  { pollutant: "NO2", value: 18, valueKind: "average", stationId: "cpcb", measuredAt: "2026-07-14T00:00:00.000Z", freshness: "fresh", unitCompatible: true }
]);
assert.equal(indicative.quality, "indicative");
assert.equal(indicative.averagingPeriodsVerified, false);

const synchronizerSource = await readFile("server/services/currentAqiSnapshotService.ts", "utf8");
assert.equal(synchronizerSource.includes("cursor += batch.length"), false);
assert.ok(synchronizerSource.includes("cursor += advanced"));

console.log("Current AQI tests passed: rolling coverage, gaps, sufficiency, station consistency, and indicative CPCB handling.");
