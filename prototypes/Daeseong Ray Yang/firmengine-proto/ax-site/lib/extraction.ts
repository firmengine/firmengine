import { renderPromptPolicy } from "./reference-prompts.ts";
import { bindCanonicalSourceField, canonicalProjectionKey } from "./canonical-field-binding.ts";
import { calculationSourceCellIssues } from "./ocr-calculation-input.ts";
import { documentFieldContract } from "./document-agent-registry.ts";
import { observeField, pageFieldCoverage, SOURCE_STATES, VERIFICATION_STATES, FIELD_OBSERVATION_INSTRUCTIONS, type ObservationInput, type VerificationState } from "./field-observation.ts";
import { normalizeMoney,type ExtractionPayload,type Fact,type IncomeSource,type Debt,type Asset,type Transaction,type EvidencePage } from "./domain.ts";
import { isSourceMoney,isDebtComponentSlot,debtComponentSlotKey,INSURANCE_SURRENDER_KEYS,isInsuranceSurrenderQuote,quotedInsuranceSurrenderAmount,parseExactOwnershipBps } from "./source-quantity.ts";
import { documentFamily } from "./document-routing.ts";
import { SOURCE_NATURE_HANDOFF_INSTRUCTIONS } from "./source-nature-context.ts";
import { RECORD_CATEGORIES, RECORD_CATEGORY_POLICY_INSTRUCTIONS, RECORD_CATEGORY_STATUS_PROMPT_VERSION, type RecordCategory } from "./category-contract.ts";
export { SOURCE_BBOX_INSTRUCTIONS } from "./field-observation.ts";
export const PROMPT_VERSION=RECORD_CATEGORY_STATUS_PROMPT_VERSION;
const APPLICANT_ROLE_EVIDENCE_RULE=renderPromptPolicy("prompt.extraction.applicant_role_evidence_rule");
export const STATEMENT_SCOPE_RELATION_VERIFY_INSTRUCTIONS=renderPromptPolicy("prompt.extraction.statement_scope_relation_verify_instructions");
const STATEMENT_SCOPE_RELATION_RULE=renderPromptPolicy("prompt.extraction.statement_scope_relation_rule");
export const DOC_FIELDS:Record<string,string>={
  payroll:renderPromptPolicy("prompt.extraction.doc_fields.payroll"),
  debt_certificate:renderPromptPolicy("prompt.extraction.doc_fields.debt_certificate"),
  credit_report:renderPromptPolicy("prompt.extraction.doc_fields.credit_report"),
  health_insurance_arrears:renderPromptPolicy("prompt.extraction.doc_fields.health_insurance_arrears"),
  bank_transactions:renderPromptPolicy("prompt.extraction.doc_fields.bank_transactions"),
  tax_income:renderPromptPolicy("prompt.extraction.doc_fields.tax_income"),
  lease:renderPromptPolicy("prompt.extraction.doc_fields.lease"),
  insurance:renderPromptPolicy("prompt.extraction.doc_fields.insurance"),
  vehicle_valuation:renderPromptPolicy("prompt.extraction.doc_fields.vehicle_valuation"),
  vehicle_registry:renderPromptPolicy("prompt.extraction.doc_fields.vehicle_registry"),
  local_tax:renderPromptPolicy("prompt.extraction.doc_fields.local_tax"),
  property_search:renderPromptPolicy("prompt.extraction.doc_fields.property_search"),
  business_registration:renderPromptPolicy("prompt.extraction.doc_fields.business_registration"),
  health_insurance:renderPromptPolicy("prompt.extraction.doc_fields.health_insurance"),
  health_insurance_payment:renderPromptPolicy("prompt.extraction.doc_fields.health_insurance_payment"),
  tax_revenue:renderPromptPolicy("prompt.extraction.doc_fields.tax_revenue"),
  tax_payment:renderPromptPolicy("prompt.extraction.doc_fields.tax_payment"),
  tax_arrears:renderPromptPolicy("prompt.extraction.doc_fields.tax_arrears"),
  pension:renderPromptPolicy("prompt.extraction.doc_fields.pension"),
  pension_benefit:renderPromptPolicy("prompt.extraction.doc_fields.pension_benefit"),
  identity_family:renderPromptPolicy("prompt.extraction.doc_fields.identity_family")+APPLICANT_ROLE_EVIDENCE_RULE+renderPromptPolicy("prompt.extraction.doc_fields.identity_family.part_2"),
  client_statement:renderPromptPolicy("prompt.extraction.doc_fields.client_statement")+APPLICANT_ROLE_EVIDENCE_RULE+" "+STATEMENT_SCOPE_RELATION_RULE,
  bank_account:renderPromptPolicy("prompt.extraction.doc_fields.bank_account"),
  unknown:renderPromptPolicy("prompt.extraction.doc_fields.unknown"),
};
export function sourceInstructions(type:string){return renderPromptPolicy("prompt.extraction.source_instructions", {value1: DOC_FIELDS[type]||DOC_FIELDS[documentFamily(type)]||DOC_FIELDS.unknown, value2: RECORD_CATEGORY_POLICY_INSTRUCTIONS});}
// Common Korean and English labels route to one canonical family. The printed
// title belongs in a quoted source fact (`document_title`), not documentType.
for(const alias of ["debt_balance_certificate","debt_balance","채무잔액증명서","부채증명서","채무확인서"])DOC_FIELDS[alias]=DOC_FIELDS.debt_certificate;
for(const alias of ["신용정보조회서","신용 정보 조회서","credit_information_report"])DOC_FIELDS[alias]=DOC_FIELDS.credit_report;
for(const alias of ["건강보험료 미납내역서","보험료 미납내역서","health_insurance_premium_arrears"])DOC_FIELDS[alias]=DOC_FIELDS.health_insurance_arrears;
export type ExtractCategory=RecordCategory;
export interface ReadField extends ObservationInput {}
export interface ReadRecord {category:ExtractCategory;label:string;fields:ReadField[];}
export interface PageRead {documentType:string;records:ReadRecord[];warnings:string[];complete:boolean;}
export const PAGE_COMPLETENESS_INSTRUCTIONS=renderPromptPolicy("prompt.extraction.page_completeness_instructions");
const obj=(properties:Record<string,unknown>)=>({type:"object",additionalProperties:false,properties,required:Object.keys(properties)});
const nullable=(type:string)=>({type:[type,"null"]});
const bboxSchema={anyOf:[{type:"array",items:{type:"number"},minItems:4,maxItems:4},{type:"null"}]};
export const PAGE_SCHEMA=obj({documentType:{type:"string"},records:{type:"array",items:obj({category:{type:"string",enum:[...RECORD_CATEGORIES]},label:{type:"string"},fields:{type:"array",items:obj({key:{type:"string"},label:{type:"string"},value:nullable("string"),unit:nullable("string"),quote:nullable("string"),confidence:{type:"string",enum:["clear","uncertain","unreadable"]},bbox:bboxSchema,canonicalFieldId:nullable("string"),sourceState:{type:"string",enum:SOURCE_STATES},applicability:{type:"string",enum:["applicable","not_applicable","unknown"]},applicabilityQuote:nullable("string")})}})},warnings:{type:"array",items:{type:"string"}},complete:{type:"boolean"}});
export const CLASSIFY_SCHEMA=obj({role:{type:"string",enum:["evidence","filed_form","administrative","unknown"]},documentType:{type:"string"},confidence:{type:"string",enum:["high","low"]},reason:{type:"string"}});
export const VERIFY_SCHEMA=obj({
  checks:{type:"array",items:obj({recordIndex:{type:"integer"},fieldIndex:{type:"integer"},categoryStatus:{type:"string",enum:["supported","wrong_category","unclear"]},meaningStatus:{type:"string",enum:["supported","wrong_field","unclear"]},status:{type:"string",enum:["agrees","corrected","unreadable","ambiguous"]},value:nullable("string"),unit:nullable("string"),quote:nullable("string"),bbox:bboxSchema,reason:{type:"string"}})},
  missingFields:{type:"array",items:obj({canonicalFieldId:nullable("string"),sourceState:{type:"string",enum:["present","blank","masked","illegible","explicit_none"]},quote:nullable("string"),bbox:bboxSchema})},
  omittedRows:{type:"boolean"},warnings:{type:"array",items:{type:"string"}},
});
/** A correction needs a second matching value/unit reading, with a source quote from each pass. */
export function applyConfirmedCorrection(field:ReadField,prior:{status:string;categoryStatus?:string;meaningStatus?:string;value:string|null;unit:string|null;quote:string|null}|undefined,current:{status:string;categoryStatus?:string;meaningStatus?:string;value:string|null;unit:string|null;quote:string|null}):boolean{
  if(current.status!=="corrected"||(current.categoryStatus!==undefined&&current.categoryStatus!=="supported")||current.meaningStatus!=="supported"||prior?.status!=="corrected"||(prior.categoryStatus!==undefined&&prior.categoryStatus!=="supported")||prior.meaningStatus!=="supported"||current.value===null||current.value!==prior.value||current.unit?.trim()!==prior.unit?.trim()||!current.quote?.trim()||!prior.quote?.trim())return false;
  field.value=current.value;field.unit=current.unit;field.quote=current.quote;field.confidence="clear";return true;
}
export type FieldReviewCheck={recordIndex:number;fieldIndex:number;categoryStatus?:"supported"|"wrong_category"|"unclear";meaningStatus?:string;status:"agrees"|"corrected"|"unreadable"|"ambiguous";value:string|null;unit:string|null;quote:string|null;bbox?:number[]|null;reason:string};
export interface RepairTarget extends FieldReviewCheck {missingFirstCheck:boolean;bboxIssue?:boolean;bboxOnly?:boolean;bboxConflict?:boolean;sourceBBox?:number[]|null;bboxReference?:number[]|null;}
function checksFor(checks:readonly FieldReviewCheck[]|undefined,ri:number,fi:number){return (checks??[]).filter(c=>c.recordIndex===ri&&c.fieldIndex===fi);}
function recordCategoryStatus(checks:readonly FieldReviewCheck[]|undefined,ri:number):"supported"|"wrong_category"|"unclear"|undefined{
  const statuses=(checks??[]).filter(check=>check.recordIndex===ri).map(check=>check.categoryStatus).filter(status=>status!==undefined);
  if(!statuses.length)return undefined;
  if(statuses.includes("wrong_category"))return "wrong_category";
  if(statuses.some(status=>status!=="supported"))return "unclear";
  return "supported";
}
function validAgreement(field:ReadField,check:FieldReviewCheck){return (check.categoryStatus===undefined||check.categoryStatus==="supported")&&check.meaningStatus==="supported"&&check.status==="agrees"&&check.value===field.value&&check.unit?.trim()===field.unit?.trim()&&!!check.quote?.trim();}
function anchoredNullClaim(field:ReadField){return field.value===null&&["blank","masked","illegible","explicit_none"].includes(field.sourceState??"")&&!!field.quote?.trim()&&isValidSourceBBox(field.bbox);}
function verifierDisposition(check:FieldReviewCheck|undefined,missing=false):VerificationState{
  if(!check)return missing?"missing_check":"unverified";
  if(check.categoryStatus==="wrong_category")return "wrong_field";
  if(check.categoryStatus==="unclear")return "unclear";
  if(check.meaningStatus==="wrong_field")return "wrong_field";
  if(check.status==="unreadable")return "unreadable";
  if(check.meaningStatus==="unclear"||check.status==="ambiguous")return "unclear";
  if(check.status==="corrected")return "value_mismatch";
  if(check.meaningStatus==="supported"&&check.status==="agrees")return "supported";
  return "unclear";
}
function unresolvedDisposition(first:FieldReviewCheck|undefined,second:FieldReviewCheck|undefined,missingFirst:boolean):VerificationState{
  if(first?.categoryStatus==="wrong_category"||second?.categoryStatus==="wrong_category")return "wrong_field";
  if(second?.categoryStatus==="unclear")return "unclear";
  if(first?.meaningStatus==="wrong_field"||second?.meaningStatus==="wrong_field")return "wrong_field";
  if(first?.status==="unreadable"||second?.status==="unreadable")return "unreadable";
  if(first&&second&&(first.status==="corrected"||second.status==="corrected")&&(first.value!==second.value||first.unit?.trim()!==second.unit?.trim()))return "conflicting";
  if(second&&(second.meaningStatus==="unclear"||second.status==="ambiguous"))return "unclear";
  return verifierDisposition(first,missingFirst);
}
export function isValidSourceBBox(bbox:unknown):bbox is [number,number,number,number]{return Array.isArray(bbox)&&bbox.length===4&&bbox.every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1)&&bbox[0]<bbox[2]&&bbox[1]<bbox[3];}
// Re-located source geometry needs substantial area agreement across reads.
// This uses the frozen bbox acceptance threshold rather than treating any
// incidental edge overlap as corroboration.
const BBOX_CORROBORATION_IOU=0.5;
function bboxIoU(a:unknown,b:unknown){
  if(!isValidSourceBBox(a)||!isValidSourceBBox(b))return 0;
  const width=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),height=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  const intersection=width*height,areaA=(a[2]-a[0])*(a[3]-a[1]),areaB=(b[2]-b[0])*(b[3]-b[1]),union=areaA+areaB-intersection;
  return union>0?intersection/union:0;
}
const INVALID_BBOX_WARNING="원문 bbox의 좌표 순서가 올바르지 않아 재확인이 필요합니다.";
function refreshBBoxWarning(read:PageRead){
  read.warnings=read.warnings.filter(w=>w!==INVALID_BBOX_WARNING);
  if(read.records.some(record=>record.fields.some(field=>field.bbox!==null&&!isValidSourceBBox(field.bbox))))read.warnings.push(INVALID_BBOX_WARNING);
}
export function getRepairTargets(read:PageRead,checks:readonly FieldReviewCheck[]|undefined):RepairTarget[]{
  const targets:RepairTarget[]=[];
  read.records.forEach((record,recordIndex)=>record.fields.forEach((field,fieldIndex)=>{
    if(field.value===null&&!anchoredNullClaim(field)) return;
    const matches=checksFor(checks,recordIndex,fieldIndex);
    const first=matches.length===1?matches[0]:undefined;
    const sourceBBox=isValidSourceBBox(field.bbox)?[...field.bbox]:null;
    const firstBBox=isValidSourceBBox(first?.bbox)?[...first!.bbox!]:null;
    const bboxConflict=!!sourceBBox&&!!firstBBox&&bboxIoU(sourceBBox,firstBBox)<BBOX_CORROBORATION_IOU;
    const bboxIssue=!isValidSourceBBox(field.bbox)||!!first&&first.bbox!==undefined&&!isValidSourceBBox(first.bbox)||bboxConflict;
    const categoryStatus=recordCategoryStatus(checks,recordIndex),categoryBlocked=categoryStatus!==undefined&&categoryStatus!=="supported";
    const agreed=!categoryBlocked&&matches.length===1&&validAgreement(field,matches[0]);
    if(agreed&&!bboxIssue)return;
    targets.push({...first??{recordIndex,fieldIndex,meaningStatus:"unclear" as const,status:"ambiguous" as const,value:null,unit:null,quote:null,reason:matches.length>1?"검증 응답이 중복되었습니다.":"첫 검증에서 이 필드 응답이 누락되었습니다."},missingFirstCheck:matches.length!==1,bboxIssue,bboxOnly:bboxIssue&&agreed,bboxConflict,sourceBBox,bboxReference:firstBBox??sourceBBox});
  }));
  return targets;
}
/** Apply first-pass agreements and isolate every disagreement or missing check for one repair pass. */
export function applyFirstVerification(read:PageRead,checks:readonly FieldReviewCheck[]|undefined):{read:PageRead;targets:RepairTarget[]}{
  const next=structuredClone(read);
  next.records.forEach((record,ri)=>{
    record.fields.forEach((field,fi)=>{
      if(field.value===null&&!anchoredNullClaim(field))return;
      const matches=checksFor(checks,ri,fi),first=matches.length===1?matches[0]:undefined;
      const agreement=!!first&&validAgreement(field,first)&&(field.value!==null||isValidSourceBBox(first.bbox));
      if(agreement){field.confidence="clear";field.verificationState="supported";}
      else {field.confidence=first?.status==="unreadable"?"unreadable":"uncertain";field.verificationState=verifierDisposition(first,matches.length===0);}
    });
    const categoryStatus=recordCategoryStatus(checks,ri);
    if(categoryStatus==="wrong_category"||categoryStatus==="unclear")for(const field of record.fields){field.confidence="uncertain";field.verificationState=categoryStatus==="wrong_category"?"wrong_field":"unclear";}
  });
  refreshBBoxWarning(next);
  const targets=getRepairTargets(next,checks);
  // Regional verification can commit without a targeted repair pass. Keep a
  // value agreement separate from unresolved geometry before any receipt is made.
  for(const target of targets)if(target.bboxOnly){
    const field=next.records[target.recordIndex].fields[target.fieldIndex];
    field.confidence="uncertain";field.verificationState="conflicting";
  }
  return {read:next,targets};
}
/** A targeted repair can change only fields that disagreed or were omitted in the first review. */
export function applyTargetedRepair(read:PageRead,firstChecks:readonly FieldReviewCheck[]|undefined,repairChecks:readonly FieldReviewCheck[]|undefined):{read:PageRead;disagreements:number}{
  const next=structuredClone(read),targets=getRepairTargets(read,firstChecks);let disagreements=0;
  for(const target of targets){
    const field=next.records[target.recordIndex]?.fields[target.fieldIndex];if(!field)continue;
    const matches=checksFor(repairChecks,target.recordIndex,target.fieldIndex),second=matches.length===1?matches[0]:undefined;
    if(target.bboxOnly){
      const geometryAgrees=!!second&&isValidSourceBBox(target.bboxReference)&&isValidSourceBBox(second.bbox)&&bboxIoU(target.bboxReference,second.bbox)>=BBOX_CORROBORATION_IOU;
      if(second&&validAgreement(field,second)&&isValidSourceBBox(second.bbox)&&geometryAgrees){field.bbox=[...second.bbox];field.confidence="clear";field.verificationState="supported";continue;}
      // Geometry repair failure does not invalidate an independently agreed
      // value or quote; clear geometry, mark the field unresolved, and preserve
      // the raw reading without allowing it to receive a source receipt.
      field.bbox=null;field.confidence="uncertain";field.verificationState="conflicting";disagreements++;next.warnings.push(`${target.recordIndex+1}행 ${field.label}: 원문 bbox를 독립 재판독으로 확인하지 못했습니다. 값·인용은 보존하지만 원문 검증은 보류합니다.`);continue;
    }
    const first=target.missingFirstCheck?undefined:target;
    const geometryAgrees=!target.bboxIssue||!!second&&isValidSourceBBox(target.bboxReference)&&isValidSourceBBox(second.bbox)&&bboxIoU(target.bboxReference,second.bbox)>=BBOX_CORROBORATION_IOU;
    if(first&&second&&geometryAgrees&&applyConfirmedCorrection(field,first,second)){
      field.sourceState="present";field.applicability="unknown";field.applicabilityQuote=null;field.verificationState="corrected";
      if(isValidSourceBBox(second.bbox))field.bbox=[...second.bbox];else if(target.bboxIssue&&second.bbox===null)field.bbox=null;
      if(target.bboxIssue&&!isValidSourceBBox(field.bbox)){field.bbox=null;disagreements++;next.warnings.push(`${target.recordIndex+1}행 ${field.label}: 교정된 값은 보존했지만 bbox 좌표를 확인하지 못했습니다.`);}
      continue;
    }
    // A missing first check is not a contradictory reading. The extractor's
    // value plus one independent source agreement can resolve it, but only if
    // the verifier repeats the same value and explicit unit with a citation.
    if(target.missingFirstCheck&&second&&validAgreement(field,second)&&geometryAgrees){
      field.confidence="clear";field.verificationState="supported";if(isValidSourceBBox(second.bbox))field.bbox=[...second.bbox];else if(target.bboxIssue&&second.bbox===null)field.bbox=null;
      if(target.bboxIssue&&!isValidSourceBBox(field.bbox)){field.bbox=null;disagreements++;next.warnings.push(`${target.recordIndex+1}행 ${field.label}: 값은 보존했지만 bbox 좌표를 확인하지 못했습니다.`);}
      continue;
    }
    disagreements++;field.confidence=second?.status==="unreadable"?"unreadable":"uncertain";field.verificationState=target.bboxConflict?"conflicting":unresolvedDisposition(first,second,target.missingFirstCheck);
    if(target.bboxIssue&&!geometryAgrees){field.bbox=null;field.confidence="uncertain";field.verificationState="conflicting";next.warnings.push(`${target.recordIndex+1}행 ${field.label}: 원문 위치와 재판독 위치가 일치하지 않아 bbox 및 원문 검증을 보류합니다. 값·인용은 별도로 보존합니다.`);}
    next.warnings.push(`${target.recordIndex+1}행 ${field.label}: 두 차례 원문 판독이 값·단위·인용에서 합의하지 못했습니다.${second?.value!==null&&second?.value!==undefined?` (재판독 후보: ${second.value}${second.unit?` ${second.unit}`:""})`:""}`);
  }
  next.records.forEach((record,ri)=>{
    const categoryStatus=recordCategoryStatus([...(firstChecks??[]),...(repairChecks??[])],ri);
    if(categoryStatus==="wrong_category"||categoryStatus==="unclear")for(const field of record.fields){field.confidence="uncertain";field.verificationState=categoryStatus==="wrong_category"?"wrong_field":"unclear";}
  });
  refreshBBoxWarning(next);
  return {read:next,disagreements};
}
/** Merge only first-pass-agreed fields into an omitted-row reread; unmatchable rows stay partial. */
export function preserveAgreedFieldsAfterOmission(baseline:PageRead,baselineChecks:readonly FieldReviewCheck[]|undefined,reread:PageRead):PageRead{
  const next=structuredClone(reread),taken=new Set<number>(),anchorKeys=new Set(["contract_id","account_id","transaction_id","creditor","origination_date","due_date","date","classification","product_code","label","employer","payer_identity_id","kind","account_number","vehicle_number","asset_id"]);
  const fieldLocal=(record:ReadRecord,f:ReadField)=>{const key=canonicalKey(f.key),prefix=`${record.category}.`;return key.startsWith(prefix)?key.slice(prefix.length):key;};
  const anchor=(record:ReadRecord,ri:number)=>record.fields.filter((f,fi)=>anchorKeys.has(fieldLocal(record,f))&&checksFor(baselineChecks,ri,fi).length===1&&validAgreement(f,checksFor(baselineChecks,ri,fi)[0])&&f.value!==null).map(f=>[canonicalKey(f.key),f.value?.trim().normalize("NFKC")]);
  let incomplete=false;
  baseline.records.forEach((old,ri)=>{
    const categoryStatus=recordCategoryStatus(baselineChecks,ri);
    if(categoryStatus==="wrong_category"||categoryStatus==="unclear"){incomplete=true;return;}
    const confirmed=old.fields.filter((f,fi)=>f.value!==null&&checksFor(baselineChecks,ri,fi).length===1&&validAgreement(f,checksFor(baselineChecks,ri,fi)[0]));
    if(!confirmed.length)return;
    const oldAnchors=anchor(old,ri),candidates=next.records.map((record,index)=>({record,index,score:record.category!==old.category||taken.has(index)?0:oldAnchors.filter(([key,value])=>record.fields.some(f=>canonicalKey(f.key)===key&&f.value?.trim().normalize("NFKC")===value)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    const sameCategoryOld=baseline.records.filter(r=>r.category===old.category).length,sameCategoryNew=next.records.map((r,index)=>({r,index})).filter(x=>x.r.category===old.category&&!taken.has(x.index));
    const match=candidates.length&&(!candidates[1]||candidates[0].score>candidates[1].score)?candidates[0]:!oldAnchors.length&&sameCategoryOld===1&&sameCategoryNew.length===1?{record:sameCategoryNew[0].r,index:sameCategoryNew[0].index,score:0}:undefined;
    if(!match){incomplete=true;return;}
    taken.add(match.index);
    for(const field of confirmed){const key=canonicalKey(field.key),current=match.record.fields.find(f=>canonicalKey(f.key)===key);
      if(!current)match.record.fields.push(structuredClone(field));
      else if(current.value!==field.value||current.unit?.trim()!==field.unit?.trim()){incomplete=true;}
      else if(current.confidence!=="clear")current.confidence="clear";
    }
  });
  if(incomplete){next.complete=false;next.warnings.push("행 누락 재추출에서 기존에 첫 검증된 일부 필드를 안전하게 연결하지 못했습니다. 기존 후보를 철회하지 않고 원본 대조가 필요합니다.");}
  return next;
}
export const EXTRACT_INSTRUCTIONS=FIELD_OBSERVATION_INSTRUCTIONS+"\n"+SOURCE_NATURE_HANDOFF_INSTRUCTIONS+renderPromptPolicy("prompt.extraction.extract_instructions");

const tri=(v:string|null|undefined):"yes"|"no"|"unknown"=>["yes","예","있음","유"].includes(v??"")?"yes":["no","아니오","없음","무"].includes(v??"")?"no":"unknown";
const known=<const T extends string>(v:string|null|undefined,values:readonly T[],fallback:T):T=>values.includes(v as T)?v as T:fallback;
// Workflow guides use camelCase while the extraction schema recommends snake_case.
// Use one spelling for namespace checks, duplicate detection, facts and typed projections.
const canonicalKey=(key:string)=>key.trim().replace(/([A-Z]+)([A-Z][a-z])/g,"$1_$2").replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
function stableTextToken(value:string){let a=2166136261>>>0,b=0x9e3779b9>>>0;for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,2246822519);}return `${(a>>>0).toString(36)}${(b>>>0).toString(36)}`;}
const creditReportType=(type:string)=>documentFamily(type)==="credit_report";
const currentDebtType=(type:string)=>documentFamily(type)==="debt_certificate";
const leaseType=(type:string)=>documentFamily(type)==="lease";
const healthArrearsType=(type:string)=>documentFamily(type)==="health_insurance_arrears";
function sourceFieldKey(key:string,documentType:string){
  const local=canonicalKey(key);
  if(creditReportType(documentType)&&local==="reported_amount")return "amount";
  if(healthArrearsType(documentType))return ({principal:"premium_arrears",interest:"late_charge",total:"total_arrears",disposition_amount:"disposal_costs"} as Record<string,string>)[local]??local;
  // Current principal is a separate semantic slot from a loan's original or
  // unspecified principal. Keep source fact keys unchanged below; aliases share
  // only the current slot's conflict group, never the generic principal group.
  if(currentDebtType(documentType))return ({outstanding_principal:"principal_balance",total_claim:"total",creditor_name:"creditor",as_of_date:"as_of"} as Record<string,string>)[local]??local;
  if(documentFamily(documentType)==="lease")return ({lessee:"tenant",lessor:"landlord",security_deposit:"deposit",rent_per_month:"monthly_rent",property_location:"property_address"} as Record<string,string>)[local]??local;
  if(["bank_account","bank_transactions"].includes(documentFamily(documentType)))return ({bank:"institution",financial_institution:"institution",account_holder:"owner",account_holder_name:"owner",customer_name:"owner",active_status:"active",account_status:"active",current_balance:"balance",balance_as_of:"as_of"} as Record<string,string>)[local]??local;
  return local;
}
const sourceAssetKind=(value:string|undefined):Asset["kind"]=>{
  const aliases:Record<string,Asset["kind"]>={"보험계약":"insurance","보험":"insurance",insurance_policy:"insurance","자동차":"vehicle","차량":"vehicle","예금":"deposit","현금":"cash","임차보증금":"lease_deposit","부동산":"real_estate","퇴직금":"retirement"};
  return known(aliases[value??""]??value,["cash","deposit","insurance","vehicle","real_estate","lease_deposit","business","receivable","retirement","other"],"other");
};
const sourceAmountBasis=(value:string|undefined):IncomeSource["amountBasis"]=>{
  if(value&&/^기간\s*합계(?:\s*\([^)]*\))?$/.test(value))return "period_total";
  if(value==="월액"||value==="월별 금액")return "monthly";
  return known(value,["monthly","period_total","unknown"],"unknown");
};
// Unlike an explicitly KRW-labelled editor input, a source reading with no unit
// has no defensible scale. Preserve its raw amount while blocking normalization.
const sourceMoney=(field:ReadField)=>field.unit?.trim()?normalizeMoney(field.value,field.unit.trim()):{...normalizeMoney(field.value,"unknown"),normalizationStatus:"review_required" as const};
/** Day-grouped transactions retain the complete timestamp in source facts. */
function transactionDay(value:string|undefined):string{
  if(!value)return "";
  const found=/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(value);
  if(!found)return value;
  const stamp=new Date(found[1]+"T00:00:00.000Z");
  return Number.isFinite(stamp.valueOf())&&stamp.toISOString().slice(0,10)===found[1]?found[1]:value;
}
/** Only clear, quoted readings enter numeric/typed projections. Ambiguous readings stay in the ledger. */
export function projectPage(read:PageRead,documentId:string,page:number,documentHash:string):ExtractionPayload{
  const facts:Partial<Fact>[]=[],incomes:IncomeSource[]=[],debts:Debt[]=[],assets:Asset[]=[],transactions:Transaction[]=[];
  const warnings=[...read.warnings];
  const family=documentFamily(read.documentType),isCreditReport=creditReportType(read.documentType),isHealthArrears=healthArrearsType(read.documentType);
  const sourceContract=documentFieldContract(read.documentType),strictCanonicalRoute=read.documentType.startsWith("shared-document:");
const namespaces=new Set(["person","income","debt","asset","transaction","household","case","applicant","spouse","court","business","statement","family","tax","procedure","credit_report","health_insurance_arrears","bank_account","lease","insurance"]);
  let household:ExtractionPayload["household"];
  read.records.forEach((r,ri)=>{
    const id=`${documentId}:p${page}:${r.category}:${ri}`,ids:string[]=[];
    const keyCache=new WeakMap<ReadField,string>();
    const inputIssueCache=new WeakMap<ReadField,string[]>();
    const sourceIssues=(f:ReadField)=>{
      const cached=inputIssueCache.get(f);if(cached)return cached;
      const bound=bindCanonicalSourceField(f,sourceContract);
      const issues=calculationSourceCellIssues(f,bound.definition);
      inputIssueCache.set(f,issues);return issues;
    };
    const localKey=(f:ReadField)=>{
      const cached=keyCache.get(f);if(cached!==undefined)return cached;
      const binding=bindCanonicalSourceField(f,sourceContract);
      const typed=canonicalProjectionKey(sourceContract,binding,r.category);
      const raw=canonicalKey(f.key);
      // An unknown/contradictory source ID cannot enter a legal calculation by a
      // coincidental field name. It is still preserved in the raw OCR ledger.
      const key=typed??((strictCanonicalRoute||!!f.canonicalFieldId)&&binding.binding==="unbound"
        ?"unbound_source."+raw
        :(()=>{const prefixes=[r.category,...(isCreditReport?["credit_report"]:[]),...(isHealthArrears?["health_insurance_arrears"]:[]),...(family==="insurance"?["insurance"]:[]),"bank_account","lease"];const prefix=prefixes.find(p=>raw.startsWith(p+"."));return sourceFieldKey(prefix?raw.slice(prefix.length+1):raw,read.documentType);})());
      keyCache.set(f,key);return key;
    };
    const statementTextIndexes=new Set<number>(),duplicateStatementTextIndexes=new Set<number>(),conflictingStatementTextIndexes=new Set<number>(),statementTextIdentity=new Map<number,string>();
    if(r.category==="statement"){
      const locationGroups=new Map<string,number[]>(),sectionOrdinals=new Map<string,number>();let paragraphOrdinal=0,sectionAnchor:string|undefined;
      for(const [fieldIndex,source] of r.fields.entries()){
        const key=localKey(source);
        if(["heading","section_title","section_anchor"].includes(key)&&source.value?.trim()&&source.quote?.trim()&&source.confidence==="clear")sectionAnchor=source.value.normalize("NFKC").trim();
        if(key!=="text")continue;
        statementTextIndexes.add(fieldIndex);paragraphOrdinal++;
        if(isValidSourceBBox(source.bbox)){
          const boxKey=source.bbox.map(value=>String(value)).join("-");
          statementTextIdentity.set(fieldIndex,`box-${boxKey}`);locationGroups.set(boxKey,[...(locationGroups.get(boxKey)??[]),fieldIndex]);
        }else{
          const sectionKey=sectionAnchor?stableTextToken(sectionAnchor):"";const ordinal=(sectionOrdinals.get(sectionKey)??0)+1;sectionOrdinals.set(sectionKey,ordinal);
          statementTextIdentity.set(fieldIndex,sectionKey?`section-${sectionKey}-ordinal-${ordinal}`:`ordinal-${paragraphOrdinal}`);
        }
      }
      for(const indices of locationGroups.values()){
        const variants=new Map<string,number[]>();for(const fieldIndex of indices){const source=r.fields[fieldIndex];const identity=JSON.stringify([source.value,source.unit,source.quote]);variants.set(identity,[...(variants.get(identity)??[]),fieldIndex]);}
        if(variants.size>1)for(const fieldIndex of indices)conflictingStatementTextIndexes.add(fieldIndex);
        else for(const duplicateIndices of variants.values())for(const fieldIndex of duplicateIndices.slice(1))duplicateStatementTextIndexes.add(fieldIndex);
      }
    }
    const byKey=new Map<string,ReadField[]>();
    for(const field of r.fields)byKey.set(localKey(field),[...(byKey.get(localKey(field))??[]),field]);
    const conflicting=new Set([...byKey].filter(([key,fields])=>!(r.category==="statement"&&key==="text")&&new Set(fields.filter(f=>f.value!==null).map(f=>JSON.stringify([f.value,f.unit]))).size>1).map(([key])=>key));
    // An explicit unresolved component cannot disappear behind a usable duplicate.
    if(r.category==="debt")for(const [key,fields] of byKey)if(isDebtComponentSlot(key)&&fields.length>1&&fields.some(f=>f.value===null||!f.quote?.trim()||f.confidence!=="clear"))conflicting.add(key);
    const usable=(f:ReadField,fieldIndex?:number)=>(!f.sourceState||f.sourceState==="present")&&typeof f.value==="string"&&f.value.trim()!==""&&f.confidence==="clear"&&typeof f.quote==="string"&&!!f.quote.trim()&&sourceIssues(f).length===0&&!conflicting.has(localKey(f))&&!(fieldIndex!==undefined&&conflictingStatementTextIndexes.has(fieldIndex));
    const field=(key:string)=>(byKey.get(key)??[]).find(usable);
    const chosen=new Map([...byKey].map(([key,fields])=>[key,field(key)??fields.find(f=>f.value!==null&&typeof f.quote==="string"&&!!f.quote.trim()&&f.confidence!=="unreadable")]));
    const value=(key:string)=>field(key)?.value??undefined;
    const num=(key:string)=>{const f=field(key);return f?sourceMoney(f):null;};
    const currentPrincipal=()=>{
      const explicit=byKey.get("principal_balance");
      if(currentDebtType(read.documentType)&&explicit){
        // Presence is independent of usability. A blank, ambiguous, wrongly
        // labelled or conflicting current slot must never fall back to principal.
        const currentMeaning=/(?:원금\s*(?:현재\s*)?(?:잔액|잔금)|(?:현재|미상환|남은)\s*원금|(?:outstanding|current|remaining)\s*principal|principal\s*balance)/iu;
        if(!explicit.length||explicit.some(f=>{const money=sourceMoney(f);return !usable(f)||!isValidSourceBBox(f.bbox)||!currentMeaning.test(f.quote??"")||money.normalizationStatus!=="exact"||money.amountWon===null||BigInt(money.amountWon)<0n;}))return null;
        return sourceMoney(explicit[0]);
      }
      const generic=field("principal");
      // A generic field may remain compatible when the document has no explicit
      // current slot; an explicitly historical/initial amount is never current.
      if(!generic||/(?:최초|당초|초기|발생|매각\s*당시|original|initial|origination|disburs(?:ed|ement))/iu.test(generic.quote??""))return null;
      return sourceMoney(generic);
    };
    const integer=(key:string)=>{const v=value(key);return v&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;};
    if(conflicting.size)warnings.push(`${id}: 동일 필드의 상충값은 계산에서 제외했습니다 (${[...conflicting].join(", ")}).`);
    for(const [fi,f]of r.fields.entries()){
      const key=localKey(f);
      const unresolved=f.value===null||typeof f.quote!=="string"||!f.quote.trim()||f.confidence==="unreadable";
      const observation=observeField(read.documentType,f,{documentId,page,sourceSha256:documentHash},ri,fi);
      const preserveUnresolved=unresolved&&(r.category==="debt"&&isDebtComponentSlot(key)||!!f.sourceState&&!!f.quote?.trim());
      if(unresolved&&!preserveUnresolved)continue;
      const repeatableStatementText=statementTextIndexes.has(fi),fieldConflict=conflicting.has(key)||conflictingStatementTextIndexes.has(fi);
      if(repeatableStatementText&&duplicateStatementTextIndexes.has(fi))continue;
      if(!preserveUnresolved&&!repeatableStatementText&&!conflicting.has(key)&&chosen.get(key)!==f)continue;
      const fid=`${id}:f${fi}`;
      const validation:Fact["validation"]=[];
      if(preserveUnresolved&&r.category==="debt"&&isDebtComponentSlot(key))validation.push({code:"UNRESOLVED_DEBT_COMPONENT_SLOT",message:"원문에 합계·비용 슬롯이 있으나 값 또는 인용을 확인할 수 없어 계산을 보류합니다.",severity:"error"});
      if(f.confidence!=="clear")validation.push({code:"UNCERTAIN_READING",message:"재판독 필요: 계산 투영에서 제외한 값입니다.",severity:"warning"});
      if(fieldConflict)validation.push({code:"FIELD_CONFLICT",message:repeatableStatementText?"같은 원문 영역에서 상충하는 진술문 텍스트가 판독되었습니다.":"같은 필드에 상충하는 원문값이 있습니다.",severity:"error"});
      if(r.category==="debt"&&["bank_transactions","bank_account"].includes(family))validation.push({code:"DOCUMENT_CATEGORY_MISMATCH",message:"은행 거래·계좌 문서의 이 행을 현재 채무로 분류할 원문 근거가 없습니다. 원문 사실만 보존하고 typed 채무 투영은 보류합니다.",severity:"error"});
      if(observation.issues.length)validation.push({code:"FIELD_OBSERVATION_REVIEW",message:observation.issues.join(", "),severity:"warning"});
      for(const issue of sourceIssues(f))validation.push({code:issue,message:"원문 피처의 자료형·단위·기간·인용이 계산용 형식에 맞지 않아 투영을 보류합니다.",severity:"error"});
      if(observation.sourceState!=="present")validation.push({code:"SOURCE_STATE_UNRESOLVED",message:"원문 상태를 값 추출·비대상 결정과 구분하여 보존했습니다. 계산에 사용할 수 없습니다.",severity:"warning"});
      const monetary=observation.sourceState==="present"&&isSourceMoney(key,f.unit);
      if(monetary&&!f.unit?.trim())validation.push({code:"MONETARY_UNIT_MISSING",message:"원문 금액 단위가 확인되지 않아 원화 정규화와 계산을 보류했습니다.",severity:"warning"});
      // Every projected value has its own source fact; uncertain facts cannot license a different amount.
      if(usable(f,fi))ids.push(fid);
      const normalizedKey=canonicalKey(f.key),rawPrefix=namespaces.has(normalizedKey.split(".")[0])&&normalizedKey.includes(".")?normalizedKey.split(".")[0]:null,rawLocal=rawPrefix?normalizedKey.slice(rawPrefix.length+1):normalizedKey,factType=isCreditReport?"credit_report":isHealthArrears?"health_insurance_arrears":r.category;
      const leaseField=family==="lease"&&["tenant","landlord","applicant_role","applicant_is_tenant","applicant_is_landlord","property_address","property_reference","deposit","monthly_rent","secured_balance","arrears_deduction","use","start_date","end_date","period_start","period_end"].includes(key);
      const accountField=["bank_account","bank_transactions"].includes(family)&&r.category!=="transaction"&&["institution","owner","account_number","balance","active","as_of","encumbrance_status","seizure_status","pledge_status"].includes(key);
      // The same exact canonical identifier defines the original source row,
      // its normalized SQL projection, and the CaseData fact read by legal
      // calculations/forms. PageRead still preserves the raw OCR key and quote.
      const verifiedBinding=bindCanonicalSourceField(f,sourceContract);
      const verifiedCaseKey=canonicalProjectionKey(sourceContract,verifiedBinding,r.category);
      const factKey=(strictCanonicalRoute||!!f.canonicalFieldId)&&verifiedBinding.binding==="unbound"
        ? `${r.category}.unbound_source.${normalizedKey}`
        :verifiedCaseKey&&verifiedBinding.binding!=="unbound"
        ? `${r.category}.${verifiedCaseKey}`
        :isCreditReport||isHealthArrears?`${factType}.${key}`:leaseField?`lease.${key}`:accountField?`bank_account.${key}`:rawPrefix?`${rawPrefix}.${rawLocal}`:`${factType}.${rawLocal}`;
      const logicalId=`${id}:${key}${repeatableStatementText?`:paragraph:${statementTextIdentity.get(fi)}`:""}${fieldConflict?`:candidate:${fi}`:""}`;
      facts.push({id:fid,subjectId:id,logicalId,key:factKey,fieldObservation:observation,canonicalFieldId:observation.canonicalFieldId??undefined,value:f.value,rawValue:f.value??undefined,sourceUnit:f.unit,...(monetary?{numeric:sourceMoney(f)}:{}),periodStart:value("period_start"),periodEnd:value("period_end"),asOf:value("as_of"),refs:typeof f.quote==="string"&&f.quote.trim()?[{documentId,page,quote:f.quote,sourceHash:documentHash,...(isValidSourceBBox(f.bbox)?{bbox:f.bbox}:{})}]:[],validation});
    }
    if(!ids.length)return;
    if(r.category==="income"){
      if(strictCanonicalRoute&&!["gross","expenses","net","period_start","period_end"].some(name=>!!field(name))){
        warnings.push(`${id}: 표준 소득 피처가 매핑되지 않아 원문만 보존하고 소득 계산 객체 생성을 보류합니다.`);
        return;
      }
      if(leaseType(read.documentType)&&!(["applicant_is_landlord","income_owner_role"].some(k=>value(k)==="yes"||value(k)==="applicant"))){warnings.push(`${id}: 임대차 문서만으로 신청인 임대수입을 판단하지 않았습니다. 신청인이 임대인이라는 원문 근거가 필요합니다.`);}
      else {
        const sourceFamily=sourceContract?.family_id??null;
        const kindAliases:Record<string,IncomeSource["kind"]>={"근로소득":"wage","급여":"wage","사업소득":"business","부동산임대소득":"rent","연금소득":"pension","이자소득":"interest","배당소득":"dividend"};
        const rawKind=value("kind");
        const incomeKind:IncomeSource["kind"]=sourceFamily==="payroll_payslip"?"wage":
          sourceFamily==="business_sales_vat"?"business":
          known(kindAliases[rawKind??""]??rawKind,["wage","business","rent","interest","dividend","pension","benefit","other"],"other");
        const start=value("period_start"),end=value("period_end");
        const declaredBasis=sourceAmountBasis(value("amount_basis"));
        // A net payslip/earning-period amount or annual income certificate is
        // a total for the expressly printed period. The calculator still blocks
        // non-calendar-month spans and unreviewed recurrence/identity.
        const periodTotalFamily=["payroll_payslip","current_nonwage_income","tax_income"].includes(sourceFamily??"");
        const hasSourcePeriod=!!field("period_start")&&!!field("period_end");
        const basis=declaredBasis!=="unknown"?declaredBasis:
          periodTotalFamily&&hasSourcePeriod&&!!field("net")?"period_total":"unknown";
        if(basis==="unknown"&&!!field("net"))
          warnings.push(`${id}: 금액의 월액/기간합계 기준을 확정할 근거가 없어 계산 분모를 보류했습니다.`);
        const label=value("label")||value("employer")||rawKind||r.label;
        incomes.push({id,kind:incomeKind,label,employer:value("employer"),payerIdentityId:value("payer_identity_id"),
          aggregationTreatment:"unknown",aggregationReviewed:false,gross:num("gross"),expenses:num("expenses"),net:num("net"),
          periodStart:start,periodEnd:end,periodMonths:integer("period_months"),amountBasis:basis,recurring:tri(value("recurring")),
          recognition:"unreviewed",factIds:ids});
      }
    }
    if(r.category==="debt"){
      if(["bank_transactions","bank_account"].includes(family)){warnings.push(`${id}: 은행 거래·계좌 문서에서 debt category가 판독되어 원문 사실은 보존했지만 typed 현재채무 생성은 보류했습니다.`);return;}
      const currentClaimBasis=["principal","principal_balance","interest","total","current_balance","claim_amount","amount_due","tax_arrears","arrears_amount","premium_arrears","late_charge","total_arrears"].some(key=>field(key))||(currentDebtType(read.documentType)&&byKey.has("principal_balance"));
      if(isCreditReport){warnings.push(`${id}: 신용정보조회서의 이력 금액은 현재 잔액이 아니므로 원문 fact로만 보존하고 typed 현재 채무에서 제외했습니다.`);return;}
      if(isHealthArrears){warnings.push(`${id}: 건강보험료 미납 항목은 법적 채무 분류 전 원문 사실로만 보존했습니다.`);return;}
      if(!value("creditor")||!currentClaimBasis){warnings.push(`${id}: 명시된 채권자와 현재 채권액 근거가 모두 없어 typed 채무를 만들지 않았습니다.`);return;}
      if(!value("creditor"))warnings.push(`${id}: 인용된 채권자명이 없어 채권자 확인이 필요합니다.`);
      const guaranteeKeys=["liability_role","claim_nature","underlying_debt_id","guarantee_for","recourse_status","guarantee_limit","guarantee_amount"];
      const hasGuaranteeEvidence=guaranteeKeys.some(key=>field(key));
      if(hasGuaranteeEvidence)warnings.push(`${id}: 보증·조건부 채무는 원문 사실만 추출했습니다. 채권 포함 범위와 책임액은 법률 검토가 필요합니다.`);
      const sourceComponentIssues=[...new Set([...byKey].filter(([key,fields])=>isDebtComponentSlot(key)&&fields.some(f=>!usable(f))).map(([key])=>debtComponentSlotKey(key)!))];
      debts.push({id,sourceComponentIssues,creditor:value("creditor")||"",contractId:value("contract_id"),principal:currentPrincipal(),interest:num("interest"),secured:tri(value("secured")),classification:known(value("classification"),["ordinary","secured","tax","estate","non_dischargeable","disputed","unknown"],"unknown"),asOf:value("as_of"),dueDate:value("due_date"),legalReview:"unreviewed",...(hasGuaranteeEvidence?{guaranteeDetails:{liabilityRole:known(value("liability_role"),["principal","guarantor","joint_and_several","unknown"],"unknown"),claimNature:known(value("claim_nature"),["fixed","contingent","disputed","unknown"],"unknown"),underlyingDebtId:value("underlying_debt_id"),recourseStatus:known(value("recourse_status"),["not_applicable","unpaid","partially_paid","subrogated","unknown"],"unknown"),capTreatment:"unknown" as const,capTreatmentReviewed:false,sourceGuaranteeAmount:num("guarantee_amount"),sourceGuaranteeLimit:num("guarantee_limit")}}:{}),factIds:ids});
    }
    if(r.category==="asset"){
      if(leaseType(read.documentType)&&!(["applicant_is_tenant","asset_owner_role","ownership_role"].some(k=>value(k)==="yes"||value(k)==="applicant"))){warnings.push(`${id}: 임대차 문서만으로 신청인 소유자산을 판단하지 않았습니다. 신청인 역할의 원문 근거가 필요합니다.`);return;}
      if(!value("label"))warnings.push(`${id}: 인용된 재산명이 없어 재산명 확인이 필요합니다.`);
      // The document family is a routing signal for the typed category, not a
      // source fact or legal-recognition decision. Use it only when the row has
      // no explicit contradictory kind; retain every original kind reading as
      // a fact so uncertainty/conflicts remain visible to review.
      const rawKinds=byKey.get("kind")??[];
      const noKindReading=!rawKinds.length||rawKinds.every(candidate=>candidate.value===null||!candidate.value.trim());
      const familyKindReading=rawKinds.length>0&&rawKinds.every(candidate=>candidate.value!==null&&sourceAssetKind(candidate.value)==="insurance");
      const assetKind=family==="insurance"&&(noKindReading||familyKindReading)?"insurance":sourceAssetKind(value("kind"));
      let grossValue=num("gross_value"),securedPayoff=num("secured_payoff");
      if(assetKind==="insurance"||/insurance|보험/.test(read.documentType)){
        // Every explicit surrender slot participates in selection, including an
        // unusable/null alias. Generic premium/coverage fields remain separate.
        const strict=INSURANCE_SURRENDER_KEYS.flatMap(key=>byKey.get(key)??[]);
        const semantic=[...(byKey.get("refund_value")??[]).filter(candidate=>!candidate.quote?.trim()||isInsuranceSurrenderQuote(candidate.quote)),...(byKey.get("gross_value")??[]).filter(candidate=>isInsuranceSurrenderQuote(candidate.quote??""))];
        const candidates=[...strict,...semantic];
        const located=(candidate:ReadField)=>usable(candidate)&&isValidSourceBBox(candidate.bbox)&&isInsuranceSurrenderQuote(candidate.quote??"");
        const quoteAgrees=(candidate:ReadField)=>{
          const quoted=quotedInsuranceSurrenderAmount(candidate.quote??"");
          if(!quoted)return false;
          const money=sourceMoney(candidate),quoteMoney=normalizeMoney(quoted.raw,quoted.unit??candidate.unit??"unknown");
          if(money.normalizationStatus==="exact")return money.amountWon!==null&&BigInt(money.amountWon)>=0n&&quoteMoney.normalizationStatus==="exact"&&quoteMoney.amountWon===money.amountWon;
          // Preserve an unnormalized observation only if its literal number agrees;
          // missing source units never become a usable amount through the quote.
          const raw=(value:string|null)=>value?.normalize("NFKC").trim().replace(/,/g,"").replace(/\s*(?:원|KRW)\s*$/i,"");
          return money.normalizationStatus==="review_required"&&raw(candidate.value)===raw(quoted.raw)&&/^\+?\d+(?:\.\d+)?$/.test(raw(candidate.value)??"");
        };
        const coherent=candidates.length>0&&candidates.every(candidate=>located(candidate)&&quoteAgrees(candidate));
        const amounts=new Set(candidates.map(candidate=>sourceMoney(candidate).amountWon));
        grossValue=coherent&&amounts.size===1&&(amounts.has(null)?candidates.length===1:true)?sourceMoney(candidates[0]):null;
        if(!grossValue&&candidates.length)warnings.push(`${id}: 서로 다른 해약환급금 후보 또는 불명확한 원문 금액·위치가 있어 자산가액 선택을 보류했습니다.`);
        else if(!candidates.length&&(byKey.has("refund_value")||byKey.has("gross_value")))warnings.push(`${id}: 보험 가입·보장·납입 금액을 환급가치로 사용하지 않았습니다. 해약환급금 원문 열이 필요합니다.`);
        // A policy-loan balance is evidence, not automatically a deduction from a
        // surrender value that may already be net of that loan. Preserve its raw
        // fact and leave a missing payoff missing until its basis is reviewed.
        if(byKey.has("policy_loan_balance")||byKey.has("loan_balance"))warnings.push(`${id}: 보험계약대출 잔액은 원문 사실로 보존했습니다. 환급금의 대출 차감 전후와 공제 근거는 별도 검토해야 합니다.`);
      }
      if(field("secured_payoff")&&/채권\s*최고액|저당\s*설정액|근저당\s*설정|maximum\s*secured/i.test(field("secured_payoff")!.quote??"")){
        securedPayoff=null;warnings.push(`${id}: 담보 설정액·채권최고액은 실제 상환잔액이 아니므로 차감 계산에서 제외했습니다.`);
      }
      assets.push({id,kind:assetKind,label:value("label")||"",grossValue,securedPayoff,securedPayoffScope:known(value("secured_payoff_scope"),["applicant_interest","entire_collateral","unknown"],"unknown"),disposalCosts:num("disposal_costs"),protectedValue:num("protected_value"),ownershipBps:integer("ownership_bps")??(sourceContract?.family_id==="cash_deposit_asset"&&field("ownership_share")?parseExactOwnershipBps({value:value("ownership_share")!,unit:field("ownership_share")!.unit}):null),asOf:value("as_of"),valuationBasis:value("valuation_basis"),recognition:"unreviewed",factIds:ids});
    }
    if(r.category==="transaction"&&num("amount")){
      const summaryPhrase=/^(?:(?:입금|출금|거래|금액)\s*(?:금액\s*)?(?:합계|소계|총계|누계)(?:금액)?|(?:합계|소계|총계|누계)(?:금액)?\s*(?:입금|출금|거래|금액)|(?:당일|기간|월간|일자별|페이지)\s*(?:입출금|거래|입금|출금)\s*(?:합계|소계|총계|누계)(?:금액)?|(?:subtotal|grand\s*total|total\s+(?:deposits|withdrawals|transactions)))(?=$|[\s:：=0-9,.([{])/iu;
      const sourceSummary=(source:ReadField)=>source.confidence==="clear"&&!!source.quote&&(summaryPhrase.test(source.quote.normalize("NFKC").trim())||/^(?:합계|소계|총계|누계|subtotal|total)(?=$|[\s:：=0-9,.([{])/iu.test(source.quote.normalize("NFKC").trim()));
      const labelText=r.label.normalize("NFKC").replace(/\s+/g,"").toLowerCase();
      const explicitSummaryLabel=/^(?:(?:당일|일자별|기간별|월간|일일|페이지)?)(?:(?:거래|입금|출금)?)(?:합계|소계|총계|누계|subtotal|grandtotal)(?:(?:거래|입금|출금)?)$/iu.test(labelText);
      const controlKeys=new Set(["row_type","row_class","record_type","entry_type","transaction_row_type","is_summary","is_subtotal","is_total"]);
      const explicitSummaryField=r.fields.some(source=>{
        const key=localKey(source),value=source.value?.normalize("NFKC").trim().toLowerCase()??"";
        if(!controlKeys.has(key)||!sourceSummary(source))return false;
        return ["summary","subtotal","total","합계","소계","총계","누계","yes","true","예"].includes(value);
      });
      // Only amount/direction source cells can supply semantic total evidence.
      // A merchant or memo containing “합계” is ordinary transaction text.
      const amountOrDirectionTotalQuote=r.fields.some(source=>["amount","direction"].includes(localKey(source))&&sourceSummary(source));
      // A model-generated record label alone must never remove a real payment.
      const quotedSummaryLabel=explicitSummaryLabel&&r.fields.some(source=>!["memo","counterparty"].includes(localKey(source))&&sourceSummary(source));
      const summaryRow=quotedSummaryLabel||explicitSummaryField||amountOrDirectionTotalQuote;
      if(summaryRow){warnings.push(`${id}: 원문 표지가 거래 소계·합계 행을 나타내므로 금액 facts는 보존하고 typed 거래와 거래 합계에서 제외했습니다.`);return;}
      transactions.push({id,date:transactionDay(value("date")),accountId:value("account_id"),counterparty:value("counterparty"),direction:known(value("direction"),["in","out","unknown"],"unknown"),amount:num("amount")!,kind:known(value("kind"),["income","expense","transfer","debt_payment","asset_disposal","tax","unknown"],"unknown"),factIds:ids});
    }
    if(r.category==="household")household={reportedMembers:integer("reported_members"),factIds:ids};
  });
  const p:EvidencePage={documentId,page,role:"evidence",documentType:read.documentType,fieldCoverage:pageFieldCoverage(read,{documentId,page,sourceSha256:documentHash})};
  return {facts,incomes,debts,assets,transactions,household,pages:[p],warnings,...(read.complete?{replacesPages:[{documentId,page}]}:{})};
}
export function validatePageRead(raw:unknown):PageRead{
  const r=raw as PageRead;
  if(!r||typeof r.documentType!=="string"||typeof r.complete!=="boolean"||!Array.isArray(r.records)||!Array.isArray(r.warnings)||r.warnings.some(w=>typeof w!=="string")||r.records.length>500)throw new Error("추출 결과 형식이 올바르지 않습니다.");
  for(const x of r.records){
    if(!["person","income","debt","asset","transaction","household","business","statement","other"].includes(x.category)||typeof x.label!=="string"||!Array.isArray(x.fields)||x.fields.length>200)throw new Error("추출 필드 형식을 확인하세요.");
    for(const f of x.fields){
      if(!f||typeof f.key!=="string"||!f.key.trim()||typeof f.label!=="string"||!(f.value===null||typeof f.value==="string")||!(f.unit===null||typeof f.unit==="string")||!(f.quote===null||typeof f.quote==="string")||!["clear","uncertain","unreadable"].includes(f.confidence)||!(f.bbox===null||(Array.isArray(f.bbox)&&f.bbox.length===4&&f.bbox.every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1))))throw new Error("원문 필드 형식을 올바르게 확인하세요.");
      if(f.canonicalFieldId!==undefined&&f.canonicalFieldId!==null&&typeof f.canonicalFieldId!=="string"||f.sourceState!==undefined&&!SOURCE_STATES.includes(f.sourceState)||f.applicability!==undefined&&!["applicable","not_applicable","unknown"].includes(f.applicability)||f.applicabilityQuote!==undefined&&f.applicabilityQuote!==null&&typeof f.applicabilityQuote!=="string"||f.verificationState!==undefined&&!VERIFICATION_STATES.includes(f.verificationState))throw new Error("피처 식별자·기재 상태·적용 근거 형식을 확인하세요.");
      if(f.bbox!==null&&!isValidSourceBBox(f.bbox)&&!r.warnings.includes(INVALID_BBOX_WARNING))r.warnings.push(INVALID_BBOX_WARNING);
    }
  }
  return r;
}
