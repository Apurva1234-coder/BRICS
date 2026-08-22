import { INITIAL_BRICS_NODES } from "../data/bricsFederationNodes.js";
import { BRICS_COUNTRIES_CONFIG } from "../data/bricsCountries.js";
import type {
  BricsCountryCode,
  BricsCountryNode,
  BricsFederationEvent,
  BricsFederationStatusResponse,
  BricsPollutionType,
  BricsFederationSeverity,
  PollutionReport
} from "../types.js";

// In-memory state for prototype federation layer
const nodesMap = new Map<string, BricsCountryNode>();
for (const node of INITIAL_BRICS_NODES) {
  nodesMap.set(node.nodeId, { ...node });
}

// Pre-seeded cross-country standardized events
const INITIAL_FEDERATION_EVENTS: BricsFederationEvent[] = [
  {
    eventId: "brics-evt-ind-delhi-001",
    sourceNodeId: "node-ind-delhi",
    sourceCountry: "IND",
    sourceCountryName: "India",
    sourceFlag: "🇮🇳",
    latitude: 28.6139,
    longitude: 77.2090,
    locality: "National Capital Region / Punjab Boundary, India",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    pollutionType: "crop_burning",
    pollutantValues: {
      pm2_5: 385,
      pm10: 490,
      no2: 82,
      co: 3.4,
      aqi: 425
    },
    severity: "critical",
    confidence: 0.94,
    sourceType: "satellite_sentinel5p",
    windDirectionDeg: 310,
    windSpeedKmh: 18,
    predictedAffectedRegion: "North-West Indo-Gangetic Plains & Transboundary Airshed",
    predictionConfidence: 0.88,
    targetCountries: ["ALL", "CHN"],
    title: "Severe Agricultural Burning Plume across Northern Airshed",
    description: "Multi-cluster stubble emission detected via Sentinel-5P high-density aerosol optical depth. Dense smoke plume moving eastward.",
    verificationStatus: "verified",
    sharedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    metadata: {
      sentinelProduct: "AER_AI_340_380",
      cpcbStationCount: 14,
      crossBorderPotential: "high"
    }
  },
  {
    eventId: "brics-evt-chn-beijing-002",
    sourceNodeId: "node-chn-beijing",
    sourceCountry: "CHN",
    sourceCountryName: "China",
    sourceFlag: "🇨🇳",
    latitude: 39.9042,
    longitude: 116.4074,
    locality: "Jing-Jin-Ji Industrial Corridor, Hebei / Beijing",
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    pollutionType: "industrial_smoke",
    pollutantValues: {
      pm2_5: 240,
      pm10: 310,
      so2: 65,
      no2: 98,
      aqi: 290
    },
    severity: "high",
    confidence: 0.91,
    sourceType: "ground_station",
    windDirectionDeg: 120,
    windSpeedKmh: 14,
    predictedAffectedRegion: "Bohai Bay & Yellow Sea Boundary",
    predictionConfidence: 0.84,
    targetCountries: ["ALL", "RUS"],
    title: "Heavy Metallurgy Smelting Emission Plume",
    description: "Coordinated industrial cluster elevated emissions under atmospheric inversion layer.",
    verificationStatus: "verified",
    sharedAt: new Date(Date.now() - 85 * 60 * 1000).toISOString()
  },
  {
    eventId: "brics-evt-bra-sp-003",
    sourceNodeId: "node-bra-brasilia",
    sourceCountry: "BRA",
    sourceCountryName: "Brazil",
    sourceFlag: "🇧🇷",
    latitude: -23.5505,
    longitude: -46.6333,
    locality: "Greater São Paulo Metropolitan Corridor",
    timestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    pollutionType: "vehicular_exhaust",
    pollutantValues: {
      pm2_5: 110,
      no2: 125,
      co: 4.8,
      o3: 92,
      aqi: 178
    },
    severity: "moderate",
    confidence: 0.89,
    sourceType: "ground_station",
    windDirectionDeg: 210,
    windSpeedKmh: 9,
    predictedAffectedRegion: "Tietê Valley Basin",
    predictionConfidence: 0.81,
    targetCountries: ["ALL"],
    title: "Metropolitan Traffic & Industrial Inversion",
    description: "High ozone precursor and NO2 accumulation across coastal mountain basin.",
    verificationStatus: "verified",
    sharedAt: new Date(Date.now() - 130 * 60 * 1000).toISOString()
  },
  {
    eventId: "brics-evt-rus-ural-004",
    sourceNodeId: "node-rus-moscow",
    sourceCountry: "RUS",
    sourceCountryName: "Russia",
    sourceFlag: "🇷🇺",
    latitude: 56.8389,
    longitude: 60.6057,
    locality: "Ural Industrial Area, Yekaterinburg",
    timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
    pollutionType: "chemical_leak",
    pollutantValues: {
      so2: 140,
      no2: 88,
      pm10: 195,
      aqi: 220
    },
    severity: "high",
    confidence: 0.87,
    sourceType: "sensor_mesh",
    windDirectionDeg: 270,
    windSpeedKmh: 22,
    predictedAffectedRegion: "Central Eurasian Atmospheric Corridor",
    predictionConfidence: 0.79,
    targetCountries: ["ALL", "CHN"],
    title: "Sulfur Dioxide Spike from Chemical Processing Complex",
    description: "Industrial chemical cluster elevated SO2 readings verified via ground sensor mesh.",
    verificationStatus: "verified",
    sharedAt: new Date(Date.now() - 200 * 60 * 1000).toISOString()
  },
  {
    eventId: "brics-evt-zaf-highveld-005",
    sourceNodeId: "node-zaf-pretoria",
    sourceCountry: "ZAF",
    sourceCountryName: "South Africa",
    sourceFlag: "🇿🇦",
    latitude: -26.2041,
    longitude: 28.0473,
    locality: "Highveld Priority Area / Mpumalanga Coal Basin",
    timestamp: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
    pollutionType: "industrial_smoke",
    pollutantValues: {
      pm2_5: 180,
      pm10: 275,
      so2: 115,
      no2: 74,
      aqi: 245
    },
    severity: "high",
    confidence: 0.92,
    sourceType: "satellite_sentinel5p",
    windDirectionDeg: 45,
    windSpeedKmh: 16,
    predictedAffectedRegion: "Gauteng Plateau & Southern African Inversion Layer",
    predictionConfidence: 0.85,
    targetCountries: ["ALL"],
    title: "Coal-Fired Power Complex Heavy Emission Cloud",
    description: "Significant thermal and particulate plume across Highveld airshed.",
    verificationStatus: "verified",
    sharedAt: new Date(Date.now() - 310 * 60 * 1000).toISOString()
  }
];

const eventsStore: BricsFederationEvent[] = [...INITIAL_FEDERATION_EVENTS];

/** Lookup Country Info from BRICS Config */
function lookupCountry(countryCode: string) {
  const code = countryCode.toUpperCase();
  return BRICS_COUNTRIES_CONFIG.find(
    (c) => c.iso3 === code || c.iso2 === code || c.name.toUpperCase() === code
  );
}

/** Get all registered BRICS country nodes */
export function getFederationNodes(): BricsCountryNode[] {
  return Array.from(nodesMap.values()).map((node) => ({
    ...node,
    lastHeartbeatAt: new Date().toISOString() // Simulates live synchronized cluster
  }));
}

/** Get a specific country node by ID or country code */
export function getNodeById(nodeIdOrCode: string): BricsCountryNode | undefined {
  const direct = nodesMap.get(nodeIdOrCode);
  if (direct) return direct;
  return Array.from(nodesMap.values()).find(
    (n) => n.countryCode.toUpperCase() === nodeIdOrCode.toUpperCase()
  );
}

/** Register or update heartbeat for a country node */
export function registerOrHeartbeatNode(payload: {
  nodeId?: string;
  countryCode: BricsCountryCode;
  countryName?: string;
  endpointUrl?: string;
  geographicRegion?: string;
  supportedDataSources?: BricsCountryNode["supportedDataSources"];
  contactEmail?: string;
}): BricsCountryNode {
  const country = lookupCountry(payload.countryCode);
  const nodeId = payload.nodeId || `node-${payload.countryCode.toLowerCase()}-${Date.now().toString(36)}`;
  
  const existing = nodesMap.get(nodeId) || getNodeById(payload.countryCode);
  const updated: BricsCountryNode = {
    nodeId: existing ? existing.nodeId : nodeId,
    countryCode: payload.countryCode,
    countryName: payload.countryName || country?.name || payload.countryCode,
    flag: country?.flag || "🌐",
    geographicRegion: payload.geographicRegion || existing?.geographicRegion || "Global",
    supportedDataSources: payload.supportedDataSources || existing?.supportedDataSources || ["openaq", "open_meteo"],
    nodeStatus: "active",
    endpointUrl: payload.endpointUrl || existing?.endpointUrl || `https://${payload.countryCode.toLowerCase()}-node.brics-sentinel.org/api/v1`,
    registeredAt: existing?.registeredAt || new Date().toISOString(),
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: existing?.sharedEventsCount || 0,
    receivedEventsCount: existing?.receivedEventsCount || 0,
    contactEmail: payload.contactEmail || existing?.contactEmail,
    capabilities: existing?.capabilities || {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  };

  nodesMap.set(updated.nodeId, updated);
  return updated;
}

/** Publish a standardized environmental pollution event to the federation */
export function publishFederationEvent(eventInput: Partial<BricsFederationEvent> & {
  sourceCountry: BricsCountryCode;
  latitude: number;
  longitude: number;
  pollutionType: BricsPollutionType;
  pollutantValues: BricsFederationEvent["pollutantValues"];
  severity: BricsFederationSeverity;
}): BricsFederationEvent {
  // Schema validations
  if (!eventInput.sourceCountry) {
    throw new Error("Missing required sourceCountry code.");
  }
  if (!Number.isFinite(eventInput.latitude) || eventInput.latitude < -90 || eventInput.latitude > 90) {
    throw new Error("Invalid latitude coordinate: must be a number between -90 and 90.");
  }
  if (!Number.isFinite(eventInput.longitude) || eventInput.longitude < -180 || eventInput.longitude > 180) {
    throw new Error("Invalid longitude coordinate: must be a number between -180 and 180.");
  }
  if (!eventInput.pollutionType) {
    throw new Error("Missing required pollutionType field.");
  }
  if (!eventInput.pollutantValues || typeof eventInput.pollutantValues !== "object") {
    throw new Error("Missing required pollutantValues object.");
  }
  if (!eventInput.severity) {
    throw new Error("Missing required severity classification.");
  }

  const country = lookupCountry(eventInput.sourceCountry);
  const sourceNode = getNodeById(eventInput.sourceCountry);
  const eventId =
    eventInput.eventId ||
    `brics-evt-${eventInput.sourceCountry.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const newEvent: BricsFederationEvent = {
    eventId,
    sourceNodeId: eventInput.sourceNodeId || sourceNode?.nodeId || `node-${eventInput.sourceCountry.toLowerCase()}`,
    sourceCountry: eventInput.sourceCountry,
    sourceCountryName: eventInput.sourceCountryName || country?.name || eventInput.sourceCountry,
    sourceFlag: eventInput.sourceFlag || country?.flag || "🌐",
    latitude: eventInput.latitude,
    longitude: eventInput.longitude,
    locality: eventInput.locality || `${country?.name || eventInput.sourceCountry} Region`,
    timestamp: eventInput.timestamp || new Date().toISOString(),
    pollutionType: eventInput.pollutionType,
    pollutantValues: eventInput.pollutantValues,
    severity: eventInput.severity,
    confidence: typeof eventInput.confidence === "number" ? Math.max(0, Math.min(1, eventInput.confidence)) : 0.85,
    sourceType: eventInput.sourceType || "ground_station",
    windDirectionDeg: eventInput.windDirectionDeg,
    windSpeedKmh: eventInput.windSpeedKmh,
    predictedAffectedRegion: eventInput.predictedAffectedRegion,
    predictionConfidence: eventInput.predictionConfidence,
    targetCountries: eventInput.targetCountries && eventInput.targetCountries.length > 0 ? eventInput.targetCountries : ["ALL"],
    title: eventInput.title || `${eventInput.severity.toUpperCase()} ${eventInput.pollutionType.replace(/_/g, " ")} Incident`,
    description: eventInput.description || `Federated environmental alert from ${country?.name || eventInput.sourceCountry} node.`,
    verificationStatus: eventInput.verificationStatus || "verified",
    sharedAt: new Date().toISOString(),
    metadata: eventInput.metadata || {}
  };

  eventsStore.unshift(newEvent);

  // Update source node shared counter
  if (sourceNode) {
    sourceNode.sharedEventsCount += 1;
    nodesMap.set(sourceNode.nodeId, sourceNode);
  }

  return newEvent;
}

/** Retrieve shared federation events with optional filtering */
export function getFederationEvents(options?: {
  country?: string;
  targetCountry?: string;
  severity?: string;
  pollutionType?: string;
  limit?: number;
  since?: string;
}): BricsFederationEvent[] {
  let result = [...eventsStore];

  if (options?.country) {
    const code = options.country.toUpperCase();
    result = result.filter((e) => e.sourceCountry === code || e.sourceCountryName.toUpperCase() === code);
  }

  if (options?.targetCountry) {
    const target = options.targetCountry.toUpperCase() as BricsCountryCode;
    result = result.filter((e) => !e.targetCountries || e.targetCountries.includes("ALL") || e.targetCountries.includes(target));
  }

  if (options?.severity) {
    const sev = options.severity.toLowerCase();
    result = result.filter((e) => e.severity.toLowerCase() === sev);
  }

  if (options?.pollutionType) {
    const type = options.pollutionType.toLowerCase();
    result = result.filter((e) => e.pollutionType.toLowerCase() === type);
  }

  if (options?.since) {
    const sinceTime = new Date(options.since).getTime();
    if (!Number.isNaN(sinceTime)) {
      result = result.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
    }
  }

  const limit = options?.limit && options.limit > 0 ? Math.min(100, options.limit) : 50;
  return result.slice(0, limit);
}

/** Retrieve events relevant to a specific country node (e.g. China retrieving events that affect it or broadcast to all) */
export function getEventsRelevantToCountry(countryCode: string): {
  countryCode: string;
  countryName: string;
  flag: string;
  relevantEvents: BricsFederationEvent[];
  count: number;
} {
  const code = countryCode.toUpperCase() as BricsCountryCode;
  const country = lookupCountry(code);

  const relevantEvents = eventsStore.filter((e) => {
    // 1. Target countries explicitly list this country or ALL
    if (e.targetCountries && (e.targetCountries.includes("ALL") || e.targetCountries.includes(code))) {
      return true;
    }
    // 2. Event originated from this country
    if (e.sourceCountry === code) {
      return true;
    }
    return false;
  });

  // Increment received events counter for this country node
  const node = getNodeById(code);
  if (node) {
    node.receivedEventsCount = Math.max(node.receivedEventsCount, relevantEvents.length);
    nodesMap.set(node.nodeId, node);
  }

  return {
    countryCode: code,
    countryName: country?.name || code,
    flag: country?.flag || "🌐",
    relevantEvents,
    count: relevantEvents.length
  };
}

/** Overall status of the BRICS federation data exchange */
export function getFederationStatus(): BricsFederationStatusResponse {
  const nodes = Array.from(nodesMap.values());
  const activeNodes = nodes.filter((n) => n.nodeStatus === "active").length;
  const crossBorderEvents = eventsStore.filter((e) => e.targetCountries && e.targetCountries.length > 1).length;
  const regions = Array.from(new Set(nodes.map((n) => n.geographicRegion)));

  return {
    federationActive: true,
    totalNodes: nodes.length,
    activeNodes,
    totalSharedEvents: eventsStore.length,
    crossBorderEventsCount: crossBorderEvents,
    lastSyncAt: new Date().toISOString(),
    supportedRegions: regions
  };
}

/** Bridge an Indian local report into a standardized BRICS federation event */
export function bridgeReportToFederation(report: PollutionReport): BricsFederationEvent {
  const severityMap: Record<string, BricsFederationSeverity> = {
    severe: "critical",
    high: "high",
    watch: "moderate",
    resolved: "low"
  };

  const pollutionTypeMap: Record<string, BricsPollutionType> = {
    garbage_burning: "solid_waste_burning",
    crop_burning: "crop_burning",
    industrial_emission: "industrial_smoke",
    vehicle_exhaust: "vehicular_exhaust",
    dust_construction: "dust_storm",
    other: "other"
  };

  const mappedPollutionType = pollutionTypeMap[report.gemini?.pollution_type] || "other";
  const mappedSeverity = severityMap[report.priority] || "high";

  return publishFederationEvent({
    eventId: `brics-bridge-ind-${report.id}`,
    sourceNodeId: "node-ind-delhi",
    sourceCountry: "IND",
    sourceCountryName: "India",
    sourceFlag: "🇮🇳",
    latitude: report.lat,
    longitude: report.lng,
    locality: report.locality?.locality_name || report.areaText || "National Territory, India",
    timestamp: report.createdAt,
    pollutionType: mappedPollutionType,
    pollutantValues: {
      aqi: report.airQuality?.aqi || 260
    },
    severity: mappedSeverity,
    confidence: report.gemini?.confidence ?? 0.85,
    sourceType: "citizen_report",
    targetCountries: ["ALL"],
    title: `Local Citizen Report: ${report.gemini?.pollution_type?.replace(/_/g, " ") || "Air Incident"}`,
    description: report.userDescription || report.gemini?.public_summary || "Citizen pollution report verified via Gemini AI computer vision.",
    verificationStatus: report.evidenceStatus === "verified" ? "verified" : "indicative",
    metadata: {
      localReportId: report.id,
      geminiAnalysis: report.gemini?.public_summary || "Standard verified report",
      trustLevel: report.trustLevel,
      visibleEvidence: report.gemini?.visible_evidence
    }
  });
}

