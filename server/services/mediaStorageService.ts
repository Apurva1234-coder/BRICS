import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { getStorage } from "firebase-admin/storage";
import type { CaptureEvidence, MediaEvidence, PollutionReport } from "../types.js";
import { getAdminApp } from "./adminApp.js";

export class MediaStorageUnavailableError extends Error {
  readonly code = "MEDIA_STORAGE_UNAVAILABLE";
  constructor() {
    super("Report media storage is temporarily unavailable. Please try again.");
    this.name = "MediaStorageUnavailableError";
  }
}

function requiresCloudStorage() {
  const serverless = process.env.NODE_ENV === "production" || Boolean(process.env.NETLIFY) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  return serverless && process.env.PROTOTYPE_LOCAL_MEDIA !== "true" && !process.env.LOCAL_MEDIA_ROOT?.trim();
}

export function localMediaRoot() {
  const configured = process.env.LOCAL_MEDIA_ROOT?.trim();
  if (configured) return path.resolve(configured);
  return process.env.NODE_ENV === "production" || process.env.FUNCTIONS_EMULATOR
    ? path.join("/tmp", "media")
    : path.join(process.cwd(), "storage", "media");
}
const MAX_MEDIA_BYTES = 2_500_000;
const DISPLAY_URL_TTL_MS = 24 * 60 * 60 * 1000;

function extensionFor(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "video/mp4") return "mp4";
  return "jpg";
}

function decodeBase64(data: string) {
  const cleaned = data.includes(",") ? data.split(",").pop() || "" : data;
  return Buffer.from(cleaned, "base64");
}

function ensureSupported(mimeType: string, sizeBytes: number) {
  const valid = ["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(mimeType);
  if (!valid) throw new Error("Unsupported media type. Upload a JPEG, PNG, WebP, or MP4 evidence file.");
  if (sizeBytes <= 0) throw new Error("Uploaded media is empty.");
  if (sizeBytes > MAX_MEDIA_BYTES) throw new Error("Uploaded media is too large after compression.");
}

function firebaseBucket() {
  // An explicit local root is used by local development and deterministic tests.
  if (process.env.LOCAL_MEDIA_ROOT?.trim()) return null;
  if (process.env.ENABLE_FIREBASE_STORAGE !== "true") return null;
  const app = getAdminApp();
  if (!app) return null;
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET || "cleanair-sentinel.firebasestorage.app";
  return getStorage(app).bucket(bucketName);
}

function localMediaUrl(storagePath: string) {
  return `/media/${storagePath.replaceAll("\\", "/")}`;
}

async function localMediaExists(storagePath: string) {
  try {
    await access(path.join(localMediaRoot(), storagePath), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** Creates fresh response-time media URLs without changing stored reports. */
export async function refreshMediaDisplayUrl(media: MediaEvidence): Promise<MediaEvidence> {
  const localUrl = [media.displayUrl, media.publicUrl].find((url) => url?.startsWith("/media/"));
  if (localUrl) {
    return await localMediaExists(media.storagePath)
      ? { ...media, displayUrl: localUrl, publicUrl: localUrl }
      : { ...media, displayUrl: undefined, publicUrl: undefined };
  }

  const isFirebaseMedia = media.storageProvider === "firebase_storage" || media.cloudUri?.startsWith("gs://");
  if (isFirebaseMedia && media.storagePath) {
    const bucket = firebaseBucket();
    if (bucket) {
      try {
        const [displayUrl] = await bucket.file(media.storagePath).getSignedUrl({
          action: "read",
          expires: Date.now() + DISPLAY_URL_TTL_MS
        });
        return { ...media, displayUrl, publicUrl: displayUrl };
      } catch {
        console.warn(`[Storage] Could not refresh media URL for ${media.mediaId}.`);
      }
    }
    return { ...media, displayUrl: undefined, publicUrl: undefined };
  }

  if (media.storagePath) {
    const displayUrl = localMediaUrl(media.storagePath);
    if (!await localMediaExists(media.storagePath)) {
      return { ...media, displayUrl: undefined, publicUrl: undefined, storageProvider: "local_dev" };
    }
    return { ...media, displayUrl, publicUrl: displayUrl, storageProvider: "local_dev" };
  }

  return { ...media, displayUrl: undefined, publicUrl: undefined };
}

export async function hydrateReportMediaUrls(report: PollutionReport): Promise<PollutionReport> {
  const media = await Promise.all((report.media ?? []).map(refreshMediaDisplayUrl));
  const primary = report.primaryMediaId ? media.find((item) => item.mediaId === report.primaryMediaId) : media[0];
  const cleanupProof = report.cleanupProof
    ? { ...report.cleanupProof, afterMedia: await refreshMediaDisplayUrl(report.cleanupProof.afterMedia) }
    : undefined;
  const resolutionProof = report.resolutionProof
    ? {
        ...report.resolutionProof,
        ...(report.resolutionProof.afterMedia
          ? { afterMedia: await refreshMediaDisplayUrl(report.resolutionProof.afterMedia) }
          : {})
      }
    : undefined;

  return {
    ...report,
    media,
    imageUrl: primary?.displayUrl,
    ...(cleanupProof ? { cleanupProof } : {}),
    ...(resolutionProof ? { resolutionProof } : {})
  };
}

export async function hydrateReportsMediaUrls(reports: readonly PollutionReport[]): Promise<PollutionReport[]> {
  return Promise.all(reports.map(hydrateReportMediaUrls));
}


async function uploadFirebase(pathname: string, buffer: Buffer, mimeType: string) {
  const bucket = firebaseBucket();
  if (!bucket) return undefined;
  try {
    const file = bucket.file(pathname);
    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
      metadata: { cacheControl: "private, max-age=3600" }
    });
    const [displayUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000
    });
    return {
      cloudUri: `gs://${bucket.name}/${pathname}`,
      displayUrl
    };
  } catch (err) {
    console.warn("[Storage] Firebase upload failed; using local media storage.");
    return undefined;
  }
}

async function uploadLocal(pathname: string, buffer: Buffer) {
  const absolutePath = path.join(localMediaRoot(), pathname);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  return `/media/${pathname.replaceAll("\\", "/")}`;
}

export function mediaHash(base64: string) {
  return createHash("sha256").update(decodeBase64(base64)).digest("hex");
}

export async function storeReportMedia(input: {
  reportId: string;
  mediaId: string;
  originalBase64: string;
  thumbnailBase64: string;
  mimeType: string;
  fileModifiedAt?: string;
  capturedAt?: string;
  width?: number;
  height?: number;
  exifAvailable?: boolean;
  captureEvidence?: CaptureEvidence;
}): Promise<MediaEvidence> {
  const original = decodeBase64(input.originalBase64);
  const thumbnail = decodeBase64(input.thumbnailBase64 || input.originalBase64);
  ensureSupported(input.mimeType, original.byteLength);

  const hash = createHash("sha256").update(original).digest("hex");
  const extension = extensionFor(input.mimeType);
  const storagePath = `reports/${input.reportId}/${input.mediaId}/original.${extension}`;
  const thumbnailPath = `reports/${input.reportId}/${input.mediaId}/thumbnail.jpg`;
  const warnings: string[] = [];
  if (!input.exifAvailable && !input.captureEvidence) warnings.push("no_exif_metadata");

  let publicUrl: string | undefined;
  let displayUrl: string | undefined;
  let cloudUri: string | undefined;
  let storageProvider: MediaEvidence["storageProvider"] = "local_dev";
  const firebaseOriginal = await uploadFirebase(storagePath, original, input.mimeType);
  const firebaseThumbnail = await uploadFirebase(thumbnailPath, thumbnail, "image/jpeg");
  if (firebaseOriginal && firebaseThumbnail) {
    storageProvider = "firebase_storage";
    cloudUri = firebaseOriginal.cloudUri;
    displayUrl = firebaseOriginal.displayUrl;
    publicUrl = displayUrl;
  } else {
    if (requiresCloudStorage()) throw new MediaStorageUnavailableError();
    displayUrl = await uploadLocal(storagePath, original);
    await uploadLocal(thumbnailPath, thumbnail);
    publicUrl = displayUrl;
  }

  return {
    mediaId: input.mediaId,
    type: input.mimeType.startsWith("video/") ? "video" : "photo",
    storagePath,
    cloudUri,
    thumbnailPath,
    publicUrl,
    displayUrl,
    storageProvider,
    mimeType: input.mimeType,
    sizeBytes: original.byteLength,
    sha256Hash: hash,
    uploadedAt: new Date().toISOString(),
    fileModifiedAt: input.fileModifiedAt,
    capturedAt: input.capturedAt,
    width: input.width,
    height: input.height,
    exifAvailable: input.exifAvailable,
    captureEvidence: input.captureEvidence,
    metadataWarnings: warnings
  };
}

export async function storeResolutionMedia(input: {
  reportId: string;
  imageBase64: string;
  mimeType: string;
}): Promise<MediaEvidence> {
  const buffer = decodeBase64(input.imageBase64);
  ensureSupported(input.mimeType, buffer.byteLength);
  const extension = extensionFor(input.mimeType);
  const storagePath = `reports/${input.reportId}/resolution/after.${extension}`;
  const hash = createHash("sha256").update(buffer).digest("hex");
  let publicUrl: string | undefined;
  let displayUrl: string | undefined;
  let cloudUri: string | undefined;
  let storageProvider: MediaEvidence["storageProvider"] = "local_dev";
  const firebaseOriginal = await uploadFirebase(storagePath, buffer, input.mimeType);
  if (firebaseOriginal) {
    storageProvider = "firebase_storage";
    cloudUri = firebaseOriginal.cloudUri;
    displayUrl = firebaseOriginal.displayUrl;
    publicUrl = displayUrl;
  } else {
    if (requiresCloudStorage()) throw new MediaStorageUnavailableError();
    displayUrl = await uploadLocal(storagePath, buffer);
    publicUrl = displayUrl;
  }

  return {
    mediaId: "RES-AFTER",
    type: input.mimeType.startsWith("video/") ? "video" : "photo",
    storagePath,
    cloudUri,
    publicUrl,
    displayUrl,
    storageProvider,
    mimeType: input.mimeType,
    sizeBytes: buffer.byteLength,
    sha256Hash: hash,
    uploadedAt: new Date().toISOString(),
    exifAvailable: false,
    metadataWarnings: ["no_exif_metadata"]
  };
}

export type StoredSatelliteMedia = {
  storagePath: string;
  cloudUri?: string;
  displayUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  createdAt: string;
};

function safeSatelliteFilename(filename: string) {
  const parsed = path.parse(filename);
  const stem = parsed.name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "product";
  const extension = [".png", ".jpg", ".jpeg", ".webp"].includes(parsed.ext.toLowerCase()) ? parsed.ext.toLowerCase() : ".png";
  return `${stem}${extension}`;
}

export async function storeSatelliteMedia(input: {
  buffer: Buffer;
  reportId: string;
  filename: string;
  mimeType?: string;
}): Promise<StoredSatelliteMedia> {
  const { buffer, reportId, filename } = input;
  const mimeType = input.mimeType || "image/png";
  if (!/^image\/(png|jpeg|webp)$/.test(mimeType)) throw new Error("Satellite products must be stored as PNG, JPEG, or WebP images.");
  if (!buffer.byteLength) throw new Error("Satellite product is empty.");
  const safeReportId = reportId.replace(/[^a-zA-Z0-9_-]/g, "-");
  if (!safeReportId) throw new Error("Satellite report ID is invalid.");
  const storagePath = `reports/${safeReportId}/satellite/${safeSatelliteFilename(filename)}`;
  const createdAt = new Date().toISOString();
  const sha256Hash = createHash("sha256").update(buffer).digest("hex");

  const firebaseRes = await uploadFirebase(storagePath, buffer, mimeType);
  if (firebaseRes) {
    return { storagePath, cloudUri: firebaseRes.cloudUri, displayUrl: firebaseRes.displayUrl, mimeType, sizeBytes: buffer.byteLength, sha256Hash, createdAt };
  }

  if (requiresCloudStorage()) throw new MediaStorageUnavailableError();
  await uploadLocal(storagePath, buffer);
  return { storagePath, displayUrl: localMediaUrl(storagePath), mimeType, sizeBytes: buffer.byteLength, sha256Hash, createdAt };
}

export async function readMediaBuffer(media: MediaEvidence): Promise<Buffer | undefined> {
  try {
    if (media.storageProvider === "firebase_storage" && media.displayUrl) {
      const response = await fetch(media.displayUrl);
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    }
    return await readFile(path.join(localMediaRoot(), media.storagePath));
  } catch {
    return undefined;
  }
}
