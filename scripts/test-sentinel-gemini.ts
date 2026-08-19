import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile("server/services/geminiSatelliteComparisonService.ts", "utf8");
const verifier = await readFile("server/services/satelliteVerificationService.ts", "utf8");
assert.match(verifier, /IMAGE 1/); assert.match(verifier, /IMAGE 2/); assert.match(source, /Do not infer AQI/); assert.match(source, /inlineData/); assert.match(source, /responseSchema/);
console.log("sentinel Gemini labels, multimodal parts, and schema contract: ok");
