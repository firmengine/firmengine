/**
 * A4 read-only adapter for the persisted ExportManifest shape.
 * A durable D1 receipt fingerprint is NOT proof of the manifest fingerprint:
 * recompute the latter with the exact commandHash from case-command-contract.
 * Does not read the database/bucket, mutate records, or grant replay/approval.
 */
const denied = {canDelete:false, canReplay:false, canMarkCommitted:false, canApprove:false};
const validHash = value => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const validId = value => typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
const isRecord = value => !!value && typeof value === "object" && !Array.isArray(value);
const observedVersion = value => Number.isSafeInteger(value) && value >= 1;
const blocked = (classification, code) => ({classification, codes:[code], ...denied});

/**
 * @param {object} input - Observed caseData (including exportManifest), D1 receipt,
 *   and independently observed caseSnapshot/SQL/R2/audit lists (null = unobserved).
 * @param {(value:object)=>Promise<string>} commandHash - Use the real canonical hash,
 *   not an arbitrary hash of JSON.stringify or the stored receipt fingerprint.
 * @param {(input:object)=>object} inspectEvidence - Real read-only triage function.
 */
export async function inspectStoredExportRecovery(input, commandHash, inspectEvidence) {
  const {caseData, receipt, caseSnapshot = null, artifactRows = null,
    objectProofs = null, auditEvents = null} = input ?? {};
  if (!isRecord(caseData) || !isRecord(caseData.context) ||
      caseData.context.id == null || !isRecord(receipt)) {
    return blocked("inconclusive", "STORED_CASE_OR_RECEIPT_NOT_OBSERVED");
  }
  if (typeof caseData.context.id !== "string" || !caseData.context.id.trim() ||
      typeof receipt.caseId !== "string" || !receipt.caseId.trim() ||
      caseData.context.id !== receipt.caseId) {
    return blocked("conflict", "STORED_CASE_IDENTITY_CONFLICT");
  }
  const raw = caseData.exportManifest;
  if (raw == null) return blocked("inconclusive", "STORED_MANIFEST_NOT_OBSERVED");
  if (!isRecord(raw)) return blocked("conflict", "STORED_MANIFEST_INVALID");
  // The persisted schema uses exportRequestId, NOT requestId. Never substitute
  // receipt.requestId for a missing observed manifest identity.
  if (raw.exportRequestId == null) {
    return blocked("inconclusive", "STORED_EXPORT_REQUEST_NOT_OBSERVED");
  }
  if (!validId(raw.exportRequestId) || !validId(receipt.requestId)) {
    return blocked("conflict", "STORED_EXPORT_REQUEST_INVALID");
  }
  if (raw.exportRequestId !== receipt.requestId) {
    return blocked("historical", "STORED_EXPORT_REQUEST_DIFFERENT");
  }
  if (raw.caseRevision == null || raw.sourceDataVersionAtExport == null || raw.mode == null) {
    return blocked("inconclusive", "STORED_MANIFEST_SOURCE_NOT_OBSERVED");
  }
  if (!observedVersion(raw.caseRevision) ||
      !observedVersion(raw.sourceDataVersionAtExport) ||
      !["draft","final"].includes(raw.mode)) {
    return blocked("conflict", "STORED_MANIFEST_SOURCE_INVALID");
  }
  if (!observedVersion(caseData.context.revision)) {
    return blocked("conflict", "STORED_CASE_REVISION_INVALID");
  }
  if (raw.caseRevision !== caseData.context.revision) {
    return blocked("stale", "STORED_MANIFEST_REVISION_STALE");
  }
  if (raw.sourceDataVersionAtExport !== receipt.sourceDataVersion ||
      raw.caseRevision !== receipt.caseRevision || raw.mode !== receipt.mode) {
    return blocked("conflict", "STORED_RECEIPT_SOURCE_CONFLICT");
  }
  if (!validHash(receipt.referenceSha256) ||
      !validHash(receipt.manifestFingerprint)) {
    return blocked("conflict", "STORED_RECEIPT_DIGEST_INVALID");
  }
  if (!Array.isArray(raw.files) || raw.files.length === 0 ||
      raw.files.some(f => !isRecord(f) || !validId(f.id) ||
        typeof f.kind !== "string" || !f.kind ||
        typeof f.name !== "string" || !f.name ||
        !validHash(f.hash) || !["current","archived","invalidated"].includes(f.status)) ||
      new Set(raw.files.map(f=>f.id)).size !== raw.files.length) {
    return blocked("conflict", "STORED_MANIFEST_FILES_INVALID");
  }
  // Missing writer evidence is not an observed writer approval. The ordinary
  // reduced projection accepts absent optional fields; this adapter must not.
  if (raw.documentWriter == null) {
    return blocked("inconclusive", "STORED_WRITER_NOT_OBSERVED");
  }
  if (!isRecord(raw.documentWriter)) {
    return blocked("conflict", "STORED_WRITER_INVALID");
  }
  if (typeof commandHash !== "function" || typeof inspectEvidence !== "function") {
    return blocked("inconclusive", "STORED_VERIFIER_NOT_AVAILABLE");
  }
  let fingerprint;
  try {
    fingerprint = await commandHash({caseId:caseData.context.id,
      requestId:raw.exportRequestId, mode:raw.mode,
      caseRevision:raw.caseRevision, sourceDataVersion:raw.sourceDataVersionAtExport,
      referenceSha256:receipt.referenceSha256,
      files:raw.files.map(f=>({id:f.id,kind:f.kind,name:f.name,hash:f.hash}))});
  } catch {
    return blocked("inconclusive", "STORED_FINGERPRINT_COMPUTATION_FAILED");
  }
  if (!validHash(fingerprint)) return blocked("conflict", "STORED_FINGERPRINT_INVALID");
  if (fingerprint.toLowerCase() !== receipt.manifestFingerprint.toLowerCase()) {
    return blocked("conflict", "STORED_MANIFEST_FINGERPRINT_CONFLICT");
  }
  const projection={requestId:raw.exportRequestId,artifactIds:raw.files.map(f=>f.id),
    fingerprint,caseRevision:raw.caseRevision,mode:raw.mode,
    sourceDataVersionAtExport:raw.sourceDataVersionAtExport,
    files:raw.files,documentWriter:raw.documentWriter};
  try {
    const result=inspectEvidence({receipt,caseSnapshot,artifactRows,objectProofs,
      auditEvents,manifest:projection});
    if (!isRecord(result) || !["conflict","stale","historical","unplanned",
        "inconclusive","evidence_consistent_review_required"].includes(result.classification) ||
        !Array.isArray(result.codes)) {
      return blocked("conflict", "STORED_TRIAGE_RESULT_INVALID");
    }
    // Preserve observed conflicts from R2/SQL/audit even when the request is
    // still claimed/uncertain/failed. Only the optimistic result is downgraded.
    if (receipt.status !== "committed") {
      return {...result, classification: result.classification ===
        "evidence_consistent_review_required" ? "inconclusive" : result.classification,
        codes:[...new Set([...result.codes, "STORED_RECEIPT_NOT_COMMITTED"])], ...denied};
    }
    return {...result, ...denied};
  } catch {
    return blocked("inconclusive", "STORED_TRIAGE_UNAVAILABLE");
  }
}
