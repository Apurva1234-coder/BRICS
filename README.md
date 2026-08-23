# CleanAir Sentinel 🌍

CleanAir Sentinel is an AI-powered, real-time spatial intelligence platform built to crowdsource, verify, and resolve environmental pollution incidents. Designed for citizens and regulatory authorities, it bridges the gap between hyper-local civilian reporting and macro-level satellite verification.

## 🚨 The Problem
Traditional environmental monitoring relies on sparse hardware sensors and bureaucratic reporting pipelines. Citizens witness illegal emissions, crop burning, and toxic dumping, but they lack an immediate, verifiable way to report these anomalies. Authorities, conversely, are overwhelmed with unverified, disjointed data without geographical context or prioritization.

## 💡 The Solution
CleanAir Sentinel acts as an autonomous triage engine. It allows citizens to instantly submit photo evidence of pollution. The system uses **Google Gemini AI** to contextually understand the image and text, automatically scoring its risk. It then autonomously cross-references this ground-truth data with **CPCB (Central Pollution Control Board)** regional AQI data and **Copernicus Sentinel Hub** satellite imagery to verify the incident. Authorities receive a beautifully aggregated dashboard of high-priority "Situations" ready for immediate action.

---

## ✨ Key Features
- **Smart AI Triage**: Gemini Vision analyzes uploaded photos to classify the type of pollution and determine its severity automatically.
- **Satellite Cross-Verification**: The system automatically attempts to fetch thermal anomalies and cloud-cover evidence from Sentinel-2 & Sentinel-5P satellites for the reported location.
- **Station-derived air intelligence**: Combines official CPCB/data.gov.in station records with OpenAQ monitoring locations, pollutant-level freshness, local station context, and a bounded 24-hour statistical prediction when enough hourly history exists.
- **National coverage audit**: CPCB pagination runs to the provider-reported total with an emergency cap, while OpenAQ India locations synchronize through a bounded, rate-limit-aware snapshot. Partial coverage is disclosed instead of presented as complete.
- **Officer Dashboard**: A centralized, grouped view of incidents clustered into actionable "Situations."
- **Citizen Map**: A beautiful, glassmorphic dark-mode interactive spatial map (React-Leaflet) showing active incidents.
- **Mobile-First**: Fully responsive UI designed to look like a premium native mobile app for citizens on the ground.

---

## 🛠 Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Leaflet Maps.
- **Backend**: Node.js, Express, TypeScript.
- **AI & Intelligence**: Google Gemini 3.1 Flash Lite.
- **External Data**: Sentinel Hub APIs, CPCB/data.gov.in, and OpenAQ v3.
- **Air-quality architecture**: CPCB is the official Indian monitoring source. OpenAQ is supplementary and may republish government data. Google Air Quality is not used by the AQI data pipeline; Google Maps browser rendering remains independent.
- **Air-quality authentication**: OpenAQ v3 is backend-only; the key is never placed in Vite or returned by diagnostics.
- **Architecture**: Single-container optimized (Express serving the Vite build).

---

## 🏗 Architecture
The repository uses a monolithic structure where the frontend and backend are tightly integrated for simplicity and rapid deployment during hackathons.
- Read the full [Architecture Guide](docs/ARCHITECTURE.md)
- Explore the [API Documentation](docs/API.md)
- Learn about [Mobile UI Decisions](docs/MOBILE_UI.md)

---

## 🚀 Setup Instructions

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/AntiDynamic/cleanair-local-sentinel.git
cd cleanair-local-sentinel
npm install
```

### 2. Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Ensure you provide at minimum the `GEMINI_API_KEY` for the AI triage to function.

### Sentinel provider setup

Sentinel verification is backend-only and optional. Set `SENTINEL_HUB_PROVIDER` to `cdse`, `commercial`, or `custom`. CDSE clients use `https://sh.dataspace.copernicus.eu` with the CDSE identity realm; commercial Sentinel Hub clients use `https://services.sentinel-hub.com` with the commercial realm. Credentials from one environment cannot authenticate against the other.

For `custom`, set both endpoint variables explicitly. Do not commit credentials, do not expose them through Vite variables, and restart the backend after `.env` changes. Host verification is more reliable than sandbox networking:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-sentinel-host.ps1
```

### 3. Run Commands
Start both the React frontend and the Express backend locally:
```bash
# Start backend in watch mode (Port 8787)
npm run server:dev

# In a new terminal, start the Vite frontend (Port 5173)
npm run dev
```

### 4. Hackathon Demo Mode
To run the production-optimized build strictly using local storage (bypassing the need for Cloud SQL or Firestore):
```bash
npm run demo
```
This builds the frontend into `dist/` and serves the entire application via the Express backend on `http://localhost:8787`.

---

## ☁️ Deployment Instructions
For hackathons, the easiest way to deploy this full-stack application (without requiring Google Cloud billing) is **Netlify** or **Render**.
- **Netlify**: Run `npx netlify deploy --build --prod`. The `netlify.toml` is pre-configured.
- **Google Cloud Run**: Read our [Cloud Run Deployment Guide](docs/DEPLOYMENT.md).

---

## 🎭 Demo Flow (For Judges)
We have prepared a step-by-step [Demo Guide](docs/DEMO_GUIDE.md) to showcase the best features of the platform smoothly.
1. Open Map view and submit a report with an image.
2. View "My Reports" to see the AI auto-score the image.
3. Show the Officer Dashboard where the CPCB data and Sentinel Satellite cross-checks are attached.

---

## 🔌 API Summary
- `POST /api/reports`: Accepts `multipart/form-data` with images for AI analysis.
- `GET /api/situations`: Returns grouped incidents for the Officer Dashboard.
- `GET /api/air-quality/cpcb/status`: CPCB pagination, station, pollutant, freshness, and cache diagnostics.
- `GET /api/air-quality/cpcb/nearby?lat=&lng=&radiusKm=25&limit=8`: Nearby official CPCB monitoring stations.
- `GET /api/air-quality/cpcb/local-context?lat=&lng=&radiusKm=25`: IDW station-derived pollutant context with confidence and freshness.
- `GET /api/air-quality/openaq/status?check=true`: Safe OpenAQ configuration/authentication diagnostics.
- `GET /api/air-quality/openaq/nearby?lat=&lng=&radiusKm=25&limit=12`: Nearby OpenAQ monitoring locations and latest readings.
- `GET /api/air-quality/national-status`: CPCB/OpenAQ completeness, synchronization, station matching, and pollutant coverage diagnostics.
- `GET /api/air-quality/aqi-status`: bounded current-AQI history synchronization status and validated/indicative/pending coverage counts.
- `GET /api/air-quality/audit/station/:physicalStationId`: Development-only normalized station audit; raw provider payloads and credentials are never exposed.
- `GET /api/air-quality/forecast-24h?lat=&lng=`: Local statistical 24-hour prediction from recent OpenAQ hourly history, or an explicit insufficient-history response.
- `GET /api/satellite/status?check=true`: Diagnostics for Sentinel Hub token auth.

### AQI data wording
CPCB and OpenAQ values are monitoring-station measurements. The app may estimate local context from nearby stations, but it does not claim an exact street-level sensor reading. Forecasts are application-generated statistical predictions, not official CPCB/OpenAQ forecasts.

### Measurement truth
CPCB `pollutant_avg` is displayed as a CPCB reported average because the current resource metadata does not prove an 8-hour or 24-hour rolling period. It is therefore not used as official-style AQI input. OpenAQ latest measurements are also not automatically AQI inputs. A coloured current map marker requires a finite, non-negative, timestamped average with compatible units and fresh/usable age; stale, expired, maximum-only, minimum-only, invalid, and unknown-timestamp values remain diagnostic context.

The current AQI layer uses a bounded background synchronizer. For OpenAQ stations with compatible sensors, it fetches recent hourly history, deduplicates readings to UTC hours, fills only short gaps, and calculates a rolling Indian AQI only when the window has sufficient coverage and at least three pollutants including PM2.5 or PM10. The result is labelled **validated rolling AQI**, but remains application-calculated and is not an official CPCB AQI. CPCB station averages may appear as **indicative AQI** only when they are fresh, average-valued, timestamped, and meet the same pollutant-count rule; their averaging period remains unverified. Pending, insufficient-history, insufficient-pollutant, and unavailable states are shown explicitly instead of being rendered as AQI zero.

The synchronizer is deliberately bounded. `CURRENT_AQI_SYNC_CONCURRENCY`, `CURRENT_AQI_REFRESH_BATCH_SIZE`, `CURRENT_AQI_MAX_REQUESTS_PER_RUN`, `CURRENT_AQI_HISTORY_DAYS`, `CURRENT_AQI_MAX_AGE_HOURS`, and `CURRENT_AQI_CACHE_TTL_MINUTES` control the work queue and cache. CPCB's [AQI calculation guidance](https://cpcb.nic.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvSG93X0FRSV9DYWxjdWxhdGVkLnBkZg) requires at least three pollutants, one of PM2.5 or PM10, and a minimum of 16 hours for a sub-index; these constraints are preserved in the calculation trace.

Cluster labels are station counts (`×N`); the tooltip separately shows the eligible-value median and range. Pollutants selected for an area may come from different nearby stations and are called multi-station local pollutant context, never an exact street-level reading or official AQI for that location. Pb is part of the Indian AQI framework but is shown only when the live source reports it. OpenAQ may republish government data.

Run the national audit with `npm run verify:air-national`. The official AQI reference is CPCB's [About National Air Quality Index](https://cpcb.nic.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvQWJvdXRfQVFJLnBkZg).

---

## ⚠️ Prototype Notes (Demo Mode)
To ensure absolute reliability during live demonstrations and lower the barrier to entry, this prototype utilizes a built-in `DEMO_MODE`. 
- **Storage**: By default, reports and uploaded images are written to a temporary local filesystem (`server/data/` and `storage/`) rather than a persistent remote Cloud Bucket or Firestore. This is an intentional design choice to guarantee that the core logic and AI pipelines function 100% reliably regardless of external database connectivity issues during a hackathon.
- **Mock Fallbacks**: If external environmental APIs (like Sentinel Hub) rate-limit the application, the system degrades gracefully and provides simulated historical context instead of crashing, ensuring a flawless UX demonstration.
