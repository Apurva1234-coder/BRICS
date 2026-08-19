import { readFile } from "node:fs/promises";

const appUrl = process.env.APP_URL || "http://localhost:5173";
const apiUrl = process.env.API_URL || "http://localhost:8787";

const whitePng =
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA/klEQVR4nO3QQQ3AIADAQEDmVQIkybDkAzbYwJf2a/evwNsDZp0B8D8mBgaGgYFhYGBYbA4MDAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8DAMDw8BgYGAaGgYFhYGAYGBgYhgEAMeYBO6+g8/IAAAAASUVORK5CYII=";

async function expectOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response;
}

await expectOk(`${appUrl}/`);
await expectOk(`${apiUrl}/api/health`);

const sourceFiles = [
  "src/pages/NearbyPage.tsx",
  "src/pages/ReportPage.tsx",
  "src/services/reportService.ts",
  "server/services/geminiService.ts"
];
for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  if (/\bdemo\b|\bmock\b|\bsample\b/i.test(text)) {
    throw new Error(`${file} still contains demo/mock/sample wording.`);
  }
}

const publicAirFiles = [
  "src/components/CpcbLayerPanel.tsx",
  "src/components/LocalLeafletMap.tsx",
  "src/components/MapWorkspace.tsx",
  "src/components/ForecastPanel.tsx"
];
for (const file of publicAirFiles) {
  const text = await readFile(file, "utf8");
  if (/Stations Loaded|Records Loaded|Pages Fetched|Total Available|cpcb\.title|cpcb\.subtitle/.test(text)) {
    throw new Error(`${file} exposes raw air-ingestion diagnostics in the public surface.`);
  }
  if (/cpcb-station-missing|stateAqiLabelIcon|mode === ["']cpcb["']/.test(text)) {
    throw new Error(`${file} still exposes missing-station or state-label marker clutter.`);
  }
  if (/predictions\[[^\]]+\]\s*\?\?\s*["'](?:–|-)["']/.test(text)) {
    throw new Error(`${file} renders an empty forecast placeholder.`);
  }
}

const mapLayout = await readFile("scripts/test-air-map-layout.mjs", "utf8");
if (!mapLayout.includes("Air map layout assertions passed")) {
  throw new Error("Air map layout assertions are missing from the smoke suite.");
}

import crypto from "node:crypto";

const whitePngHash = crypto.createHash("sha256").update(Buffer.from(whitePng, "base64")).digest("hex");

const beforeReports = await (await expectOk(`${apiUrl}/api/reports`)).json();
const response = await fetch(`${apiUrl}/api/reports`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    lat: 18.5912,
    lng: 73.7389,
    areaText: "Smoke test",
    imageHash: whitePngHash,
    imageBase64: whitePng,
    originalBase64: whitePng,
    imageMimeType: "image/png",
    userDescription: "This is not pollution.",
    userId: "smoke-test"
  })
});

if (response.status !== 400) {
  throw new Error(`Wrong photo was not rejected. Status: ${response.status}. Body: ${await response.text()}`);
}

const afterReports = await (await expectOk(`${apiUrl}/api/reports`)).json();
if (afterReports.length !== beforeReports.length) {
  throw new Error("Rejected photo changed the report queue.");
}

console.log("Smoke test passed: app/API load, wrong photo is rejected, no ticket is created.");
