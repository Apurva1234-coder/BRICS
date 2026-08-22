import type {
  PropagationInput,
  PropagationResult,
  PropagationStep,
  CrossBorderImpactPrediction,
  PollutionPropagationModel,
  PropagationImpactLevel,
  MeteorologicalContext,
  HourlyForecastPoint
} from "../types.js";
import { computeDestinationPoint, haversineDistanceKm, calculateBearingDegrees } from "./pollutionMovementEstimator.js";
import { degreesToCompass, oppositeBearingDegrees } from "./googleWeatherProvider.js";
import { identifyCountryForCoordinate, getCountryBoundary } from "../data/bricsBoundaries.js";

/** Map PM2.5 concentration (µg/m³) to standard Impact Level */
export function pm25ToImpactLevel(pm25: number): PropagationImpactLevel {
  if (pm25 >= 250) return "CRITICAL";
  if (pm25 >= 120) return "HIGH";
  if (pm25 >= 60) return "MEDIUM";
  return "LOW";
}

/** Map PM2.5 to estimated AQI (US EPA / Indian CPCB standard piecewise approximation) */
export function pm25ToEstimatedAqi(pm25: number): number {
  if (pm25 <= 30) return Math.round(pm25 * (50 / 30));
  if (pm25 <= 60) return Math.round(50 + (pm25 - 30) * (50 / 30));
  if (pm25 <= 90) return Math.round(100 + (pm25 - 60) * (100 / 30));
  if (pm25 <= 120) return Math.round(200 + (pm25 - 90) * (100 / 30));
  if (pm25 <= 250) return Math.round(300 + (pm25 - 120) * (100 / 130));
  return Math.min(500, Math.round(400 + (pm25 - 250) * (100 / 130)));
}

/**
 * Explainable physics & rule-based pollution propagation model.
 * Simulates Lagrangian particle advection, turbulent dispersion, atmospheric decay, and cross-border intersection.
 */
export class RuleBasedPropagationModel implements PollutionPropagationModel {
  name = "RuleBasedLagrangianPropagationModel";
  version = "1.0.0";

  async predictPropagation(input: PropagationInput): Promise<PropagationResult> {
    const horizonHours = Math.min(48, Math.max(1, input.horizonHours || 12));
    const timeStepHours = Math.max(1, input.timeStepHours || 1);
    const startMs = input.timestamp ? new Date(input.timestamp).getTime() : Date.now();
    const startIso = new Date(startMs).toISOString();

    const sourceLat = input.sourceLatitude;
    const sourceLng = input.sourceLongitude;

    // Identify source country
    const sourceInfo = identifyCountryForCoordinate(sourceLat, sourceLng);
    const sourceCountryCode = input.sourceCountryCode || sourceInfo.countryCode;
    const sourceCountryName = sourceInfo.countryName;
    const sourceFlag = sourceInfo.flag;

    // Determine initial concentration
    let initialPm25 = input.initialPm2_5;
    if (!initialPm25 || initialPm25 <= 0) {
      if (input.initialSeverity === "critical") initialPm25 = 340;
      else if (input.initialSeverity === "high") initialPm25 = 210;
      else if (input.initialSeverity === "moderate") initialPm25 = 95;
      else initialPm25 = 45;
    }
    const initialAqi = input.initialAqi || pm25ToEstimatedAqi(initialPm25);

    // Weather fallback
    const baseMeteorology: MeteorologicalContext = input.meteorology || {
      source: "Model Default Meteorological Baseline",
      observedAt: startIso,
      latitude: sourceLat,
      longitude: sourceLng,
      temperatureC: 26,
      relativeHumidityPercent: 60,
      windSpeedKmh: 18,
      windDirectionDegrees: 90, // From East
      windDirectionCompass: "E",
      movementDirectionDegrees: 270, // Toward West
      movementDirectionCompass: "W",
      precipitationMm: 0,
      precipitationType: "NONE",
      dataStatus: "AVAILABLE"
    };

    const hourlyForecast = input.hourlyForecast || [];

    const steps: PropagationStep[] = [
      {
        stepNumber: 0,
        hoursElapsed: 0,
        timestamp: startIso,
        latitude: sourceLat,
        longitude: sourceLng,
        distanceFromSourceKm: 0,
        plumeRadiusKm: 2.0,
        currentCountryCode: sourceCountryCode,
        currentCountryName: sourceCountryName,
        currentCountryFlag: sourceFlag,
        estimatedPm2_5: initialPm25,
        estimatedAqi: initialAqi,
        impactLevel: pm25ToImpactLevel(initialPm25),
        dilutionFactor: 1.0,
        segmentWindSpeedKmh: baseMeteorology.windSpeedKmh,
        segmentWindDirectionDeg: baseMeteorology.windDirectionDegrees,
        segmentCompass: baseMeteorology.windDirectionCompass
      }
    ];

    let currentLat = sourceLat;
    let currentLng = sourceLng;
    let accumulatedDistanceKm = 0;

    let crossBorderDetected = false;
    let firstForeignStep: PropagationStep | null = null;
    const intersectedCountriesMap = new Map<string, { countryCode: string; countryName: string; flag: string; entryHour: number; distanceKm: number }>();

    for (let h = timeStepHours; h <= horizonHours; h += timeStepHours) {
      // Lookup forecast point for hour h if available
      const forecast = hourlyForecast.find((f) => f.hoursAhead === h);
      const windSpeed = forecast ? forecast.windSpeedKmh : baseMeteorology.windSpeedKmh;
      const windDir = forecast ? forecast.windDirectionDegrees : baseMeteorology.windDirectionDegrees;
      const moveBearing = forecast ? forecast.movementDirectionDegrees : oppositeBearingDegrees(windDir);
      const moveCompass = forecast ? forecast.movementDirectionCompass : degreesToCompass(moveBearing);
      const precipMm = forecast ? forecast.precipitationMm : baseMeteorology.precipitationMm;

      // 1. Advection Step Distance (km)
      const stepDistanceKm = Math.max(0.5, windSpeed * timeStepHours);
      const nextPoint = computeDestinationPoint(currentLat, currentLng, stepDistanceKm, moveBearing);

      accumulatedDistanceKm += stepDistanceKm;
      currentLat = nextPoint.latitude;
      currentLng = nextPoint.longitude;

      const stepTimeIso = new Date(startMs + h * 3600 * 1000).toISOString();
      const distFromSource = haversineDistanceKm(sourceLat, sourceLng, currentLat, currentLng);

      // 2. Plume Horizontal Dispersion Width: R(t) = R0 + 0.35 * sqrt(d)
      const plumeRadius = Math.round((2.0 + 0.35 * Math.sqrt(distFromSource)) * 10) / 10;

      // 3. Dilution & Atmospheric Decay
      // Advection dilution: (10 / (10 + d))^0.45
      const advectionDilution = Math.pow(10 / (10 + distFromSource), 0.45);
      // Aerosol decay + rain washout
      const decayRate = 0.035; // Fine aerosol natural settling rate (h^-1)
      const rainDecay = precipMm > 0 ? 0.12 * precipMm : 0;
      const exponentialDecay = Math.exp(-(decayRate + rainDecay) * h);

      const dilutionFactor = Math.max(0.08, Math.round(advectionDilution * exponentialDecay * 1000) / 1000);
      const stepPm25 = Math.round(initialPm25 * dilutionFactor * 10) / 10;
      const stepAqi = pm25ToEstimatedAqi(stepPm25);

      // 4. Country boundary check
      const currentCountry = identifyCountryForCoordinate(currentLat, currentLng);

      const stepObj: PropagationStep = {
        stepNumber: h / timeStepHours,
        hoursElapsed: h,
        timestamp: stepTimeIso,
        latitude: currentLat,
        longitude: currentLng,
        distanceFromSourceKm: distFromSource,
        plumeRadiusKm: plumeRadius,
        currentCountryCode: currentCountry.countryCode,
        currentCountryName: currentCountry.countryName,
        currentCountryFlag: currentCountry.flag,
        estimatedPm2_5: stepPm25,
        estimatedAqi: stepAqi,
        impactLevel: pm25ToImpactLevel(stepPm25),
        dilutionFactor,
        segmentWindSpeedKmh: windSpeed,
        segmentWindDirectionDeg: windDir,
        segmentCompass: moveCompass
      };

      steps.push(stepObj);

      // Check if stepped into a foreign sovereign country
      if (currentCountry.countryCode !== sourceCountryCode && currentCountry.countryCode !== "INTL") {
        crossBorderDetected = true;
        if (!firstForeignStep) {
          firstForeignStep = stepObj;
        }
        if (!intersectedCountriesMap.has(currentCountry.countryCode)) {
          intersectedCountriesMap.set(currentCountry.countryCode, {
            countryCode: currentCountry.countryCode,
            countryName: currentCountry.countryName,
            flag: currentCountry.flag,
            entryHour: h,
            distanceKm: distFromSource
          });
        }
      }
    }

    // Calculate Dominant Bearing
    const overallBearing = calculateBearingDegrees(sourceLat, sourceLng, currentLat, currentLng);
    const dominantDir = degreesToCompass(overallBearing);

    // Build Cross-Border Prediction Object if border crossing detected
    let crossBorderPrediction: CrossBorderImpactPrediction | null = null;
    const predictionId = `prop-${sourceCountryCode.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    if (crossBorderDetected && firstForeignStep) {
      const targetCountryBoundary = getCountryBoundary(firstForeignStep.currentCountryCode);
      const targetRegion = identifyCountryForCoordinate(firstForeignStep.latitude, firstForeignStep.longitude).regionName;

      // Risk score evaluation (0 - 100%)
      let riskScore = 0;

      // Factor 1: Source intensity (0 - 40 pts)
      if (initialPm25 >= 300) riskScore += 40;
      else if (initialPm25 >= 200) riskScore += 32;
      else if (initialPm25 >= 100) riskScore += 22;
      else riskScore += 12;

      // Factor 2: Predicted concentration at border crossing (0 - 30 pts)
      if (firstForeignStep.estimatedPm2_5 >= 150) riskScore += 30;
      else if (firstForeignStep.estimatedPm2_5 >= 80) riskScore += 22;
      else if (firstForeignStep.estimatedPm2_5 >= 45) riskScore += 14;
      else riskScore += 6;

      // Factor 3: Proximity / Arrival transit speed (0 - 20 pts)
      if (firstForeignStep.hoursElapsed <= 4) riskScore += 20;
      else if (firstForeignStep.hoursElapsed <= 8) riskScore += 15;
      else if (firstForeignStep.hoursElapsed <= 16) riskScore += 10;
      else riskScore += 5;

      // Factor 4: Atmospheric transport stability (0 - 10 pts)
      if (baseMeteorology.windSpeedKmh >= 15 && baseMeteorology.precipitationMm === 0) riskScore += 10;
      else if (baseMeteorology.windSpeedKmh >= 8) riskScore += 6;
      else riskScore += 2;

      riskScore = Math.min(96, Math.max(15, riskScore));
      const riskCat: PropagationImpactLevel =
        riskScore >= 75 ? "CRITICAL" : riskScore >= 50 ? "HIGH" : riskScore >= 25 ? "MEDIUM" : "LOW";

      // Confidence evaluation
      let confidence = 78;
      if (hourlyForecast.length > 0) confidence += 8;
      if (baseMeteorology.windSpeedKmh < 4) confidence -= 25;
      if (baseMeteorology.precipitationMm > 5) confidence -= 15;
      confidence = Math.min(95, Math.max(30, confidence));
      const confLevel: "HIGH" | "MEDIUM" | "LOW" =
        confidence >= 75 ? "HIGH" : confidence >= 50 ? "MEDIUM" : "LOW";

      const pollutantName = typeof input.pollutionType === "string" ? input.pollutionType.replace(/_/g, " ") : "PM2.5 Aerosol";

      crossBorderPrediction = {
        predictionId,
        eventId: input.eventId,
        sourceCountry: sourceCountryCode,
        sourceCountryName,
        sourceFlag,
        sourceLocation: {
          latitude: sourceLat,
          longitude: sourceLng,
          locality: input.sourceLocality || `${sourceCountryName} Industrial Airshed`
        },
        sourcePollutant: pollutantName,
        sourcePollutionLevel: {
          pm2_5: initialPm25,
          aqi: initialAqi,
          severity: input.initialSeverity || "critical"
        },
        affectedCountry: firstForeignStep.currentCountryCode,
        affectedCountryName: firstForeignStep.currentCountryName,
        affectedFlag: firstForeignStep.currentCountryFlag,
        affectedRegion: targetRegion,
        borderCrossingPoint: {
          latitude: firstForeignStep.latitude,
          longitude: firstForeignStep.longitude,
          distanceFromSourceKm: firstForeignStep.distanceFromSourceKm
        },
        estimatedArrivalHours: firstForeignStep.hoursElapsed,
        estimatedArrivalTime: firstForeignStep.timestamp,
        predictedPollutionLevel: {
          pm2_5: firstForeignStep.estimatedPm2_5,
          aqi: firstForeignStep.estimatedAqi,
          remainingRatio: firstForeignStep.dilutionFactor
        },
        predictedImpactCategory: firstForeignStep.impactLevel,
        riskScore,
        riskCategory: riskCat,
        confidence,
        confidenceLevel: confLevel,
        windConditions: {
          speedKmh: baseMeteorology.windSpeedKmh,
          directionDeg: baseMeteorology.windDirectionDegrees,
          compass: baseMeteorology.windDirectionCompass
        },
        environmentalFactors: {
          temperatureC: baseMeteorology.temperatureC,
          humidityPercent: baseMeteorology.relativeHumidityPercent,
          precipitationMm: baseMeteorology.precipitationMm
        },
        explanation: `Wind blowing from ${baseMeteorology.windDirectionCompass} (${baseMeteorology.windDirectionDegrees}°) at ${baseMeteorology.windSpeedKmh} km/h advects particulate plume across the border into ${firstForeignStep.currentCountryName} (${targetRegion}) in ~${firstForeignStep.hoursElapsed} hours with estimated ${firstForeignStep.estimatedPm2_5} µg/m³ PM2.5 intensity.`,
        disclaimer: "Application-generated wind-based propagation estimate. Designed for early operational awareness; does not represent official government notification or chemical transport modeling.",
        generatedAt: startIso
      };
    }

    return {
      predictionId,
      source: {
        latitude: sourceLat,
        longitude: sourceLng,
        countryCode: sourceCountryCode,
        countryName: sourceCountryName,
        flag: sourceFlag,
        locality: input.sourceLocality
      },
      horizonHours,
      timeStepHours,
      totalDistanceKm: Math.round(accumulatedDistanceKm * 10) / 10,
      dominantDirection: dominantDir,
      steps,
      hasCrossBorderImpact: crossBorderDetected,
      crossBorderPrediction,
      allIntersectedCountries: Array.from(intersectedCountriesMap.values()),
      modelMetadata: {
        name: this.name,
        version: this.version,
        type: "physics_rule_based"
      },
      generatedAt: startIso
    };
  }
}

// Singleton propagation model instance
export const defaultPropagationModel = new RuleBasedPropagationModel();
