const apiUrl = process.env.API_URL || "http://localhost:8787";
const lat = process.env.AQI_TEST_LAT || "18.5204";
const lng = process.env.AQI_TEST_LNG || "73.8567";

async function readJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, text };
  }
  return { ok: true, status: response.status, json: JSON.parse(text) };
}

const clean = await readJson(`${apiUrl}/api/air-quality?lat=${lat}&lng=${lng}`);
if (!clean.ok) {
  console.error(`AQI request failed: ${clean.status} ${clean.text}`);
  process.exit(1);
}

console.log("Air quality");
console.log(`- selected provider: ${clean.json.provider}`);
console.log(`- AQI: ${clean.json.aqi ?? "unavailable"}`);
console.log(`- category: ${clean.json.category ?? "unavailable"}`);
console.log(`- dominant pollutant: ${clean.json.dominantPollutant ?? "unavailable"}`);
if (clean.json.nearestStation) console.log(`- nearest station: ${clean.json.nearestStation}`);
if (clean.json.rawSummary) console.log(`- summary: ${clean.json.rawSummary}`);

const sources = await readJson(`${apiUrl}/api/air-quality/sources?lat=${lat}&lng=${lng}`);
if (!sources.ok) {
  console.error(`AQI sources request failed: ${sources.status} ${sources.text}`);
  process.exit(1);
}
console.log("Air quality sources");
console.log(`- selected provider: ${sources.json.selectedProvider}`);
console.log(`- cpcb usable: ${sources.json.cpcb.usable}`);
console.log(`- cpcb reason: ${sources.json.cpcb.reason}`);
console.log(`- openaq usable: ${sources.json.openaq.usable}`);
console.log(`- openaq reason: ${sources.json.openaq.reason}`);

const cpcbStatus = await readJson(`${apiUrl}/api/air-quality/cpcb/status`);
if (!cpcbStatus.ok) {
  console.error(`CPCB status request failed: ${cpcbStatus.status} ${cpcbStatus.text}`);
  process.exit(1);
}
console.log("CPCB status");
console.log(`- configured: ${cpcbStatus.json.configured}`);
console.log(`- stations: ${cpcbStatus.json.stationCount}`);
console.log(`- usable records: ${cpcbStatus.json.usableRecordCount}`);
console.log(`- latest update: ${cpcbStatus.json.latestUpdate ?? "unavailable"}`);
console.log(`- complete: ${cpcbStatus.json.complete}`);

const nearbyCpcb = await readJson(`${apiUrl}/api/air-quality/cpcb/nearby?lat=${lat}&lng=${lng}&radiusKm=30&limit=8`);
if (!nearbyCpcb.ok) {
  console.error(`CPCB nearby request failed: ${nearbyCpcb.status} ${nearbyCpcb.text}`);
  process.exit(1);
}
console.log(`- nearby CPCB stations: ${nearbyCpcb.json.stationCount}`);

const context = await readJson(`${apiUrl}/api/air-quality/cpcb/local-context?lat=${lat}&lng=${lng}&radiusKm=25`);
if (!context.ok) {
  console.error(`CPCB local context request failed: ${context.status} ${context.text}`);
  process.exit(1);
}
console.log(`- local context pollutants: ${Object.keys(context.json.pollutants || {}).length}`);

const openAqNearby = await readJson(`${apiUrl}/api/air-quality/openaq/nearby?lat=${lat}&lng=${lng}&radiusKm=25&limit=8`);
if (!openAqNearby.ok) {
  console.error(`OpenAQ nearby request failed: ${openAqNearby.status} ${openAqNearby.text}`);
  process.exit(1);
}
console.log(`- nearby OpenAQ stations: ${openAqNearby.json.stationCount}`);

const forecast = await readJson(`${apiUrl}/api/air-quality/forecast-24h?lat=${lat}&lng=${lng}`);
if (!forecast.ok) {
  console.error(`24h forecast request failed: ${forecast.status} ${forecast.text}`);
  process.exit(1);
}
console.log(`- 24h prediction provider: ${forecast.json.provider}`);
console.log(`- 24h prediction reason: ${forecast.json.reason ?? "available"}`);

const map = await readJson(`${apiUrl}/api/air-quality/map`);
if (!map.ok) {
  console.error(`AQI map request failed: ${map.status} ${map.text}`);
  process.exit(1);
}
const cpcbPoints = map.json.points.filter((point) => point.provider === "cpcb_data_gov").length;
const openAqPoints = map.json.points.filter((point) => point.provider === "openaq").length;
console.log("Air quality map");
console.log(`- country: ${map.json.country}`);
console.log(`- generated at: ${map.json.generatedAt}`);
console.log(`- cpcb usable: ${map.json.cpcbUsable}`);
console.log(`- cpcb reason: ${map.json.cpcbReason}`);
console.log(`- openaq usable: ${map.json.openAqUsable}`);
console.log(`- openaq reason: ${map.json.openAqReason}`);
console.log(`- total map points: ${map.json.points.length}`);
console.log(`- cpcb map points: ${cpcbPoints}`);
console.log(`- openaq map points: ${openAqPoints}`);
if (!map.json.points.length && (map.json.cpcbUsable || map.json.openAqUsable)) {
  console.error("AQI map marked a provider usable but returned no map points.");
  process.exit(1);
}

const debug = await readJson(`${apiUrl}/api/air-quality/debug?lat=${lat}&lng=${lng}`);
if (debug.ok) {
  console.log("Air quality debug");
  console.log(`- openaq configured: ${debug.json.openAqConfigured}`);
  console.log(`- openaq usable: ${debug.json.openAqUsable}`);
  console.log(`- openaq reason: ${debug.json.openAqReason}`);
  console.log(`- cpcb configured: ${debug.json.cpcbConfigured}`);
  console.log(`- cpcb usable: ${debug.json.cpcbUsable}`);
  console.log(`- cpcb reason: ${debug.json.cpcbReason}`);
  console.log(`- cpcb record count: ${debug.json.cpcbRecordCount ?? "n/a"}`);
  console.log(`- cpcb nearest station: ${debug.json.cpcbNearestStation ?? "n/a"}`);
  console.log(`- final selected provider: ${debug.json.selectedProvider}`);
} else {
  console.log(`Air quality debug unavailable: ${debug.status}`);
}
