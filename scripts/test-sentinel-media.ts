import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

process.env.NODE_ENV = "test";
process.env.LOCAL_MEDIA_ROOT = await mkdtemp(path.join(os.tmpdir(), "cleanair-sentinel-media-"));

const { storeSatelliteMedia } = await import("../server/services/mediaStorageService.js");
const { app } = await import("../server/index.js");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+JtZrAAAAAElFTkSuQmCC", "base64");
const server = app.listen(0, "127.0.0.1");

try {
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  const stored = await storeSatelliteMedia({ reportId: "report:123", filename: "near colour.png", buffer: png, mimeType: "image/png" });
  const storedAgain = await storeSatelliteMedia({ reportId: "report:123", filename: "near colour.png", buffer: png, mimeType: "image/png" });
  assert.equal(stored.storagePath, "reports/report-123/satellite/near-colour.png");
  assert.equal(storedAgain.storagePath, stored.storagePath, "satellite product paths must be deterministic");
  assert.equal(stored.sizeBytes, png.length);
  assert.equal(stored.sha256Hash.length, 64);
  const image = await fetch(`http://127.0.0.1:${port}${stored.displayUrl}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const missing = await fetch(`http://127.0.0.1:${port}/media/reports/report-123/satellite/missing.png`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "Media file not found.", reasonCode: "media_not_found" });
  console.log("sentinel media storage and media 404 behavior: ok");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(process.env.LOCAL_MEDIA_ROOT!, { recursive: true, force: true });
}
