import type { MediaEvidence, PollutionReport } from "../types";

// v2 intentionally starts a clean local report namespace. Legacy demo and
// Firestore-backed records are never imported into the browser store.
const DB_NAME = "nagarnetra-local-reports-v2";
const DB_VERSION = 1;
const REPORTS = "reports";
const MEDIA = "media";
export const MAX_DEMO_IMAGE_BYTES = 3 * 1024 * 1024;

type StoredMedia = { id: string; blob: Blob; createdAt: string };
let dbPromise: Promise<IDBDatabase> | undefined;
const objectUrls = new Map<string, string>();
export const DEMO_REPORTS_CHANGED_EVENT = "nagarnetra-demo-reports-changed";

function notifyReportsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEMO_REPORTS_CHANGED_EVENT));
}

function unavailable(cause?: unknown) {
  const error = new Error("This browser could not save the evidence. Please allow site storage and try again.");
  if (cause) console.error("[Local report storage] IndexedDB operation failed:", cause);
  return error;
}

function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(unavailable());
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(REPORTS)) db.createObjectStore(REPORTS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(MEDIA)) db.createObjectStore(MEDIA, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(unavailable(request.error));
      request.onblocked = () => reject(unavailable(new Error("IndexedDB open request was blocked by another tab.")));
    });
  }
  return dbPromise;
}

async function read<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(unavailable(request.error));
  });
}

async function write(store: string, value: unknown): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    const request = transaction.objectStore(store).put(value);
    let settled = false;
    const fail = (cause: unknown) => { if (!settled) { settled = true; reject(unavailable(cause)); } };
    request.onerror = () => fail(request.error);
    transaction.onerror = () => fail(transaction.error);
    transaction.onabort = () => fail(transaction.error || new Error("IndexedDB transaction was aborted."));
    transaction.oncomplete = () => { if (!settled) { settled = true; resolve(); } };
  });
}

function mediaId(prefix: "before" | "after") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function saveDemoImage(blob: Blob, prefix: "before" | "after", details: { hash: string; width?: number; height?: number; capturedAt?: string; mimeType?: string }): Promise<MediaEvidence> {
  if (!blob.size || blob.size > MAX_DEMO_IMAGE_BYTES) throw unavailable();
  const id = mediaId(prefix);
  try {
    await write(MEDIA, { id, blob, createdAt: new Date().toISOString() } satisfies StoredMedia);
  } catch (error) {
    console.error("[Local report storage] Could not save report media:", error);
    throw error instanceof Error && error.message.startsWith("This browser could not save") ? error : unavailable(error);
  }
  return {
    mediaId: id,
    type: "photo",
    storagePath: `indexeddb:${id}`,
    storageProvider: "browser_indexeddb",
    mimeType: details.mimeType || blob.type || "image/jpeg",
    sizeBytes: blob.size,
    sha256Hash: details.hash,
    uploadedAt: new Date().toISOString(),
    capturedAt: details.capturedAt,
    width: details.width,
    height: details.height,
    metadataWarnings: ["Stored only in this browser for the Netlify demonstration."]
  };
}

async function objectUrl(mediaId: string): Promise<string | undefined> {
  const current = objectUrls.get(mediaId);
  if (current) return current;
  const item = await read<StoredMedia>(MEDIA, mediaId);
  if (!item?.blob) return undefined;
  const url = URL.createObjectURL(item.blob);
  objectUrls.set(mediaId, url);
  return url;
}

function persistentMedia(media: MediaEvidence): MediaEvidence {
  const copy = { ...media };
  if (copy.storageProvider === "browser_indexeddb") {
    delete copy.displayUrl;
    delete copy.publicUrl;
    delete copy.cloudUri;
  }
  return copy;
}

function persistentReport(report: PollutionReport): PollutionReport {
  const copy = JSON.parse(JSON.stringify(report)) as PollutionReport;
  copy.media = copy.media.map(persistentMedia);
  if (copy.cleanupProof) copy.cleanupProof.afterMedia = persistentMedia(copy.cleanupProof.afterMedia);
  if (copy.resolutionProof?.afterMedia) copy.resolutionProof.afterMedia = persistentMedia(copy.resolutionProof.afterMedia);
  if (copy.imageUrl?.startsWith("blob:")) delete copy.imageUrl;
  return copy;
}

async function hydratedMedia(media: MediaEvidence): Promise<MediaEvidence> {
  if (media.storageProvider !== "browser_indexeddb") return media;
  const url = await objectUrl(media.mediaId);
  return { ...media, ...(url ? { displayUrl: url } : {}) };
}

export async function hydrateDemoReport(report: PollutionReport): Promise<PollutionReport> {
  const copy = persistentReport(report);
  copy.media = await Promise.all(copy.media.map(hydratedMedia));
  if (copy.cleanupProof) copy.cleanupProof.afterMedia = await hydratedMedia(copy.cleanupProof.afterMedia);
  if (copy.resolutionProof?.afterMedia) copy.resolutionProof.afterMedia = await hydratedMedia(copy.resolutionProof.afterMedia);
  copy.imageUrl = copy.media[0]?.displayUrl;
  return copy;
}

export async function listDemoReports(): Promise<PollutionReport[]> {
  const db = await database();
  const reports = await new Promise<PollutionReport[]>((resolve, reject) => {
    const request = db.transaction(REPORTS, "readonly").objectStore(REPORTS).getAll();
    request.onsuccess = () => resolve(request.result as PollutionReport[]);
    request.onerror = () => reject(unavailable());
  });
  return Promise.all(reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(hydrateDemoReport));
}

export async function saveDemoReport(report: PollutionReport): Promise<PollutionReport> {
  try {
    await write(REPORTS, persistentReport(report));
    const hydrated = await hydrateDemoReport(report);
    notifyReportsChanged();
    return hydrated;
  } catch {
    throw unavailable();
  }
}

export async function getDemoReport(id: string) {
  const report = await read<PollutionReport>(REPORTS, id);
  return report ? hydrateDemoReport(report) : undefined;
}

export async function clearLocalDemoData() {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([REPORTS, MEDIA], "readwrite");
    transaction.objectStore(REPORTS).clear();
    transaction.objectStore(MEDIA).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(unavailable());
  });
  revokeDemoObjectUrls();
  notifyReportsChanged();
}

export function revokeDemoObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
}
