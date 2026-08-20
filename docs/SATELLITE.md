# Satellite pollution mode

Satellite mode adds an on-demand Sentinel-5P atmospheric pollutant overlay to the existing Leaflet map. It is separate from AIR/AQI and does not label satellite concentrations as AQI.

## Setup

The Google Cloud project must be `cleanair-sentinel-506017`, with Earth Engine enabled and the project registered for non-commercial use. Install dependencies with `npm install`.

For local unattended authentication, configure either `EARTH_ENGINE_PRIVATE_KEY_FILE` pointing to a service-account JSON file or `EARTH_ENGINE_PRIVATE_KEY_JSON` containing the credential JSON. Never commit either credential. `EARTH_ENGINE_PROJECT` and `GOOGLE_CLOUD_PROJECT` default to `cleanair-sentinel-506017` in `.env.example`.

For deployment, provide the same values through the hosting provider's secret manager or use application default credentials where supported.

Recommended local layout:

```text
<project>\
  .env
  credentials\
    earth-engine-service-account.json
```

Set `EARTH_ENGINE_PRIVATE_KEY_FILE=./credentials/earth-engine-service-account.json` in `.env`. The file must be a Google Cloud service-account JSON key whose service account is permitted to use Earth Engine in `cleanair-sentinel-506017`. Do not place the JSON under `src/`, `public/`, or any committed directory, and do not paste its contents into frontend code.

## Run and test

Run the API and frontend with the existing project commands:

```powershell
npm run server:dev
npm run dev
```

Open the app, choose `SATELLITE`, select one pollutant and date range, then click `Load Satellite Pollution`. The request is made only at that point. Switching away from SATELLITE removes the overlay. Repeating the exact request in the same browser session reuses the cached tile URL.

The initial supported region is India. Additional countries can be added by extending the satellite region abstraction and backend geometry selection.
