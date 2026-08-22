import type { EconomicCorridor } from "../types.js";

/**
 * Registry of Representative Major BRICS & Inter-regional Economic Trade Corridors
 * Configurable dataset supporting transboundary industrial hubs, transport arteries, and waypoint nodes.
 */
export const BRICS_ECONOMIC_CORRIDORS: EconomicCorridor[] = [
  // ── Corridor 1: Northern Trans-Himalayan & Trade Gateway (IND - PAK - CHN) ──
  {
    id: "corridor-delhi-lahore-central-asia",
    name: "Northern Subcontinental Trade & Industrial Corridor",
    countries: ["IND", "PAK", "CHN"],
    description: "High-density arterial economic corridor connecting the National Capital Region through the Punjab industrial belt toward Himalayan border crossings.",
    importance: "CRITICAL",
    primaryIndustries: ["Petrochemical Refining", "Textiles & Garments", "Automotive Manufacturing", "Heavy Agro-Machinery"],
    totalLengthKm: 650,
    waypoints: [
      { latitude: 28.6139, longitude: 77.2090 }, // Delhi NCR
      { latitude: 29.3909, longitude: 76.9635 }, // Panipat Refinery Hub
      { latitude: 30.3752, longitude: 76.7821 }, // Ambala Logistics Node
      { latitude: 30.9010, longitude: 75.8573 }, // Ludhiana Industrial Base
      { latitude: 31.3260, longitude: 75.5762 }, // Jalandhar Manufacturing Hub
      { latitude: 31.6340, longitude: 74.8723 }, // Amritsar Frontier
      { latitude: 31.5204, longitude: 74.3587 }, // Lahore Industrial Basin
      { latitude: 32.4945, longitude: 74.5229 }  // Sialkot Export Zone
    ],
    cities: [
      {
        id: "city-delhi-ncr",
        name: "Delhi NCR Metropolitan Hub",
        countryCode: "IND",
        countryFlag: "🇮🇳",
        latitude: 28.6139,
        longitude: 77.2090,
        populationEstimate: 32000000,
        economicWeight: 10,
        industrialFocus: "Heavy Consumer Goods, IT Logistics & Petrochem Distribution",
        corridorKmMarker: 0
      },
      {
        id: "city-panipat",
        name: "Panipat Petrochemical & Textile Zone",
        countryCode: "IND",
        countryFlag: "🇮🇳",
        latitude: 29.3909,
        longitude: 76.9635,
        populationEstimate: 1400000,
        economicWeight: 8,
        industrialFocus: "IOCL Oil Refinery, Shoddy Yarn & Heavy Synthetic Textiles",
        corridorKmMarker: 85
      },
      {
        id: "city-ludhiana",
        name: "Ludhiana Heavy Engineering Center",
        countryCode: "IND",
        countryFlag: "🇮🇳",
        latitude: 30.9010,
        longitude: 75.8573,
        populationEstimate: 3500000,
        economicWeight: 9,
        industrialFocus: "Bicycle Manufacturing, Diesel Engines, Auto Parts & Knitwear",
        corridorKmMarker: 310
      },
      {
        id: "city-amritsar",
        name: "Amritsar Border Trade Gateway",
        countryCode: "IND",
        countryFlag: "🇮🇳",
        latitude: 31.6340,
        longitude: 74.8723,
        populationEstimate: 1800000,
        economicWeight: 7,
        industrialFocus: "Dry Port Logistics, Mill Machinery & Transboundary Commerce",
        corridorKmMarker: 450
      },
      {
        id: "city-lahore",
        name: "Lahore Industrial Basin",
        countryCode: "PAK",
        countryFlag: "🇵🇰",
        latitude: 31.5204,
        longitude: 74.3587,
        populationEstimate: 13000000,
        economicWeight: 9,
        industrialFocus: "Chemicals, Heavy Metallurgical Fabrication & Consumer Goods",
        corridorKmMarker: 500
      }
    ]
  },

  // ── Corridor 2: Northeast China - Russian Far East Industrial Axis (CHN - RUS) ──
  {
    id: "corridor-amur-heilongjiang-industrial",
    name: "Amur-Heilongjiang Transboundary Industrial Axis",
    countries: ["CHN", "RUS"],
    description: "Major northern heavy industrial trade corridor bridging Northeast China's metallurgical belt across the Amur River into Russian Far East logistical nodes.",
    importance: "CRITICAL",
    primaryIndustries: ["Steel Production", "Coal-to-Chemicals", "Rail Freight Logistics", "Timber & Metallurgical Refining"],
    totalLengthKm: 780,
    waypoints: [
      { latitude: 45.8038, longitude: 126.5349 }, // Harbin
      { latitude: 46.8041, longitude: 130.3647 }, // Jiamusi
      { latitude: 47.3499, longitude: 130.2783 }, // Hegang Coal Basin
      { latitude: 47.7000, longitude: 131.5000 }, // Tongjiang Cross-Border Bridge
      { latitude: 48.7946, longitude: 132.9242 }, // Birobidzhan
      { latitude: 48.4827, longitude: 135.0838 }  // Khabarovsk
    ],
    cities: [
      {
        id: "city-harbin",
        name: "Harbin Industrial Megacity",
        countryCode: "CHN",
        countryFlag: "🇨🇳",
        latitude: 45.8038,
        longitude: 126.5349,
        populationEstimate: 9800000,
        economicWeight: 10,
        industrialFocus: "Turbine Manufacturing, Power Generation Equipment & Chemical Refining",
        corridorKmMarker: 0
      },
      {
        id: "city-jiamusi",
        name: "Jiamusi Agro-Industrial Center",
        countryCode: "CHN",
        countryFlag: "🇨🇳",
        latitude: 46.8041,
        longitude: 130.3647,
        populationEstimate: 2150000,
        economicWeight: 7,
        industrialFocus: "Agricultural Machinery, Paper Pulp & Food Processing",
        corridorKmMarker: 330
      },
      {
        id: "city-hegang",
        name: "Hegang Coal & Mining Complex",
        countryCode: "CHN",
        countryFlag: "🇨🇳",
        latitude: 47.3499,
        longitude: 130.2783,
        populationEstimate: 890000,
        economicWeight: 8,
        industrialFocus: "Coking Coal, Thermal Power & Graphite Processing",
        corridorKmMarker: 400
      },
      {
        id: "city-khabarovsk",
        name: "Khabarovsk Far East Strategic Hub",
        countryCode: "RUS",
        countryFlag: "🇷🇺",
        latitude: 48.4827,
        longitude: 135.0838,
        populationEstimate: 620000,
        economicWeight: 8,
        industrialFocus: "Trans-Siberian Rail Intermodal Logistics, Oil Refining & Ship Repair",
        corridorKmMarker: 780
      }
    ]
  },

  // ── Corridor 3: Persian Gulf Energy & Maritime Freight Highway (ARE - SAU - IRN) ──
  {
    id: "corridor-gulf-maritime-energy",
    name: "Persian Gulf Maritime & Energy Artery",
    countries: ["ARE", "SAU", "IRN"],
    description: "Global maritime, aviation, and petrochemical energy corridor spanning the western and eastern shores of the Arabian Gulf.",
    importance: "CRITICAL",
    primaryIndustries: ["LNG & Crude Export", "Aluminum Smelting", "Aviation Super-Hubs", "Maritime Intermodal Ports"],
    totalLengthKm: 520,
    waypoints: [
      { latitude: 24.4539, longitude: 54.3773 }, // Abu Dhabi
      { latitude: 25.0118, longitude: 55.0617 }, // Jebel Ali Free Zone
      { latitude: 25.2048, longitude: 55.2708 }, // Dubai Central
      { latitude: 25.3573, longitude: 55.4033 }, // Sharjah
      { latitude: 25.7895, longitude: 55.9432 }, // Ras Al Khaimah
      { latitude: 27.1832, longitude: 56.2667 }  // Bandar Abbas
    ],
    cities: [
      {
        id: "city-abu-dhabi",
        name: "Abu Dhabi Energy & Industrial Zone",
        countryCode: "ARE",
        countryFlag: "🇦🇪",
        latitude: 24.4539,
        longitude: 54.3773,
        populationEstimate: 1500000,
        economicWeight: 10,
        industrialFocus: "Hydrocarbon Refining, Polymers, Clean Energy & Sovereign Logistics",
        corridorKmMarker: 0
      },
      {
        id: "city-dubai-jebel-ali",
        name: "Dubai Jebel Ali Industrial Port",
        countryCode: "ARE",
        countryFlag: "🇦🇪",
        latitude: 25.0118,
        longitude: 55.0617,
        populationEstimate: 3600000,
        economicWeight: 10,
        industrialFocus: "Middle East's Largest Container Terminal, Aluminum Smelter & Re-export Hub",
        corridorKmMarker: 110
      },
      {
        id: "city-ras-al-khaimah",
        name: "Ras Al Khaimah Heavy Industries",
        countryCode: "ARE",
        countryFlag: "🇦🇪",
        latitude: 25.7895,
        longitude: 55.9432,
        populationEstimate: 400000,
        economicWeight: 7,
        industrialFocus: "Cement Kilns, Ceramic Manufacturing & Maritime Aggregate Quarrying",
        corridorKmMarker: 215
      },
      {
        id: "city-bandar-abbas",
        name: "Bandar Abbas Gateway Port",
        countryCode: "IRN",
        countryFlag: "🇮🇷",
        latitude: 27.1832,
        longitude: 56.2667,
        populationEstimate: 530000,
        economicWeight: 8,
        industrialFocus: "Shahid Rajaee Container Port, Petroleum Refinery & Steel Smelting",
        corridorKmMarker: 480
      }
    ]
  },

  // ── Corridor 4: South Africa Highveld - Maputo Freight Corridor (ZAF - MOZ) ──
  {
    id: "corridor-highveld-maputo",
    name: "Highveld-Maputo Industrial & Minerals Corridor",
    countries: ["ZAF", "MOZ"],
    description: "Key Southern African mineral export artery connecting Gauteng mining basins across the Mpumalanga coalfields to Maputo deep-water port.",
    importance: "HIGH",
    primaryIndustries: ["Coal Thermal Generation", "Ferrochrome Smelting", "Stainless Steel", "Mineral Ore Rail Freight"],
    totalLengthKm: 580,
    waypoints: [
      { latitude: -26.2041, longitude: 28.0473 }, // Johannesburg
      { latitude: -25.7479, longitude: 28.2293 }, // Pretoria Industrial
      { latitude: -25.8728, longitude: 29.2274 }, // Witbank / eMalahleni
      { latitude: -25.7725, longitude: 29.4623 }, // Middelburg Steel
      { latitude: -25.4753, longitude: 30.9694 }, // Nelspruit / Mbombela
      { latitude: -25.4384, longitude: 31.9537 }, // Komatipoort Border
      { latitude: -25.9692, longitude: 32.5732 }  // Maputo Port
    ],
    cities: [
      {
        id: "city-johannesburg",
        name: "Johannesburg Financial & Industrial Hub",
        countryCode: "ZAF",
        countryFlag: "🇿🇦",
        latitude: -26.2041,
        longitude: 28.0473,
        populationEstimate: 5800000,
        economicWeight: 10,
        industrialFocus: "Financial Headquarters, Mining Equipment Fabrication & Commerce",
        corridorKmMarker: 0
      },
      {
        id: "city-witbank",
        name: "Witbank / eMalahleni Energy Hub",
        countryCode: "ZAF",
        countryFlag: "🇿🇦",
        latitude: -25.8728,
        longitude: 29.2274,
        populationEstimate: 450000,
        economicWeight: 9,
        industrialFocus: "12 Major Coal-Fired Power Stations, Vanadium & Ferroalloy Smelters",
        corridorKmMarker: 140
      },
      {
        id: "city-middelburg",
        name: "Middelburg Stainless Steel Hub",
        countryCode: "ZAF",
        countryFlag: "🇿🇦",
        latitude: -25.7725,
        longitude: 29.4623,
        populationEstimate: 280000,
        economicWeight: 8,
        industrialFocus: "Columbus Stainless Steel Mills & Heavy Chrome Beneficiation",
        corridorKmMarker: 175
      },
      {
        id: "city-maputo",
        name: "Maputo Deepwater Mineral Port",
        countryCode: "MOZ",
        countryFlag: "🇲🇿",
        latitude: -25.9692,
        longitude: 32.5732,
        populationEstimate: 1100000,
        economicWeight: 8,
        industrialFocus: "Mozal Aluminum Smelter, Magnetite & Coal Export Terminal",
        corridorKmMarker: 580
      }
    ]
  },

  // ── Corridor 5: Paraná-Mercosul Agro-Industrial Axis (BRA - PRY - ARG) ──
  {
    id: "corridor-parana-mercosur",
    name: "Paraná-Mercosul Agro-Industrial Axis",
    countries: ["BRA", "PRY", "ARG"],
    description: "South America's premier agricultural, fertilizer, and hydroelectric transport highway connecting southern Brazil with Mercosul partners.",
    importance: "HIGH",
    primaryIndustries: ["Soybean & Grain Processing", "Fertilizer Manufacturing", "Hydroelectric Energy", "Automotive Assembly"],
    totalLengthKm: 720,
    waypoints: [
      { latitude: -25.4284, longitude: -49.2733 }, // Curitiba
      { latitude: -25.0950, longitude: -50.1619 }, // Ponta Grossa
      { latitude: -24.9578, longitude: -53.4595 }, // Cascavel Agro-Hub
      { latitude: -25.5163, longitude: -54.5854 }, // Foz do Iguaçu (Itaipu)
      { latitude: -25.5097, longitude: -54.6111 }, // Ciudad del Este
      { latitude: -27.3621, longitude: -55.8961 }  // Posadas
    ],
    cities: [
      {
        id: "city-curitiba",
        name: "Curitiba Industrial & Automotive Hub",
        countryCode: "BRA",
        countryFlag: "🇧🇷",
        latitude: -25.4284,
        longitude: -49.2733,
        populationEstimate: 1960000,
        economicWeight: 9,
        industrialFocus: "Automotive Assembly, Bio-pharmaceuticals & Logistics",
        corridorKmMarker: 0
      },
      {
        id: "city-cascavel",
        name: "Cascavel Grain & Agro-Industrial Center",
        countryCode: "BRA",
        countryFlag: "🇧🇷",
        latitude: -24.9578,
        longitude: -53.4595,
        populationEstimate: 350000,
        economicWeight: 8,
        industrialFocus: "Soybean Oil Refineries, Meat Processing & Heavy Agro-Transport",
        corridorKmMarker: 490
      },
      {
        id: "city-foz-do-iguacu",
        name: "Foz do Iguaçu Energy & Border Junction",
        countryCode: "BRA",
        countryFlag: "🇧🇷",
        latitude: -25.5163,
        longitude: -54.5854,
        populationEstimate: 260000,
        economicWeight: 8,
        industrialFocus: "Itaipu Binational Hydroelectric Generation & Tri-Border Freight",
        corridorKmMarker: 630
      },
      {
        id: "city-ciudad-del-este",
        name: "Ciudad del Este Commercial Trade Center",
        countryCode: "PRY",
        countryFlag: "🇵🇾",
        latitude: -25.5097,
        longitude: -54.6111,
        populationEstimate: 300000,
        economicWeight: 7,
        industrialFocus: "Free Trade Zone, Electronics Warehousing & Re-export Hub",
        corridorKmMarker: 645
      }
    ]
  }
];

/** Retrieve all configured economic corridors */
export function getAllEconomicCorridors(): EconomicCorridor[] {
  return [...BRICS_ECONOMIC_CORRIDORS];
}

/** Find a specific economic corridor by ID */
export function getEconomicCorridorById(id: string): EconomicCorridor | undefined {
  return BRICS_ECONOMIC_CORRIDORS.find((c) => c.id === id || c.id.toLowerCase() === id.toLowerCase());
}

/** Find all economic corridors touching a specific country code */
export function getEconomicCorridorsForCountry(countryCode: string): EconomicCorridor[] {
  const code = countryCode.toUpperCase();
  return BRICS_ECONOMIC_CORRIDORS.filter((c) => c.countries.includes(code));
}
