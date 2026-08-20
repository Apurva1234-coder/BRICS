import fs from "node:fs/promises";
import path from "node:path";

type PollutantKey = "NO2" | "SO2" | "CO" | "O3" | "HCHO";
type SatelliteRequest = { country: string; pollutant: PollutantKey; startDate: string; endDate: string };

const DATASETS: Record<PollutantKey, { dataset: string; band: string; unit: string; min: number; max: number }> = {
  NO2: { dataset: "COPERNICUS/S5P/OFFL/L3_NO2", band: "tropospheric_NO2_column_number_density", unit: "mol/m²", min: 0, max: 0.0002 },
  SO2: { dataset: "COPERNICUS/S5P/OFFL/L3_SO2", band: "SO2_column_number_density", unit: "mol/m²", min: 0, max: 0.001 },
  CO: { dataset: "COPERNICUS/S5P/OFFL/L3_CO", band: "CO_column_number_density", unit: "mol/m²", min: 0, max: 0.05 },
  O3: { dataset: "COPERNICUS/S5P/OFFL/L3_O3", band: "O3_column_number_density", unit: "mol/m²", min: 0, max: 0.5 },
  HCHO: { dataset: "COPERNICUS/S5P/OFFL/L3_HCHO", band: "tropospheric_HCHO_column_number_density", unit: "mol/m²", min: 0, max: 0.0005 }
};

const cache = new Map<string, { expires: number; value: Record<string, unknown> }>();
let eeModulePromise: Promise<any> | undefined;
let eeReady: Promise<void> | undefined;

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

async function loadEarthEngine() {
  if (!eeModulePromise) eeModulePromise = import("@google/earthengine");
  const imported = await eeModulePromise;
  return (imported as any).default || imported;
}

async function initializeEarthEngine() {
  if (eeReady) return eeReady;
  eeReady = (async () => {
    const ee = await loadEarthEngine();
    if (ee.data.isInitialized?.()) return;
    const keyPath = process.env.EARTH_ENGINE_PRIVATE_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const keyJson = process.env.EARTH_ENGINE_PRIVATE_KEY_JSON;
    if (!keyJson && !keyPath) throw new Error("EARTH_ENGINE_NOT_CONFIGURED");
    const key = keyJson ? JSON.parse(keyJson) : JSON.parse(await fs.readFile(path.resolve(keyPath!), "utf8"));
    await new Promise<void>((resolve, reject) => ee.data.authenticateViaPrivateKey(key, resolve, reject));
    await new Promise<void>((resolve, reject) => ee.initialize(null, null, resolve, reject, process.env.EARTH_ENGINE_PROJECT || process.env.GOOGLE_CLOUD_PROJECT));
  })().catch((error) => { eeReady = undefined; throw error; });
  return eeReady;
}

function getMapId(ee: any, image: any, visParams: Record<string, unknown>) {
  return new Promise<any>((resolve, reject) => ee.data.getMapId({ image, vis_params: visParams }, (map: any, error: any) => error ? reject(error) : resolve(map)));
}

export async function getSatelliteMap(input: SatelliteRequest) {
  const pollutant = DATASETS[input.pollutant];
  if (!pollutant || input.country.toUpperCase() !== "INDIA") throw new Error("Only India satellite coverage is currently available.");
  if (!validDate(input.startDate) || !validDate(input.endDate) || input.startDate >= input.endDate) throw new Error("Invalid satellite date range.");
  const key = `${input.country}:${input.pollutant}:${input.startDate}:${input.endDate}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  await initializeEarthEngine();
  const ee = await loadEarthEngine();
  const region = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017").filter(ee.Filter.eq("country_na", "India")).geometry();
  const image = ee.ImageCollection(pollutant.dataset).filterDate(input.startDate, input.endDate).filterBounds(region).select(pollutant.band).mean().clip(region);
  const map = await getMapId(ee, image, { min: pollutant.min, max: pollutant.max, palette: ["081d58", "41b6c4", "a1dab4", "ffffcc", "fdae61", "d7191c"] });
  const tileUrl = map?.tile_fetcher?.url_format || (map?.mapid ? `https://earthengine.googleapis.com/v1alpha/${map.mapid}/tiles/{z}/{x}/{y}` : undefined);
  if (!tileUrl) throw new Error("EARTH_ENGINE_TILE_UNAVAILABLE");
  const value = { success: true, country: "India", pollutant: input.pollutant, source: "Sentinel-5P / Google Earth Engine", dataset: pollutant.dataset, band: pollutant.band, tileUrl, legend: { label: "Relative satellite concentration", unit: pollutant.unit, min: pollutant.min, max: pollutant.max }, metadata: { startDate: input.startDate, endDate: input.endDate } };
  cache.set(key, { expires: Date.now() + 15 * 60_000, value });
  return value;
}
