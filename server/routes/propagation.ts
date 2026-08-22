import { Router } from "express";
import {
  executePropagationSimulation,
  getActiveCrossBorderPredictions,
  getIncomingPlumesForCountry,
  getAffectedCountriesSummary
} from "../services/crossBorderPropagationService.js";
import { getFederationEvents } from "../services/bricsFederationService.js";
import type { PropagationInput } from "../types.js";

export const propagationRouter = Router();

// POST /api/propagation/predict — Run cross-border propagation simulation
propagationRouter.post("/predict", async (req, res) => {
  try {
    const {
      eventId,
      sourceLatitude,
      sourceLongitude,
      sourceCountryCode,
      sourceLocality,
      initialPm2_5,
      initialAqi,
      initialSeverity,
      pollutionType,
      timestamp,
      horizonHours,
      timeStepHours
    } = req.body;

    let targetLat = sourceLatitude !== undefined ? Number(sourceLatitude) : undefined;
    let targetLng = sourceLongitude !== undefined ? Number(sourceLongitude) : undefined;
    let targetCountry = sourceCountryCode;
    let targetLocality = sourceLocality;
    let targetPm25 = initialPm2_5 !== undefined ? Number(initialPm2_5) : undefined;
    let targetTime = timestamp;
    let targetSeverity = initialSeverity;
    let targetType = pollutionType;

    // If eventId was provided and coordinates missing, load from federation registry
    if (eventId && (targetLat === undefined || targetLng === undefined)) {
      const events = getFederationEvents({ limit: 100 });
      const found = events.find((e) => e.eventId === eventId);
      if (!found) {
        return res.status(404).json({ error: `Event '${eventId}' not found in BRICS federation pool.` });
      }
      targetLat = found.latitude;
      targetLng = found.longitude;
      targetCountry = targetCountry || found.sourceCountry;
      targetLocality = targetLocality || found.locality;
      targetPm25 = targetPm25 || found.pollutantValues.pm2_5;
      targetTime = targetTime || found.timestamp;
      targetSeverity = targetSeverity || found.severity;
      targetType = targetType || found.pollutionType;
    }

    if (targetLat === undefined || targetLng === undefined) {
      return res.status(400).json({ error: "Must provide either 'eventId' or both 'sourceLatitude' and 'sourceLongitude'." });
    }

    if (!Number.isFinite(targetLat) || targetLat < -90 || targetLat > 90) {
      return res.status(400).json({ error: "Invalid 'sourceLatitude': must be between -90 and 90." });
    }
    if (!Number.isFinite(targetLng) || targetLng < -180 || targetLng > 180) {
      return res.status(400).json({ error: "Invalid 'sourceLongitude': must be between -180 and 180." });
    }

    const input: PropagationInput = {
      sourceLatitude: targetLat,
      sourceLongitude: targetLng,
      sourceCountryCode: targetCountry,
      sourceLocality: targetLocality,
      initialPm2_5: targetPm25,
      initialAqi: initialAqi ? Number(initialAqi) : undefined,
      initialSeverity: targetSeverity,
      pollutionType: targetType,
      timestamp: targetTime,
      horizonHours: horizonHours ? Number(horizonHours) : 12,
      timeStepHours: timeStepHours ? Number(timeStepHours) : 1,
      meteorology: req.body.meteorology,
      hourlyForecast: req.body.hourlyForecast,
      eventId
    };

    const result = await executePropagationSimulation(input);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/propagation/events — All active cross-border pollution predictions
propagationRouter.get("/events", (_req, res) => {
  try {
    const predictions = getActiveCrossBorderPredictions();
    res.json({
      success: true,
      count: predictions.length,
      predictions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/propagation/affected-countries — Summary of countries receiving cross-border plumes
propagationRouter.get("/affected-countries", (_req, res) => {
  try {
    const summary = getAffectedCountriesSummary();
    res.json({
      success: true,
      count: summary.length,
      affectedCountries: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/propagation/incoming/:countryCode — Incoming plumes targeting a specific country
propagationRouter.get("/incoming/:countryCode", (req, res) => {
  try {
    const incoming = getIncomingPlumesForCountry(req.params.countryCode);
    res.json({
      success: true,
      countryCode: req.params.countryCode.toUpperCase(),
      count: incoming.length,
      incomingPlumes: incoming,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/propagation/event/:eventId — Propagation analysis for an existing federation event
propagationRouter.get("/event/:eventId", async (req, res) => {
  try {
    const horizon = req.query.horizonHours ? Number(req.query.horizonHours) : 12;
    const events = getFederationEvents({ limit: 100 });
    const event = events.find((e) => e.eventId === req.params.eventId);

    if (!event) {
      return res.status(404).json({ error: `Event '${req.params.eventId}' not found in BRICS federation pool.` });
    }

    const input: PropagationInput = {
      sourceLatitude: event.latitude,
      sourceLongitude: event.longitude,
      sourceCountryCode: event.sourceCountry,
      sourceLocality: event.locality,
      initialPm2_5: event.pollutantValues.pm2_5,
      initialAqi: event.pollutantValues.aqi,
      initialSeverity: event.severity,
      pollutionType: event.pollutionType,
      timestamp: event.timestamp,
      horizonHours: horizon,
      eventId: event.eventId
    };

    const result = await executePropagationSimulation(input);
    res.json({
      success: true,
      event,
      propagation: result
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
