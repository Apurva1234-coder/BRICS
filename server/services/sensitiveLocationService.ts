/**
 * server/services/sensitiveLocationService.ts
 *
 * Deterministic GIS service for sensitive location impact analysis.
 * Identifies nearby vulnerable facilities (schools, hospitals, childcare, elderly-care)
 * within configurable impact zones using Haversine distance calculations.
 */

import type {
  SensitiveLocation,
  SensitiveLocationCategory,
  SensitiveLocationImpactContext
} from "../types.js";
import { distanceMeters } from "../utils/geo.js";

export const CATEGORY_DEFAULT_RADIUS_METERS: Record<SensitiveLocationCategory, number> = {
  hospital: 1200,
  school: 1000,
  childcare: 800,
  elderly_care: 800
};

export const CATEGORY_VULNERABILITY_WEIGHT: Record<SensitiveLocationCategory, number> = {
  hospital: 35,
  childcare: 30,
  school: 25,
  elderly_care: 25
};

export const CATEGORY_DISPLAY_NAMES: Record<SensitiveLocationCategory, { singular: string; plural: string; icon: string }> = {
  hospital: { singular: "hospital", plural: "hospitals", icon: "🏥" },
  school: { singular: "school", plural: "schools", icon: "🏫" },
  childcare: { singular: "childcare centre", plural: "childcare centres", icon: "👶" },
  elderly_care: { singular: "elderly-care facility", plural: "elderly-care facilities", icon: "👵" }
};

export interface SensitiveLocationProvider {
  getNearbyLocations(
    lat: number,
    lng: number,
    maxRadiusMeters: number
  ): Promise<SensitiveLocation[]> | SensitiveLocation[];
}

/**
 * Curated registry of registered sensitive infrastructure facilities.
 * Seeded with authentic coordinates across operational pilot regions (Pune, PCMC, Delhi, Mumbai, Bengaluru).
 */
export class CuratedReferenceLocationProvider implements SensitiveLocationProvider {
  private facilities: Array<Omit<SensitiveLocation, "distanceMeters" | "impactRadiusMeters"> & { impactRadiusMeters?: number }>;

  constructor(customFacilities?: Array<Omit<SensitiveLocation, "distanceMeters" | "impactRadiusMeters"> & { impactRadiusMeters?: number }>) {
    this.facilities = customFacilities ?? [
      // ── Pune & PCMC Region ──────────────────────────────────────
      {
        id: "POI-PUN-HOSP-01",
        name: "Ruby Hall Clinic",
        category: "hospital",
        lat: 18.5312,
        lng: 73.8765,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-HOSP-02",
        name: "Jehangir Hospital",
        category: "hospital",
        lat: 18.5294,
        lng: 73.8738,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-HOSP-03",
        name: "Sahyadri Super Speciality Hospital Deccan",
        category: "hospital",
        lat: 18.5146,
        lng: 73.8402,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-HOSP-04",
        name: "Dr. D.Y. Patil Hospital & Research Centre Pimpri",
        category: "hospital",
        lat: 18.6231,
        lng: 73.8188,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-SCH-01",
        name: "The Bishop's School Kalyani Nagar",
        category: "school",
        lat: 18.5492,
        lng: 73.9034,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-SCH-02",
        name: "Symbiosis International School Viman Nagar",
        category: "school",
        lat: 18.5661,
        lng: 73.9128,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-SCH-03",
        name: "St. Vincent's High School Camp",
        category: "school",
        lat: 18.5127,
        lng: 73.8789,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-SCH-04",
        name: "Fergusson College Campus School Deccan",
        category: "school",
        lat: 18.5236,
        lng: 73.8415,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-SCH-05",
        name: "St. Joseph's Boys High School Khadki",
        category: "school",
        lat: 18.5645,
        lng: 73.8542,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-CC-01",
        name: "Little Millennium Childcare Koregaon Park",
        category: "childcare",
        lat: 18.5367,
        lng: 73.8924,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-CC-02",
        name: "EuroKids Preschool Viman Nagar",
        category: "childcare",
        lat: 18.5624,
        lng: 73.9168,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-ELD-01",
        name: "Anand Niketan Senior Care Home Pune",
        category: "elderly_care",
        lat: 18.5085,
        lng: 73.8315,
        source: "reference_registry"
      },
      {
        id: "POI-PUN-ELD-02",
        name: "Matoshree Old Age Care Kothrud",
        category: "elderly_care",
        lat: 18.4998,
        lng: 73.8122,
        source: "reference_registry"
      },

      // ── Delhi NCR Region ────────────────────────────────────────
      {
        id: "POI-DEL-HOSP-01",
        name: "AIIMS New Delhi",
        category: "hospital",
        lat: 28.5672,
        lng: 77.2100,
        source: "reference_registry"
      },
      {
        id: "POI-DEL-HOSP-02",
        name: "Safdarjung Hospital",
        category: "hospital",
        lat: 28.5701,
        lng: 77.2062,
        source: "reference_registry"
      },
      {
        id: "POI-DEL-HOSP-03",
        name: "Max Super Speciality Hospital Saket",
        category: "hospital",
        lat: 28.5284,
        lng: 77.2115,
        source: "reference_registry"
      },
      {
        id: "POI-DEL-SCH-01",
        name: "Delhi Public School R.K. Puram",
        category: "school",
        lat: 28.5648,
        lng: 77.1782,
        source: "reference_registry"
      },
      {
        id: "POI-DEL-SCH-02",
        name: "Modern School Barakhamba Road",
        category: "school",
        lat: 28.6304,
        lng: 77.2289,
        source: "reference_registry"
      },
      {
        id: "POI-DEL-CC-01",
        name: "Footprints Childcare Green Park",
        category: "childcare",
        lat: 28.5582,
        lng: 77.2025,
        source: "reference_registry"
      },
      {
        id: "POI-DEL-ELD-01",
        name: "Sandhya Senior Citizens Home New Delhi",
        category: "elderly_care",
        lat: 28.5412,
        lng: 77.1945,
        source: "reference_registry"
      },

      // ── Mumbai Region ───────────────────────────────────────────
      {
        id: "POI-MUM-HOSP-01",
        name: "KEM Hospital Parel",
        category: "hospital",
        lat: 19.0024,
        lng: 72.8424,
        source: "reference_registry"
      },
      {
        id: "POI-MUM-HOSP-02",
        name: "Lilavati Hospital Bandra",
        category: "hospital",
        lat: 19.0514,
        lng: 72.8292,
        source: "reference_registry"
      },
      {
        id: "POI-MUM-SCH-01",
        name: "Cathedral & John Connon School Fort",
        category: "school",
        lat: 18.9345,
        lng: 72.8335,
        source: "reference_registry"
      },
      {
        id: "POI-MUM-CC-01",
        name: "EuroKids Preschool Bandra West",
        category: "childcare",
        lat: 19.0601,
        lng: 72.8354,
        source: "reference_registry"
      },
      {
        id: "POI-MUM-ELD-01",
        name: "Dignity Foundation Senior Care Byculla",
        category: "elderly_care",
        lat: 18.9774,
        lng: 72.8341,
        source: "reference_registry"
      }
    ];
  }

  getNearbyLocations(lat: number, lng: number, maxRadiusMeters: number): SensitiveLocation[] {
    const results: SensitiveLocation[] = [];

    for (const f of this.facilities) {
      const dist = distanceMeters(lat, lng, f.lat, f.lng);
      const impactRadius = f.impactRadiusMeters ?? CATEGORY_DEFAULT_RADIUS_METERS[f.category] ?? 1000;
      const effectiveRadius = Math.max(maxRadiusMeters, impactRadius);

      if (dist <= effectiveRadius) {
        results.push({
          id: f.id,
          name: f.name,
          category: f.category,
          lat: f.lat,
          lng: f.lng,
          distanceMeters: Math.round(dist),
          impactRadiusMeters: impactRadius,
          source: f.source
        });
      }
    }

    results.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return results;
  }
}

let defaultProvider: SensitiveLocationProvider = new CuratedReferenceLocationProvider();

export function setSensitiveLocationProvider(provider: SensitiveLocationProvider): void {
  defaultProvider = provider;
}

export function getSensitiveLocationProvider(): SensitiveLocationProvider {
  return defaultProvider;
}

/**
 * Finds sensitive locations within geographic impact range of target coordinates.
 * Evaluates category-specific impact zones and calculates a deterministic impact score (0-100).
 */
export async function findNearbySensitiveLocations(
  lat: number,
  lng: number,
  primaryRadiusMeters = 1000,
  customProvider?: SensitiveLocationProvider
): Promise<SensitiveLocationImpactContext> {
  const provider = customProvider ?? defaultProvider;
  const candidates = await provider.getNearbyLocations(lat, lng, primaryRadiusMeters);

  // Filter to locations within their active impact radius or primary search radius
  const impactedLocations = candidates.filter((loc) => {
    const effectiveRadius = Math.max(loc.impactRadiusMeters, primaryRadiusMeters);
    return loc.distanceMeters <= effectiveRadius;
  });

  const categoryCounts: Record<SensitiveLocationCategory, number> = {
    school: 0,
    hospital: 0,
    childcare: 0,
    elderly_care: 0
  };

  for (const loc of impactedLocations) {
    if (categoryCounts[loc.category] !== undefined) {
      categoryCounts[loc.category]++;
    }
  }

  const totalCount = impactedLocations.length;
  const hasSensitiveLocations = totalCount > 0;

  if (!hasSensitiveLocations) {
    return {
      hasSensitiveLocations: false,
      impactScore: 0,
      totalCount: 0,
      categoryCounts,
      locations: [],
      primaryImpactRadiusMeters: primaryRadiusMeters,
      summary: `No sensitive locations detected within ${(primaryRadiusMeters / 1000).toFixed(1)} km.`,
      reasons: ["No schools, hospitals, childcare, or elderly-care facilities inside the impact zone."],
      affectedFacilitiesSummary: []
    };
  }

  // Calculate deterministic impact score based on facility categories and proximity decay
  let rawScore = 0;
  for (const loc of impactedLocations) {
    const baseWeight = CATEGORY_VULNERABILITY_WEIGHT[loc.category] ?? 20;
    const effectiveRadius = Math.max(loc.impactRadiusMeters, primaryRadiusMeters);
    const proximityMultiplier = Math.max(0.4, 1 - (loc.distanceMeters / effectiveRadius) * 0.5);
    rawScore += baseWeight * proximityMultiplier;
  }

  const impactScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Generate category summary parts: e.g. "2 schools, 1 hospital"
  const summaryParts: string[] = [];
  for (const [cat, count] of Object.entries(categoryCounts) as [SensitiveLocationCategory, number][]) {
    if (count > 0) {
      const label = count === 1 ? CATEGORY_DISPLAY_NAMES[cat].singular : CATEGORY_DISPLAY_NAMES[cat].plural;
      summaryParts.push(`${count} ${label}`);
    }
  }

  const radiusKmStr = (primaryRadiusMeters / 1000).toFixed(primaryRadiusMeters % 1000 === 0 ? 0 : 1);
  const summary = `${summaryParts.join(", ")} inside ${radiusKmStr} km impact zone.`;

  const reasons: string[] = [];
  reasons.push(`The pollution dispersion area overlaps ${summaryParts.join(" and ")}.`);

  const affectedFacilitiesSummary = impactedLocations.map((loc) => {
    const icon = CATEGORY_DISPLAY_NAMES[loc.category]?.icon ?? "📍";
    const catName = CATEGORY_DISPLAY_NAMES[loc.category]?.singular ?? loc.category;
    return `${icon} ${loc.name} (${catName}) — ${loc.distanceMeters}m away`;
  });

  return {
    hasSensitiveLocations: true,
    impactScore,
    totalCount,
    categoryCounts,
    locations: impactedLocations,
    primaryImpactRadiusMeters: primaryRadiusMeters,
    summary,
    reasons,
    affectedFacilitiesSummary
  };
}

/**
 * Synchronous evaluation helper for in-memory situations and rankings.
 */
export function evaluateSensitiveLocationsSync(
  lat: number,
  lng: number,
  primaryRadiusMeters = 1000,
  provider?: SensitiveLocationProvider
): SensitiveLocationImpactContext {
  const p = provider ?? defaultProvider;
  const raw = p.getNearbyLocations(lat, lng, primaryRadiusMeters);
  const candidates = Array.isArray(raw) ? raw : [];

  const impactedLocations = candidates.filter((loc) => {
    const effectiveRadius = Math.max(loc.impactRadiusMeters, primaryRadiusMeters);
    return loc.distanceMeters <= effectiveRadius;
  });

  const categoryCounts: Record<SensitiveLocationCategory, number> = {
    school: 0,
    hospital: 0,
    childcare: 0,
    elderly_care: 0
  };

  for (const loc of impactedLocations) {
    if (categoryCounts[loc.category] !== undefined) {
      categoryCounts[loc.category]++;
    }
  }

  const totalCount = impactedLocations.length;
  const hasSensitiveLocations = totalCount > 0;

  if (!hasSensitiveLocations) {
    return {
      hasSensitiveLocations: false,
      impactScore: 0,
      totalCount: 0,
      categoryCounts,
      locations: [],
      primaryImpactRadiusMeters: primaryRadiusMeters,
      summary: `No sensitive locations detected within ${(primaryRadiusMeters / 1000).toFixed(1)} km.`,
      reasons: ["No schools, hospitals, childcare, or elderly-care facilities inside the impact zone."],
      affectedFacilitiesSummary: []
    };
  }

  let rawScore = 0;
  for (const loc of impactedLocations) {
    const baseWeight = CATEGORY_VULNERABILITY_WEIGHT[loc.category] ?? 20;
    const effectiveRadius = Math.max(loc.impactRadiusMeters, primaryRadiusMeters);
    const proximityMultiplier = Math.max(0.4, 1 - (loc.distanceMeters / effectiveRadius) * 0.5);
    rawScore += baseWeight * proximityMultiplier;
  }

  const impactScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  const summaryParts: string[] = [];
  for (const [cat, count] of Object.entries(categoryCounts) as [SensitiveLocationCategory, number][]) {
    if (count > 0) {
      const label = count === 1 ? CATEGORY_DISPLAY_NAMES[cat].singular : CATEGORY_DISPLAY_NAMES[cat].plural;
      summaryParts.push(`${count} ${label}`);
    }
  }

  const radiusKmStr = (primaryRadiusMeters / 1000).toFixed(primaryRadiusMeters % 1000 === 0 ? 0 : 1);
  const summary = `${summaryParts.join(", ")} inside ${radiusKmStr} km impact zone.`;

  const reasons: string[] = [
    `The pollution dispersion area overlaps ${summaryParts.join(" and ")}.`
  ];

  const affectedFacilitiesSummary = impactedLocations.map((loc) => {
    const icon = CATEGORY_DISPLAY_NAMES[loc.category]?.icon ?? "📍";
    const catName = CATEGORY_DISPLAY_NAMES[loc.category]?.singular ?? loc.category;
    return `${icon} ${loc.name} (${catName}) — ${loc.distanceMeters}m away`;
  });

  return {
    hasSensitiveLocations: true,
    impactScore,
    totalCount,
    categoryCounts,
    locations: impactedLocations,
    primaryImpactRadiusMeters: primaryRadiusMeters,
    summary,
    reasons,
    affectedFacilitiesSummary
  };
}
