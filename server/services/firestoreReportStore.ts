/**
 * server/services/firestoreReportStore.ts
 *
 * Firestore adapter for PollutionReport persistence.
 * Uses the centralized Firebase Admin SDK from adminApp.ts.
 *
 * All writes strip large base64 fields to keep documents lean.
 * Timestamps are normalized to ISO strings on read.
 */

import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { PollutionReport } from "../types.js";
import { getAdminApp, adminAvailable } from "./adminApp.js";
import { initializeApp, getApps as getClientApps } from "firebase/app";
import { getFirestore as getClientFirestore, collection as clientCollection, doc as clientDoc, getDocs as clientGetDocs, getDoc as clientGetDoc, setDoc as clientSetDoc, query as clientQuery, orderBy as clientOrderBy, limit as clientLimit } from "firebase/firestore";

const COLLECTION = "reports";
const MAX_LIST = 200;

function db(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  return getFirestore(app);
}
function clientDb() {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  const app = getClientApps().find((item) => item.name === "[DEFAULT]") || initializeApp({ apiKey, projectId, appId: process.env.VITE_FIREBASE_APP_ID || "netlify-server" });
  return getClientFirestore(app);
}

export function firestoreEnabled(): boolean {
  return adminAvailable() || Boolean(clientDb());
}

/**
 * Strip raw base64 image data from a report before writing to Firestore.
 * We store only metadata — never large blobs.
 */
function sanitizeForFirestore(report: PollutionReport): Record<string, unknown> {
  const sanitized = { ...report } as Record<string, unknown>;

  // Strip any accidentally-attached base64 blobs
  delete sanitized["imageBase64"];
  delete sanitized["originalBase64"];
  delete sanitized["thumbnailBase64"];

  // Ensure nested media array doesn't contain base64
  if (Array.isArray(sanitized["media"])) {
    sanitized["media"] = (sanitized["media"] as Record<string, unknown>[]).map((m) => {
      const clean = { ...m };
      delete clean["base64"];
      delete clean["originalBase64"];
      return clean;
    });
  }

  // Recursively remove undefined values which Firestore rejects
  const removeUndefined = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(removeUndefined);
    } else if (obj !== null && typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, removeUndefined(v)])
      );
    }
    return obj;
  };

  return removeUndefined(sanitized);
}

/**
 * Normalize Firestore Timestamps to ISO strings on read.
 * Firestore returns Timestamp objects for date fields stored as server timestamps.
 */
function normalizeTimestamps(data: Record<string, unknown>): PollutionReport {
  const normalize = (val: unknown): unknown => {
    if (val && typeof val === "object" && "toDate" in (val as object)) {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.fromEntries(
        Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, normalize(v)])
      );
    }
    if (Array.isArray(val)) return val.map(normalize);
    return val;
  };
  return normalize(data) as PollutionReport;
}

export async function saveReportToFirestore(
  report: PollutionReport
): Promise<{ persisted: boolean; reason: string }> {
  const firestore = db();
  const client = firestore ? null : clientDb();
  if (!firestore && client) { try { await clientSetDoc(clientDoc(client, COLLECTION, report.id), sanitizeForFirestore(report), { merge: true }); return { persisted: true, reason: "Persisted to Firestore via Firebase Web SDK." }; } catch (err) { return { persisted: false, reason: String(err) }; } }
  if (!firestore) {
    return { persisted: false, reason: "Firebase Admin not configured — using local dev store." };
  }
  try {
    const payload = {
      ...sanitizeForFirestore(report),
      _serverUpdatedAt: FieldValue.serverTimestamp()
    };
    await firestore.collection(COLLECTION).doc(report.id).set(payload, { merge: true });
    return { persisted: true, reason: "Persisted to Firestore." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Firestore] saveReport(${report.id}) failed:`, msg);
    return { persisted: false, reason: `Firestore write failed: ${msg}` };
  }
}

export async function listFirestoreReports(): Promise<PollutionReport[] | null> {
  const firestore = db();
  const client = firestore ? null : clientDb();
  if (!firestore && client) { try { const snap = await clientGetDocs(clientQuery(clientCollection(client, COLLECTION), clientOrderBy("createdAt", "desc"), clientLimit(MAX_LIST))); return snap.docs.map((doc) => normalizeTimestamps(doc.data() as Record<string, unknown>)); } catch { return null; } }
  if (!firestore) return null;
  try {
    const snapshot = await firestore
      .collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(MAX_LIST)
      .get();
    return snapshot.docs.map((doc) => normalizeTimestamps(doc.data() as Record<string, unknown>));
  } catch (err) {
    console.error("[Firestore] listReports failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function findFirestoreReport(id: string): Promise<PollutionReport | null> {
  const firestore = db();
  const client = firestore ? null : clientDb();
  if (!firestore && client) { try { const snap = await clientGetDoc(clientDoc(client, COLLECTION, id)); return snap.exists() ? normalizeTimestamps(snap.data() as Record<string, unknown>) : null; } catch { return null; } }
  if (!firestore) return null;
  try {
    const snapshot = await firestore.collection(COLLECTION).doc(id).get();
    if (!snapshot.exists) return null;
    return normalizeTimestamps(snapshot.data() as Record<string, unknown>);
  } catch (err) {
    console.error(`[Firestore] findReport(${id}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function updateFirestoreReport(
  id: string,
  patch: Partial<PollutionReport>
): Promise<PollutionReport | null> {
  const firestore = db();
  const client = firestore ? null : clientDb();
  if (!firestore && client) { try { const ref = clientDoc(client, COLLECTION, id); const snap = await clientGetDoc(ref); if (!snap.exists()) return null; const next = { ...normalizeTimestamps(snap.data() as Record<string, unknown>), ...patch, updatedAt: new Date().toISOString() } as PollutionReport; await clientSetDoc(ref, sanitizeForFirestore(next), { merge: true }); return next; } catch { return null; } }
  if (!firestore) return null;
  try {
    const ref = firestore.collection(COLLECTION).doc(id);
    const existing = await ref.get();
    if (!existing.exists) return null;
    const base = normalizeTimestamps(existing.data() as Record<string, unknown>);
    const next: PollutionReport = { ...base, ...patch, updatedAt: new Date().toISOString() };
    await ref.set(
      {
        ...sanitizeForFirestore(next),
        _serverUpdatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return next;
  } catch (err) {
    console.error(`[Firestore] updateReport(${id}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function listFirestoreReportsByUser(userId: string): Promise<PollutionReport[] | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snapshot = await firestore
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return snapshot.docs.map((doc) => normalizeTimestamps(doc.data() as Record<string, unknown>));
  } catch (err) {
    console.error(`[Firestore] listByUser(${userId}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}
