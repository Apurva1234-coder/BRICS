from __future__ import annotations

from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

from forecast_engine import engine, unavailable

app = FastAPI(
    title="CleanAir AQI Forecast Model Service",
    description="Station-level CPCB historical AQI forecast service backed by trained LightGBM models.",
    version="1.0.0",
)


class PredictRequest(BaseModel):
    station_name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


@app.get("/health")
def health() -> dict[str, bool | str]:
    return {"ok": True, "service": "cleanair-aqi-forecast"}


@app.get("/stations")
def stations() -> dict[str, list[str] | int | str]:
    try:
        station_names = engine.stations()
        return {"stations": station_names, "count": len(station_names)}
    except Exception as error:
        return {"stations": [], "count": 0, "reason": f"Forecast station list unavailable: {error}"}


@app.post("/predict")
def predict(payload: PredictRequest) -> dict:
    try:
        return engine.predict(payload.station_name, payload.lat, payload.lng)
    except Exception as error:
        return unavailable(f"Forecast model unavailable: {error}")
