import assert from "node:assert/strict";
import { classifySatelliteEventSuitability } from "../server/services/satelliteSuitability.js";
assert.equal(classifySatelliteEventSuitability("vehicle_smoke").suitability, "not_suitable");
assert.equal(classifySatelliteEventSuitability("garbage_burning").suitability, "partially_suitable");
console.log("sentinel event suitability contract: ok");
