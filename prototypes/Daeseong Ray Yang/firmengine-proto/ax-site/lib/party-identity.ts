import type { IntakeRun } from "./intake-types.ts";

export type SubjectLinkStatus = "candidate" | "confirmed" | "rejected" | "stale";
export interface SubjectLink {
  linkId: string; intakeRunId: string; intakeSubjectId: string; subjectScope: string;
  typedEntityId: string | null; scopeKey: string; status: SubjectLinkStatus;
  basisRefs: string[]; version: number; reviewer: string | null;
}
/** Build candidates only. Labels and masked strings never establish identity. */
export function candidateSubjectLinks(run: IntakeRun, idFactory: () => string): SubjectLink[] {
  const subjects = run.classifierReceipt?.subjects ?? [...new Map(run.result.claims.map(c => [c.subjectId, { subjectId: c.subjectId }])).values()];
  return subjects.map(subject => ({ linkId: idFactory(), intakeRunId: run.id, intakeSubjectId: subject.subjectId,
    // Classifier subject IDs are stable within a case, while names and masked
    // values are not identity keys. Case scoping is supplied by workflow storage.
    subjectScope: subject.subjectId === "case" ? "case" : subject.subjectId.split(":",1)[0], typedEntityId: null,
    scopeKey: `intake-subject:${subject.subjectId}`,
    status: "candidate", basisRefs: [], version: 1, reviewer: null }));
}
export function confirmSubjectLink(link: SubjectLink, input: { typedEntityId: string; reviewer: string; expectedVersion: number; evidenceRefs: string[] }): SubjectLink {
  if (link.status !== "candidate" || link.version !== input.expectedVersion) throw new Error("Subject link is stale or not a candidate.");
  if (!input.typedEntityId.trim() || !input.reviewer.trim() || !input.evidenceRefs.length) throw new Error("Confirmation requires a typed entity, reviewer, and basis.");
  return { ...link, typedEntityId: input.typedEntityId, status: "confirmed", reviewer: input.reviewer, basisRefs: [...new Set(input.evidenceRefs)], version: link.version + 1 };
}
export function rejectSubjectLink(link: SubjectLink, expectedVersion: number, reviewer: string): SubjectLink {
  if (link.version !== expectedVersion || link.status !== "candidate" || !reviewer.trim()) throw new Error("Subject link cannot be rejected in this state.");
  return { ...link, status: "rejected", reviewer, version: link.version + 1 };
}
