/**
 * Read-only evidence reconciliation for a single case's manual Export.
 * Neither a missing manifest reference nor a failed R2 probe authorizes deletion:
 * historical exports, uncertain commits and delayed receipts may all be valid.
 */
export interface ExportArtifactEvidence {
  id: string;
  caseId: string;
  revision: number;
  objectKey: string;
  hash: string;
}
export interface ExportManifestEvidence {
  id: string;
  hash: string;
  status: string;
}
export interface ExportRequestEvidence {
  requestId: string;
  status: "claimed" | "committed" | "uncertain" | "failed";
  artifactIds: readonly string[];
}
export interface ExportObjectEvidence {
  objectKey: string;
  /** null: not checked/inconclusive; true: R2 HEAD or GET succeeded. */
  exists: boolean | null;
  /** Only supply when computed from actual object bytes, never the R2 ETag. */
  verifiedSha256?: string | null;
}
export type ExportEvidenceIssueCode =
  | "CURRENT_SQL_MISSING" | "CURRENT_OTHER_CASE" | "CURRENT_REVISION_MISMATCH"
  | "CURRENT_HASH_MISMATCH" | "COMMITTED_SQL_MISSING" | "COMMITTED_OTHER_CASE"
  | "R2_OBJECT_MISSING" | "R2_PROOF_UNKNOWN" | "R2_BYTES_UNVERIFIED"
  | "R2_BYTES_HASH_MISMATCH" | "UNCERTAIN_COMMIT_PRESERVE"
  | "CLAIMED_REQUEST_PRESERVE" | "UNREFERENCED_SQL_PRESERVE"
  | "CURRENT_MANIFEST_EMPTY" | "DUPLICATE_OBJECT_KEY";
export interface ExportEvidenceIssue {
  code: ExportEvidenceIssueCode;
  artifactId?: string;
  requestId?: string;
  /** This audit is diagnostic. It never grants deletion authority. */
  autoDeleteAllowed: false;
}
export interface ExportEvidenceAudit {
  issues: ExportEvidenceIssue[];
  /** A clean result requires full R2 byte proof for each current artifact. */
  currentArtifactsVerified: boolean;
  autoDeleteAllowed: false;
}
export function reconcileExportEvidence(input: {
  caseId: string;
  currentRevision: number;
  manifest: readonly ExportManifestEvidence[];
  artifactRows: readonly ExportArtifactEvidence[];
  receipts: readonly ExportRequestEvidence[];
  objectProofs: readonly ExportObjectEvidence[];
}): ExportEvidenceAudit {
  const issues: ExportEvidenceIssue[] = [];
  const add = (code: ExportEvidenceIssueCode, artifactId?: string, requestId?: string) => {
    issues.push({ code, ...(artifactId ? { artifactId } : {}), ...(requestId ? { requestId } : {}), autoDeleteAllowed: false });
  };
  const rows = new Map(input.artifactRows.map(row => [row.id, row]));
  const proofs = new Map(input.objectProofs.map(proof => [proof.objectKey, proof]));
  const current = input.manifest.filter(file => file.status === "current");
  const referenced = new Set(input.manifest.map(file => file.id));
  let currentArtifactsVerified = current.length > 0;
  if (!current.length) add("CURRENT_MANIFEST_EMPTY");
  for (const file of current) {
    const row = rows.get(file.id);
    if (!row) { add("CURRENT_SQL_MISSING", file.id); currentArtifactsVerified = false; continue; }
    if (row.caseId !== input.caseId) { add("CURRENT_OTHER_CASE", file.id); currentArtifactsVerified = false; continue; }
    if (row.revision !== input.currentRevision) { add("CURRENT_REVISION_MISMATCH", file.id); currentArtifactsVerified = false; }
    if (row.hash !== file.hash) { add("CURRENT_HASH_MISMATCH", file.id); currentArtifactsVerified = false; }
  }
  for (const receipt of input.receipts) {
    for (const id of receipt.artifactIds) referenced.add(id);
    if (receipt.status === "uncertain") { add("UNCERTAIN_COMMIT_PRESERVE", undefined, receipt.requestId); continue; }
    if (receipt.status === "claimed") { add("CLAIMED_REQUEST_PRESERVE", undefined, receipt.requestId); continue; }
    if (receipt.status !== "committed") continue;
    for (const id of receipt.artifactIds) {
      const row = rows.get(id);
      if (!row) add("COMMITTED_SQL_MISSING", id, receipt.requestId);
      else if (row.caseId !== input.caseId) add("COMMITTED_OTHER_CASE", id, receipt.requestId);
      // Historical A after a new B is not required in the current manifest.
    }
  }
  const seenKeys = new Set<string>();
  for (const row of input.artifactRows) {
    if (row.caseId !== input.caseId) continue; // No permission to audit another case.
    if (!referenced.has(row.id)) add("UNREFERENCED_SQL_PRESERVE", row.id);
    if (seenKeys.has(row.objectKey)) {
      add("DUPLICATE_OBJECT_KEY", row.id);
      if (current.some(file => file.id === row.id)) currentArtifactsVerified = false;
      continue;
    }
    seenKeys.add(row.objectKey);
    const proof = proofs.get(row.objectKey);
    const isCurrent = current.some(file => file.id === row.id);
    if (!proof || proof.exists === null) {
      add("R2_PROOF_UNKNOWN", row.id);
      if (isCurrent) currentArtifactsVerified = false;
    } else if (proof.exists === false) {
      add("R2_OBJECT_MISSING", row.id);
      if (isCurrent) currentArtifactsVerified = false;
    } else if (!proof.verifiedSha256) {
      add("R2_BYTES_UNVERIFIED", row.id);
      if (isCurrent) currentArtifactsVerified = false;
    } else if (proof.verifiedSha256 !== row.hash) {
      add("R2_BYTES_HASH_MISMATCH", row.id);
      if (isCurrent) currentArtifactsVerified = false;
    }
  }
  return { issues, currentArtifactsVerified, autoDeleteAllowed: false };
}
