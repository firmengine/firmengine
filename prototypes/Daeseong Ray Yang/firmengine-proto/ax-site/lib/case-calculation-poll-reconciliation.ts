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
  headRevision:number|null; headInputSha:string|null; verifiedRunId:string|null; runDataVersion:number|null;
  runRevision:number|null; runReferenceSha:string|null; runInputSha:string|null; runStatus:string|null;
};

const CHECK_SQL=[
  "SELECT c.id AS caseId,c.revision AS currentRevision,s.data_version AS currentDataVersion,",
  "p.case_id AS pollCaseId,p.data_version AS pollDataVersion,p.case_revision AS pollRevision,",
  "p.reference_sha256 AS pollReferenceSha,p.status AS pollStatus,p.lease_token AS leaseToken,p.lease_until AS leaseUntil,",
  "h.run_id AS headRunId,h.data_version AS headDataVersion,h.case_revision AS headRevision,h.input_sha256 AS headInputSha,",
  "r.id AS verifiedRunId,r.data_version AS runDataVersion,r.case_revision AS runRevision,r.reference_sha256 AS runReferenceSha,r.input_sha256 AS runInputSha,r.status AS runStatus",
  "FROM cases c LEFT JOIN case_data_change_state s ON s.case_id=c.id",
  "LEFT JOIN case_calculation_poll_jobs p ON p.case_id=c.id",
  "LEFT JOIN case_calculation_heads h ON h.case_id=c.id",
  "LEFT JOIN case_calculation_runs r ON r.id=h.run_id AND r.case_id=c.id",
  "WHERE c.id=?"
].join(" ");

export type PollRecoveryFinding=
  |"case_unobserved"|"source_unobserved"|"active_reference_unobserved"
  |"poll_absent_head_current"|"poll_absent_head_unobserved"
  |"head_unobserved"|"head_input_unobserved"|"head_input_conflict"|"head_not_current"|"poll_source_conflict"
  |"poll_running_with_current_head"|"poll_failed_with_current_head"
  |"poll_retry_wait_with_current_head"|"poll_state_unobserved"|"poll_state_conflict";

export async function inspectCaseCalculationPollRecovery(
 database:D1Database,input:{caseId:string;activeReferenceSha256:string|null|undefined;now?:number}
){
 if(!input.caseId||input.caseId.length>300)throw new Error("CALCULATION_POLL_RECOVERY_INVALID_CASE");
 const row=await database.prepare(CHECK_SQL).bind(input.caseId).first<PollReconcileRow>();
 // The stored run's declared status is NOT the same as current head identity,
 // independent feature verification, staff approval, or court recognition.
 const rawRunStatus=row?.verifiedRunId?row.runStatus:null;
 const storedRunStatus=rawRunStatus===null||rawRunStatus===undefined?"unobserved" as const:
   rawRunStatus==="computed"||rawRunStatus==="provisional"||rawRunStatus==="missing"?rawRunStatus:"conflict" as const;
 const base={caseId:input.caseId,evidence:"read_only_point_in_time" as const,storedRunStatus,approved:false as const,writePerformed:false as const};
 if(!row)return {...base,finding:"case_unobserved" as const,lease:"unobserved" as const,headCurrent:null};
 if(typeof row.currentDataVersion!=="number"||!Number.isSafeInteger(row.currentDataVersion)||row.currentDataVersion<1||!Number.isSafeInteger(row.currentRevision)||row.currentRevision<1)
   return {...base,finding:"source_unobserved" as const,lease:"unobserved" as const,headCurrent:null};
 const sha=input.activeReferenceSha256;
 if(typeof sha!=="string"||!/^[a-f0-9]{64}$/i.test(sha))
   return {...base,finding:"active_reference_unobserved" as const,lease:"unobserved" as const,headCurrent:null};
 const timestamp=row.leaseUntil===null?NaN:Date.parse(row.leaseUntil);
 const now=input.now??Date.now();
 const lease=row.pollCaseId===null||row.pollStatus!=="running"?"not_applicable" as const:
  typeof row.leaseToken!=="string"||!row.leaseToken.trim()||!Number.isFinite(timestamp)||!Number.isFinite(now)?"unobserved" as const:
  timestamp<=now?"expired" as const:"live" as const;
 // Same run ID and source version alone cannot prove persisted input identity.
 // Missing/malformed evidence is not equivalent to a confirmed digest conflict.
 const digestObserved=(value:unknown)=>typeof value==="string"&&/^[a-f0-9]{64}$/i.test(value);
 if(row.headRunId&&row.verifiedRunId){
   if(!digestObserved(row.headInputSha)||!digestObserved(row.runInputSha))
     return {...base,finding:"head_input_unobserved" as const,lease,headCurrent:null};
   if(row.headInputSha!==row.runInputSha)
     return {...base,finding:"head_input_conflict" as const,lease,headCurrent:false};
 }
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
 if(row.pollStatus==="retry_wait")return {...base,finding:"poll_retry_wait_with_current_head" as const,lease,headCurrent:true};
 // An unrecognized or missing persisted poll status is evidence loss/conflict,
 // not a generic observed state and never authorization to clean up or retry.
 if(typeof row.pollStatus!=="string"||!row.pollStatus.trim())
   return {...base,finding:"poll_state_unobserved" as const,lease,headCurrent:true};
 return {...base,finding:"poll_state_conflict" as const,lease,headCurrent:true};
}
