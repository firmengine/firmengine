/** Durable SQL identity for an Export request. Not wired to the HTTP route yet.
 * The claim must happen BEFORE R2 writes; completion must be in the SAME D1
 * atomic batch as the guarded manifest UPDATE and its audit events. Never
 * delete an object or reissue an old request based only on a missing ACK.
 */
export type ExportReceiptStatus = 'claimed' | 'committed' | 'uncertain' | 'failed';
export type ExportReceiptRow = {
  caseId: string; requestId: string; requestHash: string;
  mode: 'draft' | 'final'; caseRevision: number;
  sourceDataVersion: number; referenceSha256: string;
  status: ExportReceiptStatus; manifestFingerprint: string | null;
};
export type ExportReceiptIdentity = Pick<ExportReceiptRow,
  'caseId' | 'requestId' | 'requestHash' | 'mode' |
  'caseRevision' | 'sourceDataVersion' | 'referenceSha256'>;
export type ExportClaim = ExportReceiptIdentity & {
  storageToken: string; claimToken: string; at: string;
};
const sha = /^[0-9a-f]{64}$/;
const token = /^[a-zA-Z0-9_-]{8,128}$/;
export function assertExportClaim(value: ExportClaim): void {
  if (!value.caseId || value.caseId.length > 300 || !token.test(value.requestId)
    || !sha.test(value.requestHash) || !sha.test(value.referenceSha256)
    || (value.mode !== 'draft' && value.mode !== 'final')
    || !Number.isSafeInteger(value.caseRevision) || value.caseRevision < 1
    || !Number.isSafeInteger(value.sourceDataVersion) || value.sourceDataVersion < 1
    || !value.storageToken || !token.test(value.claimToken)
    || !Number.isFinite(Date.parse(value.at))) {
    throw new Error('EXPORT_REQUEST_RECEIPT_INVALID_CLAIM');
  }
}
/** Unique(case_id,request_id) and source/case CAS, no overwrite on conflict. */
export const CLAIM_EXPORT_REQUEST_SQL = `
INSERT INTO case_export_request_receipts
(case_id,request_id,request_hash,mode,case_revision,source_data_version,
 reference_sha256,status,claim_token,artifact_ids_json,manifest_fingerprint,
 created_at,updated_at,committed_at)
SELECT ?,?,?,?,?,?,?,'claimed',?,NULL,NULL,?,?,NULL
FROM cases c JOIN case_data_change_state s ON s.case_id=c.id
WHERE c.id=? AND c.revision=? AND c.storage_token=? AND s.data_version=?
ON CONFLICT(case_id,request_id) DO NOTHING`;
export function claimExportRequest(input: ExportClaim) {
  assertExportClaim(input);
  return {sql: CLAIM_EXPORT_REQUEST_SQL, args: [input.caseId,input.requestId,
    input.requestHash,input.mode,input.caseRevision,input.sourceDataVersion,
    input.referenceSha256,input.claimToken,input.at,input.at,
    input.caseId,input.caseRevision,input.storageToken,input.sourceDataVersion] as const};
}
/** MUST be inserted into the *same* D1 batch as the manifest+audit CAS.
 * The storageToken is the NEW storage token after the guarded case UPDATE.
 * A standalone execution of this statement is forbidden by the caller contract.
 */
export const COMMIT_EXPORT_REQUEST_SQL = `
UPDATE case_export_request_receipts
SET status='committed',artifact_ids_json=?,manifest_fingerprint=?,committed_at=?,updated_at=?
WHERE case_id=? AND request_id=? AND request_hash=? AND claim_token=?
AND status='claimed' AND case_revision=? AND source_data_version=? AND reference_sha256=?
AND EXISTS (SELECT 1 FROM cases c JOIN case_data_change_state s ON s.case_id=c.id
 WHERE c.id=? AND c.revision=? AND c.storage_token=? AND s.data_version=?)`;
export function commitExportRequest(input: ExportClaim & {newStorageToken:string;
  artifactIds:readonly string[]; manifestFingerprint:string}) {
  assertExportClaim(input);
  if (!input.newStorageToken || !input.manifestFingerprint || !input.artifactIds.length
    || new Set(input.artifactIds).size !== input.artifactIds.length
    || input.artifactIds.some(id=>!token.test(id))) throw new Error('EXPORT_REQUEST_RECEIPT_INVALID_ARTIFACT');
  return {sql:COMMIT_EXPORT_REQUEST_SQL,args:[JSON.stringify(input.artifactIds),
    input.manifestFingerprint,input.at,input.at,input.caseId,input.requestId,
    input.requestHash,input.claimToken,input.caseRevision,input.sourceDataVersion,
    input.referenceSha256,input.caseId,input.caseRevision,input.newStorageToken,
    input.sourceDataVersion] as const};
}
export const MARK_EXPORT_UNCERTAIN_SQL = `UPDATE case_export_request_receipts
SET status='uncertain',updated_at=? WHERE case_id=? AND request_id=?
AND request_hash=? AND claim_token=? AND status='claimed'`;
export function markExportUncertain(input:ExportClaim) {
  assertExportClaim(input);
  return {sql:MARK_EXPORT_UNCERTAIN_SQL,args:[input.at,input.caseId,input.requestId,
    input.requestHash,input.claimToken] as const};
}
/** A late A after a successful B must never be treated as a new request.
 * Even a 'current' receipt needs independent SQL artifact hash + R2 HEAD checks
 * before returning an existing artifact. This function NEVER approves files.
 */
export function inspectExportReceipt(row:ExportReceiptRow|null, current:
  ExportReceiptIdentity & {manifestFingerprint:string|null}) {
  if (!row) return 'eligible_for_atomic_claim' as const;
  if (row.caseId!==current.caseId || row.requestId!==current.requestId
    || row.requestHash!==current.requestHash || row.mode!==current.mode
    || row.caseRevision!==current.caseRevision || row.sourceDataVersion!==current.sourceDataVersion
    || row.referenceSha256!==current.referenceSha256) return 'identity_conflict' as const;
  if (row.status==='committed') return row.manifestFingerprint !== null
    && row.manifestFingerprint===current.manifestFingerprint
    ? 'verify_sql_and_r2_before_reuse' as const : 'historical_committed_do_not_reissue' as const;
  if (row.status==='claimed') return 'in_flight_do_not_reclaim' as const;
  return 'manual_reconciliation_required' as const;
}
