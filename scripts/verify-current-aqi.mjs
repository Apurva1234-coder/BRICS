const baseUrl = process.env.AIR_BASE_URL || "http://localhost:8787";
const locations = [
  ["Delhi", 28.6139, 77.209],
  ["Pune", 18.5204, 73.8567],
  ["PCMC", 18.6298, 73.7997],
  ["Mumbai", 19.076, 72.8777],
  ["Bengaluru", 12.9716, 77.5946],
  ["Chennai", 13.0827, 80.2707],
  ["Kolkata", 22.5726, 88.3639],
  ["Ahmedabad", 23.0225, 72.5714],
  ["Hyderabad", 17.385, 78.4867],
  ["Lucknow", 26.8467, 80.9462],
  ["Low coverage", 34.1526, 77.5771]
];

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${body.error || "request failed"}`);
  return body;
}

const status = await getJson("/api/air-quality/aqi-status?refresh=true");
const map = await getJson("/api/air-quality/map");
const coverage = map.aqiCoverage || {};
const allowedQualities = new Set(["provider_reported", "rolling_validated", "indicative", "unavailable"]);
if ((coverage.totalPhysicalStations || 0) === 0 && (status.snapshot?.complete || coverage.snapshotComplete)) {
  throw new Error("An empty current-AQI station set must remain incomplete, not complete");
}

for (const point of map.points || []) {
  if (point.aqiQuality && !allowedQualities.has(point.aqiQuality)) throw new Error(`${point.id} has unknown AQI quality ${point.aqiQuality}`);
  if (point.metrics?.aqi !== undefined && !point.aqiStatus?.selected) throw new Error(`${point.id} exposes AQI without structured aqiStatus.selected metadata`);
}

console.log("Current AQI snapshot");
console.log(`- snapshot complete: ${status.snapshot?.complete ?? coverage.snapshotComplete}`);
console.log(`- refreshing: ${status.snapshot?.refreshing ?? "unknown"}`);
console.log(`- validated: ${coverage.validatedEligibleStations ?? status.coverage?.rollingValidated ?? 0}`);
console.log(`- indicative: ${coverage.indicativeEligibleStations ?? status.coverage?.indicative ?? 0}`);
console.log(`- pending: ${coverage.pendingStations ?? status.coverage?.pending ?? 0}`);
console.log(`- insufficient history: ${coverage.insufficientHistoryStations ?? 0}`);
console.log(`- insufficient pollutants: ${coverage.insufficientPollutantStations ?? 0}`);
console.log(`- unavailable: ${coverage.unavailableStations ?? status.coverage?.unavailable ?? 0}`);
console.log(`- total physical stations: ${coverage.totalPhysicalStations ?? status.coverage?.totalPhysicalStations ?? 0}`);
console.log(`- warnings: ${(status.warnings || []).join(" | ") || "none"}`);

for (const [name, lat, lng] of locations) {
  const result = await getJson(`/api/air-quality?lat=${lat}&lng=${lng}`);
  const trace = result.calculationTrace?.trace || result.calculationTrace;
  console.log(`${name}: station=${result.nearestStation || "none"}, AQI=${result.aqi ?? "unavailable"}, quality=${result.aqiQuality || "unavailable"}, dominant=${result.dominantPollutant || "none"}, pollutants=${Object.keys(result.pollutants || {}).length}, coverage=${trace?.coverage?.map?.((item) => `${item.pollutant}:${Math.round(item.coveragePercent || 0)}%`).join(",") || "n/a"}`);
}

console.log("Current AQI verification completed without printing credentials.");
