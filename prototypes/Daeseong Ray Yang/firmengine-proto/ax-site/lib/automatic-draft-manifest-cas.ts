/**
 * One D1 batch may finish an automatic review draft only while its case,
 * source, calculator, lawyer-review and worker lease are simultaneously current.
 * Its analysis receipt is inserted conditionally by the same predicate: a
 * no-op UPDATE must never leave a misleading successful writer receipt.
 */
export interface AutomaticDraftManifestCasInput {
  caseId: string;
  caseRevision: number;
  dataVersion: number;
  calculationRunId: string;
  legalReviewRunId: string;
  jobId: string;
  leaseToken: string;
  referenceSha256: string;
  runId: string;
  artifactsJson: string;
  receiptJson: string;
  at: string;
}

export function buildAutomaticDraftManifestCas(input: AutomaticDraftManifestCasInput) {
  const currentHeads =
    "EXISTS (SELECT 1 FROM cases c " +
    "JOIN case_data_change_state s ON s.case_id=c.id " +
    "JOIN case_calculation_heads h ON h.case_id=c.id AND h.data_version=s.data_version AND h.case_revision=c.revision " +
    "JOIN case_calculation_runs cr ON cr.id=h.run_id " +
    "JOIN case_legal_review_heads l ON l.case_id=c.id AND l.data_version=s.data_version " +
      "AND l.case_revision=c.revision AND l.calculation_run_id=h.run_id " +
    "JOIN case_legal_automation_jobs j ON j.case_id=c.id AND j.id=? " +
    "WHERE c.id=? AND c.revision=? AND s.data_version=? AND h.run_id=? " +
      "AND l.review_run_id=? AND cr.reference_sha256=? " +
      "AND j.data_version=s.data_version AND j.case_revision=c.revision " +
      "AND j.calculation_run_id=h.run_id AND j.legal_review_run_id=l.review_run_id " +
      "AND j.status='running' AND j.lease_token=? AND j.lease_until>?)";
  const headParams = [input.jobId, input.caseId, input.caseRevision, input.dataVersion,
    input.calculationRunId, input.legalReviewRunId, input.referenceSha256,
    input.leaseToken, input.at];
  const pending =
    "EXISTS (SELECT 1 FROM case_automatic_document_runs d WHERE d.id=? AND d.case_id=? " +
    "AND d.legal_review_run_id=? AND d.data_version=? AND d.case_revision=? AND d.status='pending')";
  const pendingParams = [input.runId, input.caseId, input.legalReviewRunId,
    input.dataVersion, input.caseRevision];
  return {
    receiptSql: "INSERT INTO analyses(id,case_id,revision,type,payload,at) " +
      "SELECT ?,?,?,'automatic_draft_writer_receipt',?,? WHERE " + pending + " AND " + currentHeads,
    receiptParams: ["auto-draft-receipt:" + input.runId, input.caseId,
      input.caseRevision, input.receiptJson, input.at, ...pendingParams, ...headParams],
    finishSql: "UPDATE case_automatic_document_runs SET status='complete'," +
      "artifacts_json=?,reason=NULL,updated_at=? " +
      "WHERE id=? AND case_id=? AND legal_review_run_id=? AND data_version=? " +
      "AND case_revision=? AND status='pending' AND " + currentHeads,
    finishParams: [input.artifactsJson, input.at, ...pendingParams, ...headParams],
  };
}
