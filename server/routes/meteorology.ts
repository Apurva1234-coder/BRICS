import { Router } from "express";
import {
  getMeteorologyForCoordinates,
  getHourlyForecastForCoordinates,
  predictMovement,
  getEventMeteorology
} from "../services/meteorologyService.js";
import { getFederationEvents } from "../services/bricsFederationService.js";

export const meteorologyRouter = Router();

// GET /api/meteorology — Current normalized meteorological conditions
meteorologyRouter.get("/", async (req, res) => {
  try {
    const { latitude, longitude, timestamp } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required query parameters: 'latitude' and 'longitude'." });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Invalid 'latitude' or 'longitude' numeric format." });
    }

    const meteorology = await getMeteorologyForCoordinates(
      lat,
      lng,
      typeof timestamp === "string" ? timestamp : undefined
    );

    res.json(meteorology);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/meteorology/forecast — Hourly forecast for movement analysis
meteorologyRouter.get("/forecast", async (req, res) => {
  try {
    const { latitude, longitude, horizonHours } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required query parameters: 'latitude' and 'longitude'." });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const horizon = horizonHours ? Number(horizonHours) : 6;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Invalid 'latitude' or 'longitude' numeric format." });
    }

    const result = await getHourlyForecastForCoordinates(lat, lng, horizon);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/meteorology/event/:eventId — Meteorological context for a specific pollution event
meteorologyRouter.get("/event/:eventId", async (req, res) => {
  try {
    const horizon = req.query.horizonHours ? Number(req.query.horizonHours) : 6;
    const result = await getEventMeteorology(req.params.eventId, horizon);
    res.json({
      success: true,
      eventId: req.params.eventId,
      meteorology: result.meteorology,
      prediction: result.prediction,
      source: result.meteorology.source,
      dataStatus: result.meteorology.dataStatus
    });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
});

// POST /api/meteorology/predict-movement — Compute wind-based movement trajectory
meteorologyRouter.post("/predict-movement", async (req, res) => {
  try {
    const { eventId, latitude, longitude, timestamp, horizonHours } = req.body;

    let targetLat = latitude;
    let targetLng = longitude;
    let targetTime = timestamp;

    // If eventId was provided, look up coordinates from event store
    if (eventId && (targetLat === undefined || targetLng === undefined)) {
      const events = getFederationEvents({ limit: 100 });
      const found = events.find((e) => e.eventId === eventId);
      if (!found) {
        return res.status(404).json({ error: `Event '${eventId}' not found in registry.` });
      }
      targetLat = found.latitude;
      targetLng = found.longitude;
      targetTime = found.timestamp;
    }

    if (targetLat === undefined || targetLng === undefined) {
      return res.status(400).json({ error: "Must specify either 'eventId' or both 'latitude' and 'longitude'." });
    }

    const lat = Number(targetLat);
    const lng = Number(targetLng);
    const horizon = horizonHours ? Number(horizonHours) : 6;

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ error: "Invalid 'latitude': must be a number between -90 and 90." });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Invalid 'longitude': must be a number between -180 and 180." });
    }
    if (horizon < 1 || horizon > 24) {
      return res.status(400).json({ error: "Invalid 'horizonHours': must be between 1 and 24 hours." });
    }

    const result = await predictMovement({
      latitude: lat,
      longitude: lng,
      timestamp: targetTime,
      horizonHours: horizon
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
