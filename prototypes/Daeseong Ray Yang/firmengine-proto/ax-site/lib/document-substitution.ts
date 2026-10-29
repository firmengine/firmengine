/**
 * Fail-closed, source-bound substitution reconciliation (no PDF/DB deletion).
 * A reviewed alternative may hide the PRIMARY REQUEST from the active checklist
 * only while every primary proof field is supported by current approved facts,
 * the original file identities/period remain valid, and the court's published
 * alternative permission still matches the active catalogue.
 *
 * This is not a judicial acceptance decision. Unknown court rules and all
 * unenumerated pairs remain active and require case-specific legal review.
 */
import type { CaseRequirement, SubstitutionReview } from "./case-requirements.ts";
import type { DocumentMatch } from "./document-fulfillment.ts";
import type { EvidenceDocument, EvidencePage, Fact } from "./domain.ts";
import type { IntakeCatalog } from "./intake-types.ts";
import { substitutionFactFingerprint } from "./substitution-fingerprint.ts";

export const DOCUMENT_SUBSTITUTION_VERSION = "document-substitution/1" as const;
export type SubstitutionStatus = "original_required" | "review_required" | "partial" | "inactive_by_substitution" | "restored";
export interface SubstitutionView {
  status: SubstitutionStatus;
  activeRequest: boolean;
  originalDocumentTypeId: string;
  candidateDocumentTypeIds: string[];
  coveredFields: string[];
  missingFields: string[];
  reasonCodes: string[];
  supportDocumentIds: string[];
  reviewedBy: string | null;
}
export interface SubstitutionPageType { documentId: string; page: number; documentTypeId: string | null }
export interface SubstitutionContext {
  requirement: CaseRequirement;
  matches: readonly DocumentMatch[];
  documents: readonly EvidenceDocument[];
  pages: readonly EvidencePage[];
  facts: readonly Fact[];
  subjectLink?: {status:string;typedEntityId?:string|null;linkId:string};
  courtId: string;
  asOf: string;
  catalogVersion?: number | null;
  pendingCourtPolicyChange?: boolean;
  pageTypes?: readonly SubstitutionPageType[];
}
const uniq = <T>(values:readonly T[]) => [...new Set(values)];
const validDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
const nextDay=(d:string)=>new Date(Date.parse(d+"T00:00:00Z")+86400000).toISOString().slice(0,10);
const idRoute=/^shared-document:([a-z0-9_]+)@[A-Za-z0-9_.:-]+$/;
function observedType(input:SubstitutionContext, documentId:string, page:number):string|null {
  const type=input.pageTypes?.find(p=>p.documentId===documentId&&p.page===page)?.documentTypeId;
  if(type)return type;
  const reported=input.pages.find(p=>p.documentId===documentId&&p.page===page)?.documentType;
  if(!reported)return null;
  return idRoute.exec(reported)?.[1]??null;
}
function periodCovered(review:SubstitutionReview,matches:readonly DocumentMatch[]):boolean {
  if(!validDate(review.periodStart)||!validDate(review.periodEnd)||review.periodEnd<review.periodStart)return false;
  const spans=matches.filter(m=>m.coveredPeriod?.start&&m.coveredPeriod.end)
    .map(m=>m.coveredPeriod!).filter(p=>validDate(p.start)&&validDate(p.end)&&p.start<=p.end)
    .sort((a,b)=>a.start.localeCompare(b.start));
  let through=review.periodStart;
  for(const span of spans){
    if(span.end<through)continue;
    if(span.start>through)return false;
    if(span.end>=review.periodEnd)return true;
    through=nextDay(span.end);
  }
  return false;
}
function minimumMonths(start:string,end:string):number {
  if(!validDate(start)||!validDate(end)||end<start)return 0;
  const a=new Date(start+"T00:00:00Z"),b=new Date(end+"T00:00:00Z");
  const count=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth()+1;
  return count>120?0:count;
}
function allowedPublishedPath(requirement:CaseRequirement,review:SubstitutionReview,courtId:string):string|null {
  if(!["seoul","busan"].includes(courtId))return null;
  const source=courtId==="seoul"?"SRC-INTAKE-SEOUL-402":"SRC-INTAKE-BUSAN-402";
  if(!requirement.sourceIds.includes(source))return null;
  if(review.originalDocumentTypeId==="salary_withholding"&&review.alternativeDocumentTypeIds.every(t=>["salary_statement","salary_bank_statement"].includes(t))){
    if(review.exceptionReason.trim().length<10)return null; // court §402(2)(3)(a): unavoidable absence
    if(review.alternativeDocumentTypeIds.includes("salary_statement")&&!review.employerSigned)return null;
    if(review.alternativeDocumentTypeIds.includes("salary_bank_statement")&&minimumMonths(review.periodStart,review.periodEnd)<6)return null;
    return source;
  }
  if(review.originalDocumentTypeId==="business_income_report"&&review.alternativeDocumentTypeIds.length===1&&review.alternativeDocumentTypeIds[0]==="financial_statement")
    return source; // §402(2)(3)(b), still needs exact full-field proof
  return null; // "or similar" does not authorize arbitrary automatic acceptance
}
function usable(fact:Fact):boolean {
  if(fact.state!=="verified"||fact.recognition!=="accepted")return false;
  if(!fact.canonicalFieldId||fact.value===null||fact.value===undefined||fact.value==="")return false;
  if(fact.validation?.some(issue=>issue.severity==="error"))return false;
  const text=typeof fact.value==="string"?fact.value.trim():"";
  if(/^(unknown|unreadable|masked|해당없음|미확인|판독불가|누락|공란)$/i.test(text))return false;
  return true;
}
function base(requirement:CaseRequirement,reasonCodes:string[],status:SubstitutionStatus="review_required"):SubstitutionView{
  return {status,activeRequest:true,originalDocumentTypeId:requirement.intakeDocumentTypeId,
    candidateDocumentTypeIds:requirement.alternatives.map(a=>a.id),
    coveredFields:[],missingFields:[...(requirement.sourceEvidenceFields??[])],reasonCodes:uniq(reasonCodes),
    supportDocumentIds:[],reviewedBy:requirement.substitutionReview?.reviewer??null};
}
export async function reconcileDocumentSubstitution(input:SubstitutionContext):Promise<SubstitutionView> {
  const r=input.requirement,review=r.substitutionReview,fields=r.sourceEvidenceFields??[];
  if(!r.alternatives.length)return base(r,["NO_DECLARED_ALTERNATIVES"],"original_required");
  if(!review)return base(r,["REVIEW_NOT_RECORDED"],"review_required");
  const problems:string[]=[];
  if(review.originalDocumentTypeId!==r.intakeDocumentTypeId)problems.push("ORIGINAL_TYPE_CHANGED");
  const selected=uniq(review.alternativeDocumentTypeIds);
  if(!selected.length||selected.length!==review.alternativeDocumentTypeIds.length||selected.some(id=>!r.alternatives.some(a=>a.id===id)))problems.push("ALTERNATIVE_NOT_DECLARED");
  if(r.selectedAlternativeId&&!selected.includes(r.selectedAlternativeId))problems.push("SELECTED_ALTERNATIVE_CHANGED");
  if(!fields.length||uniq(fields).length!==fields.length)problems.push("PRIMARY_PROOF_FIELDS_UNAVAILABLE");
  if(!review.reviewer.trim()||!review.reason.trim()||!review.basisRefs.length||!validDate(review.reviewedAt.slice(0,10)))problems.push("HUMAN_REVIEW_INCOMPLETE");
  if(!input.courtId||review.courtId!==input.courtId||!validDate(input.asOf)||review.periodEnd>input.asOf)problems.push("COURT_OR_PERIOD_CHANGED");
  if(input.catalogVersion===undefined||input.catalogVersion===null||review.catalogVersion!==input.catalogVersion||input.pendingCourtPolicyChange)problems.push("COURT_POLICY_RECHECK_REQUIRED");
  if(!allowedPublishedPath(r,review,input.courtId))problems.push("PUBLISHED_SUBSTITUTION_POLICY_NOT_CONFIRMED");
  if(!input.subjectLink||input.subjectLink.status!=="confirmed"||!input.subjectLink.typedEntityId)problems.push("SUBJECT_NOT_CONFIRMED");
  if(fields.length!==review.proofs.length||uniq(review.proofs.map(p=>p.requiredField)).length!==fields.length||fields.some(f=>!review.proofs.some(p=>p.requiredField===f)))problems.push("PROOF_SLOTS_INCOMPLETE");
  const proofIds=uniq(review.proofs.flatMap(item=>item.factIds));
  const snapshots=review.proofFingerprints??[];
  if(snapshots.length!==proofIds.length||uniq(snapshots.map(item=>item.factId)).length!==proofIds.length
    ||proofIds.some(id=>!snapshots.some(item=>item.factId===id&&/^[a-f0-9]{64}$/.test(item.sha256))))problems.push("PROOF_SNAPSHOT_MISSING");
  if(!problems.length)for(const snapshot of snapshots){
    const current=input.facts.find(fact=>fact.id===snapshot.factId);
    if(!current||await substitutionFactFingerprint(current)!==snapshot.sha256){problems.push("SOURCE_FACT_CHANGED");break;}
  }
  if(problems.length)return base(r,problems,"restored");
  const accepted=input.matches.filter(m=>m.requirementId===r.requirementId&&m.state==="accepted"
    &&m.subjectLinkId===input.subjectLink?.linkId&&input.documents.some(d=>d.id===m.documentId&&d.status==="active"&&d.sha256===m.sourceDocumentHash));
  const approvedMatches=accepted.filter(match=>match.pageIds.some(pageId=>{
    const prefix=match.documentId+":";
    return pageId.startsWith(prefix)&&selected.includes(observedType(input,match.documentId,Number(pageId.slice(prefix.length)))??"");
  }));
  const proofMatched=new Map<string,string[]>(),support=new Set<string>();
  for(const field of fields)proofMatched.set(field,[]);
  for(const proof of review.proofs){
    if(!proof.factIds.length||uniq(proof.factIds).length!==proof.factIds.length)continue;
    for(const factId of proof.factIds){
      const fact=input.facts.find(f=>f.id===factId);
      if(!fact||!usable(fact)||fact.subjectId!==input.subjectLink?.typedEntityId)continue;
      const valid=fact.refs.some(ref=>{
        const doc=input.documents.find(d=>d.id===ref.documentId&&d.status==="active"&&d.sha256===ref.sourceHash);
        const page=input.pages.find(p=>p.documentId===ref.documentId&&p.page===ref.page&&p.role==="evidence");
        const match=accepted.find(m=>m.documentId===ref.documentId&&m.sourceDocumentHash===doc?.sha256&&m.pageIds.includes(ref.documentId+":"+ref.page));
        return !!doc&&!!page&&!!match&&selected.includes(observedType(input,doc.id,ref.page)??"");
      });
      if(valid){
        proofMatched.get(proof.requiredField)?.push(factId);
        for(const ref of fact.refs)if(approvedMatches.some(m=>m.documentId===ref.documentId&&m.pageIds.includes(ref.documentId+":"+ref.page)))support.add(ref.documentId);
      }
    }
  }
  const covered=fields.filter(f=>(proofMatched.get(f)?.length??0)>0),missing=fields.filter(f=>!covered.includes(f));
  if(!accepted.length)problems.push("NO_ACCEPTED_ALTERNATIVE_DOCUMENT");
  if(missing.length)problems.push("REQUIRED_PROOF_FIELDS_MISSING");
  if(!periodCovered(review,approvedMatches))problems.push("REQUIRED_PERIOD_NOT_COVERED");
  if(selected.some(docType=>!accepted.some(m=>m.pageIds.some(pageId=>{
    const prefix=m.documentId+":";if(!pageId.startsWith(prefix))return false;
    return observedType(input,m.documentId,Number(pageId.slice(prefix.length)))===docType;
  }))))problems.push("SELECTED_ALTERNATIVE_NOT_MATCHED");
  return {
    status:problems.length?"restored":"inactive_by_substitution",
    activeRequest:problems.length>0,
    originalDocumentTypeId:r.intakeDocumentTypeId,
    candidateDocumentTypeIds:r.alternatives.map(a=>a.id),
    coveredFields:covered,missingFields:missing,reasonCodes:uniq(problems),
    supportDocumentIds:[...support].sort(),reviewedBy:review.reviewer,
  };
}
/** Every catalogue item is evaluated: unlinked/uncertain items are not waived. */
export function auditSubstitutionCatalog(catalog:IntakeCatalog){
  const byId=new Map(catalog.documents.map(d=>[d.id,d])),uncovered:string[]=[];
  const entries=catalog.documents.map(document=>{
    const demands=catalog.rules.filter(r=>r.enabled).flatMap(r=>r.documents.filter(n=>n.documentTypeId===document.id));
    const candidates=uniq(demands.flatMap(n=>n.alternatives)).filter(id=>byId.has(id));
    const alternativeIn=catalog.rules.filter(rule=>rule.enabled).flatMap(rule=>rule.documents.filter(n=>n.alternatives.includes(document.id)));
    if(!demands.length&&!alternativeIn.length)uncovered.push(document.id);
    return {documentTypeId:document.id,fields:[...document.fields],demandRuleCount:demands.length,alternativeUseCount:alternativeIn.length,alternatives:candidates,
      policy:!demands.length&&alternativeIn.length?"alternative_only" as const:candidates.length?"review_required" as const:"original_required" as const};
  });
  return {documentCount:entries.length,evaluatedCount:entries.length,orphanedRequestTypes:uncovered,entries};
}
