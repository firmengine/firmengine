import { currentFacts, factSourceLineageIssues, validSourceRef } from "./domain.ts";
import type { CaseData, CaseReadIndex, Fact } from "./domain.ts";

const unresolved="[확인 필요]";
const conflicted="[상충: 원문 대조 필요]";
function usableIdentityFact(data:CaseData,fact:Fact,index?:CaseReadIndex):boolean{
  return typeof fact.value==="string"&&!!fact.value.trim()&&fact.state!=="disputed"&&fact.state!=="retracted"&&fact.recognition!=="rejected"&&fact.refs.length>0&&fact.refs.every(ref=>validSourceRef(data,ref,index))&&!fact.validation.some(v=>v.severity==="error"||["UNCERTAIN_READING","NORMALIZATION_REVIEW"].includes(v.code))&&!factSourceLineageIssues(data,[fact.id],index).some(issue=>issue!=="SOURCE_VERIFICATION_REQUIRED");
}
// Names, addresses and masked identifiers are text; never format them as money.
function valueOf(fact:Fact):string{return typeof fact.value==="string"?fact.value:"";}

/** Resolve identity only from explicit applicant namespace or a same-subject, source-backed applicant role. */
export function applicantIdentityValue(data:CaseData,key:"name"|"address"|"resident_id_masked",index?:CaseReadIndex):string{
  const facts=currentFacts(data,index),roleBySubject=new Map<string,Fact[]>(),directKey=`applicant.${key}`,personKey=`person.${key}`;
  for(const fact of facts)if(["person.role","applicant.role"].includes(fact.key))roleBySubject.set(fact.subjectId,[...(roleBySubject.get(fact.subjectId)??[]),fact]);
  const rejectedDirectSubjects=new Set(facts.filter(fact=>fact.key===directKey&&!usableIdentityFact(data,fact,index)).map(fact=>fact.subjectId));
  const explicitlyApplicant=(subjectId:string)=>{
    const roles=roleBySubject.get(subjectId)??[];
    if(!roles.length)return true;
    if(!roles.every(role=>usableIdentityFact(data,role,index)))return false;
    return new Set(roles.map(role=>valueOf(role).trim().toLowerCase())).size===1&&valueOf(roles[0]).trim().toLowerCase()==="applicant";
  };
  const candidates=facts.filter(fact=>{
    if(fact.key!==directKey&&fact.key!==personKey)return false;
    if(!usableIdentityFact(data,fact,index))return false;
    if(fact.key===directKey)return explicitlyApplicant(fact.subjectId);
    return !rejectedDirectSubjects.has(fact.subjectId)&&explicitlyApplicant(fact.subjectId)&&(roleBySubject.get(fact.subjectId)??[]).length>0;
  });
  const values=[...new Set(candidates.map(valueOf))];
  return values.length===1?values[0]:values.length?conflicted:unresolved;
}

/** Reconciliation keeps CRUD identity as entered and never promotes a unique OCR person row into it.
 * Existing context values have no origin metadata, so they are preserved instead of risking deletion
 * of a value the user explicitly entered; new OCR identity remains resolvable from current facts. */
export function reconcileApplicantContext(data:CaseData):NonNullable<CaseData["context"]["applicant"]>{
  return {...(data.context.applicant??{})};
}
