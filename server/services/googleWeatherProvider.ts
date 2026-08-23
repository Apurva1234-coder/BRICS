import type {
  MeteorologicalContext,
  HourlyForecastPoint,
  MeteorologicalProvider,
  PrecipitationType,
  MeteorologicalDataStatus
} from "../types.js";

const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE",
  "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW",
  "W", "WNW", "NW", "NNW"
];

/** Convert meteorological bearing degrees (0-360) into 16-point compass string */
export function degreesToCompass(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[index];
}

/** Compute opposite bearing (direction wind is blowing TOWARD) */
export function oppositeBearingDegrees(fromDegrees: number): number {
  return (fromDegrees + 180) % 360;
}

/** Normalize precipitation string to standard PrecipitationType */
export function normalizePrecipitationType(rawType?: string): PrecipitationType {
  if (!rawType) return "NONE";
  const upper = rawType.toUpperCase();
  if (upper.includes("RAIN")) return "RAIN";
  if (upper.includes("DRIZZLE")) return "DRIZZLE";
  if (upper.includes("SNOW")) return "SNOW";
  if (upper.includes("ICE")) return "ICE";
  if (upper.includes("HAIL")) return "HAIL";
  if (upper.includes("MIX")) return "MIXED";
  return "NONE";
}

/** Generate deterministic mock weather for DEMO mode or offline fallback */
export function generateDeterministicMockWeather(
  latitude: number,
  longitude: number,
  observedAt = new Date().toISOString()
): MeteorologicalContext {
  // Deterministic calculation based on coordinates
  const latSeed = Math.abs(Math.sin(latitude * 12.9898 + longitude * 78.233)) * 100;
  const temp = Math.round(22 + (latSeed % 14)); // 22 - 36°C
  const humidity = Math.round(40 + (latSeed * 3 % 45)); // 40 - 85%
  const windSpd = Math.round(8 + (latSeed * 7 % 22)); // 8 - 30 km/h
  const windDir = Math.round((latSeed * 13.7) % 360); // 0 - 360°
  const moveDir = oppositeBearingDegrees(windDir);

  return {
    source: "DEMO",
    observedAt,
    latitude,
    longitude,
    temperatureC: temp,
    relativeHumidityPercent: humidity,
    windSpeedKmh: windSpd,
    windDirectionDegrees: windDir,
    windDirectionCompass: degreesToCompass(windDir),
    movementDirectionDegrees: moveDir,
    movementDirectionCompass: degreesToCompass(moveDir),
    precipitationMm: 0,
    precipitationType: "NONE",
    dataStatus: "DEMO_DATA",
    weatherCondition: "Clear (Demo Simulation)",
    visibilityKm: 10,
    note: "Deterministic mock meteorological context generated for demo simulation."
  };
}

/** Generate deterministic mock hourly forecast for DEMO mode */
export function generateDeterministicMockForecast(
  latitude: number,
  longitude: number,
  horizonHours = 6,
  baseContext?: MeteorologicalContext
): { context: MeteorologicalContext; hourlyForecast: HourlyForecastPoint[] } {
  const context = baseContext || generateDeterministicMockWeather(latitude, longitude);
  const hourlyForecast: HourlyForecastPoint[] = [];

  const baseTime = new Date(context.observedAt).getTime();
  for (let i = 1; i <= horizonHours; i++) {
    const time = new Date(baseTime + i * 3600 * 1000).toISOString();
    // Gentle deterministic variation over time
    const dirShift = Math.sin(i * 0.8) * 15;
    const currentWindDir = Math.round((context.windDirectionDegrees + dirShift + 360) % 360);
    const currentWindSpd = Math.max(5, Math.round(context.windSpeedKmh + Math.cos(i * 0.5) * 4));
    const moveDir = oppositeBearingDegrees(currentWindDir);

    hourlyForecast.push({
      timestamp: time,
      hoursAhead: i,
      temperatureC: context.temperatureC + Math.round(Math.sin(i * 0.5) * 2),
      relativeHumidityPercent: Math.min(100, Math.max(20, context.relativeHumidityPercent + Math.round(Math.cos(i * 0.6) * 5))),
      windSpeedKmh: currentWindSpd,
      windDirectionDegrees: currentWindDir,
      windDirectionCompass: degreesToCompass(currentWindDir),
      movementDirectionDegrees: moveDir,
      movementDirectionCompass: degreesToCompass(moveDir),
      precipitationMm: 0,
      precipitationProbability: 5,
      precipitationType: "NONE"
    });
  }

  return { context, hourlyForecast };
}

export class GoogleWeatherProvider implements MeteorologicalProvider {
  name = "Google Weather API";
  private apiKey: string;
  private isDemoMode: boolean;

  constructor(apiKey?: string, isDemoMode = false) {
    this.apiKey = apiKey || process.env.GOOGLE_WEATHER_API_KEY || "";
    this.isDemoMode = isDemoMode || process.env.DEMO_MODE === "true" || !this.apiKey;
  }

  async getCurrentConditions(latitude: number, longitude: number): Promise<MeteorologicalContext> {
    if (this.isDemoMode || !this.apiKey) {
      return generateDeterministicMockWeather(latitude, longitude);
    }

    const url = new URL("https://weather.googleapis.com/v1/currentConditions:lookup");
    url.searchParams.set("location.latitude", String(latitude));
    url.searchParams.set("location.longitude", String(longitude));
    url.searchParams.set("unitsSystem", "METRIC");
    url.searchParams.set("key", this.apiKey);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[GoogleWeatherProvider] Current conditions lookup returned HTTP ${response.status}`);
        if (response.status === 404 || response.status === 400) {
          return {
            ...generateDeterministicMockWeather(latitude, longitude),
            source: "Google Weather API (Fallback)",
            dataStatus: "LOCATION_UNSUPPORTED",
            note: `Weather data not currently indexed for coordinates (${latitude.toFixed(2)}, ${longitude.toFixed(2)}).`
          };
        }
        return {
          ...generateDeterministicMockWeather(latitude, longitude),
          source: "Google Weather API (Fallback)",
          dataStatus: "PROVIDER_ERROR",
          note: `Google Weather API returned HTTP ${response.status}.`
        };
      }

      const json = await response.json();
      return this.normalizeCurrentConditions(json, latitude, longitude);
    } catch (error) {
      console.error("[GoogleWeatherProvider] Fetch error:", (error as Error).message);
      return {
        ...generateDeterministicMockWeather(latitude, longitude),
        source: "Google Weather API (Fallback)",
        dataStatus: "PROVIDER_ERROR",
        note: `Network or timeout error contacting Google Weather API: ${(error as Error).message}`
      };
    }
  }

  async getHourlyForecast(
    latitude: number,
    longitude: number,
    horizonHours = 6
  ): Promise<{ context: MeteorologicalContext; hourlyForecast: HourlyForecastPoint[] }> {
    const horizon = Math.min(24, Math.max(1, horizonHours));

    if (this.isDemoMode || !this.apiKey) {
      return generateDeterministicMockForecast(latitude, longitude, horizon);
    }

    const url = new URL("https://weather.googleapis.com/v1/forecast/hours:lookup");
    url.searchParams.set("location.latitude", String(latitude));
    url.searchParams.set("location.longitude", String(longitude));
    url.searchParams.set("unitsSystem", "METRIC");
    url.searchParams.set("hours", String(horizon));
    url.searchParams.set("key", this.apiKey);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[GoogleWeatherProvider] Hourly forecast lookup returned HTTP ${response.status}`);
        return generateDeterministicMockForecast(latitude, longitude, horizon);
      }

      const json = await response.json();
      return this.normalizeHourlyForecast(json, latitude, longitude, horizon);
    } catch (error) {
      console.error("[GoogleWeatherProvider] Forecast fetch error:", (error as Error).message);
      return generateDeterministicMockForecast(latitude, longitude, horizon);
    }
  }

  normalizeCurrentConditions(raw: any, latitude: number, longitude: number): MeteorologicalContext {
    const conditions = raw.currentConditions || raw;
    const tempVal = conditions.temperature?.degrees ?? conditions.temperature?.value ?? conditions.temperature ?? 25;
    const humidityVal = conditions.relativeHumidity ?? conditions.relativeHumidityPercent ?? 50;
    
    // Wind handling
    const windObj = conditions.wind || {};
    const windSpeedVal = windObj.speed?.value ?? windObj.speed ?? 0;
    const windDirVal = windObj.direction?.degrees ?? windObj.direction ?? windObj.degrees ?? 0;
    const moveDirVal = oppositeBearingDegrees(windDirVal);

    // Precipitation handling
    const precipObj = conditions.precipitation || {};
    const precipMm = precipObj.qpf?.quantity ?? precipObj.qpf?.value ?? precipObj.amountMm ?? 0;
    const precipType = normalizePrecipitationType(precipObj.type || precipObj.precipitationType);

    const conditionDesc = conditions.weatherCondition?.description?.text || conditions.weatherCondition?.type || "Clear";
    const visibility = conditions.visibility?.distance ?? conditions.visibility?.value;

    return {
      source: "Google Weather API",
      observedAt: conditions.currentTime || new Date().toISOString(),
      latitude,
      longitude,
      temperatureC: Math.round(tempVal * 10) / 10,
      relativeHumidityPercent: Math.round(humidityVal),
      windSpeedKmh: Math.round(windSpeedVal * 10) / 10,
      windDirectionDegrees: Math.round(windDirVal),
      windDirectionCompass: degreesToCompass(windDirVal),
      movementDirectionDegrees: Math.round(moveDirVal),
      movementDirectionCompass: degreesToCompass(moveDirVal),
      precipitationMm: Math.round(precipMm * 10) / 10,
      precipitationType: precipType,
      dataStatus: "AVAILABLE",
      weatherCondition: conditionDesc,
      visibilityKm: visibility ? Math.round(visibility * 10) / 10 : undefined
    };
  }

  normalizeHourlyForecast(
    raw: any,
    latitude: number,
    longitude: number,
    horizonHours: number
  ): { context: MeteorologicalContext; hourlyForecast: HourlyForecastPoint[] } {
    const rawHours: any[] = raw.forecastHours || raw.hours || [];
    const hourlyForecast: HourlyForecastPoint[] = [];

    const now = Date.now();
    for (let i = 0; i < Math.min(rawHours.length, horizonHours); i++) {
      const h = rawHours[i];
      const timeStr = h.interval?.startTime || h.startTime || new Date(now + (i + 1) * 3600 * 1000).toISOString();
      const temp = h.temperature?.degrees ?? h.temperature?.value ?? 25;
      const humidity = h.relativeHumidity ?? h.relativeHumidityPercent ?? 50;

      const windObj = h.wind || {};
      const windSpeed = windObj.speed?.value ?? windObj.speed ?? 0;
      const windDir = windObj.direction?.degrees ?? windObj.direction ?? windObj.degrees ?? 0;
      const moveDir = oppositeBearingDegrees(windDir);

      const precipObj = h.precipitation || {};
      const precipMm = precipObj.qpf?.quantity ?? precipObj.qpf?.value ?? 0;
      const precipProb = precipObj.probability?.percent ?? precipObj.probability;
      const precipType = normalizePrecipitationType(precipObj.type);

      hourlyForecast.push({
        timestamp: timeStr,
        hoursAhead: i + 1,
        temperatureC: Math.round(temp * 10) / 10,
        relativeHumidityPercent: Math.round(humidity),
        windSpeedKmh: Math.round(windSpeed * 10) / 10,
        windDirectionDegrees: Math.round(windDir),
        windDirectionCompass: degreesToCompass(windDir),
        movementDirectionDegrees: Math.round(moveDir),
        movementDirectionCompass: degreesToCompass(moveDir),
        precipitationMm: Math.round(precipMm * 10) / 10,
        precipitationProbability: precipProb,
        precipitationType: precipType
      });
    }

    // If Google returned currentConditions in the payload or we synthesize from first hour
    const context: MeteorologicalContext = hourlyForecast.length > 0
      ? {
          source: "Google Weather API",
          observedAt: new Date().toISOString(),
          latitude,
          longitude,
          temperatureC: hourlyForecast[0].temperatureC,
          relativeHumidityPercent: hourlyForecast[0].relativeHumidityPercent,
          windSpeedKmh: hourlyForecast[0].windSpeedKmh,
          windDirectionDegrees: hourlyForecast[0].windDirectionDegrees,
          windDirectionCompass: hourlyForecast[0].windDirectionCompass,
          movementDirectionDegrees: hourlyForecast[0].movementDirectionDegrees,
          movementDirectionCompass: hourlyForecast[0].movementDirectionCompass,
          precipitationMm: hourlyForecast[0].precipitationMm,
          precipitationType: hourlyForecast[0].precipitationType,
          dataStatus: "AVAILABLE"
        }
      : generateDeterministicMockWeather(latitude, longitude);

    return { context, hourlyForecast };
  }
}
