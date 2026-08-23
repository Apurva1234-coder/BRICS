import assert from "node:assert/strict";
import { calculateIndianAqi } from "../server/airQuality/aqi.js";
import { parseCpcbNumber, parseCpcbTimestamp, freshnessFromAge } from "../server/airQuality/parsing.js";
import { classifyCpcbRow, normalizeCpcbPollutant } from "../server/services/cpcbService.js";

assert.deepEqual(parseCpcbNumber("NA").status, "missing");
assert.deepEqual(parseCpcbNumber("-1").status, "invalid");
assert.equal(parseCpcbNumber("72.5").value, 72.5);

const now = new Date("2026-07-13T12:00:00.000Z");
const parsedIst = parseCpcbTimestamp("13-07-2026 16:30:00", now);
assert.equal(parsedIst.valid, true);
assert.equal(parsedIst.parsedAt, "2026-07-13T11:00:00.000Z");
assert.equal(parseCpcbTimestamp("31-02-2026 10:00:00", now).valid, false);
assert.equal(freshnessFromAge(2), "fresh");
assert.equal(freshnessFromAge(8), "usable");
assert.equal(freshnessFromAge(20), "stale");
assert.equal(freshnessFromAge(30), "expired");

assert.equal(normalizeCpcbPollutant("PM_2.5"), "PM2.5");
assert.equal(normalizeCpcbPollutant("O3"), "OZONE");
const row = classifyCpcbRow({ station: "Test Station", city: "Pune", state: "Maharashtra", latitude: "18.52", longitude: "73.85", pollutant_id: "PM25", pollutant_avg: "72", pollutant_min: "60", pollutant_max: "90", last_update: "13-07-2026 16:30:00" }, now);
assert.equal(row.classification, "valid_average");

const aqi = calculateIndianAqi([{ pollutant: "PM2.5", value: 72 }, { pollutant: "PM10", value: 90 }]);
assert.equal(aqi.aqi, 139);
assert.equal(aqi.dominantPollutant, "PM2.5");

console.log("AQI primitives passed");
