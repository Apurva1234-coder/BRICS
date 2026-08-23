import assert from "node:assert/strict";
import { validateLiveCameraCapture, CaptureValidationError } from "../server/services/captureValidation.js";

const now = Date.now();
const valid = {
  imageMimeType: "image/jpeg",
  width: 1280,
  height: 720,
  captureMethod: "live_camera",
  cameraFacingMode: "environment",
  photoCapturedAt: new Date(now).toISOString(),
  captureLocation: {
    lat: 18.5204,
    lng: 73.8567,
    accuracyMeters: 24,
    capturedAt: new Date(now).toISOString()
  }
};

assert.equal(validateLiveCameraCapture(valid, now).captureMethod, "live_camera");
assert.throws(() => validateLiveCameraCapture({ ...valid, captureMethod: "upload" }, now), (error: unknown) => error instanceof CaptureValidationError && error.reasonCode === "invalid_capture_method");
assert.throws(() => validateLiveCameraCapture({ ...valid, imageMimeType: "image/png" }, now), (error: unknown) => error instanceof CaptureValidationError && error.reasonCode === "camera_image_required");
assert.throws(() => validateLiveCameraCapture({ ...valid, captureLocation: { ...valid.captureLocation, accuracyMeters: 151 } }, now), (error: unknown) => error instanceof CaptureValidationError && error.reasonCode === "gps_accuracy_too_low");
assert.throws(() => validateLiveCameraCapture({ ...valid, captureLocation: { ...valid.captureLocation, capturedAt: new Date(now - 31_000).toISOString() } }, now), (error: unknown) => error instanceof CaptureValidationError && error.reasonCode === "stale_capture_location");
console.log("capture validation tests passed");
