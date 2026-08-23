import type { AirQualityAqiResult, AirQualitySummary, AirQualityStation, CpcbPollutantCode, NormalizedPollutantReading } from "../types.js";
import { calculateIndianAqi } from "../airQuality/aqi.js";
import { BRICS_COUNTRIES_CONFIG, findBricsCountry, type BricsCountryInfo } from "../data/bricsCountries.js";

type OpenMeteoResponse = {
  latitude?: number;
  longitude?: number;
  current?: {
    time?: string;
    pm2_5?: number;
    pm10?: number;
    carbon_monoxide?: number;
    nitrogen_dioxide?: number;
    sulphur_dioxide?: number;
    ozone?: number;
  };
};

const ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality";
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { expires: number; value: AirQualitySummary }>();
const countryCaches = new Map<string, { expires: number; value: OpenMeteoNationalPoint[] }>();

function coordinateKey(lat: number, lng: number) {
  return `${lat.toFixed(2)}:${lng.toFixed(2)}`;
}

function reading(pollutant: CpcbPollutantCode, value: number | undefined, unit: string, measuredAt: string | undefined): NormalizedPollutantReading | undefined {
  if (!Number.isFinite(value) || value === undefined || value < 0) return undefined;
  return {
    pollutant,
    value,
    unit,
    provider: "open_meteo",
    station: "Open-Meteo area model",
    stationId: "open-meteo-area-model",
    measuredAt,
    freshness: "usable",
    valueKind: "instantaneous",
    aggregationPeriod: "hourly",
    aggregationPeriodVerified: false,
    unitCompatible: true,
    usableForCurrentFusion: true,
    usableForAqi: false,
    status: "available",
    warnings: ["modelled_hourly_reading"]
  };
}

function summaryFromPayload(lat: number, lng: number, payload: OpenMeteoResponse, name = "Open-Meteo area model"): AirQualitySummary {
    const key = coordinateKey(lat, lng);
    const current = payload.current;
    if (!current) throw new Error("Open-Meteo returned no current air-quality data.");
    const measuredAt = current.time ? new Date(current.time).toISOString() : new Date().toISOString();
    const readings = Object.fromEntries([
      ["PM2.5", reading("PM2.5", current.pm2_5, "µg/m³", measuredAt)],
      ["PM10", reading("PM10", current.pm10, "µg/m³", measuredAt)],
      // Open-Meteo supplies CO in µg/m³; the AQI breakpoint uses mg/m³.
      ["CO", reading("CO", current.carbon_monoxide === undefined ? undefined : current.carbon_monoxide / 1_000, "mg/m³", measuredAt)],
      ["NO2", reading("NO2", current.nitrogen_dioxide, "µg/m³", measuredAt)],
      ["SO2", reading("SO2", current.sulphur_dioxide, "µg/m³", measuredAt)],
      ["OZONE", reading("OZONE", current.ozone, "µg/m³", measuredAt)]
    ].flatMap(([pollutant, item]) => item ? [[pollutant, item]] : [])) as Partial<Record<CpcbPollutantCode, NormalizedPollutantReading>>;
    const aqiCalculation = calculateIndianAqi(Object.values(readings).flatMap((item) => item?.value === undefined ? [] : [{ pollutant: item.pollutant, value: item.value }]));
    const aqi: AirQualityAqiResult | undefined = aqiCalculation.aqi === undefined || !aqiCalculation.category ? undefined : {
      value: aqiCalculation.aqi,
      category: aqiCalculation.category,
      quality: "indicative",
      calculationType: "reported_average_estimate",
      isOfficial: false,
      dominantPollutant: aqiCalculation.dominantPollutant,
      averagingPeriodsVerified: false,
      coverageValidated: false,
      subIndices: Object.fromEntries(Object.entries(aqiCalculation.subIndices).map(([pollutant, subIndex]) => [pollutant, { concentration: readings[pollutant as CpcbPollutantCode]?.value || 0, subIndex, sourceProvider: "open_meteo", stationId: "open-meteo-area-model" }])),
      calculationTrace: { source: "Open-Meteo", readingType: "modelled_hourly" },
      warnings: ["Modelled hourly readings are an indicative estimate, not official monitoring-station AQI."]
    };
    const station: AirQualityStation = {
      id: `open-meteo:${key}`,
      name,
      provider: "open_meteo",
      lat,
      lng,
      lastUpdate: measuredAt,
      freshness: "usable",
      pollutants: readings,
      attribution: "Open-Meteo",
      license: "CC BY 4.0"
    };
    return {
      provider: "open_meteo",
      status: "available",
      aqi: aqi?.value,
      category: aqi?.category,
      dominantPollutant: aqi?.dominantPollutant,
      pollutants: readings,
      readings,
      nearestStation: station.name,
      lastUpdate: measuredAt,
      station,
      nearbyStations: [station],
      confidence: "low",
      warnings: [{ code: "provider_error", provider: "open_meteo", message: "Showing an indicative Open-Meteo area estimate because no nearby official monitoring-station reading is available." }],
      calculationType: aqi?.calculationType || "unavailable",
      aqiQuality: aqi?.quality || "unavailable",
      isOfficial: false,
      calculationTrace: aqi?.calculationTrace,
      rawSummary: aqi ? `Indicative AQI ${aqi.value}; estimated from Open-Meteo hourly area data.` : "Open-Meteo hourly pollutant context is available, but an AQI estimate could not be calculated.",
      sourceNote: "Open-Meteo provides modelled area data. This is not an official CPCB monitoring-station measurement or a street-level sensor reading."
    };
}

async function requestOpenMeteo(latitudes: string, longitudes: string): Promise<OpenMeteoResponse | OpenMeteoResponse[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", latitudes);
  url.searchParams.set("longitude", longitudes);
  url.searchParams.set("current", "pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone");
  url.searchParams.set("timezone", "auto");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}.`);
    return await response.json() as OpenMeteoResponse | OpenMeteoResponse[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOpenMeteoAirQuality(lat: number, lng: number): Promise<AirQualitySummary> {
  const key = coordinateKey(lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const payload = await requestOpenMeteo(String(lat), String(lng));
  const value = summaryFromPayload(lat, lng, Array.isArray(payload) ? payload[0] : payload);
  cache.set(key, { expires: Date.now() + CACHE_MS, value });
  return value;
}

export interface OpenMeteoNationalPoint {
  city: string;
  state?: string;
  country?: string;
  lat: number;
  lng: number;
  summary: AirQualitySummary;
}

export async function getOpenMeteoCountryAirQuality(countryQuery = "India"): Promise<OpenMeteoNationalPoint[]> {
  const country = findBricsCountry(countryQuery) || BRICS_COUNTRIES_CONFIG.find((c) => c.name === "India")!;
  const cacheKey = country.iso3;
  const cached = countryCaches.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  const locations = country.majorCities;
  const payload = await requestOpenMeteo(
    locations.map((loc) => loc.lat).join(","),
    locations.map((loc) => loc.lng).join(",")
  );
  const values = Array.isArray(payload) ? payload : [payload];
  const result: OpenMeteoNationalPoint[] = locations.flatMap((location, index) => {
    const value = values[index];
    if (!value?.current) return [];
    return [{
      city: location.city,
      state: location.state,
      country: country.name,
      lat: location.lat,
      lng: location.lng,
      summary: summaryFromPayload(location.lat, location.lng, value, `${location.city} Monitoring Point (${country.name})`)
    }];
  });

  countryCaches.set(cacheKey, { expires: Date.now() + CACHE_MS, value: result });
  return result;
}

export async function getOpenMeteoNationalAirQuality(): Promise<OpenMeteoNationalPoint[]> {
  return getOpenMeteoCountryAirQuality("India");
}

export async function getOpenMeteoGlobalAirQuality(): Promise<OpenMeteoNationalPoint[]> {
  const globalCacheKey = "GLOBAL_BRICS";
  const cached = countryCaches.get(globalCacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  // Fetch all major cities for each BRICS country for full global coverage
  const globalCities = BRICS_COUNTRIES_CONFIG.flatMap((c) =>
    c.majorCities.map((city) => ({ ...city, country: c.name }))
  );

  const payload = await requestOpenMeteo(
    globalCities.map((loc) => loc.lat).join(","),
    globalCities.map((loc) => loc.lng).join(",")
  );
  const values = Array.isArray(payload) ? payload : [payload];
  const result: OpenMeteoNationalPoint[] = globalCities.flatMap((location, index) => {
    const value = values[index];
    if (!value?.current) return [];
    return [{
      city: location.city,
      state: location.state,
      country: location.country,
      lat: location.lat,
      lng: location.lng,
      summary: summaryFromPayload(location.lat, location.lng, value, `${location.city} (${location.country})`)
    }];
  });

  countryCaches.set(globalCacheKey, { expires: Date.now() + CACHE_MS, value: result });
  return result;
}
