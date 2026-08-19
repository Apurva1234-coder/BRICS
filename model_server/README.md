# CleanAir AQI Forecast Model Service

FastAPI service for the local CPCB historical AQI forecasting model.

This service uses the trained LightGBM pickle models from:

```text
C:/Users/Apurva/Downloads/delhi/aqi_forecasting_model/models
```

and the historical CPCB station dataset from:

```text
C:/Users/Apurva/Downloads/delhi/processed/cpcb_aqi_long.csv
```

Override paths when needed:

```powershell
$env:AQI_MODEL_ROOT="C:/Users/Apurva/Downloads/delhi/aqi_forecasting_model"
$env:AQI_DATA_PATH="C:/Users/Apurva/Downloads/delhi/processed/cpcb_aqi_long.csv"
```

Run:

```bash
cd model_server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 9000
```

Test:

```bash
curl http://localhost:9000/stations
curl -X POST http://localhost:9000/predict \
  -H "Content-Type: application/json" \
  -d "{\"station_name\":\"Anand Vihar, Delhi - DPCC\"}"
```

The forecast is station-level and based on historical CPCB AQI lag, rolling, and time features. It is not live official AQI, not exact street-level AQI, and not derived from uploaded photos.
