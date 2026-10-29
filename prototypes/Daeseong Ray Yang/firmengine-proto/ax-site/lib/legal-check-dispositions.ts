export type LegalDispositionRole = "caseworker" | "lawyer";
export type LegalCheckDisposition = { checkId: string; runId: string; subjectFingerprint: string; status: "accepted" | "rejected" | "needs_review"; evidenceFactIds: string[]; reason: string; actor: string; role: LegalDispositionRole; at: string; dependencyFingerprint: string };
export type LegalCheckRun = { id: string; checkId: string; subjectFingerprint: string; dependencyFingerprint: string; status: string; reason?: string; factIds?: string[]; truncated?: boolean; coverageComplete?: boolean; source: "ai" | "human" };
export type LegalDispositionState = "current" | "stale" | "conflict" | "coverage_incomplete" | "unreviewed";

/** Creates a human disposition receipt. AI output is deliberately not an accepted disposition. */
export function recordLegalCheckDisposition(run: LegalCheckRun, input: { status: LegalCheckDisposition["status"]; evidenceFactIds: string[]; reason: string; actor: string; role: LegalDispositionRole; dependencyFingerprint: string; at?: string }): LegalCheckDisposition {
  if (!run.checkId || !run.id || !run.subjectFingerprint) throw new Error("검토 대상 체크와 실행 식별자가 필요합니다.");
  if (!input.actor.trim() || !input.reason.trim() || !input.evidenceFactIds.length) throw new Error("담당자, 구체적 이유, 근거 사실을 지정해야 합니다.");
  return {checkId:run.checkId,runId:run.id,subjectFingerprint:run.subjectFingerprint,status:input.status,evidenceFactIds:[...new Set(input.evidenceFactIds)].sort(),reason:input.reason.trim(),actor:input.actor.trim(),role:input.role,at:input.at??new Date().toISOString(),dependencyFingerprint:input.dependencyFingerprint};
}
/** Current run mismatch, conflicting repeated checks, and partial evidence coverage remain explicit blockers. */
export function legalCheckDispositionState(disposition: LegalCheckDisposition | null | undefined, runs: LegalCheckRun[], current: { subjectFingerprint: string; dependencyFingerprint: string }, options: { truncated?: boolean; coverageComplete?: boolean } = {}): LegalDispositionState {
  if(options.truncated || options.coverageComplete===false) return "coverage_incomplete";
  const relevant=runs.filter(r=>r.checkId===disposition?.checkId && r.subjectFingerprint===current.subjectFingerprint);
  const outcomes=new Set(relevant.map(r=>r.status));
  if(outcomes.size>1) return "conflict";
  if(!disposition) return "unreviewed";
  const run=runs.find(r=>r.id===disposition.runId && r.checkId===disposition.checkId);
  if(!run || !disposition.actor.trim() || !disposition.reason.trim() || !disposition.evidenceFactIds.length || run.subjectFingerprint!==current.subjectFingerprint || disposition.subjectFingerprint!==current.subjectFingerprint || run.dependencyFingerprint!==current.dependencyFingerprint || disposition.dependencyFingerprint!==current.dependencyFingerprint) return "stale";
  return "current";
}
