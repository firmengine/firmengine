/** A structural gate for unattended REVIEW drafts, separate from legal
 * sufficiency, OCR truth, source recognition or official e-filing approval.
 * Every expected non-repeating form token must have one exact persisted
 * identity. Repeat rows, when present, contain all declared group tokens.
 * Optional unknown VALUES remain placeholders in a review-only draft.
 */
export const AUTOMATIC_DRAFT_PROJECTION_VERSION="automatic-draft-projection/1" as const;
export type ProjectedValueKind="source"|"derived"|"prose"|"layout";
export interface ProjectionExpectation {
 formCode:string;token:string;valueKind:ProjectedValueKind;repeatGroup:string|null;
}
export interface ProjectionFieldIdentity {
 formCode:string;token:string;valueKind:string;subjectId?:string|null;rowOrdinal?:number|null;
}
export interface AutomaticDraftProjectionInput {
 expected:readonly ProjectionExpectation[];fields:readonly ProjectionFieldIdentity[];
 projectionError?:string|null;claimedPersistedCount?:number|null;
}
const identity=(code:string,token:string)=>JSON.stringify([code,token]);
const rowIdentity=(code:string,group:string,row:number)=>JSON.stringify([code,group,row]);
export function assessAutomaticDraftProjection(input:AutomaticDraftProjectionInput) {
 const reasons=new Set<string>(),expected=new Map<string,ProjectionExpectation>();
 for(const e of input.expected){
  const key=identity(e.formCode,e.token);
  if(!e.formCode||!e.token||expected.has(key))reasons.add("DOCUMENT_FIELD_EXPECTATION_INVALID");
  expected.set(key,e);
 }
 if(input.projectionError)reasons.add("DOCUMENT_FIELD_PROJECTION_FAILED");
 if(!expected.size||![...expected.values()].some(x=>!x.repeatGroup))
  reasons.add("DOCUMENT_FIELD_EXPECTATION_MISSING");
 if(!input.fields.length)reasons.add("DOCUMENT_FIELD_PROJECTION_EMPTY");
 if(input.fields.length>5000)reasons.add("DOCUMENT_FIELD_PROJECTION_SIZE_LIMIT");
 if(input.claimedPersistedCount!==undefined&&input.claimedPersistedCount!==null&&
    (!Number.isSafeInteger(input.claimedPersistedCount)||input.claimedPersistedCount!==input.fields.length))
    reasons.add("DOCUMENT_FIELD_PROJECTION_STORAGE_MISMATCH");
 const observed=new Set<string>(),repeated=new Map<string,Set<string>>(),repeatSubjects=new Map<string,string|null>();
 for(const f of input.fields){
  if(typeof f.formCode!=="string"||typeof f.token!=="string"||
     f.subjectId!==undefined&&f.subjectId!==null&&typeof f.subjectId!=="string"){
   reasons.add("DOCUMENT_FIELD_PROJECTION_INVALID_ROW");continue;
  }
  const expectedField=expected.get(identity(f.formCode,f.token));
  if(!expectedField){reasons.add("DOCUMENT_FIELD_PROJECTION_UNEXPECTED_TOKEN");continue;}
  if(f.valueKind!==expectedField.valueKind)reasons.add("DOCUMENT_FIELD_PROJECTION_VALUE_KIND_MISMATCH");
  if(expectedField.repeatGroup){
   if(!Number.isSafeInteger(f.rowOrdinal)||Number(f.rowOrdinal)<0){
    reasons.add("DOCUMENT_FIELD_PROJECTION_REPEAT_IDENTITY_MISSING");continue;
   }
   const row=rowIdentity(f.formCode,expectedField.repeatGroup,f.rowOrdinal!);
   const subjectId=f.subjectId??null;
   if(repeatSubjects.has(row)&&repeatSubjects.get(row)!==subjectId)
    reasons.add("DOCUMENT_FIELD_PROJECTION_REPEAT_SUBJECT_MISMATCH");
   else repeatSubjects.set(row,subjectId);
   const group=repeated.get(row)??new Set<string>();group.add(f.token);repeated.set(row,group);
  }else if(f.rowOrdinal!==null&&f.rowOrdinal!==undefined||
           f.subjectId!==null&&f.subjectId!==undefined){
   reasons.add("DOCUMENT_FIELD_PROJECTION_SCALAR_IDENTITY_INVALID");
  }
  const key=JSON.stringify([f.formCode,f.token,f.rowOrdinal??null,f.subjectId??null]);
  if(observed.has(key))reasons.add("DOCUMENT_FIELD_PROJECTION_DUPLICATE_TOKEN");
  observed.add(key);
 }
 for(const spec of expected.values())if(!spec.repeatGroup&&
   !observed.has(JSON.stringify([spec.formCode,spec.token,null,null])))
   reasons.add("DOCUMENT_FIELD_PROJECTION_REQUIRED_TOKEN_MISSING");
 for(const [key,tokens] of repeated){
  const [formCode,group]=JSON.parse(key) as [string,string,number];
  for(const spec of expected.values())if(spec.formCode===formCode&&
     spec.repeatGroup===group&&!tokens.has(spec.token))
   reasons.add("DOCUMENT_FIELD_PROJECTION_REPEAT_ROW_INCOMPLETE");
 }
 const observedForms=new Set(input.fields.map(f=>f.formCode));
 for(const code of new Set([...expected.values()].map(x=>x.formCode)))
   if(!observedForms.has(code))reasons.add("DOCUMENT_FIELD_PROJECTION_FORM_MISSING");
 return {schemaVersion:AUTOMATIC_DRAFT_PROJECTION_VERSION,eligible:reasons.size===0,
   blockers:[...reasons].sort(),expectedTokenCount:expected.size,
   projectedFieldCount:input.fields.length,repeatedRowCount:repeated.size,
   legalApprovalInferred:false as const,readyForElectronicFiling:false as const};
}
/** Do not automatically repeat 95 model calls for a source-stable form error. */
export function projectionRepairRequired(outcome:unknown):boolean{
 if(!outcome||typeof outcome!=="object"||Array.isArray(outcome))return false;
 const o=outcome as Record<string,unknown>;
 // Historical review_required jobs may predate documentProjectionBlockers.
 // A *saved* 95-check run with zero form fields is repairable without another
 // advisory model call; an unsaved or missing review is never auto-approved.
 if(o.documentFieldCount===0&&typeof o.reviewRunId==="string"&&o.reviewRunId.length>0)return true;
 return typeof o.documentFieldProjectionError==="string"&&o.documentFieldProjectionError.length>0
   ||Array.isArray(o.documentProjectionBlockers)&&o.documentProjectionBlockers.some(
      (v:unknown)=>typeof v==="string"&&v.startsWith("DOCUMENT_FIELD_"))
   ||Array.isArray(o.blockers)&&o.blockers.some(
      (v:unknown)=>typeof v==="string"&&v.startsWith("LAWGRAPH_FORM_FIELD_PROJECTION_"));
}
