import type { BricsCountryNode } from "../types.js";

export const INITIAL_BRICS_NODES: BricsCountryNode[] = [
  {
    nodeId: "node-ind-delhi",
    countryCode: "IND",
    countryName: "India",
    flag: "🇮🇳",
    geographicRegion: "South Asia",
    supportedDataSources: ["cpcb", "openaq", "sentinel5p", "open_meteo", "citizen_reports", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://ind-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-01T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 14,
    receivedEventsCount: 28,
    contactEmail: "nodal-officer@cpcb.gov.in",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  },
  {
    nodeId: "node-chn-beijing",
    countryCode: "CHN",
    countryName: "China",
    flag: "🇨🇳",
    geographicRegion: "East Asia",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://chn-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-01T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 19,
    receivedEventsCount: 22,
    contactEmail: "federation@cnemc.cn",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  },
  {
    nodeId: "node-bra-brasilia",
    countryCode: "BRA",
    countryName: "Brazil",
    flag: "🇧🇷",
    geographicRegion: "South America",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://bra-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-02T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 8,
    receivedEventsCount: 15,
    contactEmail: "brics-monitor@inpe.br",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  },
  {
    nodeId: "node-rus-moscow",
    countryCode: "RUS",
    countryName: "Russia",
    flag: "🇷🇺",
    geographicRegion: "Eurasia",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://rus-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-02T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 11,
    receivedEventsCount: 17,
    contactEmail: "sentinel@meteorf.ru",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  },
  {
    nodeId: "node-zaf-pretoria",
    countryCode: "ZAF",
    countryName: "South Africa",
    flag: "🇿🇦",
    geographicRegion: "Southern Africa",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://zaf-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-03T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 7,
    receivedEventsCount: 12,
    contactEmail: "airquality@environment.gov.za",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  },
  {
    nodeId: "node-egy-cairo",
    countryCode: "EGY",
    countryName: "Egypt",
    flag: "🇪🇬",
    geographicRegion: "North Africa / Middle East",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://egy-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-04T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 5,
    receivedEventsCount: 10,
    contactEmail: "env-sentinel@eeaa.gov.eg",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: false
    }
  },
  {
    nodeId: "node-eth-addis",
    countryCode: "ETH",
    countryName: "Ethiopia",
    flag: "🇪🇹",
    geographicRegion: "East Africa",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://eth-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-04T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 4,
    receivedEventsCount: 8,
    contactEmail: "brics@epa.gov.et",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: false
    }
  },
  {
    nodeId: "node-idn-jakarta",
    countryCode: "IDN",
    countryName: "Indonesia",
    flag: "🇮🇩",
    geographicRegion: "Southeast Asia",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://idn-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-05T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 9,
    receivedEventsCount: 14,
    contactEmail: "ispu@menlhk.go.id",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  },
  {
    nodeId: "node-irn-tehran",
    countryCode: "IRN",
    countryName: "Iran",
    flag: "🇮🇷",
    geographicRegion: "Middle East",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://irn-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-05T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 6,
    receivedEventsCount: 9,
    contactEmail: "air@doe.ir",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: false
    }
  },
  {
    nodeId: "node-are-dubai",
    countryCode: "ARE",
    countryName: "UAE",
    flag: "🇦🇪",
    geographicRegion: "Middle East",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://are-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-06T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 8,
    receivedEventsCount: 11,
    contactEmail: "airquality@moccae.gov.ae",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  },
  {
    nodeId: "node-sau-riyadh",
    countryCode: "SAU",
    countryName: "Saudi Arabia",
    flag: "🇸🇦",
    geographicRegion: "Middle East",
    supportedDataSources: ["openaq", "sentinel5p", "open_meteo", "sensor_mesh"],
    nodeStatus: "active",
    endpointUrl: "https://sau-node.brics-sentinel.org/api/v1",
    registeredAt: "2026-01-06T00:00:00.000Z",
    lastHeartbeatAt: new Date().toISOString(),
    sharedEventsCount: 7,
    receivedEventsCount: 13,
    contactEmail: "env-sentinel@mewa.gov.sa",
    capabilities: {
      canPublish: true,
      canSubscribe: true,
      hasSatelliteFeed: true,
      hasGroundMesh: true
    }
  }
];
