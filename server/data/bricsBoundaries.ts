export interface CountryGeoBoundary {
  code: string;
  name: string;
  flag: string;
  isBrics: boolean;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
  regions: Array<{
    name: string;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }>;
}

export const COUNTRY_BOUNDARIES: CountryGeoBoundary[] = [
  // ── BRICS Members ──────────────────────────────────────────────────────────
  {
    code: "IND",
    name: "India",
    flag: "🇮🇳",
    isBrics: true,
    minLat: 8.0,
    maxLat: 35.5,
    minLng: 68.0,
    maxLng: 97.4,
    centerLat: 20.5937,
    centerLng: 78.9629,
    regions: [
      { name: "Northern India (NCT/Punjab/Haryana)", minLat: 27.5, maxLat: 32.5, minLng: 74.0, maxLng: 79.0 },
      { name: "Eastern / Northeast Border Region", minLat: 22.0, maxLat: 29.5, minLng: 88.0, maxLng: 97.4 },
      { name: "Western / Thar Border Region", minLat: 23.5, maxLat: 30.0, minLng: 68.0, maxLng: 74.0 },
      { name: "Himalayan Foothills", minLat: 29.0, maxLat: 35.5, minLng: 74.0, maxLng: 88.0 },
      { name: "Central / Deccan Plateau", minLat: 15.0, maxLat: 24.0, minLng: 74.0, maxLng: 84.0 }
    ]
  },
  {
    code: "CHN",
    name: "China",
    flag: "🇨🇳",
    isBrics: true,
    minLat: 18.2,
    maxLat: 53.5,
    minLng: 73.5,
    maxLng: 134.8,
    centerLat: 35.8617,
    centerLng: 104.1954,
    regions: [
      { name: "Tibet / Himalayan Border Region", minLat: 27.5, maxLat: 36.5, minLng: 78.5, maxLng: 99.0 },
      { name: "Xinjiang / Central Asian Basin", minLat: 34.5, maxLat: 49.0, minLng: 73.5, maxLng: 96.0 },
      { name: "Northern Hebei / Beijing Plain", minLat: 37.0, maxLat: 42.5, minLng: 113.0, maxLng: 120.0 },
      { name: "Northeast / Heilongjiang Corridor", minLat: 43.0, maxLat: 53.5, minLng: 120.0, maxLng: 134.8 },
      { name: "Yangtze River Basin", minLat: 28.0, maxLat: 33.5, minLng: 105.0, maxLng: 122.0 }
    ]
  },
  {
    code: "RUS",
    name: "Russia",
    flag: "🇷🇺",
    isBrics: true,
    minLat: 41.2,
    maxLat: 81.8,
    minLng: 19.6,
    maxLng: 180.0,
    centerLat: 61.524,
    centerLng: 105.3188,
    regions: [
      { name: "Siberian / Amur-China Border Region", minLat: 48.0, maxLat: 55.0, minLng: 115.0, maxLng: 135.0 },
      { name: "Ural Industrial Corridor", minLat: 52.0, maxLat: 62.0, minLng: 55.0, maxLng: 65.0 },
      { name: "Central Federal District (Moscow Basin)", minLat: 52.0, maxLat: 58.0, minLng: 35.0, maxLng: 42.0 },
      { name: "Altai / Southern Siberian Boundary", minLat: 49.0, maxLat: 54.0, minLng: 80.0, maxLng: 90.0 }
    ]
  },
  {
    code: "BRA",
    name: "Brazil",
    flag: "🇧🇷",
    isBrics: true,
    minLat: -33.7,
    maxLat: 5.3,
    minLng: -73.9,
    maxLng: -34.8,
    centerLat: -14.235,
    centerLng: -51.9253,
    regions: [
      { name: "Amazonian Basin & Northern Forest", minLat: -8.0, maxLat: 4.5, minLng: -72.0, maxLng: -48.0 },
      { name: "Southeast Industrial Core (São Paulo/Rio)", minLat: -24.5, maxLat: -18.5, minLng: -52.0, maxLng: -41.0 },
      { name: "Southern Border Region (Paraná / Rio Grande)", minLat: -33.7, maxLat: -24.0, minLng: -57.0, maxLng: -49.0 },
      { name: "Cerrado / Central Agrobusiness Basin", minLat: -18.0, maxLat: -10.0, minLng: -56.0, maxLng: -44.0 }
    ]
  },
  {
    code: "ZAF",
    name: "South Africa",
    flag: "🇿🇦",
    isBrics: true,
    minLat: -34.8,
    maxLat: -22.1,
    minLng: 16.4,
    maxLng: 32.9,
    centerLat: -30.5595,
    centerLng: 22.9375,
    regions: [
      { name: "Highveld Industrial Corridor (Gauteng/Mpumalanga)", minLat: -27.0, maxLat: -25.0, minLng: 27.5, maxLng: 30.5 },
      { name: "Limpopo Northern Boundary", minLat: -24.5, maxLat: -22.1, minLng: 27.0, maxLng: 31.5 },
      { name: "KwaZulu-Natal Coastal Corridor", minLat: -31.0, maxLat: -27.0, minLng: 29.5, maxLng: 32.9 },
      { name: "Western Cape Coastal Basin", minLat: -34.8, maxLat: -31.5, minLng: 17.5, maxLng: 21.0 }
    ]
  },
  {
    code: "EGY",
    name: "Egypt",
    flag: "🇪🇬",
    isBrics: true,
    minLat: 22.0,
    maxLat: 31.7,
    minLng: 24.7,
    maxLng: 36.9,
    centerLat: 26.8206,
    centerLng: 30.8025,
    regions: [
      { name: "Nile Delta & Greater Cairo Corridor", minLat: 29.5, maxLat: 31.7, minLng: 30.5, maxLng: 32.5 },
      { name: "Red Sea & Sinai Transit Boundary", minLat: 27.0, maxLat: 31.3, minLng: 32.5, maxLng: 35.0 },
      { name: "Upper Nile Valley", minLat: 22.0, maxLat: 29.0, minLng: 30.5, maxLng: 33.5 }
    ]
  },
  {
    code: "ETH",
    name: "Ethiopia",
    flag: "🇪🇹",
    isBrics: true,
    minLat: 3.4,
    maxLat: 14.9,
    minLng: 33.0,
    maxLng: 48.0,
    centerLat: 9.145,
    centerLng: 40.4897,
    regions: [
      { name: "Central Rift Valley / Addis Ababa", minLat: 7.5, maxLat: 10.5, minLng: 37.5, maxLng: 40.5 },
      { name: "Northern Highland Corridor", minLat: 11.0, maxLat: 14.9, minLng: 36.5, maxLng: 40.0 },
      { name: "Eastern Ogaden / Horn of Africa Boundary", minLat: 4.5, maxLat: 10.0, minLng: 41.5, maxLng: 48.0 }
    ]
  },
  {
    code: "IDN",
    name: "Indonesia",
    flag: "🇮🇩",
    isBrics: true,
    minLat: -11.0,
    maxLat: 6.0,
    minLng: 95.0,
    maxLng: 141.0,
    centerLat: -0.7893,
    centerLng: 113.9213,
    regions: [
      { name: "Java Megalopolis (Jabodetabek)", minLat: -8.5, maxLat: -5.8, minLng: 105.5, maxLng: 114.5 },
      { name: "Sumatra Peatland / Malacca Strait Corridor", minLat: -5.5, maxLat: 5.5, minLng: 95.0, maxLng: 106.0 },
      { name: "Kalimantan Forest Basin", minLat: -4.5, maxLat: 4.5, minLng: 108.5, maxLng: 119.0 }
    ]
  },
  {
    code: "IRN",
    name: "Iran",
    flag: "🇮🇷",
    isBrics: true,
    minLat: 26.2,
    maxLat: 39.8,
    minLng: 44.0,
    maxLng: 63.3,
    centerLat: 32.4279,
    centerLng: 53.688,
    regions: [
      { name: "Tehran & Alborz Industrial Plateau", minLat: 34.5, maxLat: 37.0, minLng: 49.5, maxLng: 53.5 },
      { name: "Persian Gulf & Khuzestan Energy Corridor", minLat: 27.0, maxLat: 32.5, minLng: 48.0, maxLng: 53.0 },
      { name: "Eastern Sistan / Central Asian Border", minLat: 27.5, maxLat: 34.0, minLng: 58.5, maxLng: 63.3 }
    ]
  },
  {
    code: "ARE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    isBrics: true,
    minLat: 22.6,
    maxLat: 26.1,
    minLng: 51.5,
    maxLng: 56.4,
    centerLat: 23.4241,
    centerLng: 53.8478,
    regions: [
      { name: "Dubai & Northern Emirates Urban Corridor", minLat: 24.8, maxLat: 26.1, minLng: 54.8, maxLng: 56.4 },
      { name: "Abu Dhabi Coastal & Industrial Zone", minLat: 23.8, maxLat: 24.8, minLng: 53.0, maxLng: 55.0 },
      { name: "Al Ain / Oman Border Zone", minLat: 23.8, maxLat: 24.6, minLng: 55.3, maxLng: 56.0 }
    ]
  },
  {
    code: "SAU",
    name: "Saudi Arabia",
    flag: "🇸🇦",
    isBrics: true,
    minLat: 16.3,
    maxLat: 32.2,
    minLng: 34.5,
    maxLng: 55.7,
    centerLat: 23.8859,
    centerLng: 45.0792,
    regions: [
      { name: "Eastern Province Energy Basin (Dammam/Jubail)", minLat: 25.0, maxLat: 28.5, minLng: 48.5, maxLng: 50.5 },
      { name: "Riyadh Central Urban Plain", minLat: 23.5, maxLat: 25.5, minLng: 45.5, maxLng: 47.5 },
      { name: "Red Sea Coastal Corridor (Jeddah/Yanbu)", minLat: 20.5, maxLat: 24.5, minLng: 37.5, maxLng: 39.5 }
    ]
  },

  // ── Key Neighboring / Transit Buffer Regions ──────────────────────────────
  {
    code: "PAK",
    name: "Pakistan",
    flag: "🇵🇰",
    isBrics: false,
    minLat: 23.6,
    maxLat: 37.0,
    minLng: 60.8,
    maxLng: 77.8,
    centerLat: 30.3753,
    centerLng: 69.3451,
    regions: [
      { name: "Punjab Transboundary Airshed (Lahore Basin)", minLat: 30.0, maxLat: 33.0, minLng: 71.5, maxLng: 75.0 },
      { name: "Sindh Coastal Zone", minLat: 23.6, maxLat: 27.5, minLng: 66.5, maxLng: 71.0 }
    ]
  },
  {
    code: "NPL",
    name: "Nepal",
    flag: "🇳🇵",
    isBrics: false,
    minLat: 26.3,
    maxLat: 30.5,
    minLng: 80.0,
    maxLng: 88.2,
    centerLat: 28.3949,
    centerLng: 84.124,
    regions: [
      { name: "Terai Border Plains", minLat: 26.3, maxLat: 28.0, minLng: 80.0, maxLng: 88.0 },
      { name: "Kathmandu Himalayan Valley", minLat: 27.5, maxLat: 28.0, minLng: 85.0, maxLng: 85.6 }
    ]
  },
  {
    code: "BGD",
    name: "Bangladesh",
    flag: "🇧🇩",
    isBrics: false,
    minLat: 20.5,
    maxLat: 26.6,
    minLng: 88.0,
    maxLng: 92.7,
    centerLat: 23.685,
    centerLng: 90.3563,
    regions: [
      { name: "Bengal Delta Airshed", minLat: 22.0, maxLat: 25.5, minLng: 88.5, maxLng: 91.5 }
    ]
  },
  {
    code: "MNG",
    name: "Mongolia",
    flag: "🇲🇳",
    isBrics: false,
    minLat: 41.5,
    maxLat: 52.2,
    minLng: 87.7,
    maxLng: 119.9,
    centerLat: 46.8625,
    centerLng: 103.8467,
    regions: [
      { name: "Gobi Desert Border Corridor", minLat: 41.5, maxLat: 45.0, minLng: 95.0, maxLng: 115.0 }
    ]
  },
  {
    code: "KAZ",
    name: "Kazakhstan",
    flag: "🇰🇿",
    isBrics: false,
    minLat: 40.5,
    maxLat: 55.4,
    minLng: 46.5,
    maxLng: 87.3,
    centerLat: 48.0196,
    centerLng: 66.9237,
    regions: [
      { name: "Eurasian Steppe Border Zone", minLat: 45.0, maxLat: 52.0, minLng: 50.0, maxLng: 85.0 }
    ]
  },
  {
    code: "OMN",
    name: "Oman",
    flag: "🇴🇲",
    isBrics: false,
    minLat: 16.6,
    maxLat: 26.4,
    minLng: 52.0,
    maxLng: 59.8,
    centerLat: 21.4735,
    centerLng: 55.9754,
    regions: [
      { name: "Al Batinah & Gulf of Oman Corridor", minLat: 23.0, maxLat: 25.5, minLng: 56.5, maxLng: 58.5 }
    ]
  }
];

/** Check if a geographic coordinate falls inside a country's bounding region */
export function isCoordinateInCountry(lat: number, lng: number, country: CountryGeoBoundary): boolean {
  if (country.code === "IND") {
    // Exclude Tibet / China territory north of Himalayan crest
    if (lat > 31.2 && lng > 79.0) return false;
    // Exclude Nepal (26.4-30.4 N, 80.2-88.1 E)
    if (lat >= 26.4 && lat <= 30.4 && lng >= 80.2 && lng <= 88.1) return false;
    // Exclude Bangladesh (20.6-26.5 N, 88.8-92.5 E)
    if (lat >= 20.6 && lat <= 26.5 && lng >= 88.8 && lng <= 92.5) return false;
  }

  if (country.code === "CHN") {
    // Exclude Russian Far East territory east/north of Amur River bend
    if (lat >= 48.2 && lng >= 132.5) return false;
    // Tibet region north of Himalayas
    if (lat >= 28.0 && lat <= 36.5 && lng >= 79.0 && lng <= 99.0) return true;
  }

  return (
    lat >= country.minLat &&
    lat <= country.maxLat &&
    lng >= country.minLng &&
    lng <= country.maxLng
  );
}

/** Identify which country contains a given coordinate */
export function identifyCountryForCoordinate(
  lat: number,
  lng: number
): { countryCode: string; countryName: string; flag: string; isBrics: boolean; regionName: string } {
  for (const country of COUNTRY_BOUNDARIES) {
    if (isCoordinateInCountry(lat, lng, country)) {
      // Check subregions for granular locality
      let matchingRegion = `${country.name} Territory`;
      for (const r of country.regions) {
        if (lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng) {
          matchingRegion = r.name;
          break;
        }
      }

      return {
        countryCode: country.code,
        countryName: country.name,
        flag: country.flag,
        isBrics: country.isBrics,
        regionName: matchingRegion
      };
    }
  }

  // Fallback if over international waters or unindexed sovereign zone
  return {
    countryCode: "INTL",
    countryName: "Transboundary Air Corridor",
    flag: "🌐",
    isBrics: false,
    regionName: `International Airspace (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`
  };
}

/** Retrieve country boundary metadata by 3-letter code */
export function getCountryBoundary(code: string): CountryGeoBoundary | undefined {
  return COUNTRY_BOUNDARIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
}
