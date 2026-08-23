# Stage 2: Meteorological Intelligence & Wind-Based Movement Estimation

## Overview

The **Meteorological Intelligence Layer** adds real-time atmospheric context and transparent geodesic movement estimation to the BRICS environmental intelligence mesh.

```
Pollution Event (Source: lat, lng, time)
         ↓
Meteorological Context (Google Weather API / Normalized Schema)
         ↓
Hourly Forecast Wind Vectors (T+0 to T+horizon)
         ↓
Geodesic Step-by-Step Movement Estimator
         ↓
Estimated Future Dispersion Area & Polyline Trajectory
         ↓
Interactive Map & Situation Workspaces
```

---

## 1. Primary Meteorological Provider

**Google Maps Platform Weather API** serves as the primary meteorological provider.

- **Current Conditions**:
  `GET https://weather.googleapis.com/v1/currentConditions:lookup?location.latitude={lat}&location.longitude={lng}&unitsSystem=METRIC&key={key}`
- **Hourly Forecast**:
  `GET https://weather.googleapis.com/v1/forecast/hours:lookup?location.latitude={lat}&location.longitude={lng}&unitsSystem=METRIC&hours={hours}&key={key}`

### Credentials & Security

The Google Weather API key is **backend-only** and must never be exposed to browser bundles or client-side JavaScript.

Configure in `.env`:
```env
GOOGLE_WEATHER_API_KEY=your_google_weather_api_key
METEOROLOGY_MOVEMENT_HORIZON_HOURS=6
METEOROLOGY_CACHE_TTL_CURRENT_MINUTES=5
METEOROLOGY_CACHE_TTL_FORECAST_MINUTES=15
DEMO_MODE=false
```

When `DEMO_MODE=true` or when no API key is provided, the system deterministically simulates atmospheric conditions labeled as `source: "DEMO"`.

---

## 2. Wind Direction Convention & Bearing Vector

Meteorological convention defines wind direction as the bearing the wind is **blowing FROM**:
- $0^\circ$ (North): Wind blows FROM North $\to$ pushes pollution **TOWARD South** ($180^\circ$).
- $90^\circ$ (East): Wind blows FROM East $\to$ pushes pollution **TOWARD West** ($270^\circ$).
- $180^\circ$ (South): Wind blows FROM South $\to$ pushes pollution **TOWARD North** ($0^\circ$).
- $270^\circ$ (West): Wind blows FROM West $\to$ pushes pollution **TOWARD East** ($90^\circ$).

$$\text{Movement Bearing} = (\text{Wind Direction Degrees} + 180) \bmod 360$$

---

## 3. Geodesic Movement Calculation

Given starting point $(\text{lat}_1, \text{lng}_1)$, step distance $d$ (calculated as $\text{windSpeed} \times \Delta t$), and Earth radius $R = 6371.0\text{ km}$:

$$\delta = \frac{d}{R}$$
$$\text{lat}_2 = \arcsin\left(\sin\text{lat}_1 \cos\delta + \cos\text{lat}_1 \sin\delta \cos\theta\right)$$
$$\text{lng}_2 = \text{lng}_1 + \operatorname{atan2}\left(\sin\theta \sin\delta \cos\text{lat}_1, \cos\delta - \sin\text{lat}_1 \sin\text{lat}_2\right)$$

When hourly forecasts are available, the estimator steps **hour-by-hour** through shifting wind vectors, generating a multi-segment trajectory polyline rather than a static linear extrapolation.

---

## 4. Deterministic Confidence Scoring

- **HIGH Confidence** ($\ge 75$): Consistent wind direction across forecast intervals (variance $< 25^\circ$), moderate wind velocity ($5 - 35\text{ km/h}$), dry atmospheric conditions ($< 2\text{ mm}$ rain).
- **MEDIUM Confidence** ($50 - 74$): Moderate directional shifts ($25^\circ - 60^\circ$) or light rain ($2 - 5\text{ mm}$).
- **LOW Confidence** ($< 50$): Calm wind ($< 3\text{ km/h}$, where thermal convection dominates over directional advection), sharp shifts ($> 60^\circ$), heavy rain (particulate wet deposition/washout), or demo simulation.

---

## 5. API Endpoints

- `GET /api/meteorology?latitude={lat}&longitude={lng}` — Normalized current meteorological conditions.
- `GET /api/meteorology/forecast?latitude={lat}&longitude={lng}&horizonHours=6` — Multi-hour meteorological forecast points.
- `GET /api/meteorology/event/:eventId` — Atmospheric context for a specific BRICS federation event.
- `POST /api/meteorology/predict-movement` — Compute wind-based movement trajectory and arrival estimations.

---

## 6. Verification & Automated Tests

Run the dedicated test suite:

```bash
npm run test:meteorology
npm run test:brics-federation
npm run test:brics-aqi
npm run typecheck
npm run build
```

---

## 7. Disclaimer & Operational Limits

> **Important:** The movement prediction is an application-generated, wind-based estimate for operational triage and early situational awareness. It is not an official 3D Eulerian/Lagrangian chemical transport or photochemical dispersion forecast.
