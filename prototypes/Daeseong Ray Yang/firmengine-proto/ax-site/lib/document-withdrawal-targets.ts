/**
 * Targets for an atomic document retraction's page-job mutations.
 * The reducer may retract descendants of the requested parent document.
 * Keep all affected page jobs inside the same case-state CAS transaction.
 */
export function documentWithdrawalStatements<T>(
  requestedDocumentId: unknown,
  affectedDocumentIds: unknown,
  makeStatement: (documentId: string) => T,
): T[] {
  if (typeof requestedDocumentId !== "string" || !requestedDocumentId.trim() ||
      !Array.isArray(affectedDocumentIds) || affectedDocumentIds.length === 0)
    throw new Error("DOCUMENT_WITHDRAWAL_TARGETS_INVALID");
  const ids = new Set<string>();
  for (const value of affectedDocumentIds) {
    if (typeof value !== "string" || !value.trim())
      throw new Error("DOCUMENT_WITHDRAWAL_TARGETS_INVALID");
    ids.add(value);
  }
  if (!ids.has(requestedDocumentId))
    throw new Error("DOCUMENT_WITHDRAWAL_TARGETS_INVALID");
  return [...ids].map(makeStatement);
}
