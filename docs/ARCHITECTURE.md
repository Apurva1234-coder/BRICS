# Architecture Overview

CleanAir Sentinel is a full-stack web application designed for high resilience, offline-capable interactions (where needed), and seamless integration with external APIs for environmental intelligence.

## Core Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Leaflet (Map).
- **Backend**: Node.js, Express, TypeScript.
- **AI Processing**: Google Gemini 3.1 Flash Lite.
- **External Services**: 
  - Central Pollution Control Board (CPCB)
  - Sentinel Hub (Copernicus ESA Satellite Data)
  - Google Data.gov APIs

## System Components

### 1. The Frontend (Vite + React)
The frontend is built as a Single Page Application (SPA). It uses a modern, dynamic, and glassmorphic UI targeted at desktop and mobile dashboards.
- **Routing**: Minimal client-side views.
- **Maps**: React-Leaflet integration for spatial visualization of pollution hotspots and reported situations.
- **API Communication**: All calls are proxied through `/api/...` to the backend.

### 2. The Backend (Node.js + Express)
The backend serves as a resilient proxy and orchestrator.
- **Dual Mode Support**: Designed to run seamlessly as a traditional Node server or inside serverless environments (Cloud Run, Firebase Functions, Netlify Functions).
- **Storage Abstraction**: Uses a dual-storage strategy. In `DEMO_MODE=true`, it falls back to local JSON files (`server/data/`) and local uploads (`storage/`) instead of requiring a Cloud SQL or Firestore instance.
- **AI Orchestrator**: Uses Gemini to analyze text/images and automatically determine the priority, categories, and risks associated with user reports.
- **Verification Engine**: The Satellite Verification Queue asynchronously triggers Sentinel Hub API to check for visual or thermal evidence of reported incidents (e.g., crop burning, factory emissions) from recent satellite passes.

## Data Flow (Incident Reporting)
1. **User** submits a report with an image and location via the React App.
2. **Backend (Express)** receives the payload, saves the image (local or cloud storage).
3. **Backend** sends the image and metadata to **Gemini API** for initial classification and risk scoring.
4. **Backend** queries **CPCB API** for real-time Air Quality context at the location.
5. **Backend** queues a **Satellite Verification** job.
6. The compiled "Situation" is stored (JSON or Firestore).
7. The **Officer Dashboard** instantly reflects the new situation with all context attached.

## National air-data pipeline

`cpcbService.ts` owns one cached CPCB snapshot. It reads the provider total and effective page size, deduplicates exact logical rows, continues past 25 pages, and records expected pages, fetched/unique counts, duplicate/repeated-page counts, stop reason, and completeness. A stale last-successful snapshot is used only on refresh failure.

`openAqNationalSnapshotService.ts` fetches OpenAQ locations using `iso=IN` and `mobile=false`, preserves station/sensor/licence/timezone metadata, and processes latest measurements in a bounded 2-4 worker queue. It exposes metadata-complete and latest-snapshot-complete separately, uses stale location results when an individual request fails, and starts refreshes in the background so map requests do not fan out into uncontrolled provider calls.

All current map values pass an explicit eligibility result. Values must be finite, non-negative, timestamped, compatible, average-kind, and fresh/usable. CPCB and OpenAQ latest values have unknown averaging periods, so they are not official-style AQI inputs. Rolling AQI requires a validated hourly coverage trace. The official CPCB breakpoint reference is linked in the README and encoded in `server/airQuality/aqi.ts`.

Map points carry metric details and completeness metadata. Cluster `×N` is the count of eligible physical monitoring stations; median and range are concentration summaries only. Per-pollutant local selection is independent, so a local context can name different nearest stations without fabricating a complete station or official AQI.
