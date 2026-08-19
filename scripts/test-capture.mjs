import fs from "node:fs";

const reportPage = fs.readFileSync("src/pages/ReportPage.tsx", "utf8");
const reportService = fs.readFileSync("src/services/reportService.ts", "utf8");
const validator = fs.readFileSync("server/services/captureValidation.ts", "utf8");
const uploader = fs.existsSync("src/components/PhotoUploader.tsx") ? fs.readFileSync("src/components/PhotoUploader.tsx", "utf8") : "";

const checks = [
  ["public report has no file input", !reportPage.includes("type=\"file\"") && !uploader.includes("type=\"file\"")],
  ["public report uses live_camera", reportPage.includes('captureMethod: "live_camera"') && reportService.includes("captureMethod")],
  ["capture freezes GPS at shutter", reportPage.includes("const fix: CaptureLocationFix") && reportPage.includes("captureLocation: { ...fix")],
  ["backend rejects non-camera captures", validator.includes("invalid_capture_method") && validator.includes("capture_method_required")],
  ["backend checks GPS freshness and accuracy", validator.includes("stale_capture_location") && validator.includes("gps_accuracy_too_low")],
  ["authenticity recognizes live camera", fs.readFileSync("server/services/authenticityService.ts", "utf8").includes('captureMethod !== "live_camera"')]
];
const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length) throw new Error(`Capture contract failed: ${failed.join(", ")}`);
console.log(`capture contract passed: ${checks.length} checks.`);
