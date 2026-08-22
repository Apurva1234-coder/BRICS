import { Router } from "express";
import {
  getAllRegulatoryAuthorities,
  getRegulatoryAuthoritiesByCountry,
  getRegulatoryAuthorityById
} from "../data/bricsAuthorities.js";
import {
  getRegulatoryAlerts,
  getRegulatoryAlertById,
  createRegulatoryAlert,
  acknowledgeRegulatoryAlert,
  assignResourceToAlert,
  updateRegulatoryAlertStatus,
  resolveRegulatoryAlert,
  getRegulatoryResources
} from "../services/regulatoryCoordinationService.js";
import type { AlertResponseStatus, PropagationImpactLevel, CreateRegulatoryAlertInput } from "../types.js";

export const regulatoryRouter = Router();

// GET /api/authorities — List all registered authorities
regulatoryRouter.get("/authorities", (req, res) => {
  try {
    const country = req.query.country as string | undefined;
    const authorities = country
      ? getRegulatoryAuthoritiesByCountry(country)
      : getAllRegulatoryAuthorities();

    res.json({
      success: true,
      count: authorities.length,
      authorities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/alerts — List all regulatory alerts
regulatoryRouter.get("/alerts", (req, res) => {
  try {
    const status = req.query.status as AlertResponseStatus | undefined;
    const countryCode = req.query.country as string | undefined;
    const riskLevel = req.query.risk as PropagationImpactLevel | undefined;

    const alerts = getRegulatoryAlerts({ status, countryCode, riskLevel });

    res.json({
      success: true,
      count: alerts.length,
      alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/alerts — Create a new regulatory alert
regulatoryRouter.post("/alerts", (req, res) => {
  try {
    const input: CreateRegulatoryAlertInput = req.body;

    if (!input.sourceCountry || !input.affectedCountry || !input.affectedRegion) {
      return res.status(400).json({
        error: "Must provide 'sourceCountry', 'affectedCountry', and 'affectedRegion'."
      });
    }

    const alert = createRegulatoryAlert(input);

    res.status(201).json({
      success: true,
      alert,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/alerts/:id — Get specific alert by ID
regulatoryRouter.get("/alerts/:id", (req, res) => {
  try {
    const alert = getRegulatoryAlertById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: `Alert '${req.params.id}' not found.` });
    }

    res.json({
      success: true,
      alert,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/alerts/:id/acknowledge — Acknowledge alert
regulatoryRouter.post("/alerts/:id/acknowledge", (req, res) => {
  try {
    const { actor, notes } = req.body;
    const alert = acknowledgeRegulatoryAlert(req.params.id, actor, notes);

    res.json({
      success: true,
      alert,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/alerts/:id/assign — Assign resource to alert
regulatoryRouter.post("/alerts/:id/assign", (req, res) => {
  try {
    const { resourceId, actor, notes } = req.body;
    if (!resourceId) {
      return res.status(400).json({ error: "Must provide 'resourceId' to assign." });
    }

    const alert = assignResourceToAlert(req.params.id, resourceId, actor, notes);

    res.json({
      success: true,
      alert,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/alerts/:id/status — Update alert response status
regulatoryRouter.post("/alerts/:id/status", (req, res) => {
  try {
    const { status, actor, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Must provide 'status'." });
    }

    const alert = updateRegulatoryAlertStatus(req.params.id, status as AlertResponseStatus, actor, notes);

    res.json({
      success: true,
      alert,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/alerts/:id/resolve — Mark alert as resolved
regulatoryRouter.post("/alerts/:id/resolve", (req, res) => {
  try {
    const { resolutionNotes, actor } = req.body;
    if (!resolutionNotes) {
      return res.status(400).json({ error: "Must provide 'resolutionNotes'." });
    }

    const alert = resolveRegulatoryAlert(req.params.id, resolutionNotes, actor);

    res.json({
      success: true,
      alert,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/resources — List all deployable response resources
regulatoryRouter.get("/resources", (req, res) => {
  try {
    const authorityId = req.query.authorityId as string | undefined;
    const country = req.query.country as string | undefined;

    const resources = getRegulatoryResources(authorityId, country);

    res.json({
      success: true,
      count: resources.length,
      resources,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
