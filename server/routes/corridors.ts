import { Router } from "express";
import {
  getAllEconomicCorridors,
  getEconomicCorridorById,
  getEconomicCorridorsForCountry
} from "../data/bricsEconomicCorridors.js";
import {
  predictEconomicCorridorImpact,
  getActiveCorridorPredictions,
  getAffectedCorridors,
  getCorridorPredictionById
} from "../services/economicCorridorService.js";
import type { CorridorImpactInput } from "../types.js";

export const corridorsRouter = Router();

// GET /api/corridors — List all registered BRICS economic corridors
corridorsRouter.get("/", (req, res) => {
  try {
    const country = req.query.country as string | undefined;
    const corridors = country
      ? getEconomicCorridorsForCountry(country)
      : getAllEconomicCorridors();

    res.json({
      success: true,
      count: corridors.length,
      corridors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/corridors/affected — All currently affected economic corridors
corridorsRouter.get("/affected", (_req, res) => {
  try {
    const affected = getAffectedCorridors();
    res.json({
      success: true,
      count: affected.length,
      affectedCorridors: affected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/corridors/active-predictions — All active predictions
corridorsRouter.get("/active-predictions", (_req, res) => {
  try {
    const predictions = getActiveCorridorPredictions();
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

// GET /api/corridors/:corridorId — Specific corridor details + active impact prediction
corridorsRouter.get("/:corridorId", (req, res) => {
  try {
    const corridor = getEconomicCorridorById(req.params.corridorId);
    if (!corridor) {
      return res.status(404).json({ error: `Corridor '${req.params.corridorId}' not found.` });
    }

    const activePrediction = getCorridorPredictionById(req.params.corridorId);

    res.json({
      success: true,
      corridor,
      activePrediction: activePrediction || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/corridors/predict-impact — Calculate economic corridor impact from pollution source
corridorsRouter.post("/predict-impact", async (req, res) => {
  try {
    const {
      corridorId,
      sourceLatitude,
      sourceLongitude,
      sourceLocality,
      sourceCountryCode,
      initialPm2_5,
      initialSeverity,
      pollutionType,
      horizonHours,
      propagationResult,
      eventId
    } = req.body;

    if (!propagationResult && (sourceLatitude === undefined || sourceLongitude === undefined) && !eventId) {
      return res.status(400).json({
        error: "Must provide either 'propagationResult', 'eventId', or ('sourceLatitude' and 'sourceLongitude')."
      });
    }

    const input: CorridorImpactInput = {
      corridorId,
      sourceLatitude: Number(sourceLatitude || 0),
      sourceLongitude: Number(sourceLongitude || 0),
      sourceLocality,
      sourceCountryCode,
      initialPm2_5: initialPm2_5 ? Number(initialPm2_5) : undefined,
      initialSeverity,
      pollutionType,
      horizonHours: horizonHours ? Number(horizonHours) : 18,
      propagationResult,
      eventId
    };

    const predictions = await predictEconomicCorridorImpact(input);

    res.json({
      success: true,
      count: predictions.length,
      predictions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
