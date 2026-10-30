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
  | "CURRENT_MANIFEST_EMPTY" | "DUPLICATE_OBJECT_KEY" | "OBJECT_KEY_SCOPE_MISMATCH"
  | "R2_PROOF_CONFLICT" | "R2_UNTRACKED_OBJECT_PRESERVE" | "R2_UNTRACKED_PROOF_UNKNOWN"
  | "ARTIFACT_EVIDENCE_CONFLICT" | "FOREIGN_CASE_OBJECT_KEY_ALIAS"
  | "CURRENT_MANIFEST_DUPLICATE_ID" | "CURRENT_MANIFEST_HASH_INVALID"
  | "CURRENT_SQL_HASH_INVALID" | "R2_BYTES_SHA_INVALID";
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
  const isSha256 = (value: unknown): value is string =>
    typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
  const issues: ExportEvidenceIssue[] = [];
  const add = (code: ExportEvidenceIssueCode, artifactId?: string, requestId?: string) => {
    issues.push({ code, ...(artifactId ? { artifactId } : {}), ...(requestId ? { requestId } : {}), autoDeleteAllowed: false });
  };
  const rows = new Map(input.artifactRows.map(row => [row.id, row]));
  // A caller may compose SQL, historical receipts and retry snapshots in an
  // arbitrary order. The final Map entry alone cannot prove an artifact ID:
  // conflicting evidence with the same ID must block current verification.
  const firstRows = new Map<string, ExportArtifactEvidence>();
  const conflictingRowIds = new Set<string>();
  for (const row of input.artifactRows) {
    const first = firstRows.get(row.id);
    if (first && (first.caseId !== row.caseId || first.revision !== row.revision ||
      first.objectKey !== row.objectKey || first.hash !== row.hash)) {
      conflictingRowIds.add(row.id);
    } else if (!first) {
      firstRows.set(row.id, row);
    }
  }
  // Multiple probes may race with a retry or a partial R2 failure. Never let
  // the last element in an unordered response silently win over a contradiction.
  const proofs = new Map<string, ExportObjectEvidence>();
  const conflictingProofs = new Set<string>();
  for (const proof of input.objectProofs) {
    const previous = proofs.get(proof.objectKey);
    if (previous && (previous.exists !== proof.exists ||
      (previous.verifiedSha256 ?? null) !== (proof.verifiedSha256 ?? null))) {
      conflictingProofs.add(proof.objectKey);
    } else if (!previous) {
      proofs.set(proof.objectKey, proof);
    }
  }
  const current = input.manifest.filter(file => file.status === "current");
  const referenced = new Set(input.manifest.map(file => file.id));
  let currentArtifactsVerified = current.length > 0;
  if (!current.length) add("CURRENT_MANIFEST_EMPTY");
  const currentIds = new Set<string>();
  for (const file of current) {
    if (currentIds.has(file.id)) {
      add("CURRENT_MANIFEST_DUPLICATE_ID", file.id);
      currentArtifactsVerified = false;
    }
    currentIds.add(file.id);
    if (!isSha256(file.hash)) {
      add("CURRENT_MANIFEST_HASH_INVALID", file.id);
      currentArtifactsVerified = false;
    }
  }
  for (const id of conflictingRowIds) {
    // Report only IDs belonging to the requested case or its provided receipts;
    // unrelated foreign-case evidence must not be disclosed by the diagnostic.
    if (referenced.has(id) || input.artifactRows.some(row => row.id === id && row.caseId === input.caseId)) {
      add("ARTIFACT_EVIDENCE_CONFLICT", id);
    }
    if (currentIds.has(id)) currentArtifactsVerified = false;
  }
  for (const file of current) {
    const row = rows.get(file.id);
    if (!row) { add("CURRENT_SQL_MISSING", file.id); currentArtifactsVerified = false; continue; }
    if (row.caseId !== input.caseId) { add("CURRENT_OTHER_CASE", file.id); currentArtifactsVerified = false; continue; }
    if (row.revision !== input.currentRevision) { add("CURRENT_REVISION_MISMATCH", file.id); currentArtifactsVerified = false; }
    if (!isSha256(row.hash)) { add("CURRENT_SQL_HASH_INVALID", file.id); currentArtifactsVerified = false; }
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
  const currentKeys = new Set(current.map(file => rows.get(file.id)?.objectKey).filter((key): key is string => !!key));
  // A foreign-case SQL row may reuse this case's R2 key despite having a
  // different artifact ID. Report the alias without exposing a foreign ID.
  // Only an alias to a CURRENT object blocks current verification; a historic
  // alias remains a separate investigation and never authorizes deletion.
  const ownedPrefixForAlias = "cases/"+input.caseId+"/artifacts/";
  const foreignAliases = new Set(input.artifactRows
    .filter(row => row.caseId !== input.caseId && row.objectKey.startsWith(ownedPrefixForAlias))
    .map(row => row.objectKey));
  for (const key of foreignAliases) {
    add("FOREIGN_CASE_OBJECT_KEY_ALIAS");
    if (currentKeys.has(key)) currentArtifactsVerified = false;
  }

  for (const key of conflictingProofs) {
    // Report only keys owned by this case, not other cases observed by a bulk probe.
    if (key.startsWith("cases/"+input.caseId+"/artifacts/")) add("R2_PROOF_CONFLICT");
    if (currentKeys.has(key)) currentArtifactsVerified = false;
  }
  for (const row of input.artifactRows) {
    if (row.caseId !== input.caseId) continue; // No permission to audit another case.
    if (!referenced.has(row.id)) add("UNREFERENCED_SQL_PRESERVE", row.id);
    if (row.objectKey !== "cases/"+input.caseId+"/artifacts/"+row.id) {
      add("OBJECT_KEY_SCOPE_MISMATCH", row.id);
      if (current.some(file => file.id === row.id)) currentArtifactsVerified = false;
    }
    if (seenKeys.has(row.objectKey)) {
      add("DUPLICATE_OBJECT_KEY", row.id);
      if (currentKeys.has(row.objectKey)) currentArtifactsVerified = false;
      continue;
    }
    seenKeys.add(row.objectKey);
    const proof = conflictingProofs.has(row.objectKey) ? undefined : proofs.get(row.objectKey);
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
    } else if (!isSha256(proof.verifiedSha256)) {
      add("R2_BYTES_SHA_INVALID", row.id);
      if (isCurrent) currentArtifactsVerified = false;
    } else if (proof.verifiedSha256 !== row.hash) {
      add("R2_BYTES_HASH_MISMATCH", row.id);
      if (isCurrent) currentArtifactsVerified = false;
    }
  }
  // R2 PUT may succeed while D1 artifact-row persistence fails. Those objects
  // do not appear in the SQL-row loop above. Observed keys are NOT a complete
  // bucket inventory; absence from this list never implies that an object is absent.
  const ownedPrefix = "cases/"+input.caseId+"/artifacts/";
  for (const [key, proof] of proofs) {
    if (!key.startsWith(ownedPrefix) || seenKeys.has(key)) continue;
    if (conflictingProofs.has(key) || proof.exists === null) {
      add("R2_UNTRACKED_PROOF_UNKNOWN");
    } else if (proof.exists === true) {
      add("R2_UNTRACKED_OBJECT_PRESERVE");
    }
  }
  return { issues, currentArtifactsVerified, autoDeleteAllowed: false };
}
