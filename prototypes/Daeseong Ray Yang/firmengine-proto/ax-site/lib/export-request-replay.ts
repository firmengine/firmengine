/**
 * Request-scoped replay decision for a manual export POST.
 * A network failure after a manifest CAS must not silently issue a second set
 * of artifact IDs. This only recognizes the SAME request's current manifest;
 * it deliberately does not restore historic approvals or guess missing facts.
 */
import type { ExportManifest } from "./domain.ts";

export type ExportReplayDecision = "new" | "reuse" | "conflict";
export type ExportMode = "draft" | "final";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Legacy clients may omit the field; an explicit invalid token fails closed. */
export function parseExportRequestId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !UUID_V4.test(value)) throw new Error("EXPORT_REQUEST_ID_INVALID");
  return value.toLowerCase();
}

/** The R2/D1 artifact existence check is intentionally performed by the route,
 * after this pure state comparison and before a successful replay response. */
export function inspectExportRequestReplay(input: {
  requestId: string | null;
  manifest: ExportManifest | undefined;
  caseRevision: number;
  mode: ExportMode;
  sourceDataVersion: number | null;
  referenceSha256: string | null | undefined;
}): ExportReplayDecision {
  const { requestId, manifest, caseRevision, mode, sourceDataVersion, referenceSha256 } = input;
  if (!requestId || !manifest || manifest.exportRequestId !== requestId) return "new";
  // Same operation ID with a different case/reference/source/manifest is NOT
  // permission to create another export or to claim an old file is current.
  if (manifest.caseRevision !== caseRevision || manifest.mode !== mode ||
      sourceDataVersion === null || !Number.isSafeInteger(sourceDataVersion) || sourceDataVersion < 0 ||
      manifest.sourceDataVersionAtExport !== sourceDataVersion ||
      !referenceSha256 || manifest.documentWriter?.referenceRelease?.sha256 !== referenceSha256 ||
      manifest.documentWriter?.caseRevision !== caseRevision ||
      manifest.documentWriter?.mode !== mode ||
      !manifest.files.length ||
      manifest.files.some(file => file.status !== "current" || !file.id || !/^[0-9a-f]{64}$/i.test(file.hash))) {
    return "conflict";
  }
  return "reuse";
}
