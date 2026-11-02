/**
 * A missing legacy workflow field may receive defaults during an explicit
 * schema migration. An explicitly stored null / scalar is NOT an empty list:
 * reject it before any route can dereference `.some`, `.findIndex`, or `.map`.
 * This predicate only inspects the payload; it never changes case evidence.
 */
const WORKFLOW_ARRAY_FIELDS = [
  "requirements", "subjectLinks", "documentMatches", "tasks",
  "legalDispositions", "procedureEvents", "projectionBlockers", "reviewHistory",
  "decisions", "documentEdits", "requirementConfirmations", "businessNetReviews",
] as const;

export function invalidWorkflowArrayFields(workflow: unknown): string[] {
  if (workflow === undefined) return [];
  if (workflow === null || typeof workflow !== "object" || Array.isArray(workflow)) return ["workflowState"];
  const current = workflow as Record<string, unknown>;
  return WORKFLOW_ARRAY_FIELDS.filter(field =>
    Object.prototype.hasOwnProperty.call(current, field) && !Array.isArray(current[field]));
}
