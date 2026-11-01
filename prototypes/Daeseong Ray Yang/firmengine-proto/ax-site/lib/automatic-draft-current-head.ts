/**
 * Read-time guard for a generated review draft. All joined derived heads,
 * immutable runs, and the leased job must describe the same case/source.
 * This read guard is NOT a substitute for the atomic manifest commit CAS.
 */
export const AUTOMATIC_DRAFT_CURRENT_HEAD_SQL =
  "SELECT c.revision AS revision,s.data_version AS dataVersion," +
  "ch.run_id AS calculationRunId,lh.review_run_id AS reviewRunId," +
  "j.lease_token AS leaseToken,j.lease_until AS leaseUntil,j.status AS status " +
  "FROM cases c JOIN case_data_change_state s ON s.case_id=c.id " +
  "JOIN case_calculation_heads ch ON ch.case_id=c.id " +
  "AND ch.data_version=s.data_version AND ch.case_revision=c.revision " +
  "JOIN case_calculation_runs cr ON cr.id=ch.run_id AND cr.case_id=c.id " +
  "AND cr.data_version=s.data_version AND cr.case_revision=c.revision " +
  "AND cr.input_sha256=ch.input_sha256 " +
  "JOIN case_legal_review_heads lh ON lh.case_id=c.id " +
  "AND lh.data_version=s.data_version AND lh.case_revision=c.revision " +
  "AND lh.calculation_run_id=ch.run_id " +
  "JOIN case_legal_review_runs lr ON lr.id=lh.review_run_id AND lr.case_id=c.id " +
  "AND lr.data_version=s.data_version AND lr.case_revision=c.revision " +
  "AND lr.calculation_run_id=ch.run_id " +
  "JOIN case_legal_automation_jobs j ON j.id=? AND j.case_id=c.id " +
  "AND j.data_version=s.data_version AND j.case_revision=c.revision " +
  "AND j.calculation_run_id=ch.run_id AND j.legal_review_run_id=lh.review_run_id " +
  "AND j.reference_sha256=cr.reference_sha256 WHERE c.id=?";

/** Existing draft metadata must not be replayed under another source epoch. */
export const AUTOMATIC_DRAFT_EXISTING_RUN_SQL =
  "SELECT status,artifacts_json AS artifactsJson,data_version AS dataVersion," +
  "case_revision AS caseRevision FROM case_automatic_document_runs " +
  "WHERE legal_review_run_id=? AND case_id=?";
