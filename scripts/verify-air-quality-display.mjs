const baseUrl = process.env.AIR_BASE_URL || "http://localhost:8787";
const locations = [
  ["Pune", 18.5204, 73.8567],
  ["PCMC", 18.6298, 73.7997],
  ["Delhi", 28.6139, 77.209],
  ["Weak coverage", 34.1526, 77.5771]
];

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return body;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function checkCoordinates(item, label) {
  if (!finite(item?.lat) || !finite(item?.lng) || item.lat < -90 || item.lat > 90 || item.lng < -180 || item.lng > 180) {
    throw new Error(`${label} has invalid coordinates`);
  }
}

function checkStation(station, label) {
  checkCoordinates(station, label);
  if (finite(station.distanceMeters) && station.distanceMeters < 0) throw new Error(`${label} has negative distance`);
  if (!station.freshness) throw new Error(`${label} is missing freshness`);
  for (const [pollutant, reading] of Object.entries(station.pollutants || station.readings || {})) {
    if (reading.value !== undefined && (!finite(reading.value) || reading.value < 0)) throw new Error(`${label} ${pollutant} has invalid value`);
    if (reading.min !== undefined && reading.max !== undefined && reading.min > reading.max) throw new Error(`${label} ${pollutant} has inverted range`);
  }
}

const status = await getJson("/api/air-quality/cpcb/status");
if (status.configured && (!finite(status.stationCount) || !Array.isArray(status.pollutantsAvailable))) throw new Error("CPCB status is incomplete");
console.log(`CPCB status: ${status.configured ? `${status.stationCount} stations, ${status.pollutantsAvailable.length} pollutants` : "unavailable"}`);

for (const [name, lat, lng] of locations) {
  const query = `lat=${lat}&lng=${lng}&radiusKm=25`;
  const source = await getJson(`/api/air-quality/sources?${query}`);
  const selected = source.selected || {};
  if (selected.aqi !== undefined && (!finite(selected.aqi) || selected.aqi < 0)) throw new Error(`${name} has invalid AQI`);
  if (selected.aqi !== undefined && !selected.category) throw new Error(`${name} AQI is missing category`);
  if (finite(selected.nearestStationDistanceMeters) && selected.nearestStationDistanceMeters > 25000) throw new Error(`${name} selected station exceeds 25 km`);
  checkCoordinates({ lat, lng }, name);

  const nearby = await getJson(`/api/air-quality/cpcb/nearby?${query}&limit=8`);
  for (const station of nearby.stations || []) checkStation(station, `${name} nearby station`);
  const local = await getJson(`/api/air-quality/cpcb/local-context?${query}&pollutant=all`);
  checkCoordinates(local, `${name} local context`);
  for (const [pollutant, reading] of Object.entries(local.pollutants || {})) {
    for (const field of ["nearestValue", "minNearby", "maxNearby", "avgNearby", "idwEstimate"]) {
      if (reading[field] !== undefined && (!finite(reading[field]) || reading[field] < 0)) throw new Error(`${name} ${pollutant} ${field} invalid`);
    }
  }

  const forecast = await getJson(`/api/air-quality/forecast-24h?${query}`);
  const horizons = Object.entries(forecast.predictions || {}).filter(([, value]) => finite(value) && value >= 0).map(([key]) => key);
  for (const hour of forecast.hourly || []) if (hour.aqi !== undefined && (!finite(hour.aqi) || hour.aqi < 0)) throw new Error(`${name} forecast has invalid AQI`);
  console.log(`${name}: provider=${selected.provider || "unavailable"}, AQI=${finite(selected.aqi) ? selected.aqi : "unavailable"}, CPCB stations=${nearby.stationCount ?? 0}, forecast=${horizons.join(",") || "unavailable"}`);
}

console.log("Air-quality display verification passed without printing credentials.");
