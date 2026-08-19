# Internal API Documentation

The CleanAir Sentinel backend exposes several RESTful endpoints used by the frontend. All endpoints are prefixed with `/api`.

## Core System

### `GET /api/health`
Checks if the API is running and responsive.
- **Returns**: `200 OK`
- **Response**: `{ "status": "ok", "timestamp": "...", "uptime": ... }`

### `GET /api/demo/status`
Returns whether the application is running in Hackathon DEMO mode.
- **Returns**: `200 OK`
- **Response**: `{ "demoMode": true }`

## Reports & Situations

### `GET /api/reports`
Fetches all user reports.
- **Returns**: `200 OK`
- **Response**: `[ { "id": "...", "description": "...", "location": { "lat": ..., "lng": ... }, ... } ]`

### `POST /api/reports`
Submits a new environmental incident report.
- **Content-Type**: `multipart/form-data`
- **Fields**: 
  - `description` (string)
  - `latitude` (number)
  - `longitude` (number)
  - `image` (file)
- **Returns**: `201 Created`
- **Response**: The newly created `Report` object with AI-generated metadata.

### `GET /api/situations`
Fetches grouped "Situations" (aggregated reports + CPCB data + Sentinel Evidence).
- **Returns**: `200 OK`
- **Response**: `[ { "id": "...", "title": "...", "reports": [...], "evidence": [...], ... } ]`

## External Intelligence Diagnostics

### `GET /api/air-quality/cpcb/status`
Diagnostics for bounded CPCB pagination, normalization, station grouping, pollutant availability, freshness, and cache state.
- **Returns**: `200 OK` even when the provider is unavailable.
- **Response**: `{ configured, recordCount, usableRecordCount, stationCount, pollutantsAvailable, latestUpdate, oldestUpdate, cacheExpiresAt, complete, reason }`

### `GET /api/air-quality/cpcb/nearby?lat=&lng=&radiusKm=25&limit=8&pollutant=all`
Returns nearby official CPCB monitoring stations with all supported pollutant fields, selected value kind, timestamps, freshness, and station distance. CPCB station data is not an exact street-level sensor reading.

### `GET /api/air-quality/cpcb/local-context?lat=&lng=&radiusKm=25&pollutant=all`
Returns station-derived local pollutant context. Each pollutant includes nearest value, nearby min/max/average, inverse-distance-weighted estimate, station count, confidence, and freshness summary. No street-level measurement is claimed.

### `GET /api/air-quality/openaq/status?check=true`
Returns safe OpenAQ environment and authentication diagnostics. It exposes lengths and a short fingerprint, never the key itself.

### `GET /api/air-quality/openaq/nearby?lat=&lng=&radiusKm=25&limit=12`
Returns nearby OpenAQ monitoring locations and latest normalized readings with attribution and license metadata.

### `GET /api/air-quality/national-status`
Returns CPCB provider totals/page completeness, OpenAQ India metadata/latest synchronization progress, merged physical-station counts, and per-pollutant eligible map coverage. Use `?refresh=true` only for development audits.

### `GET /api/air-quality/audit/station/:physicalStationId`
Development-only normalized station comparison. It preserves source/provider, timestamp, unit, freshness, aggregation-period verification, current-map eligibility, and AQI eligibility without returning unrestricted raw provider responses.

### `GET /api/air-quality/forecast-24h?lat=&lng=`
Returns a local statistical 24-hour prediction from recent OpenAQ hourly station history. It returns `provider: "unavailable"` with `reason` when history is insufficient; it does not fabricate a flat forecast and is not an official provider forecast.

### `GET /api/satellite/status?check=true`
Diagnostics endpoint to verify Sentinel Hub OAuth token generation and Catalog API access.
- **Query Params**: `check=true` (Forces a live network test)
- **Returns**: `200 OK`
- **Response**: `{ "status": "ok", "tokenValid": true, ... }`

## National air-data semantics
CPCB pagination continues until its reported total is reached or a classified terminal/provider failure occurs. `pollutant_avg` remains an unverified provider-reported average unless official resource documentation proves its averaging period. Fresh/usable averages can appear as current concentration markers; stale, expired, maximum-only, minimum-only, invalid, and unknown-timestamp readings are excluded from normal map markers.

OpenAQ national metadata uses the official `iso=IN` and `mobile=false` filters, preserves location/sensor/licence/timezone metadata, and refreshes latest values with bounded concurrency. A partial or stale snapshot is labelled as such. Latest measurements are not automatically rolling AQI inputs.

The map's `×N` cluster count is a count of eligible monitoring stations. The cluster median and range are separate concentration statistics, never a cluster AQI. Nearby locality values are selected per pollutant and may come from different stations.

### `POST /api/satellite/debug-aoi`
Debug endpoint to manually trigger a satellite search for a specific coordinate area (Area of Interest).
- **Body**: `{ "latitude": 28.6139, "longitude": 77.2090 }`
- **Returns**: `200 OK`
- **Response**: `{ "results": [...], "processingLogs": [...] }`
