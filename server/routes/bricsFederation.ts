import { Router } from "express";
import {
  getFederationNodes,
  getNodeById,
  registerOrHeartbeatNode,
  publishFederationEvent,
  getFederationEvents,
  getEventsRelevantToCountry,
  getFederationStatus,
  executeLiveFederationExchange
} from "../services/bricsFederationService.js";
import type { BricsCountryCode } from "../types.js";

export const bricsFederationRouter = Router();

// GET /api/brics/federation/nodes — List all registered BRICS country nodes
bricsFederationRouter.get("/nodes", (_req, res) => {
  try {
    const nodes = getFederationNodes();
    res.json({
      success: true,
      nodes,
      count: nodes.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/brics/federation/nodes/:nodeId — Retrieve specific country node details
bricsFederationRouter.get("/nodes/:nodeId", (req, res) => {
  try {
    const node = getNodeById(req.params.nodeId);
    if (!node) {
      return res.status(404).json({ error: `Country node '${req.params.nodeId}' not found in BRICS registry.` });
    }
    res.json({ success: true, node });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/brics/federation/nodes/register — Register or heartbeat a country node
bricsFederationRouter.post("/nodes/register", (req, res) => {
  try {
    const { countryCode, nodeId, countryName, endpointUrl, geographicRegion, supportedDataSources, contactEmail } = req.body;
    if (!countryCode) {
      return res.status(400).json({ error: "Missing required 'countryCode' parameter." });
    }
    const node = registerOrHeartbeatNode({
      countryCode: countryCode.toUpperCase() as BricsCountryCode,
      nodeId,
      countryName,
      endpointUrl,
      geographicRegion,
      supportedDataSources,
      contactEmail
    });
    res.status(200).json({ success: true, node, message: `Node '${node.nodeId}' synchronized.` });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/brics/federation/events — Submit/publish a standardized environmental event
bricsFederationRouter.post("/events", (req, res) => {
  try {
    const event = publishFederationEvent(req.body);
    res.status(201).json({
      success: true,
      event,
      message: `Standardized event '${event.eventId}' published to BRICS federation.`
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/brics/federation/events — Retrieve shared events with optional filters
bricsFederationRouter.get("/events", (req, res) => {
  try {
    const { country, targetCountry, severity, pollutionType, limit, since } = req.query;
    const events = getFederationEvents({
      country: typeof country === "string" ? country : undefined,
      targetCountry: typeof targetCountry === "string" ? targetCountry : undefined,
      severity: typeof severity === "string" ? severity : undefined,
      pollutionType: typeof pollutionType === "string" ? pollutionType : undefined,
      limit: typeof limit === "string" ? Number(limit) : undefined,
      since: typeof since === "string" ? since : undefined
    });
    res.json({
      success: true,
      events,
      count: events.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/brics/federation/events/relevant/:countryCode — Retrieve events relevant to a specific country node
bricsFederationRouter.get("/events/relevant/:countryCode", (req, res) => {
  try {
    const result = getEventsRelevantToCountry(req.params.countryCode);
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/brics/federation/status — Check federation health & data-exchange status
bricsFederationRouter.get("/status", (_req, res) => {
  try {
    const status = getFederationStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/brics/federation/exchange-live — Authenticated live end-to-end exchange pipeline
bricsFederationRouter.post("/exchange-live", async (req, res) => {
  try {
    const result = await executeLiveFederationExchange(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});
