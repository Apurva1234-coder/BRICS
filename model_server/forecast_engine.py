from __future__ import annotations

import os
import pickle
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

warnings.filterwarnings(
    "ignore",
    message="X does not have valid feature names.*",
    category=UserWarning,
)

MODEL_VERSION = "lightgbm_cpcb_delhi_v1"
MODEL_PROVIDER = "local_lightgbm_model"
CITY = "Delhi"
CONFIDENCE_NOTE = "1h and 6h forecasts are stronger; 24h is trend/risk guidance."
SOURCE_NOTE = "CPCB historical station-level AQI forecast. Not live official AQI and not exact street-level AQI."

DEFAULT_MODEL_ROOT = Path("C:/Users/Apurva/Downloads/delhi/aqi_forecasting_model")
DEFAULT_DATA_PATH = Path("C:/Users/Apurva/Downloads/delhi/processed/cpcb_aqi_long.csv")

MODEL_PATHS = {
    "1h": "lightgbm_aqi_1h.pkl",
    "6h": "lightgbm_aqi_6h.pkl",
    "12h": "lightgbm_aqi_12h.pkl",
    "24h": "lightgbm_aqi_24h.pkl",
}
LAGS = [1, 3, 6, 12, 24, 48, 72]
ROLLING_WINDOWS = [3, 6, 12, 24]
FEATURE_COLUMNS = [
    "AQI_lag_1h",
    "AQI_lag_3h",
    "AQI_lag_6h",
    "AQI_lag_12h",
    "AQI_lag_24h",
    "AQI_lag_48h",
    "AQI_lag_72h",
    "AQI_roll_mean_3h",
    "AQI_roll_mean_6h",
    "AQI_roll_mean_12h",
    "AQI_roll_mean_24h",
    "AQI_roll_std_6h",
    "AQI_roll_std_24h",
    "AQI_roll_min_24h",
    "AQI_roll_max_24h",
    "hour",
    "day_of_week",
    "month",
    "is_weekend",
    "season",
    "station_name",
]


def generated_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def unavailable(reason: str) -> dict[str, Any]:
    return {
        "provider": "unavailable",
        "predictions": {},
        "categories": {},
        "spikeRisk": "unknown",
        "confidenceNote": CONFIDENCE_NOTE,
        "sourceNote": SOURCE_NOTE,
        "generatedAt": generated_at(),
        "reason": reason,
    }


def model_root() -> Path:
    return Path(os.getenv("AQI_MODEL_ROOT", str(DEFAULT_MODEL_ROOT)))


def data_path() -> Path:
    return Path(os.getenv("AQI_DATA_PATH", str(DEFAULT_DATA_PATH)))


def add_season(month: pd.Series) -> pd.Series:
    return np.select(
        [
            month.isin([12, 1, 2]),
            month.isin([3, 4, 5, 6]),
            month.isin([7, 8, 9]),
            month.isin([10, 11]),
        ],
        [1, 2, 3, 4],
        default=0,
    )


def aqi_category(value: float) -> str:
    if value <= 50:
        return "Good"
    if value <= 100:
        return "Satisfactory"
    if value <= 200:
        return "Moderate"
    if value <= 300:
        return "Poor"
    if value <= 400:
        return "Very Poor"
    return "Severe"


def category_rank(category: str) -> int:
    return {
        "Good": 1,
        "Satisfactory": 2,
        "Moderate": 3,
        "Poor": 4,
        "Very Poor": 5,
        "Severe": 6,
    }.get(category, 0)


def spike_risk(latest_aqi: float, predicted_24h_aqi: float) -> str:
    if not np.isfinite(latest_aqi) or not np.isfinite(predicted_24h_aqi):
        return "unknown"
    increase = predicted_24h_aqi - latest_aqi
    latest_category = aqi_category(latest_aqi)
    forecast_category = aqi_category(predicted_24h_aqi)
    if increase >= 75 or category_rank(forecast_category) >= category_rank("Very Poor"):
        return "high"
    if increase >= 30 or (
        category_rank(latest_category) < category_rank("Poor")
        and category_rank(forecast_category) >= category_rank("Poor")
    ):
        return "medium"
    return "low"


class ForecastEngine:
    def __init__(self) -> None:
        self._models: dict[str, Any] | None = None
        self._data: pd.DataFrame | None = None

    def load_models(self) -> dict[str, Any]:
        if self._models is not None:
            return self._models

        models_dir = model_root() / "models"
        models: dict[str, Any] = {}
        missing = []
        for horizon, filename in MODEL_PATHS.items():
            path = models_dir / filename
            if not path.exists():
                missing.append(str(path))
                continue
            with path.open("rb") as file:
                models[horizon] = pickle.load(file)

        if missing:
            raise FileNotFoundError("Missing LightGBM model file(s): " + ", ".join(missing))
        self._models = models
        return models

    def load_data(self) -> pd.DataFrame:
        if self._data is not None:
            return self._data

        csv_path = data_path()
        if not csv_path.exists():
            raise FileNotFoundError(f"Input data not found: {csv_path}")

        data = pd.read_csv(csv_path, parse_dates=["timestamp"])
        required = {"timestamp", "station_name", "AQI"}
        missing = required.difference(data.columns)
        if missing:
            raise ValueError(f"Missing required columns in input CSV: {sorted(missing)}")

        data["AQI"] = pd.to_numeric(data["AQI"], errors="coerce")
        data = data.dropna(subset=["timestamp", "station_name", "AQI"])
        data = data.sort_values(["station_name", "timestamp"]).reset_index(drop=True)
        self._data = data
        return data

    def stations(self) -> list[str]:
        data = self.load_data()
        return sorted(data["station_name"].dropna().astype(str).unique().tolist())

    def station_history(self, station_name: str) -> pd.DataFrame:
        data = self.load_data()
        normalized = station_name.lower().strip()
        station_names = data["station_name"].dropna().astype(str)
        exact_matches = station_names.str.lower() == normalized
        station_data = data[exact_matches].copy()
        if station_data.empty:
            contains_matches = station_names.str.lower().apply(
                lambda value: value in normalized or normalized in value
            )
            station_data = data[contains_matches].copy()
        if station_data.empty:
            raise LookupError(f"Station not found: {station_name}")
        return station_data.sort_values("timestamp").reset_index(drop=True)

    def latest_features(self, station_data: pd.DataFrame) -> pd.DataFrame:
        featured = station_data.copy()
        for lag in LAGS:
            featured[f"AQI_lag_{lag}h"] = featured["AQI"].shift(lag)

        shifted_aqi = featured["AQI"].shift(1)
        for window in ROLLING_WINDOWS:
            featured[f"AQI_roll_mean_{window}h"] = shifted_aqi.rolling(window, min_periods=window).mean()

        featured["AQI_roll_std_6h"] = shifted_aqi.rolling(6, min_periods=6).std()
        featured["AQI_roll_std_24h"] = shifted_aqi.rolling(24, min_periods=24).std()
        featured["AQI_roll_min_24h"] = shifted_aqi.rolling(24, min_periods=24).min()
        featured["AQI_roll_max_24h"] = shifted_aqi.rolling(24, min_periods=24).max()

        featured["hour"] = featured["timestamp"].dt.hour
        featured["day_of_week"] = featured["timestamp"].dt.dayofweek
        featured["month"] = featured["timestamp"].dt.month
        featured["is_weekend"] = featured["day_of_week"].isin([5, 6]).astype(int)
        featured["season"] = add_season(featured["month"]).astype(int)

        usable = featured.dropna(subset=FEATURE_COLUMNS).copy()
        if usable.empty:
            raise ValueError("Insufficient AQI history for this station")
        return usable.tail(1)

    def predict(self, station_name: str | None, lat: float | None = None, lng: float | None = None) -> dict[str, Any]:
        if not station_name:
            if lat is not None and lng is not None:
                return unavailable("station_name is required because station coordinates are not available")
            return unavailable("station_name is required")

        try:
            models = self.load_models()
            latest = self.latest_features(self.station_history(station_name))
        except LookupError as error:
            return unavailable(str(error))
        except ValueError as error:
            return unavailable(str(error))
        except Exception as error:
            return unavailable(f"Forecast model unavailable: {error}")

        predictions: dict[str, int] = {}
        categories: dict[str, str] = {}
        for horizon, model in models.items():
            predicted_aqi = float(model.predict(latest[FEATURE_COLUMNS])[0])
            clipped = int(round(float(np.clip(predicted_aqi, 0, 500))))
            predictions[horizon] = clipped
            categories[horizon] = aqi_category(clipped)

        latest_aqi = int(round(float(latest["AQI"].iloc[0])))
        latest_timestamp = latest["timestamp"].iloc[0]
        station = str(latest["station_name"].iloc[0])

        return {
            "provider": MODEL_PROVIDER,
            "modelVersion": MODEL_VERSION,
            "stationName": station,
            "city": CITY,
            "latestAvailableTimestamp": latest_timestamp.isoformat()
            if hasattr(latest_timestamp, "isoformat")
            else str(latest_timestamp),
            "latestAvailableAqi": latest_aqi,
            "predictions": predictions,
            "categories": categories,
            "spikeRisk": spike_risk(latest_aqi, predictions["24h"]),
            "confidenceNote": CONFIDENCE_NOTE,
            "sourceNote": SOURCE_NOTE,
            "generatedAt": generated_at(),
        }


engine = ForecastEngine()
