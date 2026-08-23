# BRICS Environmental Federation Architecture

## Overview

The BRICS Environmental Federation Layer extends the NagarNetra / CleanAir Sentinel platform into a decentralized, multi-country environmental data exchange mesh.

It connects national environmental nodes across all 11 BRICS member states:
- 🇮🇳 **India** (`IND` - Nodal Center)
- 🇨🇳 **China** (`CHN`)
- 🇧🇷 **Brazil** (`BRA`)
- 🇷🇺 **Russia** (`RUS`)
- 🇿🇦 **South Africa** (`ZAF`)
- 🇪🇬 **Egypt** (`EGY`)
- 🇪🇹 **Ethiopia** (`ETH`)
- 🇮🇩 **Indonesia** (`IDN`)
- 🇮🇷 **Iran** (`IRN`)
- 🇦🇪 **UAE** (`ARE`)
- 🇸🇦 **Saudi Arabia** (`SAU`)

---

## Key Architectural Principles

1. **Common AI Intelligence Mesh**
   - No separate or fragmented AI models per country.
   - Shared vision verification (Gemini), satellite telemetry (Sentinel-5P / CAMS), and multi-sensor atmospheric modeling apply uniformly across the federation.

2. **Standardized Environmental Event Schema (`BricsFederationEvent`)**
   - Universal data interchange format for transboundary environmental events:
     - `eventId`: Globally unique event identifier
     - `sourceNodeId` & `sourceCountry`: Originating national node
     - `latitude` & `longitude`: Validated geospatial coordinates
     - `timestamp`: ISO 8601 observation time
     - `pollutionType`: Classified emission type (`crop_burning`, `industrial_smoke`, `dust_storm`, `chemical_leak`, etc.)
     - `pollutantValues`: Quantified metric matrix ($\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{NO}_2$, $\text{SO}_2$, $\text{CO}$, $\text{O}_3$, $\text{AQI}$)
     - `severity`: `"critical"` | `"high"` | `"moderate"` | `"low"`
     - `confidence`: Statistical/model confidence ($0.0 \to 1.0$)
     - `sourceType`: `"satellite_sentinel5p"` | `"ground_station"` | `"citizen_report"` | `"sensor_mesh"`
     - `windDirectionDeg` & `windSpeedKmh`: Atmospheric transport vector
     - `predictedAffectedRegion`: Target transboundary airshed corridor
     - `targetCountries`: Direct or broadcast recipient node list

3. **Decentralized Country Nodes Abstraction (`BricsCountryNode`)**
   - Real-time heartbeat synchronization and capability flags (`canPublish`, `canSubscribe`, `hasSatelliteFeed`, `hasGroundMesh`).
   - Supports local telemetry integrations (CPCB, OpenAQ, Open-Meteo, INPE, CNEMC, Roshydromet).

4. **Bi-directional Cross-Country Data Exchange Protocol**
   - **India 🇮🇳 → BRICS Protocol → China 🇨🇳**:
     1. Local telemetry / citizen report detected in India (e.g. Northern Airshed agricultural burning).
     2. Packaged into standardized `BricsFederationEvent` with transboundary trajectory metadata.
     3. Shared to Federation event bus via `POST /api/brics/federation/events`.
     4. China node queries `GET /api/brics/federation/events/relevant/CHN` and receives the verified alert with complete pollutant matrix.

---

## API Endpoints

- `GET /api/brics/federation/nodes`: List all registered member nodes & health status
- `GET /api/brics/federation/nodes/:nodeId`: Detailed node capabilities and stats
- `POST /api/brics/federation/nodes/register`: Dynamic node registration and heartbeat
- `POST /api/brics/federation/events`: Submit/publish standardized environmental event
- `GET /api/brics/federation/events`: Query federated events with filtering (`country`, `severity`, `pollutionType`, `since`)
- `GET /api/brics/federation/events/relevant/:countryCode`: Fetch events affecting or targeted to a specific nation
- `GET /api/brics/federation/status`: Federation cluster health, active nodes, and event counts

---

## Verification & Testing

Run the automated deterministic test suite:

```bash
npm run test:brics-federation
npm run test:brics-aqi
npm run test:context-aware
npm run typecheck
npm run build
```
