import { Router } from "express";
import { getSatelliteMap } from "../services/satelliteService.js";

export const satellitePollutionRouter = Router();

satellitePollutionRouter.post("/satellite", async (req, res) => {
  const { country, pollutant, startDate, endDate } = req.body || {};
  try {
    if (typeof country !== "string" || typeof pollutant !== "string" || typeof startDate !== "string" || typeof endDate !== "string") {
      return res.status(400).json({ error: "country, pollutant, startDate, and endDate are required." });
    }
    return res.json(await getSatelliteMap({ country, pollutant: pollutant as any, startDate, endDate }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Satellite data could not be loaded.";
    const status = message.includes("NOT_CONFIGURED") ? 503 : 400;
    return res.status(status).json({ error: status === 503 ? "Satellite service is not configured." : "Satellite data could not be loaded." });
  }
});
