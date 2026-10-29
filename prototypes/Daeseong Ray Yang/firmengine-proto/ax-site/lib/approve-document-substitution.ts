/** Human-authorized substitute evidence mapping; no primary requirement is erased. */
import type { CaseRequirement, SubstitutionProof, SubstitutionReview } from "./case-requirements.ts";
import type { Fact } from "./domain.ts";
import type { IntakeCatalog } from "./intake-types.ts";
import { substitutionFactFingerprint } from "./substitution-fingerprint.ts";
const check=(condition:boolean,code:string)=>{if(!condition)throw new Error("SUBSTITUTION_"+code);};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const date=(value:unknown):value is string=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
const unique=(ids:string[])=>new Set(ids).size===ids.length;
export async function approveDocumentSubstitution(input:{
 requirement:CaseRequirement;proposal:unknown;catalog:IntakeCatalog;
 facts:readonly Fact[];courtId:string;actor:string;at:string;reason:string;basisRefs:readonly string[];
}):Promise<SubstitutionReview> {
 const {requirement,proposal,catalog}=input;
 check(record(proposal),"INVALID_PROPOSAL");
 if(!record(proposal))throw new Error("SUBSTITUTION_INVALID_PROPOSAL");
 const allowed=new Set(["alternativeDocumentTypeIds","proofs","periodStart","periodEnd","exceptionReason","employerSigned"]);
 check(Object.keys(proposal).every(k=>allowed.has(k)),"UNEXPECTED_FIELDS");
 const alternatives=proposal.alternativeDocumentTypeIds;
 check(Array.isArray(alternatives)&&alternatives.length>0&&alternatives.length<=8&&alternatives.every(x=>typeof x==="string"),"INVALID_ALTERNATIVES");
 const ids=alternatives as string[];
 check(unique(ids)&&ids.every(id=>requirement.alternatives.some(a=>a.id===id)),"ALTERNATIVE_NOT_REGISTERED");
 check(!requirement.selectedAlternativeId||ids.includes(requirement.selectedAlternativeId),"SELECTED_CANDIDATE_CHANGED");
 const activeDocIds=new Set(catalog.documents.map(d=>d.id));
 check(activeDocIds.has(requirement.intakeDocumentTypeId)&&ids.every(id=>activeDocIds.has(id)),"CATALOG_CHANGED");
 const currentAllowed=new Set(catalog.rules.filter(rule=>rule.enabled&&requirement.matchedRuleIds.includes(rule.id))
   .flatMap(rule=>rule.documents.filter(need=>need.documentTypeId===requirement.intakeDocumentTypeId).flatMap(need=>need.alternatives)));
 check(ids.every(id=>currentAllowed.has(id)),"COURT_RULE_ALTERNATIVE_CHANGED");

 const fields=requirement.sourceEvidenceFields??[];
 check(fields.length>0&&unique(fields),"PRIMARY_FIELDS_UNAVAILABLE");
 check(Array.isArray(proposal.proofs)&&proposal.proofs.length===fields.length,"PROOF_FIELDS_INCOMPLETE");
 const factIds=new Set(input.facts.map(f=>f.id));
 const seen=new Set<string>();
 const proofs:SubstitutionProof[]=[];
 for(const item of proposal.proofs as unknown[]){
  check(record(item),"INVALID_PROOF");
  if(!record(item))continue;
  check(Object.keys(item).every(k=>["requiredField","factIds"].includes(k)),"INVALID_PROOF_FIELDS");
  check(typeof item.requiredField==="string"&&fields.includes(item.requiredField)&&!seen.has(item.requiredField),"INVALID_PROOF_LABEL");
  check(Array.isArray(item.factIds)&&item.factIds.length>0&&item.factIds.length<=20&&item.factIds.every(x=>typeof x==="string"&&factIds.has(x)),"INVALID_PROOF_FACTS");
  const sourceFactIds=item.factIds as string[];
  check(unique(sourceFactIds),"DUPLICATE_PROOF_FACT");
  seen.add(item.requiredField as string);
  proofs.push({requiredField:item.requiredField as string,factIds:sourceFactIds});
 }
 check(seen.size===fields.length,"PROOF_FIELDS_INCOMPLETE");
 check(date(proposal.periodStart)&&date(proposal.periodEnd)&&String(proposal.periodStart)<=String(proposal.periodEnd),"INVALID_PERIOD");
 check(typeof proposal.exceptionReason==="string"&&proposal.exceptionReason.length<=3000,"INVALID_EXCEPTION_REASON");
 check(typeof proposal.employerSigned==="boolean","INVALID_SIGNED_STATUS");
 check(input.actor.trim().length>0&&input.reason.trim().length>0&&input.basisRefs.length>0&&input.basisRefs.every(x=>typeof x==="string"&&x.trim().length>0),"MISSING_REVIEW_BASIS");
 check(typeof input.courtId==="string"&&input.courtId.trim().length>0,"UNKNOWN_COURT");
 const byId=new Map(input.facts.map(f=>[f.id,f]));
 const proofFactIds=[...new Set(proofs.flatMap(p=>p.factIds))];
 const proofFingerprints=[] as {factId:string;sha256:string}[];
 for(const factId of proofFactIds){
  const fact=byId.get(factId);
  check(!!fact,"PROOF_FACT_MISSING");
  proofFingerprints.push({factId,sha256:await substitutionFactFingerprint(fact!)});
 }
 return {
  originalDocumentTypeId:requirement.intakeDocumentTypeId,alternativeDocumentTypeIds:ids,
  proofs,proofFingerprints,periodStart:proposal.periodStart as string,periodEnd:proposal.periodEnd as string,
  courtId:input.courtId,catalogVersion:catalog.version,exceptionReason:(proposal.exceptionReason as string).trim(),
  employerSigned:proposal.employerSigned as boolean,reviewer:input.actor,reviewedAt:input.at,
  reason:input.reason,basisRefs:[...new Set(input.basisRefs)]
 };
}
