# Stage 4: Economic Corridor Intelligence

## Overview

The **Economic Corridor Intelligence Layer** monitors vital industrial arteries, manufacturing clusters, and transboundary trade highways across all BRICS member nations. It overlays predicted atmospheric plume dispersion paths against economic geography to identify at-risk manufacturing hubs, compute precise sequential arrival milestones, and quantify supply-chain disruption risk.

```
Pollution Source Event (Industrial / Stubble / Forest Fires)
                        ↓
Meteorological Advection & Dispersion Vectors (Stage 2)
                        ↓
Modular Lagrangian Propagation Model (Stage 3)
                        ↓
Economic Corridor & City Node Intersection Engine (Stage 4)
                        ↓
Sequential Impact Timeline ($T_0 \to \text{City A} \to \text{City B} \to \text{Border} \to \text{City C}$)
                        ↓
Multi-Factor Corridor Risk Assessment (0–100%, CRITICAL / HIGH / MEDIUM / LOW)
                        ↓
Downstream Input to Stage 5: Automated Regulatory Coordination
```

---

## 1. Economic Corridor Data Structure

Configured in [`server/data/bricsEconomicCorridors.ts`](file:///c:/Users/pares/Documents/antigravity/goofy-goodall/server/data/bricsEconomicCorridors.ts):

```typescript
export interface EconomicCorridor {
  id: string;
  name: string;
  countries: string[];
  description: string;
  importance: "CRITICAL" | "HIGH" | "MEDIUM";
  primaryIndustries: string[];
  totalLengthKm: number;
  waypoints: Array<{ latitude: number; longitude: number }>;
  cities: CorridorCityNode[];
}

export interface CorridorCityNode {
  id: string;
  name: string;
  countryCode: string;
  countryFlag: string;
  latitude: number;
  longitude: number;
  populationEstimate: number;
  economicWeight: number; // 1-10 trade output scale
  industrialFocus: string;
  corridorKmMarker: number;
}
```

### Configured Trade Arteries:
1. 🇮🇳 🇵🇰 🇨🇳 **Northern Subcontinental Trade & Industrial Corridor** (`corridor-delhi-lahore-central-asia`):
   - *Nodes:* Delhi NCR $\to$ Panipat Refinery $\to$ Ludhiana $\to$ Amritsar $\to$ Lahore Basin.
2. 🇨🇳 🇷🇺 **Amur-Heilongjiang Transboundary Industrial Axis** (`corridor-amur-heilongjiang-industrial`):
   - *Nodes:* Harbin $\to$ Jiamusi $\to$ Hegang Coal Basin $\to$ Amur River Bridge $\to$ Khabarovsk.
3. 🇦🇪 🇸🇦 🇮🇷 **Persian Gulf Maritime & Energy Artery** (`corridor-gulf-maritime-energy`):
   - *Nodes:* Abu Dhabi $\to$ Dubai Jebel Ali Port $\to$ Ras Al Khaimah $\to$ Strait of Hormuz $\to$ Bandar Abbas.
4. 🇿🇦 🇲🇿 **Highveld-Maputo Industrial & Minerals Corridor** (`corridor-highveld-maputo`):
   - *Nodes:* Johannesburg $\to$ Witbank / eMalahleni Coal Belt $\to$ Middelburg $\to$ Maputo Port.
5. 🇧🇷 🇵🇾 🇦🇷 **Paraná-Mercosul Agro-Industrial Axis** (`corridor-parana-mercosur`):
   - *Nodes:* Curitiba $\to$ Cascavel $\to$ Foz do Iguaçu (Itaipu) $\to$ Ciudad del Este $\to$ Posadas.

---

## 2. Sequential Arrival Timeline Forecasting

The engine projects exact chronologically ordered milestones along the trade artery:

$$\text{Pollution Release} \;\longrightarrow\; \text{City A (T+3h)} \;\longrightarrow\; \text{City B (T+6h)} \;\longrightarrow\; \text{Border Crossing (T+8h)} \;\longrightarrow\; \text{City C (T+11h)}$$

Each milestone reports:
- Estimated arrival hour ($T+X\text{h}$) and UTC timestamp.
- Predicted attenuated PM2.5 concentration ($\mu\text{g/m}^3$) and AQI.
- Local economic disruption rating (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).

---

## 3. Explainable Corridor Risk Scoring

Calculated using transparent, weighted criteria:

1. **Pollution Intensity ($0 - 35\text{ pts}$)**: Peak PM2.5 concentration across all corridor nodes.
2. **Exposure & Economic Output ($0 - 30\text{ pts}$)**: Number of threatened cities + aggregate trade output weights ($\sum \text{economicWeight}$).
3. **Early Warning Urgency ($0 - 20\text{ pts}$)**: Arrival $\le 3\text{h}$ receives highest operational triage score.
4. **Cross-Border Trade Disruption ($0 - 15\text{ pts}$)**: Transboundary corridor crossing adds international supply chain risk.

### Risk Categories:
- **CRITICAL** ($\ge 75\%$): High-density plume threatening critical economic logistics hubs with imminent arrival.
- **HIGH** ($50\% - 74\%$): Significant air quality degradation across major industrial nodes.
- **MEDIUM** ($25\% - 49\%$): Moderate peripheral exposure.
- **LOW** ($< 25\%$): Negligible trade or workforce impact.

---

## 4. REST API Endpoints

- `GET /api/corridors` — List all registered economic corridors and waypoints.
- `GET /api/corridors/affected` — Retrieve all currently impacted corridors with active plume forecasts.
- `GET /api/corridors/active-predictions` — Get all live corridor impact predictions.
- `GET /api/corridors/:corridorId` — Detailed corridor overview and current impact status.
- `POST /api/corridors/predict-impact` — Run multi-corridor impact prediction for given coordinates or existing propagation results.

---

## 5. Automated Test Suite

Run the dedicated test suite:

```bash
npm run test:corridors
npm run test:propagation
npm run test:meteorology
npm run test:brics-federation
npm run test:brics-aqi
npm run test:context-aware
npm run typecheck
npm run build
```

---

## 6. Operational Disclaimer

> **Important:** Economic corridor risk assessments and arrival forecasts are application-generated estimates designed for multi-lateral planning and early supply chain awareness. They do not constitute official government trade restrictions or regulatory directives.
