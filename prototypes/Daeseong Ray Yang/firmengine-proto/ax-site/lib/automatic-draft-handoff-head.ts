/** Read-only staff handoff gate; a head may not target another case or source epoch.
 * This query does not guarantee future consistency through R2 reads or saveCase.
 */
export const AUTOMATIC_DRAFT_HANDOFF_HEAD_SQL =
  "SELECT s.data_version AS dataVersion,c.run_id AS calculationRunId,l.review_run_id AS legalReviewRunId," +
  "c.case_revision AS calculationCaseRevision,l.case_revision AS legalCaseRevision," +
  "r.reference_sha256 AS referenceSha256 " +
  "FROM case_data_change_state s " +
  "JOIN case_calculation_heads c ON c.case_id=s.case_id " +
  "JOIN case_calculation_runs r ON r.id=c.run_id AND r.case_id=s.case_id " +
  "AND r.data_version=s.data_version AND r.case_revision=c.case_revision " +
  "AND r.input_sha256=c.input_sha256 " +
  "JOIN case_legal_review_heads l ON l.case_id=s.case_id " +
  "JOIN case_legal_review_runs lr ON lr.id=l.review_run_id AND lr.case_id=s.case_id " +
  "AND lr.data_version=s.data_version AND lr.case_revision=l.case_revision " +
  "AND lr.calculation_run_id=c.run_id AND lr.input_sha256=l.input_sha256 " +
  "WHERE s.case_id=? AND c.data_version=s.data_version " +
  "AND l.data_version=s.data_version AND l.case_revision=c.case_revision " +
  "AND l.calculation_run_id=c.run_id";
