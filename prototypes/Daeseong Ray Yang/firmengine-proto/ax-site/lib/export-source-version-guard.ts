/**
 * Atomic guard for manual export manifest creation. Case revision/storage_token
 * alone cannot observe new OCR, document, or normalized-feature SQL writes.
 * Keep this predicate in the very same UPDATE cases statement that commits
 * the export manifest; a preflight SELECT is not sufficient.
 */
export const EXPORT_SOURCE_VERSION_CAS_SQL =
  "EXISTS (SELECT 1 FROM case_data_change_state s WHERE s.case_id = ? AND s.data_version = ?)";

export function exportSourceVersionCASParams(caseId: string, dataVersion: number): readonly [string, number] {
  if (typeof caseId !== "string" || !caseId.trim() || !Number.isSafeInteger(dataVersion) || dataVersion < 0)
    throw new Error("EXPORT_SOURCE_VERSION_INVALID");
  return [caseId, dataVersion];
}
