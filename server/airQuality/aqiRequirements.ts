import type { PollutantCode } from "./pollutants.js";

export const CPCB_AQI_REQUIREMENTS = {
  minimumPollutants: 3,
  mandatoryParticulatePollutants: ["PM2.5", "PM10"] as PollutantCode[],
  minimumDailyObservations: 16,
  sourceTitle: "How is AQI calculated?",
  sourceUrl: "https://cpcb.nic.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvSG93X0FRSV9DYWxjdWxhdGVkLnBkZg%3D%3D"
} as const;

export function averagingHoursFor(pollutant: PollutantCode): 8 | 24 {
  return pollutant === "CO" || pollutant === "OZONE" ? 8 : 24;
}

export function minimumWindowObservations(pollutant: PollutantCode): number {
  // CPCB specifies at least 16 observations for a daily sub-index. An 8-hour
  // rolling window cannot contain 16 hourly slots, so it requires one complete
  // 8-hour window while the overall daily sufficiency rule remains 16.
  return averagingHoursFor(pollutant) === 24 ? CPCB_AQI_REQUIREMENTS.minimumDailyObservations : 8;
}

export function validatePollutantSufficiency(pollutants: PollutantCode[]) {
  const availablePollutants = [...new Set(pollutants)];
  const particulatePresent = CPCB_AQI_REQUIREMENTS.mandatoryParticulatePollutants.some((pollutant) => availablePollutants.includes(pollutant));
  const missingRequirements: string[] = [];
  if (availablePollutants.length < CPCB_AQI_REQUIREMENTS.minimumPollutants) {
    missingRequirements.push(`minimum_${CPCB_AQI_REQUIREMENTS.minimumPollutants}_pollutants`);
  }
  if (!particulatePresent) missingRequirements.push("pm25_or_pm10_required");
  return {
    valid: missingRequirements.length === 0,
    availablePollutants,
    requiredMinimumPollutantCount: CPCB_AQI_REQUIREMENTS.minimumPollutants,
    mandatoryPollutantRuleSatisfied: particulatePresent,
    missingRequirements,
    warnings: missingRequirements.length ? ["insufficient_pollutants"] : []
  };
}
