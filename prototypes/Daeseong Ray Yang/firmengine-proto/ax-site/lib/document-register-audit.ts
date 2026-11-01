/** Internal event inserted in the same D1 batch as the corresponding case revision. */
export interface DocumentRegistrationAudit {
  documentId: string;
  sha256: string;
  pageCount: number;
}

export interface DocumentRegistrationAuditWrite extends DocumentRegistrationAudit {
  caseId: string;
  caseRevision: number;
  storageToken: string;
  eventId: string;
  actor: string;
  at: string;
}

export function prepareDocumentRegistrationAudit(db: Pick<D1Database, "prepare">, input: DocumentRegistrationAuditWrite): D1PreparedStatement {
  if (!input.documentId || !/^[a-f0-9]{64}$/.test(input.sha256) || !Number.isSafeInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > 600)
    throw new Error("DOCUMENT_REGISTRATION_AUDIT_INPUT_INVALID");
  const detail = JSON.stringify({documentId: input.documentId, sha256: input.sha256, pageCount: input.pageCount});
  return db.prepare(`INSERT INTO events (id,case_id,actor,type,detail,at)
    SELECT ?,?,?,?,?,?
    WHERE EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=? AND storage_token=?)
      AND EXISTS (SELECT 1 FROM documents WHERE id=? AND case_id=? AND sha256=? AND page_count=?)`)
    .bind(input.eventId, input.caseId, input.actor, "document.registered", detail, input.at,
      input.caseId, input.caseRevision, input.storageToken,
      input.documentId, input.caseId, input.sha256, input.pageCount);
}
