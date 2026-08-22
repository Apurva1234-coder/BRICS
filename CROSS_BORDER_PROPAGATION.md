# Stage 3: Cross-Border Pollution Propagation Model

## Overview

The **Cross-Border Pollution Propagation Layer** predicts how atmospheric particulate plumes advect across international boundaries, identifying potentially affected recipient nations, border transit times, arrival concentrations, and transboundary risk categories.

```
Pollution Source Event (India 🇮🇳 / China 🇨🇳 / Brazil 🇧🇷 / etc.)
                    ↓
Hourly Meteorological Vectors (Google Weather API / Open-Meteo)
                    ↓
Modular Pollution Propagation Model (RuleBasedLagrangianModel)
                    ↓
Step-by-Step Trajectory & Plume Dispersion Simulation
                    ↓
Dynamic Geographic Country Boundary Intersection (11 BRICS Nations)
                    ↓
Cross-Border Impact Prediction Contract & Risk Scoring
                    ↓
Automated BRICS Federated Event Exchange & Map Visualization
```

---

## 1. Modular Interface & Future ML Architecture

The propagation architecture is designed with a strict common interface across all BRICS member states. No country-specific logic or separate model instances are required.

```typescript
export interface PollutionPropagationModel {
  name: string;
  version: string;
  predictPropagation(input: PropagationInput): Promise<PropagationResult>;
}
```

### Initial Implementation: `RuleBasedPropagationModel`
- Explainable Lagrangian advection stepping.
- Plume horizontal eddy dispersion: $R(t) = R_0 + 0.35 \sqrt{d}$.
- Exponential decay & atmospheric dilution:
  $$C(t) = C_0 \cdot \left(\frac{10}{10 + d}\right)^{0.45} \cdot \exp\left(-(k_{\text{decay}} + k_{\text{rain}}) \cdot t\right)$$
- Wet scavenging rainout acceleration when precipitation is active.

### Future ML Upgrade: `MLPropagationModel`
The system can drop in neural/ML chemical transport surrogate models implementing `PollutionPropagationModel` without changing downstream UI, API routes, or federation exchanges.

---

## 2. Dynamic Country & Boundary Intersection

The model dynamically checks predicted trajectory points against sovereign geographic boundaries and subregion corridors. Border crossings are never hardcoded.

Supported BRICS Nations:
- 🇮🇳 **India (IND)** — Northern Plains, Trans-Himalayan, Northeast corridors
- 🇨🇳 **China (CHN)** — Tibet / Himalayan, Xinjiang, Heilongjiang, Hebei basins
- 🇷🇺 **Russia (RUS)** — Siberian / Amur frontier, Ural, Central District
- 🇧🇷 **Brazil (BRA)** — Amazonian, Southeast Industrial, Paraná Basin
- 🇿🇦 **South Africa (ZAF)** — Highveld Mpumalanga, Limpopo, Coastal corridors
- 🇪🇬 **Egypt (EGY)** — Nile Delta, Red Sea, Sinai transit zone
- 🇪🇹 **Ethiopia (ETH)** — Rift Valley, Northern Highlands, Ogaden boundary
- 🇮🇩 **Indonesia (IDN)** — Java, Sumatra Peatland, Kalimantan forest
- 🇮🇷 **Iran (IRN)** — Alborz Plateau, Persian Gulf, Sistan corridor
- 🇦🇪 **United Arab Emirates (ARE)** — Dubai / Northern Emirates, Coastal industrial
- 🇸🇦 **Saudi Arabia (SAU)** — Eastern Province energy basin, Riyadh Plain

---

## 3. Explainable Risk Scoring Model

Cross-border risk (0–100%) is evaluated using transparent weighted factors:

1. **Source Pollution Intensity (0–40 pts)**: Initial PM2.5 / severity level.
2. **Predicted Arrival Concentration (0–30 pts)**: Remaining PM2.5 after dilution.
3. **Proximity & Transit Speed (0–20 pts)**: Hours to border crossing.
4. **Atmospheric Transport Stability (0–10 pts)**: Steady wind alignment, low precipitation washout.

### Risk Categories
- **CRITICAL** ($\ge 75\%$): Dense hazardous plume with fast arrival transit.
- **HIGH** ($50\% - 74\%$): Significant cross-border aerosol transport.
- **MEDIUM** ($25\% - 49\%$): Moderate transboundary advection.
- **LOW** ($< 25\%$): Diluted dispersion below ambient alert thresholds.

---

## 4. Automated Federated Data Exchange

When a cross-border impact is predicted:

$$\text{Source Node (e.g. 🇮🇳 India)} \;\longrightarrow\; \text{Propagation Model} \;\longrightarrow\; \text{BRICS Federation Mesh} \;\longrightarrow\; \text{Target Node (e.g. 🇨🇳 China)}$$

The prediction automatically creates and dispatches a verified `BricsFederationEvent` into the global BRICS pool, allowing recipient nations to monitor incoming plumes in real-time.

---

## 5. REST API Endpoints

- `POST /api/propagation/predict` — Execute multi-hour Lagrangian propagation simulation.
- `GET /api/propagation/events` — Retrieve all active transboundary plume predictions.
- `GET /api/propagation/affected-countries` — Aggregated summary of countries receiving incoming plumes.
- `GET /api/propagation/incoming/:countryCode` — Incoming plumes targeting a specific country.
- `GET /api/propagation/event/:eventId` — Full propagation analysis for a specific event.

---

## 6. Automated Test Suite

Run the dedicated test suite:

```bash
npm run test:propagation
npm run test:meteorology
npm run test:brics-federation
npm run test:brics-aqi
npm run test:context-aware
npm run typecheck
npm run build
```

---

## 7. Operational Disclaimer

> **Important:** Predictions generated by the Cross-Border Pollution Propagation Model are application-level wind-based estimations designed for early situational awareness and triage. They do not constitute official diplomatic alerts or government meteorological advisories.
