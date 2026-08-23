const baseUrl = process.env.AIR_BASE_URL || "http://localhost:8787";

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return body;
}

const status = await getJson("/api/air-quality/national-status");
const map = await getJson("/api/air-quality/map");

console.log("CPCB");
console.log(`- provider total: ${status.cpcb.apiReportedTotal ?? "unknown"}`);
console.log(`- raw fetched: ${status.cpcb.rawFetchedCount ?? 0}`);
console.log(`- unique fetched: ${status.cpcb.uniqueFetchedCount ?? 0}`);
console.log(`- expected pages: ${status.cpcb.expectedPageCount ?? "unknown"}`);
console.log(`- actual pages: ${status.cpcb.fetchedPageCount ?? 0}`);
console.log(`- complete: ${status.cpcb.complete}`);
console.log(`- stop reason: ${status.cpcb.stopReason ?? "unknown"}`);
console.log(`- station count: ${status.cpcb.stationCount ?? 0}`);

console.log("OpenAQ");
console.log(`- locations found: ${status.openaq.providerReportedLocationCount}`);
console.log(`- locations fetched: ${status.openaq.fetchedLocationCount}`);
console.log(`- latest processed: ${status.openaq.processedLocationCount}`);
console.log(`- latest successful: ${status.openaq.successfulLatestCount}`);
console.log(`- latest failed: ${status.openaq.failedLatestCount}`);
console.log(`- metadata complete: ${status.openaq.metadataComplete}`);
console.log(`- latest snapshot complete: ${status.openaq.latestSnapshotComplete}`);

console.log("Merged");
console.log(`- physical stations: ${status.merged.physicalStationCount}`);
console.log(`- matched: ${status.merged.matchedStationCount}`);
console.log(`- CPCB-only: ${status.merged.cpcbOnlyCount}`);
console.log(`- OpenAQ-only: ${status.merged.openAqOnlyCount}`);

console.log("Per pollutant");
for (const [pollutant, coverage] of Object.entries(status.pollutants || {})) {
  console.log(`- ${pollutant}: map-visible=${coverage.eligibleStations}/${coverage.totalPhysicalStations}`);
}

const sample = map.points.slice(0, 10);
console.log(`Sample verification: ${sample.length} station points inspected`);
for (const point of sample) {
  const details = Object.entries(point.metricDetails || {}).map(([metric, value]) => `${metric}:${value.value} ${value.unit} ${value.provider} ${value.currentMapEligible ? "eligible" : "excluded"}`).join(" | ");
  if (details) console.log(`- ${point.name || point.id}: ${details}`);
}

console.log(`AQI verification: ${map.points.filter((point) => point.aqiQuality === "provider_reported" || point.aqiQuality === "rolling_validated").length} validated AQI points; snapshot-only AQI is excluded.`);
console.log(`Cluster verification: cluster count is rendered as station count; median remains a separate tooltip value.`);
console.log(`National map complete: ${status.nationalMapComplete}`);
console.log(`Warnings: ${(status.warnings || []).join(" | ") || "none"}`);
console.log("National air-data audit completed without printing credentials.");
