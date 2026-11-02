/** Commit-time authorization fence for staff automatic review-draft handoff.
 * Human authorization is still independently checked at the HTTP boundary;
 * this predicate prevents a grant revoked during R2/network I/O from winning CAS.
 * Does not imply lawyer review or court filing approval.
 */
export const HANDOFF_REQUIRED_ROLES = ["case_editor", "caseworker_review"] as const;
const oneRole =
  " AND EXISTS (SELECT 1 FROM app_role_grants g " +
  "WHERE g.actor_id=? AND g.role=? AND g.scope_id IN (?,'*') " +
  "AND g.status='active' AND g.effective_from<=strftime('%Y-%m-%dT%H:%M:%fZ','now') " +
  "AND (g.effective_to IS NULL OR g.effective_to>strftime('%Y-%m-%dT%H:%M:%fZ','now')))";
export const HANDOFF_ROLE_GUARD_SQL = HANDOFF_REQUIRED_ROLES.map(() => oneRole).join("");
export function handoffRoleGuardParams(actor:string,caseId:string):string[]{
  if(!actor.trim()||actor==="private-site-service")throw new Error("AUTODRAFT_ROLE_FENCE_ACTOR_REQUIRED");
  return HANDOFF_REQUIRED_ROLES.flatMap(role=>[actor,role,caseId]);
}
