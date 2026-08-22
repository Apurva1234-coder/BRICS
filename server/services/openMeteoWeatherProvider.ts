import type {
  MeteorologicalContext,
  HourlyForecastPoint,
  MeteorologicalProvider,
  PrecipitationType
} from "../types.js";
import {
  degreesToCompass,
  oppositeBearingDegrees,
  normalizePrecipitationType,
  generateDeterministicMockWeather,
  generateDeterministicMockForecast
} from "./googleWeatherProvider.js";

export class OpenMeteoWeatherProvider implements MeteorologicalProvider {
  name = "Open-Meteo Weather API";
  private isDemoMode: boolean;

  constructor(isDemoMode = false) {
    this.isDemoMode = isDemoMode || process.env.DEMO_MODE === "true";
  }

  /** Retrieve live current conditions from Open-Meteo API */
  async getCurrentConditions(latitude: number, longitude: number): Promise<MeteorologicalContext> {
    if (this.isDemoMode) {
      return generateDeterministicMockWeather(latitude, longitude);
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m"
    );
    url.searchParams.set("forecast_days", "1");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[OpenMeteoWeatherProvider] Open-Meteo returned HTTP ${response.status}`);
        return {
          ...generateDeterministicMockWeather(latitude, longitude),
          source: "Open-Meteo (Demo Fallback)",
          dataStatus: "DEMO_DATA",
          note: `Open-Meteo API returned HTTP ${response.status}; using deterministic atmospheric fallback.`
        };
      }

      const json = (await response.json()) as any;
      const current = json.current;
      if (!current) {
        throw new Error("Open-Meteo returned no current weather payload.");
      }

      const temp = Math.round((current.temperature_2m ?? 25) * 10) / 10;
      const humidity = Math.round(current.relative_humidity_2m ?? 50);
      const windSpeed = Math.round((current.wind_speed_10m ?? 10) * 10) / 10;
      const windDir = Math.round(current.wind_direction_10m ?? 0);
      const precip = Math.round((current.precipitation ?? 0) * 10) / 10;
      const moveDir = oppositeBearingDegrees(windDir);

      return {
        source: "Open-Meteo Weather API",
        observedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
        latitude,
        longitude,
        temperatureC: temp,
        relativeHumidityPercent: humidity,
        windSpeedKmh: windSpeed,
        windDirectionDegrees: windDir,
        windDirectionCompass: degreesToCompass(windDir),
        movementDirectionDegrees: moveDir,
        movementDirectionCompass: degreesToCompass(moveDir),
        precipitationMm: precip,
        precipitationType: precip > 0 ? "RAIN" : "NONE",
        dataStatus: "AVAILABLE",
        weatherCondition: precip > 0 ? "Precipitation Active" : "Clear / Atmospheric Dispersion Normal",
        visibilityKm: 10,
        note: "Live meteorological telemetry retrieved via Open-Meteo global atmospheric model."
      };
    } catch (error) {
      console.warn("[OpenMeteoWeatherProvider] Fetch error, falling back to mock:", (error as Error).message);
      return {
        ...generateDeterministicMockWeather(latitude, longitude),
        source: "Open-Meteo (Offline Fallback)",
        dataStatus: "DEMO_DATA",
        note: `Network or timeout connecting to Open-Meteo: ${(error as Error).message}`
      };
    }
  }

  /** Retrieve hourly forecast from Open-Meteo API */
  async getHourlyForecast(
    latitude: number,
    longitude: number,
    horizonHours = 6
  ): Promise<{ context: MeteorologicalContext; hourlyForecast: HourlyForecastPoint[] }> {
    const horizon = Math.min(24, Math.max(1, horizonHours));

    if (this.isDemoMode) {
      return generateDeterministicMockForecast(latitude, longitude, horizon);
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m"
    );
    url.searchParams.set(
      "hourly",
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m"
    );
    url.searchParams.set("forecast_days", "2");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return generateDeterministicMockForecast(latitude, longitude, horizon);
      }

      const json = (await response.json()) as any;
      const current = json.current;
      const hourly = json.hourly;

      if (!current || !hourly || !Array.isArray(hourly.time)) {
        return generateDeterministicMockForecast(latitude, longitude, horizon);
      }

      const temp = Math.round((current.temperature_2m ?? 25) * 10) / 10;
      const humidity = Math.round(current.relative_humidity_2m ?? 50);
      const windSpeed = Math.round((current.wind_speed_10m ?? 10) * 10) / 10;
      const windDir = Math.round(current.wind_direction_10m ?? 0);
      const precip = Math.round((current.precipitation ?? 0) * 10) / 10;
      const moveDir = oppositeBearingDegrees(windDir);

      const context: MeteorologicalContext = {
        source: "Open-Meteo Weather API",
        observedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
        latitude,
        longitude,
        temperatureC: temp,
        relativeHumidityPercent: humidity,
        windSpeedKmh: windSpeed,
        windDirectionDegrees: windDir,
        windDirectionCompass: degreesToCompass(windDir),
        movementDirectionDegrees: moveDir,
        movementDirectionCompass: degreesToCompass(moveDir),
        precipitationMm: precip,
        precipitationType: precip > 0 ? "RAIN" : "NONE",
        dataStatus: "AVAILABLE",
        weatherCondition: precip > 0 ? "Precipitation Active" : "Clear / Atmospheric Dispersion Normal",
        visibilityKm: 10,
        note: "Live meteorological telemetry retrieved via Open-Meteo global atmospheric model."
      };

      const hourlyForecast: HourlyForecastPoint[] = [];
      const count = Math.min(horizon, hourly.time.length);

      for (let i = 0; i < count; i++) {
        const t = hourly.time[i];
        const hWindDir = Math.round(hourly.wind_direction_10m?.[i] ?? windDir);
        const hMoveDir = oppositeBearingDegrees(hWindDir);

        hourlyForecast.push({
          timestamp: new Date(t).toISOString(),
          hoursAhead: i + 1,
          temperatureC: Math.round((hourly.temperature_2m?.[i] ?? temp) * 10) / 10,
          relativeHumidityPercent: Math.round(hourly.relative_humidity_2m?.[i] ?? humidity),
          windSpeedKmh: Math.round((hourly.wind_speed_10m?.[i] ?? windSpeed) * 10) / 10,
          windDirectionDegrees: hWindDir,
          windDirectionCompass: degreesToCompass(hWindDir),
          movementDirectionDegrees: hMoveDir,
          movementDirectionCompass: degreesToCompass(hMoveDir),
          precipitationMm: Math.round((hourly.precipitation?.[i] ?? 0) * 10) / 10,
          precipitationProbability: hourly.precipitation?.[i] > 0 ? 80 : 5,
          precipitationType: hourly.precipitation?.[i] > 0 ? "RAIN" : "NONE"
        });
      }

      return { context, hourlyForecast };
    } catch (error) {
      console.warn("[OpenMeteoWeatherProvider] Forecast error, using fallback:", (error as Error).message);
      return generateDeterministicMockForecast(latitude, longitude, horizon);
    }
  }
}

// Export singleton instance
export const openMeteoWeatherProvider = new OpenMeteoWeatherProvider();
