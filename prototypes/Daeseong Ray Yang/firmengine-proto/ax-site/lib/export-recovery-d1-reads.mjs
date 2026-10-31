/**
 * A4: read-only projection of the ACTUAL D1 receipt/artifact/event schema.
 * Does not fetch D1/R2, trigger a job, infer legal approval, or authorize replay.
 * A stored "document_writer.prepared" event has no requestId in its detail:
 * do not manufacture a request-scoped audit proof from type/time proximity.
 */
import { inspectStoredExportRecovery } from "./export-recovery-stored-manifest.mjs";
import { inspectExportRecoveryEvidence } from "./export-recovery-evidence.mjs";

const denied = {canDelete:false,canReplay:false,canMarkCommitted:false,canApprove:false};
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const token = value => typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
const block = (classification, code) => ({classification,codes:[code],...denied});

/** Read-only D1 statements. Callers must authenticate/authorize the case FIRST. */
export const EXPORT_RECOVERY_RECEIPT_SELECT_SQL = `SELECT
 case_id AS caseId,request_id AS requestId,request_hash AS requestHash,mode,
 case_revision AS caseRevision,source_data_version AS sourceDataVersion,
 reference_sha256 AS referenceSha256,status,claim_token AS claimToken,
 artifact_ids_json AS artifactIdsJson,manifest_fingerprint AS manifestFingerprint,
 created_at AS createdAt,updated_at AS updatedAt,committed_at AS committedAt
 FROM case_export_request_receipts WHERE case_id=? AND request_id=? LIMIT 1`;
export const EXPORT_RECOVERY_AUDIT_SELECT_SQL = `SELECT id,case_id AS caseId,actor,type,detail,at
 FROM events WHERE case_id=? AND type IN ('document_writer.prepared','export.generated')
 ORDER BY at DESC,id DESC LIMIT ?`;
/** Include foreign artifact IDs that alias an expected object key; SQL identity
 * may be inspected but foreign-case payload or private contents must not be emitted.
 */
export function exportRecoveryArtifactSelect(caseId, artifactIds) {
  if (typeof caseId !== "string" || !caseId.trim() || caseId.length > 300 ||
      !Array.isArray(artifactIds) || artifactIds.length === 0 ||
      artifactIds.some(id=>!token(id)) || new Set(artifactIds).size !== artifactIds.length) {
    throw new Error("EXPORT_RECOVERY_QUERY_IDENTITY_INVALID");
  }
  const ids = JSON.stringify(artifactIds);
  return {sql:`SELECT id,case_id AS caseId,revision,object_key AS objectKey,hash
    FROM artifacts WHERE id IN (SELECT value FROM json_each(?))
    OR object_key IN (SELECT 'cases/' || ? || '/artifacts/' || value FROM json_each(?))`,
    args:[ids,caseId,ids]};
}
const pick = (row, camel, snake) => Object.prototype.hasOwnProperty.call(row,camel) ?
  row[camel] : row[snake];
/**
 * Takes ONLY observed D1 rows and independent R2 byte-GET proof.
 * undefined/null collections are NOT OBSERVED; [] is observed empty.
 * A positive R2 proof requires verification="r2-get-byte-sha256" AND bytesHash;
 * SQL hashes, object ETags and R2 HEAD metadata are not byte verification.
 */
export function projectExportRecoveryD1Reads(input={}) {
  // A null read and an HTTP/DB error envelope are distinct; never destructure
  // an invalid wrapper or mislabel a 429/503/timeout as an absent receipt.
  if (input === null) return block("inconclusive","D1_READ_INPUT_NOT_OBSERVED");
  if (!record(input) || input instanceof Error ||
      Object.prototype.hasOwnProperty.call(input,"error") ||
      Object.prototype.hasOwnProperty.call(input,"status")) {
    return block("conflict","D1_READ_INPUT_INVALID");
  }
  const {receiptRow,artifactRows=null,auditRows=null,r2BytesProofs=null}=input;
  if (receiptRow === undefined) return block("inconclusive","D1_RECEIPT_NOT_OBSERVED");
  if (receiptRow === null) return block("inconclusive","D1_RECEIPT_OBSERVED_ABSENT");
  if (!record(receiptRow)) return block("conflict","D1_RECEIPT_SHAPE_INVALID");
  const receipt={caseId:pick(receiptRow,"caseId","case_id"),
    requestId:pick(receiptRow,"requestId","request_id"),
    requestHash:pick(receiptRow,"requestHash","request_hash"),
    mode:receiptRow.mode,
    caseRevision:pick(receiptRow,"caseRevision","case_revision"),
    sourceDataVersion:pick(receiptRow,"sourceDataVersion","source_data_version"),
    referenceSha256:pick(receiptRow,"referenceSha256","reference_sha256"),
    status:receiptRow.status,
    artifactIdsJson:pick(receiptRow,"artifactIdsJson","artifact_ids_json"),
    manifestFingerprint:pick(receiptRow,"manifestFingerprint","manifest_fingerprint")};
  if (!token(receipt.requestId) || typeof receipt.caseId !== "string" ||
      !receipt.caseId.trim()) return block("conflict","D1_RECEIPT_IDENTITY_INVALID");

  let projectedRows=null;
  if (artifactRows !== null && artifactRows !== undefined) {
    if (!Array.isArray(artifactRows) || artifactRows.some(row=>!record(row))) {
      return block("conflict","D1_ARTIFACT_ROWS_SHAPE_INVALID");
    }
    projectedRows=artifactRows.map(row=>({id:row.id,
      caseId:pick(row,"caseId","case_id"),revision:row.revision,
      objectKey:pick(row,"objectKey","object_key"),hash:row.hash}));
  }
  let objectProofs=null;
  if (r2BytesProofs !== null && r2BytesProofs !== undefined) {
    if (!Array.isArray(r2BytesProofs) || r2BytesProofs.some(row=>!record(row) ||
        typeof row.objectKey !== "string" || typeof row.exists !== "boolean")) {
      return block("conflict","R2_PROBE_ROWS_SHAPE_INVALID");
    }
    objectProofs=r2BytesProofs.map(row=>({objectKey:row.objectKey,exists:row.exists,
      verifiedSha256:row.exists===true && row.verification==="r2-get-byte-sha256" &&
        typeof row.bytesHash === "string" ? row.bytesHash : null}));
  }
  let auditEvents=null,writerEvents=0;
  if (auditRows !== null && auditRows !== undefined) {
    if (!Array.isArray(auditRows) || auditRows.some(row=>!record(row))) {
      return block("conflict","D1_AUDIT_ROWS_SHAPE_INVALID");
    }
    auditEvents=[];
    for (const row of auditRows) {
      const caseId=pick(row,"caseId","case_id");
      if (typeof caseId !== "string" || caseId!==receipt.caseId ||
          !["document_writer.prepared","export.generated"].includes(row.type) ||
          typeof row.detail!=="string") {
        return block("conflict","D1_AUDIT_ROW_IDENTITY_INVALID");
      }
      let detail;
      try {detail=JSON.parse(row.detail);} catch {return block("conflict","D1_AUDIT_DETAIL_JSON_INVALID");}
      if (!record(detail)) return block("conflict","D1_AUDIT_DETAIL_JSON_INVALID");
      if (row.type==="document_writer.prepared") {
        writerEvents+=1; // detail is a writer receipt: no requestId; do NOT bind it.
      } else if (detail.requestId === receipt.requestId &&
          detail.revision === receipt.caseRevision) {
        auditEvents.push({type:"export.generated",caseId,
          requestId:detail.requestId,revision:detail.revision});
      }
    }
  }
  return {receipt,artifactRows:projectedRows,objectProofs,auditEvents,writerEvents};
}
export async function inspectExportRecoveryFromD1Reads(input, commandHash) {
  const projection=projectExportRecoveryD1Reads(input);
  if (Object.prototype.hasOwnProperty.call(projection,"classification")) return projection;
  const result=await inspectStoredExportRecovery({
    caseData:input?.caseData,caseSnapshot:input?.caseSnapshot,
    receipt:projection.receipt,artifactRows:projection.artifactRows,
    objectProofs:projection.objectProofs,auditEvents:projection.auditEvents},
    commandHash,inspectExportRecoveryEvidence);
  // D1 "document_writer.prepared" has no request ID. Never fabricate that link
  // from a shared timestamp, actor or lookalike writer payload.
  const codes=[...new Set([...(result.codes??[]),
    ...(projection.auditEvents!==null && projection.writerEvents>0 ?
      ["D1_WRITER_EVENT_REQUEST_BINDING_UNPROVEN"] : [])])];
  return {...result,codes,classification:result.classification===
    "evidence_consistent_review_required" ? "inconclusive" : result.classification,
    ...denied};
}
