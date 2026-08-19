import { getForecastDisplayState, getPublicCurrentAqiState } from "../src/services/airQualityDisplay";

const base = {
  provider: "openaq",
  status: "available",
  pollutants: {},
  lastUpdate: new Date().toISOString(),
  station: { distanceMeters: 1000 },
  readings: { "PM2.5": { value: 0, unit: "ug/m3", usableForAqi: true } }
} as any;

if (getPublicCurrentAqiState({ ...base, aqi: 0 }).state !== "reliable") throw new Error("AQI zero must remain valid");
if (getPublicCurrentAqiState({ ...base, aqi: Number.NaN }).aqi !== undefined) throw new Error("NaN AQI must be hidden");
if (getPublicCurrentAqiState({ ...base, aqi: 10, station: { distanceMeters: 26000 } }).state !== "unavailable") throw new Error("Distant station must be blocked");
if (!getForecastDisplayState({ provider: "locally_forecast", predictions: { "1h": 0 }, categories: {}, hourly: [] } as any).available) throw new Error("Forecast AQI zero must remain valid");
if (getForecastDisplayState({ provider: "locally_forecast", predictions: {}, categories: {}, hourly: [] } as any).available) throw new Error("Empty forecast must stay hidden");
console.log("Air-quality display helper tests passed.");
