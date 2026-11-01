/**
 * A4 read-only diagnostic for calculation-poll cleanup ambiguity.
 * This is NOT an acknowledgement, approval, retry instruction or mutation.
 * A current calculation head and an outstanding poll can coexist when the
 * DELETE/ACK after persistence is lost. Do not infer that cleanup occurred.
 */
type PollReconcileRow={
  caseId:string; currentRevision:number; currentDataVersion:number|null;
  pollCaseId:string|null; pollDataVersion:number|null; pollRevision:number|null;
  pollReferenceSha:string|null; pollStatus:string|null; leaseToken:string|null;
  leaseUntil:string|null; headRunId:string|null; headDataVersion:number|null;
  headRevision:number|null; verifiedRunId:string|null; runDataVersion:number|null;
  runRevision:number|null; runReferenceSha:string|null;
};

const CHECK_SQL=[
  "SELECT c.id AS caseId,c.revision AS currentRevision,s.data_version AS currentDataVersion,",
  "p.case_id AS pollCaseId,p.data_version AS pollDataVersion,p.case_revision AS pollRevision,",
  "p.reference_sha256 AS pollReferenceSha,p.status AS pollStatus,p.lease_token AS leaseToken,p.lease_until AS leaseUntil,",
  "h.run_id AS headRunId,h.data_version AS headDataVersion,h.case_revision AS headRevision,",
  "r.id AS verifiedRunId,r.data_version AS runDataVersion,r.case_revision AS runRevision,r.reference_sha256 AS runReferenceSha",
  "FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id",
  "LEFT JOIN case_calculation_poll_jobs p ON p.case_id=c.id",
  "LEFT JOIN case_calculation_heads h ON h.case_id=c.id",
  "LEFT JOIN case_calculation_runs r ON r.id=h.run_id AND r.case_id=c.id",
  "WHERE c.id=?"
].join(" ");

export type PollRecoveryFinding=
  |"case_unobserved"|"source_unobserved"|"active_reference_unobserved"
  |"poll_absent_head_current"|"poll_absent_head_unobserved"
  |"head_unobserved"|"head_not_current"|"poll_source_conflict"
  |"poll_running_with_current_head"|"poll_failed_with_current_head"
  |"poll_state_observed";

export async function inspectCaseCalculationPollRecovery(
 database:D1Database,input:{caseId:string;activeReferenceSha256:string|null|undefined;now?:number}
){
 if(!input.caseId||input.caseId.length>300)throw new Error("CALCULATION_POLL_RECOVERY_INVALID_CASE");
 const row=await database.prepare(CHECK_SQL).bind(input.caseId).first<PollReconcileRow>();
 const base={caseId:input.caseId,evidence:"read_only_point_in_time" as const,approved:false as const,writePerformed:false as const};
 if(!row)return {...base,finding:"case_unobserved" as const,lease:"unobserved" as const,headCurrent:null};
 if(typeof row.currentDataVersion!=="number"||!Number.isSafeInteger(row.currentDataVersion)||row.currentDataVersion<1||!Number.isSafeInteger(row.currentRevision)||row.currentRevision<1)
   return {...base,finding:"source_unobserved" as const,lease:"unobserved" as const,headCurrent:null};
 const sha=input.activeReferenceSha256;
 if(typeof sha!=="string"||!/^[a-f0-9]{64}$/i.test(sha))
   return {...base,finding:"active_reference_unobserved" as const,lease:"unobserved" as const,headCurrent:null};
 const timestamp=row.leaseUntil===null?NaN:Date.parse(row.leaseUntil);
 const now=input.now??Date.now();
 const lease=row.pollCaseId===null||row.pollStatus!=="running"?"not_applicable" as const:
  !Number.isFinite(timestamp)||!Number.isFinite(now)?"unobserved" as const:
  timestamp<=now?"expired" as const:"live" as const;
 const headCurrent=Boolean(row.headRunId&&row.verifiedRunId===row.headRunId&&
   row.headDataVersion===row.currentDataVersion&&row.runDataVersion===row.currentDataVersion&&
   row.headRevision===row.currentRevision&&row.runRevision===row.currentRevision&&
   row.runReferenceSha===sha);
 if(row.pollCaseId===null)
   return {...base,finding:headCurrent?"poll_absent_head_current" as const:"poll_absent_head_unobserved" as const,lease,headCurrent};
 if(!row.headRunId||!row.verifiedRunId)
   return {...base,finding:"head_unobserved" as const,lease,headCurrent:false};
 if(!headCurrent)return {...base,finding:"head_not_current" as const,lease,headCurrent:false};
 if(row.pollDataVersion!==row.currentDataVersion||row.pollRevision!==row.currentRevision||row.pollReferenceSha!==sha)
   return {...base,finding:"poll_source_conflict" as const,lease,headCurrent:true};
 if(row.pollStatus==="running")return {...base,finding:"poll_running_with_current_head" as const,lease,headCurrent:true};
 if(row.pollStatus==="failed")return {...base,finding:"poll_failed_with_current_head" as const,lease,headCurrent:true};
 return {...base,finding:"poll_state_observed" as const,lease,headCurrent:true};
}
