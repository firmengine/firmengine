/**
 * Case export audit records must be inserted in the SAME D1 batch as the
 * case-manifest CAS. A separate after-commit INSERT can fail after the export
 * succeeds, leaving an unrepairable gap in the audit trail.
 *
 * The event is evidence of a committed export, not a legal or court approval.
 */
export type CaseExportAuditType = "document_writer.prepared" | "export.generated";
export type CaseExportAuditEvent = Readonly<{ type: CaseExportAuditType; detail: unknown }>;

export const GUARDED_CASE_AUDIT_EVENT_INSERT_SQL =
  "INSERT INTO events (id,case_id,actor,type,detail,at) " +
  "SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM cases WHERE id = ? AND revision = ? AND storage_token = ?)";

export function caseAuditEventBindings(input: {
  eventId: string;
  caseId: string;
  actorId: string;
  event: CaseExportAuditEvent;
  at: string;
  revision: number;
  storageToken: string;
}): [string, string, string, CaseExportAuditType, string, string, string, number, string] {
  const { eventId, caseId, actorId, event, at, revision, storageToken } = input;
  if (!eventId || !caseId || !actorId || !storageToken || !Number.isSafeInteger(revision) || revision < 0 ||
      !["document_writer.prepared", "export.generated"].includes(event?.type))
    throw new Error("EXPORT_AUDIT_EVENT_INVALID");
  const detail = JSON.stringify(event.detail);
  if (typeof detail !== "string") throw new Error("EXPORT_AUDIT_EVENT_DETAIL_INVALID");
  return [eventId, caseId, actorId, event.type, detail, at, caseId, revision, storageToken];
}
