import type {
  PropagationInput,
  PropagationResult,
  CrossBorderImpactPrediction,
  BricsFederationEvent,
  BricsCountryCode
} from "../types.js";
import { defaultPropagationModel } from "./propagationModel.js";
import { getHourlyForecastForCoordinates } from "./meteorologyService.js";
import { publishFederationEvent, getFederationEvents } from "./bricsFederationService.js";

// In-memory store for active cross-border predictions
const activePredictionsStore: CrossBorderImpactPrediction[] = [];

/** Add initial baseline cross-border predictions to ensure active prototype intelligence */
function initializeDemoCrossBorderPredictions() {
  if (activePredictionsStore.length > 0) return;

  const now = new Date();
  const time8h = new Date(now.getTime() + 8 * 3600 * 1000).toISOString();
  const time6h = new Date(now.getTime() + 6 * 3600 * 1000).toISOString();
  const time11h = new Date(now.getTime() + 11 * 3600 * 1000).toISOString();

  // Scenario 1: India -> China (Trans-Himalayan industrial plume)
  activePredictionsStore.push({
    predictionId: "prop-ind-chn-sample-1",
    eventId: "brics-sample-ind-01",
    sourceCountry: "IND",
    sourceCountryName: "India",
    sourceFlag: "🇮🇳",
    sourceLocation: {
      latitude: 29.5,
      longitude: 79.5,
      locality: "Uttarakhand / Northern Plains Industrial Zone"
    },
    sourcePollutant: "PM2.5 Aerosol Plume",
    sourcePollutionLevel: {
      pm2_5: 320,
      aqi: 370,
      severity: "critical"
    },
    affectedCountry: "CHN",
    affectedCountryName: "China",
    affectedFlag: "🇨🇳",
    affectedRegion: "Tibet / Himalayan Border Region",
    borderCrossingPoint: {
      latitude: 30.6,
      longitude: 80.8,
      distanceFromSourceKm: 165
    },
    estimatedArrivalHours: 8,
    estimatedArrivalTime: time8h,
    predictedPollutionLevel: {
      pm2_5: 142,
      aqi: 215,
      remainingRatio: 0.44
    },
    predictedImpactCategory: "HIGH",
    riskScore: 74,
    riskCategory: "HIGH",
    confidence: 78,
    confidenceLevel: "HIGH",
    windConditions: {
      speedKmh: 24,
      directionDeg: 225, // From SW (pushes NE)
      compass: "SW"
    },
    environmentalFactors: {
      temperatureC: 22,
      humidityPercent: 55,
      precipitationMm: 0
    },
    explanation: "Sustained south-westerly wind at 24 km/h pushes heavy particulate plume across the northern border corridor into China (Tibet Autonomous Region) in ~8 hours.",
    disclaimer: "Application-generated wind-based propagation estimate. For operational guidance only.",
    generatedAt: now.toISOString()
  });

  // Scenario 2: China -> Russia (Heilongjiang / Amur River industrial plume)
  activePredictionsStore.push({
    predictionId: "prop-chn-rus-sample-2",
    eventId: "brics-sample-chn-01",
    sourceCountry: "CHN",
    sourceCountryName: "China",
    sourceFlag: "🇨🇳",
    sourceLocation: {
      latitude: 47.5,
      longitude: 130.2,
      locality: "Heilongjiang Industrial Basin, China"
    },
    sourcePollutant: "SO2 & Industrial Aerosols",
    sourcePollutionLevel: {
      pm2_5: 280,
      aqi: 330,
      severity: "severe"
    },
    affectedCountry: "RUS",
    affectedCountryName: "Russia",
    affectedFlag: "🇷🇺",
    affectedRegion: "Siberian / Amur-China Border Region",
    borderCrossingPoint: {
      latitude: 48.4,
      longitude: 132.5,
      distanceFromSourceKm: 195
    },
    estimatedArrivalHours: 6,
    estimatedArrivalTime: time6h,
    predictedPollutionLevel: {
      pm2_5: 165,
      aqi: 240,
      remainingRatio: 0.59
    },
    predictedImpactCategory: "HIGH",
    riskScore: 81,
    riskCategory: "CRITICAL",
    confidence: 82,
    confidenceLevel: "HIGH",
    windConditions: {
      speedKmh: 32,
      directionDeg: 240, // From WSW (pushes ENE)
      compass: "WSW"
    },
    environmentalFactors: {
      temperatureC: 14,
      humidityPercent: 48,
      precipitationMm: 0
    },
    explanation: "High wind speeds (32 km/h) advect heavy industrial emissions across the Amur River frontier into Russia (Far Eastern District) in ~6 hours.",
    disclaimer: "Application-generated wind-based propagation estimate. For operational guidance only.",
    generatedAt: now.toISOString()
  });

  // Scenario 3: UAE -> Iran / Saudi Arabia (Gulf energy corridor)
  activePredictionsStore.push({
    predictionId: "prop-are-irn-sample-3",
    eventId: "brics-sample-are-01",
    sourceCountry: "ARE",
    sourceCountryName: "United Arab Emirates",
    sourceFlag: "🇦🇪",
    sourceLocation: {
      latitude: 25.1,
      longitude: 55.3,
      locality: "Dubai Coastal & Industrial Corridor"
    },
    sourcePollutant: "Petrochemical NO2 & PM10",
    sourcePollutionLevel: {
      pm2_5: 195,
      aqi: 245,
      severity: "high"
    },
    affectedCountry: "IRN",
    affectedCountryName: "Iran",
    affectedFlag: "🇮🇷",
    affectedRegion: "Persian Gulf & Khuzestan Energy Corridor",
    borderCrossingPoint: {
      latitude: 26.8,
      longitude: 55.0,
      distanceFromSourceKm: 190
    },
    estimatedArrivalHours: 11,
    estimatedArrivalTime: time11h,
    predictedPollutionLevel: {
      pm2_5: 88,
      aqi: 168,
      remainingRatio: 0.45
    },
    predictedImpactCategory: "MEDIUM",
    riskScore: 58,
    riskCategory: "HIGH",
    confidence: 75,
    confidenceLevel: "HIGH",
    windConditions: {
      speedKmh: 18,
      directionDeg: 170, // From S (pushes N across Gulf)
      compass: "S"
    },
    environmentalFactors: {
      temperatureC: 36,
      humidityPercent: 70,
      precipitationMm: 0
    },
    explanation: "Southerly shamal breeze advects maritime and industrial emissions across the Persian Gulf toward Iran's southern coastal airspace.",
    disclaimer: "Application-generated wind-based propagation estimate. For operational guidance only.",
    generatedAt: now.toISOString()
  });
}

// Initialize demo predictions
initializeDemoCrossBorderPredictions();

/** Run propagation simulation and handle cross-border federation exchange */
export async function executePropagationSimulation(input: PropagationInput): Promise<PropagationResult> {
  const horizon = input.horizonHours || 12;

  // Retrieve live weather if not explicitly provided
  let meteorology = input.meteorology;
  let hourlyForecast = input.hourlyForecast;

  if (!meteorology) {
    try {
      const weatherRes = await getHourlyForecastForCoordinates(
        input.sourceLatitude,
        input.sourceLongitude,
        horizon
      );
      meteorology = weatherRes.context;
      hourlyForecast = weatherRes.hourlyForecast;
    } catch {
      // Propagation model will fall back to baseline defaults safely
    }
  }

  const result = await defaultPropagationModel.predictPropagation({
    ...input,
    meteorology,
    hourlyForecast
  });

  // If cross-border impact is predicted, register it in the active store & BRICS Federation pool
  if (result.hasCrossBorderImpact && result.crossBorderPrediction) {
    const pred = result.crossBorderPrediction;
    
    // Store in active predictions cache (upsert)
    const existingIdx = activePredictionsStore.findIndex((p) => p.predictionId === pred.predictionId);
    if (existingIdx >= 0) {
      activePredictionsStore[existingIdx] = pred;
    } else {
      activePredictionsStore.unshift(pred);
      if (activePredictionsStore.length > 50) activePredictionsStore.pop();
    }

    // Automatically bridge into BRICS Federation Pool as a cross-border alert event
    try {
      const federationEvent: BricsFederationEvent = {
        eventId: `brics-prop-${pred.predictionId}`,
        sourceNodeId: `node-${pred.sourceCountry.toLowerCase()}-auto`,
        sourceCountry: pred.sourceCountry as BricsCountryCode,
        sourceCountryName: pred.sourceCountryName,
        sourceFlag: pred.sourceFlag,
        latitude: pred.sourceLocation.latitude,
        longitude: pred.sourceLocation.longitude,
        locality: pred.sourceLocation.locality || `${pred.sourceCountryName} Industrial Hub`,
        timestamp: pred.generatedAt,
        pollutionType: (input.pollutionType as any) || "industrial_smoke",
        pollutantValues: {
          pm2_5: pred.sourcePollutionLevel.pm2_5,
          aqi: pred.sourcePollutionLevel.aqi
        },
        severity: pred.sourcePollutionLevel.severity as any,
        confidence: pred.confidence / 100,
        sourceType: "atmospheric_model",
        windDirectionDeg: pred.windConditions.directionDeg,
        windSpeedKmh: pred.windConditions.speedKmh,
        predictedAffectedRegion: `${pred.affectedCountryName} (${pred.affectedRegion})`,
        predictionConfidence: pred.confidence / 100,
        targetCountries: [pred.affectedCountry as BricsCountryCode],
        title: `⚠️ Cross-Border Plume: ${pred.sourceCountryName} → ${pred.affectedCountryName}`,
        description: pred.explanation,
        verificationStatus: "verified",
        sharedAt: new Date().toISOString(),
        metadata: {
          crossBorderPrediction: pred
        }
      };

      publishFederationEvent(federationEvent);
    } catch (err) {
      console.warn("[CrossBorderPropagationService] Could not publish federation event:", (err as Error).message);
    }
  }

  return result;
}

/** Get all currently active cross-border impact predictions */
export function getActiveCrossBorderPredictions(): CrossBorderImpactPrediction[] {
  return [...activePredictionsStore];
}

/** Get incoming pollution plumes targeting a specific country */
export function getIncomingPlumesForCountry(countryCode: string): CrossBorderImpactPrediction[] {
  const code = countryCode.toUpperCase();
  return activePredictionsStore.filter((p) => p.affectedCountry.toUpperCase() === code);
}

/** Get summary of affected countries receiving cross-border plumes */
export function getAffectedCountriesSummary(): Array<{
  countryCode: string;
  countryName: string;
  flag: string;
  incomingPlumesCount: number;
  maxRiskScore: number;
  highestRiskCategory: string;
  earliestArrivalHours: number;
}> {
  const map = new Map<string, {
    countryCode: string;
    countryName: string;
    flag: string;
    incomingPlumesCount: number;
    maxRiskScore: number;
    highestRiskCategory: string;
    earliestArrivalHours: number;
  }>();

  for (const p of activePredictionsStore) {
    const existing = map.get(p.affectedCountry);
    if (existing) {
      existing.incomingPlumesCount += 1;
      existing.maxRiskScore = Math.max(existing.maxRiskScore, p.riskScore);
      existing.earliestArrivalHours = Math.min(existing.earliestArrivalHours, p.estimatedArrivalHours);
      if (p.riskCategory === "CRITICAL") existing.highestRiskCategory = "CRITICAL";
      else if (p.riskCategory === "HIGH" && existing.highestRiskCategory !== "CRITICAL") existing.highestRiskCategory = "HIGH";
    } else {
      map.set(p.affectedCountry, {
        countryCode: p.affectedCountry,
        countryName: p.affectedCountryName,
        flag: p.affectedFlag,
        incomingPlumesCount: 1,
        maxRiskScore: p.riskScore,
        highestRiskCategory: p.riskCategory,
        earliestArrivalHours: p.estimatedArrivalHours
      });
    }
  }

  return Array.from(map.values());
}
