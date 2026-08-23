import type {
  EconomicCorridor,
  CorridorCityNode,
  CorridorCityImpact,
  CorridorImpactPrediction,
  CorridorImpactInput,
  CorridorTimelineMilestone,
  PropagationResult,
  PropagationImpactLevel
} from "../types.js";
import {
  BRICS_ECONOMIC_CORRIDORS,
  getAllEconomicCorridors,
  getEconomicCorridorById
} from "../data/bricsEconomicCorridors.js";
import {
  pm25ToImpactLevel,
  pm25ToEstimatedAqi
} from "./propagationModel.js";
import { executePropagationSimulation } from "./crossBorderPropagationService.js";

const EARTH_RADIUS_KM = 6371.0;

/** Calculate geodesic distance in kilometers between two coordinates */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Active in-memory store for corridor impact predictions
const activeCorridorPredictionsStore: CorridorImpactPrediction[] = [];

// Proximity buffer distance (km) beyond plume radius to consider a city corridor node at risk
const CORRIDOR_BUFFER_KM = 35;

/** Initialize realistic baseline corridor predictions for prototype demo */
function initializeDemoCorridorPredictions() {
  if (activeCorridorPredictionsStore.length > 0) return;

  const now = new Date();
  const timeNow = now.getTime();

  // Scenario 1: Northern Subcontinental Trade Corridor (Delhi -> Panipat -> Ludhiana -> Amritsar -> Lahore)
  const corridor1 = getEconomicCorridorById("corridor-delhi-lahore-central-asia");
  if (corridor1) {
    activeCorridorPredictionsStore.push({
      predictionId: "pred-corridor-delhi-lahore-01",
      corridorId: corridor1.id,
      corridorName: corridor1.name,
      countries: corridor1.countries,
      sourceLocation: {
        latitude: 28.6139,
        longitude: 77.2090,
        locality: "Delhi NCR Metropolitan Industrial Ring"
      },
      sourcePollutant: "PM2.5 Stubble & Industrial Plume",
      sourcePollutionLevel: {
        pm2_5: 380,
        severity: "critical"
      },
      affectedCities: [
        {
          cityId: "city-delhi-ncr",
          cityName: "Delhi NCR Metropolitan Hub",
          countryCode: "IND",
          countryFlag: "🇮🇳",
          latitude: 28.6139,
          longitude: 77.2090,
          estimatedArrivalHours: 0,
          estimatedArrivalTime: new Date(timeNow).toISOString(),
          closestDistanceKm: 0,
          predictedPm2_5: 380,
          predictedAqi: 410,
          impactLevel: "CRITICAL",
          economicDisruptionRisk: "CRITICAL"
        },
        {
          cityId: "city-panipat",
          cityName: "Panipat Petrochemical & Textile Zone",
          countryCode: "IND",
          countryFlag: "🇮🇳",
          latitude: 29.3909,
          longitude: 76.9635,
          estimatedArrivalHours: 3,
          estimatedArrivalTime: new Date(timeNow + 3 * 3600 * 1000).toISOString(),
          closestDistanceKm: 8,
          predictedPm2_5: 285,
          predictedAqi: 340,
          impactLevel: "CRITICAL",
          economicDisruptionRisk: "HIGH"
        },
        {
          cityId: "city-ludhiana",
          cityName: "Ludhiana Heavy Engineering Center",
          countryCode: "IND",
          countryFlag: "🇮🇳",
          latitude: 30.9010,
          longitude: 75.8573,
          estimatedArrivalHours: 6,
          estimatedArrivalTime: new Date(timeNow + 6 * 3600 * 1000).toISOString(),
          closestDistanceKm: 14,
          predictedPm2_5: 195,
          predictedAqi: 255,
          impactLevel: "HIGH",
          economicDisruptionRisk: "HIGH"
        },
        {
          cityId: "city-amritsar",
          cityName: "Amritsar Border Trade Gateway",
          countryCode: "IND",
          countryFlag: "🇮🇳",
          latitude: 31.6340,
          longitude: 74.8723,
          estimatedArrivalHours: 9,
          estimatedArrivalTime: new Date(timeNow + 9 * 3600 * 1000).toISOString(),
          closestDistanceKm: 18,
          predictedPm2_5: 145,
          predictedAqi: 210,
          impactLevel: "HIGH",
          economicDisruptionRisk: "HIGH"
        },
        {
          cityId: "city-lahore",
          cityName: "Lahore Industrial Basin",
          countryCode: "PAK",
          countryFlag: "🇵🇰",
          latitude: 31.5204,
          longitude: 74.3587,
          estimatedArrivalHours: 11,
          estimatedArrivalTime: new Date(timeNow + 11 * 3600 * 1000).toISOString(),
          closestDistanceKm: 22,
          predictedPm2_5: 118,
          predictedAqi: 185,
          impactLevel: "HIGH",
          economicDisruptionRisk: "HIGH"
        }
      ],
      earliestArrivalHours: 0,
      earliestArrivalTime: new Date(timeNow).toISOString(),
      maxPredictedPm2_5: 380,
      borderCrossingForecast: {
        arrivalHours: 10,
        timestamp: new Date(timeNow + 10 * 3600 * 1000).toISOString(),
        fromCountry: "India (IND)",
        toCountry: "Pakistan (PAK)"
      },
      corridorRiskScore: 88,
      corridorRiskCategory: "CRITICAL",
      confidence: 84,
      confidenceLevel: "HIGH",
      timelineSummary: [
        {
          stepHours: 0,
          label: "Source: Delhi NCR Hub (IND)",
          description: "Initial hazardous stubble & industrial plume release (PM2.5: 380 µg/m³).",
          pm2_5: 380,
          type: "source"
        },
        {
          stepHours: 3,
          label: "Panipat Petrochemical Zone (IND)",
          description: "Impact in 3 hours. Severe air quality degradation across refinery district (PM2.5: 285 µg/m³).",
          pm2_5: 285,
          type: "city"
        },
        {
          stepHours: 6,
          label: "Ludhiana Engineering Center (IND)",
          description: "Impact in 6 hours. High particulate exposure on major transport corridor (PM2.5: 195 µg/m³).",
          pm2_5: 195,
          type: "city"
        },
        {
          stepHours: 9,
          label: "Amritsar Border Gateway (IND)",
          description: "Impact in 9 hours. Reaches border trade terminal (PM2.5: 145 µg/m³).",
          pm2_5: 145,
          type: "city"
        },
        {
          stepHours: 10,
          label: "Attari-Wagah Border Crossing",
          description: "Plume enters international airspace toward Lahore corridor (PM2.5: 130 µg/m³).",
          pm2_5: 130,
          type: "border"
        },
        {
          stepHours: 11,
          label: "Lahore Industrial Basin (PAK)",
          description: "Impact in 11 hours. Transboundary exposure on eastern Punjab industrial cluster (PM2.5: 118 µg/m³).",
          pm2_5: 118,
          type: "city"
        }
      ],
      explanation: "North-westerly advection vector carries heavy particulate concentration along NH44 trade corridor affecting 5 key industrial centers across 2 sovereign nations.",
      disclaimer: "Application-generated economic corridor risk assessment for multi-lateral planning and early logistical advisories.",
      generatedAt: now.toISOString()
    });
  }

  // Scenario 2: Amur-Heilongjiang Transboundary Axis (Harbin -> Jiamusi -> Hegang -> Khabarovsk)
  const corridor2 = getEconomicCorridorById("corridor-amur-heilongjiang-industrial");
  if (corridor2) {
    activeCorridorPredictionsStore.push({
      predictionId: "pred-corridor-amur-heilongjiang-02",
      corridorId: corridor2.id,
      corridorName: corridor2.name,
      countries: corridor2.countries,
      sourceLocation: {
        latitude: 45.8038,
        longitude: 126.5349,
        locality: "Harbin Industrial Megacity, China"
      },
      sourcePollutant: "Industrial SO2 & Aerosol Plume",
      sourcePollutionLevel: {
        pm2_5: 310,
        severity: "critical"
      },
      affectedCities: [
        {
          cityId: "city-harbin",
          cityName: "Harbin Industrial Megacity",
          countryCode: "CHN",
          countryFlag: "🇨🇳",
          latitude: 45.8038,
          longitude: 126.5349,
          estimatedArrivalHours: 0,
          estimatedArrivalTime: new Date(timeNow).toISOString(),
          closestDistanceKm: 0,
          predictedPm2_5: 310,
          predictedAqi: 360,
          impactLevel: "CRITICAL",
          economicDisruptionRisk: "CRITICAL"
        },
        {
          cityId: "city-jiamusi",
          cityName: "Jiamusi Agro-Industrial Center",
          countryCode: "CHN",
          countryFlag: "🇨🇳",
          latitude: 46.8041,
          longitude: 130.3647,
          estimatedArrivalHours: 4,
          estimatedArrivalTime: new Date(timeNow + 4 * 3600 * 1000).toISOString(),
          closestDistanceKm: 12,
          predictedPm2_5: 190,
          predictedAqi: 250,
          impactLevel: "HIGH",
          economicDisruptionRisk: "HIGH"
        },
        {
          cityId: "city-hegang",
          cityName: "Hegang Coal & Mining Complex",
          countryCode: "CHN",
          countryFlag: "🇨🇳",
          latitude: 47.3499,
          longitude: 130.2783,
          estimatedArrivalHours: 6,
          estimatedArrivalTime: new Date(timeNow + 6 * 3600 * 1000).toISOString(),
          closestDistanceKm: 16,
          predictedPm2_5: 155,
          predictedAqi: 220,
          impactLevel: "HIGH",
          economicDisruptionRisk: "HIGH"
        },
        {
          cityId: "city-khabarovsk",
          cityName: "Khabarovsk Far East Strategic Hub",
          countryCode: "RUS",
          countryFlag: "🇷🇺",
          latitude: 48.4827,
          longitude: 135.0838,
          estimatedArrivalHours: 12,
          estimatedArrivalTime: new Date(timeNow + 12 * 3600 * 1000).toISOString(),
          closestDistanceKm: 28,
          predictedPm2_5: 92,
          predictedAqi: 170,
          impactLevel: "MEDIUM",
          economicDisruptionRisk: "MEDIUM"
        }
      ],
      earliestArrivalHours: 0,
      earliestArrivalTime: new Date(timeNow).toISOString(),
      maxPredictedPm2_5: 310,
      borderCrossingForecast: {
        arrivalHours: 8,
        timestamp: new Date(timeNow + 8 * 3600 * 1000).toISOString(),
        fromCountry: "China (CHN)",
        toCountry: "Russia (RUS)"
      },
      corridorRiskScore: 79,
      corridorRiskCategory: "CRITICAL",
      confidence: 82,
      confidenceLevel: "HIGH",
      timelineSummary: [
        {
          stepHours: 0,
          label: "Source: Harbin Industrial Megacity (CHN)",
          description: "High-temperature coking & turbine emission spike (PM2.5: 310 µg/m³).",
          pm2_5: 310,
          type: "source"
        },
        {
          stepHours: 4,
          label: "Jiamusi Agro-Industrial Center (CHN)",
          description: "Impact in 4 hours. Atmospheric transport over Songhua River plain (PM2.5: 190 µg/m³).",
          pm2_5: 190,
          type: "city"
        },
        {
          stepHours: 6,
          label: "Hegang Mining Complex (CHN)",
          description: "Impact in 6 hours. Mining and coal-processing basin exposed (PM2.5: 155 µg/m³).",
          pm2_5: 155,
          type: "city"
        },
        {
          stepHours: 8,
          label: "Amur River Transboundary Bridge Crossing",
          description: "Plume enters Russian Far East airspace (PM2.5: 132 µg/m³).",
          pm2_5: 132,
          type: "border"
        },
        {
          stepHours: 12,
          label: "Khabarovsk Strategic Logistics Hub (RUS)",
          description: "Impact in 12 hours. Trans-Siberian freight corridor air quality impact (PM2.5: 92 µg/m³).",
          pm2_5: 92,
          type: "city"
        }
      ],
      explanation: "South-westerly advection vector carries heavy metallurgical plume across Heilongjiang corridor intersecting 4 key rail and industrial hubs before crossing the Amur River.",
      disclaimer: "Application-generated economic corridor risk assessment for multi-lateral planning and early logistical advisories.",
      generatedAt: now.toISOString()
    });
  }
}

// Initialize baseline store
initializeDemoCorridorPredictions();

/** Calculate economic disruption risk for an individual city */
export function calculateCityDisruptionRisk(
  impactLevel: PropagationImpactLevel,
  economicWeight: number
): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (impactLevel === "CRITICAL" || (impactLevel === "HIGH" && economicWeight >= 8)) {
    return "CRITICAL";
  }
  if (impactLevel === "HIGH" || (impactLevel === "MEDIUM" && economicWeight >= 7)) {
    return "HIGH";
  }
  if (impactLevel === "MEDIUM" || (impactLevel === "LOW" && economicWeight >= 8)) {
    return "MEDIUM";
  }
  return "LOW";
}

/** Calculate multi-factor explainable corridor risk score (0-100%) */
export function calculateCorridorRiskScore(
  maxPm25: number,
  affectedCities: CorridorCityImpact[],
  hasBorderCrossing: boolean,
  earliestArrivalHours: number,
  corridorImportance: string
): { score: number; category: PropagationImpactLevel } {
  // 1. Pollution Intensity (0 - 35 pts)
  let intensityScore = 0;
  if (maxPm25 >= 300) intensityScore = 35;
  else if (maxPm25 >= 200) intensityScore = 28;
  else if (maxPm25 >= 100) intensityScore = 20;
  else if (maxPm25 >= 50) intensityScore = 12;
  else intensityScore = 5;

  // 2. Exposure & Affected Cities Count (0 - 30 pts)
  const cityCountScore = Math.min(15, affectedCities.length * 4);
  const totalEconomicWeight = affectedCities.reduce((sum, c) => {
    const cityNode = BRICS_ECONOMIC_CORRIDORS.flatMap((cor) => cor.cities).find((cn) => cn.id === c.cityId);
    return sum + (cityNode?.economicWeight || 5);
  }, 0);
  const economicWeightScore = Math.min(15, totalEconomicWeight * 0.75);
  const exposureScore = cityCountScore + economicWeightScore;

  // 3. Early Warning Urgency (0 - 20 pts)
  let urgencyScore = 0;
  if (earliestArrivalHours <= 2) urgencyScore = 20;
  else if (earliestArrivalHours <= 5) urgencyScore = 15;
  else if (earliestArrivalHours <= 10) urgencyScore = 10;
  else urgencyScore = 5;

  // 4. Cross-Border International Impact (0 - 15 pts)
  const crossBorderScore = hasBorderCrossing ? 15 : 0;

  // Total raw score
  let totalScore = Math.round(intensityScore + exposureScore + urgencyScore + crossBorderScore);
  if (corridorImportance === "CRITICAL" && totalScore >= 40) totalScore = Math.min(100, totalScore + 5);
  totalScore = Math.max(0, Math.min(100, totalScore));

  // Risk category
  let category: PropagationImpactLevel = "LOW";
  if (totalScore >= 75) category = "CRITICAL";
  else if (totalScore >= 50) category = "HIGH";
  else if (totalScore >= 25) category = "MEDIUM";

  return { score: totalScore, category };
}

/** Evaluate corridor impact from a PropagationResult */
export function evaluateCorridorImpact(
  propagation: PropagationResult,
  corridor: EconomicCorridor
): CorridorImpactPrediction | null {
  const affectedCities: CorridorCityImpact[] = [];
  const milestones: CorridorTimelineMilestone[] = [];

  // Add source milestone
  milestones.push({
    stepHours: 0,
    label: `Source: ${propagation.source.locality || propagation.source.countryName}`,
    description: `Initial particulate plume advection originating from ${propagation.source.countryName} (${propagation.source.flag}).`,
    pm2_5: propagation.steps[0]?.estimatedPm2_5 || 100,
    type: "source"
  });

  // Evaluate each city in the corridor against all trajectory steps
  for (const city of corridor.cities) {
    let closestDistance = Infinity;
    let closestStepIdx = -1;

    for (let i = 0; i < propagation.steps.length; i++) {
      const step = propagation.steps[i];
      const dist = calculateDistanceKm(
        step.latitude,
        step.longitude,
        city.latitude,
        city.longitude
      );

      if (dist < closestDistance) {
        closestDistance = dist;
        closestStepIdx = i;
      }
    }

    if (closestStepIdx >= 0) {
      const bestStep = propagation.steps[closestStepIdx];
      const impactThresholdKm = bestStep.plumeRadiusKm + CORRIDOR_BUFFER_KM;

      if (closestDistance <= impactThresholdKm) {
        // Calculate localized PM2.5 attenuation based on lateral distance from plume centerline
        const lateralFactor = Math.max(0.35, 1 - closestDistance / (impactThresholdKm * 1.2));
        const cityPm25 = Math.round(bestStep.estimatedPm2_5 * lateralFactor);
        const cityAqi = pm25ToEstimatedAqi(cityPm25);
        const cityImpactLevel = pm25ToImpactLevel(cityPm25);
        const disruptionRisk = calculateCityDisruptionRisk(cityImpactLevel, city.economicWeight);

        affectedCities.push({
          cityId: city.id,
          cityName: city.name,
          countryCode: city.countryCode,
          countryFlag: city.countryFlag,
          latitude: city.latitude,
          longitude: city.longitude,
          estimatedArrivalHours: bestStep.hoursElapsed,
          estimatedArrivalTime: bestStep.timestamp,
          closestDistanceKm: Math.round(closestDistance),
          predictedPm2_5: cityPm25,
          predictedAqi: cityAqi,
          impactLevel: cityImpactLevel,
          economicDisruptionRisk: disruptionRisk
        });
      }
    }
  }

  // If no cities were impacted and plume does not intersect the corridor waypoints, return null
  if (affectedCities.length === 0) {
    // Check if waypoints are intersected even if cities are not directly matched
    let corridorNear = false;
    for (const wp of corridor.waypoints) {
      for (const step of propagation.steps) {
        const d = calculateDistanceKm(step.latitude, step.longitude, wp.latitude, wp.longitude);
        if (d <= step.plumeRadiusKm + CORRIDOR_BUFFER_KM) {
          corridorNear = true;
          break;
        }
      }
      if (corridorNear) break;
    }
    if (!corridorNear) return null;
  }

  // Sort affected cities by arrival hours ascending
  affectedCities.sort((a, b) => a.estimatedArrivalHours - b.estimatedArrivalHours);

  // Build timeline milestones including border crossing
  for (const ac of affectedCities) {
    milestones.push({
      stepHours: ac.estimatedArrivalHours,
      label: `${ac.cityName} (${ac.countryFlag})`,
      description: `Estimated impact in ${ac.estimatedArrivalHours}h. Predicted PM2.5: ${ac.predictedPm2_5} µg/m³ (${ac.impactLevel} impact).`,
      pm2_5: ac.predictedPm2_5,
      type: "city"
    });
  }

  // If cross-border impact was predicted, insert border crossing milestone
  let borderCrossingForecast: CorridorImpactPrediction["borderCrossingForecast"] = undefined;
  if (propagation.hasCrossBorderImpact && propagation.crossBorderPrediction) {
    const p = propagation.crossBorderPrediction;
    borderCrossingForecast = {
      arrivalHours: p.estimatedArrivalHours,
      timestamp: p.estimatedArrivalTime,
      fromCountry: `${p.sourceCountryName} (${p.sourceCountry})`,
      toCountry: `${p.affectedCountryName} (${p.affectedCountry})`
    };

    milestones.push({
      stepHours: p.estimatedArrivalHours,
      label: `Border Crossing: ${p.sourceFlag} → ${p.affectedFlag} ${p.affectedCountryName}`,
      description: `Plume crosses sovereign border into ${p.affectedCountryName} in ~${p.estimatedArrivalHours}h.`,
      pm2_5: p.predictedPollutionLevel.pm2_5,
      type: "border"
    });
  }

  // Sort milestones by stepHours ascending
  milestones.sort((a, b) => a.stepHours - b.stepHours);

  const maxPm25 = affectedCities.length > 0
    ? Math.max(...affectedCities.map((c) => c.predictedPm2_5))
    : propagation.steps[0]?.estimatedPm2_5 || 100;

  const earliestArrival = affectedCities.length > 0
    ? affectedCities[0].estimatedArrivalHours
    : 0;

  const earliestTime = affectedCities.length > 0
    ? affectedCities[0].estimatedArrivalTime
    : propagation.steps[0]?.timestamp || new Date().toISOString();

  const { score: corridorRiskScore, category: corridorRiskCategory } = calculateCorridorRiskScore(
    maxPm25,
    affectedCities,
    !!borderCrossingForecast,
    earliestArrival,
    corridor.importance
  );

  const predictionId = `corridor-pred-${corridor.id}-${Date.now()}`;
  const confidence = Math.round((propagation.modelMetadata ? 80 : 75) + Math.min(15, affectedCities.length * 3));
  const confidenceLevel = confidence >= 80 ? "HIGH" : confidence >= 60 ? "MEDIUM" : "LOW";

  const explanation = `Plume advection along the ${corridor.name} threatens ${affectedCities.length} economic hubs (${affectedCities.map((c) => c.cityName).join(", ")}) with peak PM2.5 of ${maxPm25} µg/m³ and earliest exposure within ${earliestArrival} hours.`;

  const prediction: CorridorImpactPrediction = {
    predictionId,
    corridorId: corridor.id,
    corridorName: corridor.name,
    countries: corridor.countries,
    sourceLocation: {
      latitude: propagation.source.latitude,
      longitude: propagation.source.longitude,
      locality: propagation.source.locality
    },
    sourcePollutant: `${propagation.steps[0]?.estimatedPm2_5 ? "PM2.5 Aerosol" : "Industrial Plume"}`,
    sourcePollutionLevel: {
      pm2_5: propagation.steps[0]?.estimatedPm2_5 || 100,
      severity: maxPm25 >= 250 ? "critical" : maxPm25 >= 120 ? "high" : "moderate"
    },
    affectedCities,
    earliestArrivalHours: earliestArrival,
    earliestArrivalTime: earliestTime,
    maxPredictedPm2_5: maxPm25,
    borderCrossingForecast,
    corridorRiskScore,
    corridorRiskCategory,
    confidence,
    confidenceLevel,
    timelineSummary: milestones,
    explanation,
    disclaimer: "Application-generated economic corridor risk assessment for multi-lateral planning and early logistical advisories.",
    generatedAt: new Date().toISOString()
  };

  return prediction;
}

/** Predict economic corridor impacts for a given input or existing propagation result */
export async function predictEconomicCorridorImpact(
  input: CorridorImpactInput
): Promise<CorridorImpactPrediction[]> {
  let propagation = input.propagationResult;

  if (!propagation) {
    propagation = await executePropagationSimulation({
      sourceLatitude: input.sourceLatitude,
      sourceLongitude: input.sourceLongitude,
      sourceCountryCode: input.sourceCountryCode,
      sourceLocality: input.sourceLocality,
      initialPm2_5: input.initialPm2_5,
      initialSeverity: input.initialSeverity,
      pollutionType: input.pollutionType,
      horizonHours: input.horizonHours || 18,
      eventId: input.eventId
    });
  }

  const corridorsToTest = input.corridorId
    ? BRICS_ECONOMIC_CORRIDORS.filter((c) => c.id === input.corridorId)
    : BRICS_ECONOMIC_CORRIDORS;

  const results: CorridorImpactPrediction[] = [];

  for (const corridor of corridorsToTest) {
    const impact = evaluateCorridorImpact(propagation, corridor);
    if (impact) {
      results.push(impact);

      // Upsert into active predictions store
      const existingIdx = activeCorridorPredictionsStore.findIndex((p) => p.corridorId === impact.corridorId);
      if (existingIdx >= 0) {
        activeCorridorPredictionsStore[existingIdx] = impact;
      } else {
        activeCorridorPredictionsStore.unshift(impact);
        if (activeCorridorPredictionsStore.length > 30) activeCorridorPredictionsStore.pop();
      }
    }
  }

  return results;
}

/** Get all currently active corridor impact predictions */
export function getActiveCorridorPredictions(): CorridorImpactPrediction[] {
  return [...activeCorridorPredictionsStore];
}

/** Get all affected corridors with active predictions */
export function getAffectedCorridors(): CorridorImpactPrediction[] {
  return activeCorridorPredictionsStore.filter((p) => p.affectedCities.length > 0 || p.corridorRiskScore >= 25);
}

/** Get active prediction for a specific corridor */
export function getCorridorPredictionById(corridorId: string): CorridorImpactPrediction | undefined {
  return activeCorridorPredictionsStore.find(
    (p) => p.corridorId === corridorId || p.corridorId.toLowerCase() === corridorId.toLowerCase()
  );
}
