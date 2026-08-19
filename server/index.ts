import "./configureEnv.js";
import { onRequest } from "firebase-functions/v2/https";
import cors from "cors";
import express from "express";
import path from "node:path";
import { reportsRouter } from "./routes/reports.js";
import { satelliteRouter } from "./routes/satellite.js";
import { validateEnv } from "./utils/env.js";
import { aiDebugLimiter, generalApiLimiter, reportSubmissionLimiter } from "./middleware/rateLimits.js";
// Initialize Firebase Admin SDK at startup (logs auth mode: Firestore vs in-memory)
import { getAdminApp } from "./services/adminApp.js";
import { requireAuthenticatedUser } from "./middleware/requireRole.js";
import { localMediaRoot } from "./services/mediaStorageService.js";
getAdminApp();


export const app = express();
validateEnv();
const port = Number(process.env.PORT || 8080);
const browserStorageDemo = process.env.VITE_DEMO_BROWSER_STORAGE === "true";

// Netlify forwards the client address through one proxy. This prevents all
// visitors being counted as the serverless function's internal address.
app.set("trust proxy", 1);
app.use(cors({ origin: true }));
app.use(express.json({ limit: "6mb" }));
if (!browserStorageDemo) app.use("/media", express.static(localMediaRoot(), { immutable: true, maxAge: "1d" }));
app.get("/media/*", (_req, res) => {
  res.status(404).json({ error: browserStorageDemo ? "Browser demo evidence is stored in IndexedDB and is not served by this API." : "Media file not found.", reasonCode: "media_not_found" });
});
app.use("/api/reports", (req, res, next) => {
  if (req.method === "POST" && req.path === "/") return reportSubmissionLimiter(req, res, next);
  return next();
});
app.use("/api/analyze-report", reportSubmissionLimiter);
app.use("/api/debug/gemini-image", aiDebugLimiter);
app.use("/api", generalApiLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cleanair-local-sentinel" });
});
app.get("/api/auth/me", requireAuthenticatedUser, (req, res) => res.json({ uid: req.auth!.uid, role: req.auth!.role, ...(req.auth!.municipalTeamId ? { municipalTeamId: req.auth!.municipalTeamId } : {}) }));

app.use("/api", reportsRouter);
app.use("/api", satelliteRouter);

app.use(express.static(path.join(process.cwd(), "dist")));

app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/")) {
    console.log(`[404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "Not Found" });
  } else {
    res.sendFile(path.join(process.cwd(), "dist", "index.html"));
  }
});

// Export as Firebase Function
export const api = onRequest({ cors: true, region: "us-central1" }, app);

// Start server locally if not running in Firebase Functions emulator
if (!process.env.FUNCTIONS_EMULATOR && process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.listen(port, "0.0.0.0", () => {
    console.log(`CleanAir API listening on port ${port} (0.0.0.0)`);
  });
}
