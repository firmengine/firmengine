/**
 * A4 read-only triage of one durable Export request's planned artifacts.
 * Planned IDs are intent, not evidence of a D1 row, R2 bytes, a committed
 * manifest, staff review, lawyer approval, or a court filing.
 * null means NOT OBSERVED; [] means OBSERVED EMPTY.
 * Audit event proofs MUST carry the case/request/revision identity; type alone is not proof.
 * No output is permission to replay, delete, mark committed, or approve.
 */
export function inspectExportRecoveryEvidence(input) {
  const {receipt, caseSnapshot = null, artifactRows = null,
    objectProofs = null, manifest = null, auditEvents = null} = input;
  const codes = [];
  const add = code => { if (!codes.includes(code)) codes.push(code); };
  let conflict = false, stale = false, historical = false, incomplete = false, unplanned = false;
  // A failed D1/R2/audit read may arrive as an error envelope instead of an
  // array. Never throw or silently drop malformed entries in recovery triage.
  // NULL is unobserved, [] is observed empty, malformed is a conflict.
  const objectList = value => Array.isArray(value) &&
    value.every(row => row !== null && typeof row === "object" && !Array.isArray(row));
  const sqlRows = objectList(artifactRows) ? artifactRows : null;
  const r2ProofList = objectList(objectProofs) ? objectProofs : null;
  const auditList = objectList(auditEvents) ? auditEvents : null;
  if (artifactRows != null && sqlRows === null) { add("SQL_ROWS_INVALID"); conflict = true; }
  if (objectProofs != null && r2ProofList === null) { add("R2_PROOFS_INVALID"); conflict = true; }
  if (auditEvents != null && auditList === null) { add("AUDIT_EVENTS_INVALID"); conflict = true; }
  const validId = x => typeof x === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(x);
  const validSha = x => typeof x === "string" && /^[a-f0-9]{64}$/i.test(x);
  if (!receipt || !validId(receipt.requestId)
    || !["claimed", "committed", "uncertain", "failed"].includes(receipt.status)) {
    add("RECEIPT_IDENTITY_INVALID"); conflict = true;
  }
  // Matching two malformed source snapshots never establishes an authoritative
  // source identity. NULL means not observed, while 0, fractional versions,
  // and malformed reference digests are observed invalid values. Read-only only.
  if (receipt) {
    const requiredSource = [receipt.caseId, receipt.caseRevision,
      receipt.sourceDataVersion, receipt.referenceSha256];
    if (requiredSource.some(value => value == null)) {
      add("RECEIPT_SOURCE_NOT_OBSERVED"); incomplete = true;
    }
    if ((receipt.caseId != null && (typeof receipt.caseId !== "string" ||
        !receipt.caseId.trim() || receipt.caseId.length > 300)) ||
      (receipt.caseRevision != null && (!Number.isSafeInteger(receipt.caseRevision) || receipt.caseRevision < 1)) ||
      (receipt.sourceDataVersion != null && (!Number.isSafeInteger(receipt.sourceDataVersion) || receipt.sourceDataVersion < 1)) ||
      (receipt.referenceSha256 != null && !validSha(receipt.referenceSha256))) {
      add("RECEIPT_SOURCE_IDENTITY_INVALID"); conflict = true;
    }
  }
  let plan = null;
  const raw = receipt?.artifactIdsJson;
  if (raw == null) { add("PLAN_NOT_OBSERVED"); unplanned = true; }
  else {
    try { plan = typeof raw === "string" ? JSON.parse(raw) : null; }
    catch { plan = null; }
    if (!Array.isArray(plan)) { add("PLAN_INVALID"); conflict = true; plan = null; }
    else if (plan.length === 0) { add("PLAN_OBSERVED_EMPTY"); conflict = true; }
    else if (plan.some(x => !validId(x)) || new Set(plan).size !== plan.length) {
      add("PLAN_INVALID_OR_DUPLICATE_ID"); conflict = true;
    }
  }
  // A failed D1 source read or a partial projection must not be mistaken
  // for an observed source change. Distinguish absent/null, malformed/0,
  // and a valid but different version before deciding that facts are stale.
  if (caseSnapshot == null) { add("CURRENT_SOURCE_NOT_OBSERVED"); incomplete = true; }
  else if (typeof caseSnapshot !== "object" || Array.isArray(caseSnapshot) ||
    Object.prototype.hasOwnProperty.call(caseSnapshot, "error") ||
    (Object.prototype.hasOwnProperty.call(caseSnapshot, "status") &&
      !["caseId", "revision", "sourceDataVersion", "referenceSha256"]
        .some(key => Object.prototype.hasOwnProperty.call(caseSnapshot, key)))) {
    add("CURRENT_SOURCE_INVALID"); conflict = true;
  } else if (receipt) {
    const observed = [caseSnapshot.caseId, caseSnapshot.revision,
      caseSnapshot.sourceDataVersion, caseSnapshot.referenceSha256]
      .every(value => value != null);
    const invalid =
      (caseSnapshot.caseId != null && (typeof caseSnapshot.caseId !== "string" ||
        !caseSnapshot.caseId.trim() || caseSnapshot.caseId.length > 300)) ||
      (caseSnapshot.revision != null && (!Number.isSafeInteger(caseSnapshot.revision) ||
        caseSnapshot.revision < 1)) ||
      (caseSnapshot.sourceDataVersion != null &&
        (!Number.isSafeInteger(caseSnapshot.sourceDataVersion) || caseSnapshot.sourceDataVersion < 1)) ||
      (caseSnapshot.referenceSha256 != null && !validSha(caseSnapshot.referenceSha256));
    if (invalid) { add("CURRENT_SOURCE_INVALID"); conflict = true; }
    if (caseSnapshot.caseId != null && !invalid &&
      caseSnapshot.caseId !== receipt.caseId) {
      add("CASE_ID_CONFLICT"); conflict = true;
    }
    if (!observed) { add("CURRENT_SOURCE_PARTIAL_NOT_OBSERVED"); incomplete = true; }
    else if (!invalid && (caseSnapshot.revision !== receipt.caseRevision ||
      caseSnapshot.sourceDataVersion !== receipt.sourceDataVersion ||
      caseSnapshot.referenceSha256 !== receipt.referenceSha256)) {
      add("SOURCE_OR_REFERENCE_STALE"); stale = true;
    }
  }
  if (manifest == null) { add("MANIFEST_NOT_OBSERVED"); incomplete = true; }
  else if (typeof manifest !== "object" || Array.isArray(manifest) ||
    Object.prototype.hasOwnProperty.call(manifest, "error") ||
    (Object.prototype.hasOwnProperty.call(manifest, "status") &&
      !Object.prototype.hasOwnProperty.call(manifest, "requestId"))) {
    add("MANIFEST_INVALID"); conflict = true;
  } else if (manifest.requestId == null) {
    add("MANIFEST_REQUEST_NOT_OBSERVED"); incomplete = true;
  } else if (typeof manifest.requestId !== "string" || !validId(manifest.requestId)) {
    add("MANIFEST_INVALID"); conflict = true;
  } else if (!receipt || manifest.requestId !== receipt.requestId) {
    add("HISTORICAL_OR_OTHER_MANIFEST"); historical = true;
  } else if (plan) {
    const ids = manifest.artifactIds;
    if (!Array.isArray(ids) || ids.length !== plan.length ||
      new Set(ids).size !== ids.length || ids.some(id => !plan.includes(id))) {
      add("MANIFEST_PLAN_CONFLICT"); conflict = true;
    }
    if (!validSha(manifest.fingerprint) || !validSha(receipt.manifestFingerprint) ||
      manifest.fingerprint !== receipt.manifestFingerprint) {
      add("MANIFEST_FINGERPRINT_CONFLICT"); conflict = true;
    }
  }
  // A reduced, read-only manifest projection may omit file/writer details.
  // When those details ARE observed, do not ignore an explicitly archived
  // file, changed source version, or stale writer receipt merely because
  // receipt/SQL/R2 hashes match. Neither case is approval or replay authority.
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest) &&
      receipt && manifest.requestId === receipt.requestId) {
    if ((manifest.caseRevision !== undefined && manifest.caseRevision !== receipt.caseRevision) ||
        (manifest.sourceDataVersionAtExport !== undefined &&
          manifest.sourceDataVersionAtExport !== receipt.sourceDataVersion) ||
        (manifest.mode !== undefined && receipt.mode !== undefined &&
          manifest.mode !== receipt.mode)) {
      add("MANIFEST_SOURCE_IDENTITY_CONFLICT"); conflict = true;
    }
    if (Object.prototype.hasOwnProperty.call(manifest, "files")) {
      const files = manifest.files;
      if (!Array.isArray(files) || !plan || files.length !== plan.length ||
          new Set(files.map(file => file?.id)).size !== files.length ||
          files.some(file => !file || !plan.includes(file.id) ||
            file.status !== "current" || !validSha(file.hash) ||
            (sqlRows && sqlRows.some(row => row.id === file.id &&
              typeof row.hash === "string" && row.hash.toLowerCase() !== file.hash.toLowerCase())))) {
        add("MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT"); conflict = true;
      }
    }
    if (Object.prototype.hasOwnProperty.call(manifest, "documentWriter")) {
      const writer = manifest.documentWriter;
      if (!writer || writer.caseId !== receipt.caseId ||
          writer.caseRevision !== receipt.caseRevision ||
          (receipt.mode !== undefined && writer.mode !== receipt.mode) ||
          writer.referenceRelease?.sha256 !== receipt.referenceSha256) {
        add("WRITER_RECEIPT_SOURCE_CONFLICT"); conflict = true;
      }
    }
  }
  if (artifactRows == null) { add("SQL_ROWS_NOT_OBSERVED"); incomplete = true; }
  else if (sqlRows && plan) {
    // A separate SQL artifact can alias this request's R2 object key.
    // Matching the planned row and bytes is not sufficient when another
    // case, revision or artifact ID also claims the same object.
    // Read-only: flag identity collisions without deleting any evidence.
    if (receipt) {
      const expectedKeys = new Map(plan.map(id =>
        [`cases/${receipt.caseId}/artifacts/${id}`, id]));
      if (sqlRows.some(row => expectedKeys.has(row.objectKey) &&
        (row.id !== expectedKeys.get(row.objectKey) ||
         row.caseId !== receipt.caseId || row.revision !== receipt.caseRevision))) {
        add("SQL_OBJECT_KEY_ALIAS_CONFLICT"); conflict = true;
      }
    }
    for (const id of plan) {
      const hits = sqlRows.filter(row => row.id === id);
      if (hits.length === 0) { add("SQL_ROW_MISSING"); incomplete = true; continue; }
      if (hits.length !== 1) { add("SQL_ROW_DUPLICATE"); conflict = true; }
      for (const row of hits) {
        if (!receipt || row.caseId !== receipt.caseId ||
          row.revision !== receipt.caseRevision ||
          row.objectKey !== `cases/${receipt.caseId}/artifacts/${id}` ||
          !validSha(row.hash)) {
          add("SQL_IDENTITY_OR_HASH_CONFLICT"); conflict = true;
        }
      }
    }
  }
  if (objectProofs == null) { add("R2_PROOFS_NOT_OBSERVED"); incomplete = true; }
  else if (r2ProofList && plan && receipt) {
    for (const id of plan) {
      const key = `cases/${receipt.caseId}/artifacts/${id}`;
      const probes = r2ProofList.filter(proof => proof.objectKey === key);
      if (!probes.length) { add("R2_PROOF_UNKNOWN"); incomplete = true; continue; }
      if (probes.some(p => p.exists !== probes[0].exists ||
        (p.verifiedSha256 ?? null) !== (probes[0].verifiedSha256 ?? null))) {
        add("R2_PROOF_CONFLICT"); conflict = true; continue;
      }
      const proof = probes[0];
      if (proof.exists === false) { add("R2_OBJECT_OBSERVED_MISSING"); incomplete = true; continue; }
      if (proof.exists !== true) { add("R2_PROOF_UNKNOWN"); incomplete = true; continue; }
      if (!validSha(proof.verifiedSha256)) {
        add("R2_BYTES_NOT_VERIFIED"); incomplete = true; continue;
      }
      const rows = (sqlRows ?? []).filter(row => row.id === id);
      if (!rows.length) {
        if (sqlRows !== null) add("R2_WITHOUT_SQL_ROW");
        incomplete = true; continue;
      }
      if (rows.some(row => typeof row.hash !== "string" || row.hash.toLowerCase() !== proof.verifiedSha256.toLowerCase())) {
        add("R2_BYTES_HASH_CONFLICT"); conflict = true;
      }
    }
  }
  if (auditEvents == null) { add("AUDIT_EVENTS_NOT_OBSERVED"); incomplete = true; }
  else if (auditList && !["document_writer.prepared", "export.generated"].every(type =>
    auditList.some(event => event.type === type && receipt &&
      event.caseId === receipt.caseId && event.requestId === receipt.requestId &&
      event.revision === receipt.caseRevision))) {
    add("AUDIT_EVENTS_OBSERVED_INCOMPLETE"); incomplete = true;
  }
  const classification = conflict ? "conflict" : stale ? "stale" :
    historical ? "historical" : unplanned ? "unplanned" :
    incomplete ? "inconclusive" : "evidence_consistent_review_required";
  return {classification, codes, canDelete: false, canReplay: false,
    canMarkCommitted: false, canApprove: false};
}
