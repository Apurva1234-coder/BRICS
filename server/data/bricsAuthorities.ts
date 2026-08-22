import type { RegulatoryAuthority, RegulatoryResource } from "../types.js";

/**
 * Registry of Simulated Environmental Regulatory Authorities across all BRICS Member States
 * Configured with jurisdictions, responsible pollution areas, and communication channels.
 */
export const BRICS_REGULATORY_AUTHORITIES: RegulatoryAuthority[] = [
  // ── India (IND) ──────────────────────────────────────────────────────────
  {
    id: "auth-ind-cpcb",
    name: "Central Pollution Control Board (CPCB)",
    countryCode: "IND",
    countryFlag: "🇮🇳",
    region: "National / All Airsheds",
    jurisdiction: "All-India Federal Jurisdiction",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["industrial_smoke", "stubble_burning", "vehicle_emissions", "dust", "open_waste"],
    contactEndpoint: { channel: "internal_dashboard", target: "cpcb-central-ops@sentinel.internal" },
    activeStatus: true
  },
  {
    id: "auth-ind-caqm",
    name: "Commission for Air Quality Management (CAQM NCR & Adjoining)",
    countryCode: "IND",
    countryFlag: "🇮🇳",
    region: "National Capital Region (NCR), Punjab, Haryana, Rajasthan",
    jurisdiction: "Northern Subcontinental Trade Corridor",
    authorityType: "TRANSBOUNDARY_COMMISSION",
    responsiblePollutionTypes: ["stubble_burning", "industrial_smoke", "vehicle_emissions"],
    contactEndpoint: { channel: "internal_dashboard", target: "caqm-response-hub@sentinel.internal" },
    activeStatus: true
  },
  {
    id: "auth-ind-ppcb",
    name: "Punjab Pollution Control Board (PPCB)",
    countryCode: "IND",
    countryFlag: "🇮🇳",
    region: "Punjab Frontier / Wagah-Lahore Border Corridor",
    jurisdiction: "State of Punjab & Border Industrial Axis",
    authorityType: "STATE_POLLUTION_CONTROL",
    responsiblePollutionTypes: ["stubble_burning", "industrial_smoke"],
    contactEndpoint: { channel: "internal_dashboard", target: "ppcb-enforcement@sentinel.internal" },
    activeStatus: true
  },

  // ── China (CHN) ──────────────────────────────────────────────────────────
  {
    id: "auth-chn-mee",
    name: "Ministry of Ecology and Environment (MEE)",
    countryCode: "CHN",
    countryFlag: "🇨🇳",
    region: "National / Beijing Central",
    jurisdiction: "State Council Environmental Authority",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["industrial_smoke", "dust", "vehicle_emissions", "open_waste"],
    contactEndpoint: { channel: "internal_dashboard", target: "mee-national-control@sentinel.internal" },
    activeStatus: true
  },
  {
    id: "auth-chn-tibet-epb",
    name: "Tibet Autonomous Region Ecology & Environment Department",
    countryCode: "CHN",
    countryFlag: "🇨🇳",
    region: "Tibet / Himalayan Border Region",
    jurisdiction: "Tibetan Plateau Transboundary Airshed",
    authorityType: "PROVINCIAL_EPB",
    responsiblePollutionTypes: ["dust", "industrial_smoke", "transboundary_aerosols"],
    contactEndpoint: { channel: "internal_dashboard", target: "tibet-epb-monitoring@sentinel.internal" },
    activeStatus: true
  },
  {
    id: "auth-chn-hlj-epb",
    name: "Heilongjiang Provincial Ecology & Environment Bureau",
    countryCode: "CHN",
    countryFlag: "🇨🇳",
    region: "Heilongjiang / Northeast Industrial Basin",
    jurisdiction: "Amur-Songhua River Industrial Axis",
    authorityType: "PROVINCIAL_EPB",
    responsiblePollutionTypes: ["industrial_smoke", "coal_combustion", "chemical_emissions"],
    contactEndpoint: { channel: "internal_dashboard", target: "hlj-epb-ops@sentinel.internal" },
    activeStatus: true
  },

  // ── Russia (RUS) ─────────────────────────────────────────────────────────
  {
    id: "auth-rus-rosprirodnadzor",
    name: "Federal Service for Supervision of Natural Resources (Rosprirodnadzor)",
    countryCode: "RUS",
    countryFlag: "🇷🇺",
    region: "National / Moscow Central",
    jurisdiction: "Russian Federation Environmental Supervision",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["industrial_smoke", "mining_tailings", "chemical_emissions"],
    contactEndpoint: { channel: "internal_dashboard", target: "rosprirodnadzor-hq@sentinel.internal" },
    activeStatus: true
  },
  {
    id: "auth-rus-far-east",
    name: "Far Eastern Federal District Environmental Directorate",
    countryCode: "RUS",
    countryFlag: "🇷🇺",
    region: "Siberian / Amur-China Border Region (Khabarovsk / Jewish AO)",
    jurisdiction: "Amur River Transboundary Frontier",
    authorityType: "PROVINCIAL_EPB",
    responsiblePollutionTypes: ["industrial_smoke", "forest_wildfires", "transboundary_aerosols"],
    contactEndpoint: { channel: "internal_dashboard", target: "fe-russia-env@sentinel.internal" },
    activeStatus: true
  },

  // ── Brazil (BRA) ─────────────────────────────────────────────────────────
  {
    id: "auth-bra-ibama",
    name: "Brazilian Institute of Environment and Renewable Natural Resources (IBAMA)",
    countryCode: "BRA",
    countryFlag: "🇧🇷",
    region: "National / Federal Oversight",
    jurisdiction: "Federal Environmental Enforcement",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["forest_wildfires", "industrial_smoke", "open_waste"],
    contactEndpoint: { channel: "internal_dashboard", target: "ibama-emergencias@sentinel.internal" },
    activeStatus: true
  },
  {
    id: "auth-bra-iat-parana",
    name: "Water and Land Institute of Paraná (IAT Paraná)",
    countryCode: "BRA",
    countryFlag: "🇧🇷",
    region: "Paraná & Tri-Border Basin (Foz do Iguaçu / Cascavel)",
    jurisdiction: "Paraná-Mercosul Agro-Industrial Axis",
    authorityType: "STATE_POLLUTION_CONTROL",
    responsiblePollutionTypes: ["open_waste", "industrial_smoke", "agro_emissions"],
    contactEndpoint: { channel: "internal_dashboard", target: "iat-pr-fiscalizacao@sentinel.internal" },
    activeStatus: true
  },

  // ── South Africa (ZAF) ───────────────────────────────────────────────────
  {
    id: "auth-zaf-dffe",
    name: "Department of Forestry, Fisheries and the Environment (DFFE)",
    countryCode: "ZAF",
    countryFlag: "🇿🇦",
    region: "National / Highveld Priority Area",
    jurisdiction: "National Air Quality Directorate",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["industrial_smoke", "coal_combustion", "mining_tailings"],
    contactEndpoint: { channel: "internal_dashboard", target: "dffe-airquality@sentinel.internal" },
    activeStatus: true
  },
  {
    id: "auth-zaf-mpumalanga-green-scorpions",
    name: "Mpumalanga Environmental Management Inspectorate (Green Scorpions)",
    countryCode: "ZAF",
    countryFlag: "🇿🇦",
    region: "Highveld Coal Belt (Witbank / Middelburg)",
    jurisdiction: "Highveld-Maputo Industrial Corridor",
    authorityType: "STATE_POLLUTION_CONTROL",
    responsiblePollutionTypes: ["industrial_smoke", "coal_combustion"],
    contactEndpoint: { channel: "internal_dashboard", target: "greenscorpions-mp@sentinel.internal" },
    activeStatus: true
  },

  // ── United Arab Emirates (ARE) ───────────────────────────────────────────
  {
    id: "auth-are-moccae",
    name: "Ministry of Climate Change and Environment (MoCCAE)",
    countryCode: "ARE",
    countryFlag: "🇦🇪",
    region: "National / Persian Gulf Airshed",
    jurisdiction: "UAE Federal Air Quality Oversight",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["industrial_smoke", "petrochemical_emissions", "dust"],
    contactEndpoint: { channel: "internal_dashboard", target: "moccae-compliance@sentinel.internal" },
    activeStatus: true
  },

  // ── Saudi Arabia (SAU) ───────────────────────────────────────────────────
  {
    id: "auth-sau-ncec",
    name: "National Center for Environmental Compliance (NCEC)",
    countryCode: "SAU",
    countryFlag: "🇸🇦",
    region: "National / Eastern Province Petrochemical Basin",
    jurisdiction: "Kingdom Environmental Inspectorate",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["petrochemical_emissions", "dust", "industrial_smoke"],
    contactEndpoint: { channel: "internal_dashboard", target: "ncec-dispatch@sentinel.internal" },
    activeStatus: true
  },

  // ── Iran (IRN) ───────────────────────────────────────────────────────────
  {
    id: "auth-irn-doe",
    name: "Department of Environment (DOE Iran)",
    countryCode: "IRN",
    countryFlag: "🇮🇷",
    region: "National / Coastal Hormozgan & Khuzestan",
    jurisdiction: "Persian Gulf & Alborz Environmental Protection",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["industrial_smoke", "petrochemical_emissions", "dust"],
    contactEndpoint: { channel: "internal_dashboard", target: "doe-iran-control@sentinel.internal" },
    activeStatus: true
  },

  // ── Egypt (EGY) ──────────────────────────────────────────────────────────
  {
    id: "auth-egy-eeaa",
    name: "Egyptian Environmental Affairs Agency (EEAA)",
    countryCode: "EGY",
    countryFlag: "🇪🇬",
    region: "National / Greater Cairo & Nile Delta",
    jurisdiction: "Ministry of Environment Operational Arm",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["industrial_smoke", "open_waste", "dust"],
    contactEndpoint: { channel: "internal_dashboard", target: "eeaa-ops@sentinel.internal" },
    activeStatus: true
  },

  // ── Ethiopia (ETH) ───────────────────────────────────────────────────────
  {
    id: "auth-eth-epa",
    name: "Ethiopian Environmental Protection Authority (EPA)",
    countryCode: "ETH",
    countryFlag: "🇪🇹",
    region: "National / Rift Valley Basin",
    jurisdiction: "Federal Environmental Regulatory Body",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["open_waste", "industrial_smoke", "dust"],
    contactEndpoint: { channel: "internal_dashboard", target: "eth-epa-monitoring@sentinel.internal" },
    activeStatus: true
  },

  // ── Indonesia (IDN) ──────────────────────────────────────────────────────
  {
    id: "auth-idn-klhk",
    name: "Ministry of Environment and Forestry (KLHK)",
    countryCode: "IDN",
    countryFlag: "🇮🇩",
    region: "National / Sumatra & Kalimantan Forest Peatlands",
    jurisdiction: "Gakkum Environmental Law Enforcement",
    authorityType: "NATIONAL_MINISTRY",
    responsiblePollutionTypes: ["forest_wildfires", "industrial_smoke", "open_waste"],
    contactEndpoint: { channel: "internal_dashboard", target: "klhk-gakkum@sentinel.internal" },
    activeStatus: true
  }
];

/**
 * Registry of Simulated Deployable Environmental Resources
 */
export const BRICS_REGULATORY_RESOURCES: RegulatoryResource[] = [
  // India Units
  {
    id: "res-ind-mobile-01",
    name: "Mobile Air Quality Lab - Northern NCR Unit 1",
    authorityId: "auth-ind-caqm",
    countryCode: "IND",
    countryFlag: "🇮🇳",
    resourceType: "MOBILE_MONITORING_UNIT",
    status: "AVAILABLE",
    stationLocation: { latitude: 28.6139, longitude: 77.2090, name: "Delhi Anand Vihar Depot" },
    contactCallsign: "SENTINEL-NORTH-ALPHA"
  },
  {
    id: "res-ind-inspection-02",
    name: "Panipat Petrochem & Industrial Inspection Team",
    authorityId: "auth-ind-cpcb",
    countryCode: "IND",
    countryFlag: "🇮🇳",
    resourceType: "INSPECTION_TEAM",
    status: "AVAILABLE",
    stationLocation: { latitude: 29.3909, longitude: 76.9635, name: "Panipat Industrial Estate" },
    contactCallsign: "INSPECT-PANIPAT-BRAVO"
  },
  {
    id: "res-ind-rapid-03",
    name: "Punjab Border Rapid Scavenging & Suppression Unit",
    authorityId: "auth-ind-ppcb",
    countryCode: "IND",
    countryFlag: "🇮🇳",
    resourceType: "RAPID_RESPONSE_CREW",
    status: "AVAILABLE",
    stationLocation: { latitude: 31.6340, longitude: 74.8723, name: "Amritsar Base" },
    contactCallsign: "RAPID-AMRITSAR-1"
  },

  // China Units
  {
    id: "res-chn-tibet-mobile",
    name: "Himalayan Transboundary Mobile Monitoring Van",
    authorityId: "auth-chn-tibet-epb",
    countryCode: "CHN",
    countryFlag: "🇨🇳",
    resourceType: "MOBILE_MONITORING_UNIT",
    status: "AVAILABLE",
    stationLocation: { latitude: 29.6525, longitude: 91.1721, name: "Lhasa Plateau Station" },
    contactCallsign: "PLATEAU-SENTINEL-1"
  },
  {
    id: "res-chn-hlj-enforce",
    name: "Heilongjiang Cross-Border Emission Taskforce",
    authorityId: "auth-chn-hlj-epb",
    countryCode: "CHN",
    countryFlag: "🇨🇳",
    resourceType: "EMISSION_ENFORCEMENT_UNIT",
    status: "AVAILABLE",
    stationLocation: { latitude: 45.8038, longitude: 126.5349, name: "Harbin Command Post" },
    contactCallsign: "DRAGON-ENFORCE-9"
  },

  // Russia Units
  {
    id: "res-rus-amur-patrol",
    name: "Amur River Ecological Border Patrol",
    authorityId: "auth-rus-far-east",
    countryCode: "RUS",
    countryFlag: "🇷🇺",
    resourceType: "INSPECTION_TEAM",
    status: "AVAILABLE",
    stationLocation: { latitude: 48.4827, longitude: 135.0838, name: "Khabarovsk Environmental Outpost" },
    contactCallsign: "AMUR-GUARDIAN-3"
  },

  // Brazil Units
  {
    id: "res-bra-parana-fiscal",
    name: "Paraná Tri-Border Environmental Taskforce",
    authorityId: "auth-bra-iat-parana",
    countryCode: "BRA",
    countryFlag: "🇧🇷",
    resourceType: "FIELD_OFFICER",
    status: "AVAILABLE",
    stationLocation: { latitude: -25.5163, longitude: -54.5854, name: "Foz do Iguaçu Tri-Border Base" },
    contactCallsign: "GUARANI-VERDE-2"
  },

  // South Africa Units
  {
    id: "res-zaf-highveld-scorpions",
    name: "Highveld Priority Rapid Response Van",
    authorityId: "auth-zaf-mpumalanga-green-scorpions",
    countryCode: "ZAF",
    countryFlag: "🇿🇦",
    resourceType: "RAPID_RESPONSE_CREW",
    status: "AVAILABLE",
    stationLocation: { latitude: -25.8728, longitude: 29.2274, name: "Witbank Air Quality Depot" },
    contactCallsign: "SCORPION-DELTA-4"
  },

  // UAE Units
  {
    id: "res-are-gulf-mobile",
    name: "Dubai-Sharjah Coastal Marine & Air Monitoring Unit",
    authorityId: "auth-are-moccae",
    countryCode: "ARE",
    countryFlag: "🇦🇪",
    resourceType: "MOBILE_MONITORING_UNIT",
    status: "AVAILABLE",
    stationLocation: { latitude: 25.2048, longitude: 55.2708, name: "Dubai Port Base" },
    contactCallsign: "FALCON-AIR-1"
  }
];

/** Retrieve all configured regulatory authorities */
export function getAllRegulatoryAuthorities(): RegulatoryAuthority[] {
  return [...BRICS_REGULATORY_AUTHORITIES];
}

/** Find authority by ID */
export function getRegulatoryAuthorityById(id: string): RegulatoryAuthority | undefined {
  return BRICS_REGULATORY_AUTHORITIES.find((a) => a.id === id || a.id.toLowerCase() === id.toLowerCase());
}

/** Retrieve authorities for a country */
export function getRegulatoryAuthoritiesByCountry(countryCode: string): RegulatoryAuthority[] {
  const code = countryCode.toUpperCase();
  return BRICS_REGULATORY_AUTHORITIES.filter((a) => a.countryCode === code);
}

/** Retrieve all resources */
export function getAllRegulatoryResources(): RegulatoryResource[] {
  return [...BRICS_REGULATORY_RESOURCES];
}
