/**
 * Source-only OCR diagnostics and independent reference comparison.
 * IMPORTANT: a model/verifier agreement is not independent accuracy, and
 * source-level 'not applicable' never grants case-level legal recognition.
 */
export type SourceOcrStatus =
  | "cross_read_agreed" | "omission_suspected" | "misrecognition_corrected"
  | "misrecognition_unresolved" | "not_applicable_source_claim"
  | "source_blank" | "source_none_unreviewed" | "source_obscured"
  | "conflicting" | "needs_review";

export interface OcrObservedField {
  documentId?: string; page?: number; sourceSha256?: string;
  canonicalFieldId?: string | null; key?: string;
  value?: string | null; unit?: string | null; quote?: string | null;
  bbox?: number[] | null; confidence?: string;
  sourceState?: string; applicability?: string; applicabilityQuote?: string | null;
  verificationState?: string; subjectId?: string | null; asOf?: string | null; periodStart?: string | null; periodEnd?: string | null;
}
export interface OcrSourceRead { documentType?: string; complete?: boolean; records?: Array<{fields?: OcrObservedField[]}>; }
export interface OcrMissingCue {canonicalFieldId?: string | null; sourceState?: string; quote?: string | null; bbox?: number[] | null;}
export interface OcrSourceFinding {
  fieldId: string | null; recordIndex: number | null; fieldIndex: number | null;
  status: SourceOcrStatus; reason: string;
  /** Source claims are not a case applicability decision. */
  independentlyConfirmed: false;
}
const bboxValid=(x:unknown):x is number[]=>Array.isArray(x)&&x.length===4&&x.every(n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1)&&x[0]<x[2]&&x[1]<x[3];
const anchored=(f:{quote?:string|null;bbox?:number[]|null})=>!!f.quote?.trim()&&bboxValid(f.bbox);
const readValue=(f:OcrObservedField)=>typeof f.value==="string"&&!!f.value.trim();

export function classifyOcrField(f:OcrObservedField):Pick<OcrSourceFinding,"status"|"reason">{
  const verify=f.verificationState, state=f.sourceState;
  if(verify==="corrected")return {status:"misrecognition_corrected",reason:"초기 추출값이 원문 재판독에서 정정되었습니다. 정답 일치 여부는 별도 검증 대상입니다."};
  if(verify==="wrong_field"||verify==="value_mismatch")return {status:"misrecognition_unresolved",reason:"값·필드 의미가 상충하여 사실 인정과 계산을 보류합니다."};
  if(state==="conflicting"||verify==="conflicting")return {status:"conflicting",reason:"원문 또는 재판독 값이 상충합니다."};
  if(state==="illegible"||state==="masked"||verify==="unreadable")return {status:"source_obscured",reason:"판독 불가 또는 마스킹이며 0이나 해당 없음이 아닙니다."};
  if(state==="explicit_none"){
    if(f.applicability==="not_applicable"&&anchored(f)&&f.applicabilityQuote?.trim()&&f.quote?.includes(f.applicabilityQuote))
      return {status:"not_applicable_source_claim",reason:"원문에 명시된 비대상 진술입니다. 사건별 법적 비적용 여부는 별도 검토해야 합니다."};
    return {status:"source_none_unreviewed",reason:"원문에 없음 표시가 있으나 해당 없음으로 확정할 근거가 충분하지 않습니다."};
  }
  if(state==="blank")return {status:"source_blank",reason:"원문 빈칸입니다. 누락·0·해당 없음으로 자동 판정하지 않습니다."};
  if(state==="present"&&readValue(f)&&f.confidence==="clear"&&verify==="supported"&&anchored(f))
    return {status:"cross_read_agreed",reason:"추출기와 원문 검증기의 값이 일치합니다. 독립 정답과 대조한 정확도는 아닙니다."};
  return {status:"needs_review",reason:"원문 존재·위치·독립 정답 대조가 미확인 상태입니다."};
}

/** A read-only report: do not invent omissions from catalog gaps or null values. */
export function summarizePageOcrQuality(read:OcrSourceRead|null|undefined,missingFields:readonly OcrMissingCue[]=[]) {
  const findings:OcrSourceFinding[]=[];
  for(const [ri,record] of (read?.records??[]).entries())for(const [fi,field] of (record.fields??[]).entries()){
    const {status,reason}=classifyOcrField(field);
    findings.push({fieldId:field.canonicalFieldId??null,recordIndex:ri,fieldIndex:fi,status,reason,independentlyConfirmed:false});
  }
  // Verifier-only source-anchored omissions; never use blank/masked/explicit_none as omission.
  for(const cue of missingFields){
    if(!cue.canonicalFieldId?.trim()||!anchored(cue))continue;
    const status:SourceOcrStatus=cue.sourceState==="present"?"omission_suspected":cue.sourceState==="blank"?"source_blank":cue.sourceState==="explicit_none"?"source_none_unreviewed":cue.sourceState==="illegible"||cue.sourceState==="masked"?"source_obscured":"needs_review";
    findings.push({fieldId:cue.canonicalFieldId,recordIndex:null,fieldIndex:null,status,reason:status==="omission_suspected"?"검증기가 원문에 보이는 필드/행을 추출 결과에서 찾지 못했습니다.":"원문 상태를 별도 보존합니다. 누락으로 세지 않습니다.",independentlyConfirmed:false});
  }
  const counts:Record<SourceOcrStatus,number>={cross_read_agreed:0,omission_suspected:0,misrecognition_corrected:0,misrecognition_unresolved:0,not_applicable_source_claim:0,source_blank:0,source_none_unreviewed:0,source_obscured:0,conflicting:0,needs_review:0};
  for(const item of findings)counts[item.status]++;
  return {schema:"ocr-source-quality/1" as const,completeReadClaim:read?.complete===true,
    independentlyScored:false as const,accuracyPercent:null,counts,findings};
}

export type GoldState="present"|"not_applicable"|"not_provided"|"blank"|"unreadable";
export interface IndependentlyReviewedField {
  id:string;documentId:string;page:number;sourceSha256:string;canonicalFieldId:string;logicalDocumentId?:string;
  /** Reviewed against the actual image without revealing the answer to the extractor. */
  independentlyReviewed:true;
  state:GoldState;expectedValue?:string|null;expectedUnit?:string|null;expectedSubjectId?:string|null;expectedAsOf?:string|null;expectedPeriodStart?:string|null;expectedPeriodEnd?:string|null;
  /** Required for repeated instances of the same field: independent cell/row location. */
  bbox?:number[]|null;
}
export type IndependentStatus="correct"|"omission"|"misrecognition"|"not_applicable_confirmed"|"not_applicable_missed"|"not_provided"|"source_blank"|"unscorable_unreadable"|"false_positive"|"unresolved_ambiguity";
export interface IndependentFinding {goldId:string;documentId:string;logicalDocumentId:string;page:number;fieldId:string;status:IndependentStatus;expectedState:GoldState;}
const norm=(s:string)=>s.normalize("NFKC").trim().replace(/\s+/g," ");
const valueEqual=(a:string,b:string)=>{const x=norm(a),y=norm(b);if(/^-?(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(x)&&/^-?(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(y))return x.replace(/,/g,"")===y.replace(/,/g,"");return x===y;};
function iou(a:number[],b:number[]){const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));const area=(q:number[])=>(q[2]-q[0])*(q[3]-q[1]);return intersection/(area(a)+area(b)-intersection)||0;}

/**
 * A strict after-the-fact comparator. A gold item is never part of a model prompt.
 * No asserted OCR accuracy without independently reviewed, source-specific gold.
 */
export function scoreIndependentOcr(gold:readonly IndependentlyReviewedField[],observations:readonly OcrObservedField[]) {
  if(!gold.length)return {schema:"ocr-independent-evaluation/1" as const,accuracyPercent:null,denominator:0,counts:{},findings:[]};
  const ids=new Set<string>();for(const g of gold){
    if(!g.independentlyReviewed||!g.id.trim()||ids.has(g.id)||!g.documentId.trim()||!g.sourceSha256||!/^[a-f0-9]{64}$/i.test(g.sourceSha256)||!g.canonicalFieldId.trim()||!Number.isInteger(g.page)||g.page<1)throw new Error("INDEPENDENT_GOLD_INVALID_OR_DUPLICATE");
    if(g.state==="present"&&(typeof g.expectedValue!=="string"||!g.expectedValue.trim()))throw new Error("INDEPENDENT_GOLD_MISSING_VISIBLE_VALUE");
    if(g.bbox!==undefined&&g.bbox!==null&&!bboxValid(g.bbox))throw new Error("INDEPENDENT_GOLD_BBOX_INVALID");
    ids.add(g.id);
  }
  const used=new Set<number>();const findings:IndependentFinding[]=[];
  for(const g of gold){
    const same=observations.map((f,i)=>({f,i})).filter(({f,i})=>!used.has(i)&&f.documentId===g.documentId&&f.page===g.page&&f.sourceSha256===g.sourceSha256&&f.canonicalFieldId===g.canonicalFieldId);
    const spatial=g.bbox?same.filter(x=>bboxValid(x.f.bbox)&&iou(g.bbox!,x.f.bbox!)>=0.3):same;
    const matches=g.bbox?spatial:same;
    let status:IndependentStatus;
    if(matches.length>1){status="unresolved_ambiguity";}
    else {
      const one=matches[0];if(one)used.add(one.i);
      const f=one?.f;
      if(g.state==="present"){
        if(!f)status="omission";
        else if(f.sourceState==="explicit_none"||f.sourceState==="blank")status="misrecognition";
        else if(f.confidence==="unreadable"||f.sourceState==="illegible"||f.sourceState==="masked")status="unscorable_unreadable";
        else if(f.value===null||f.value===undefined||f.value==="")status="omission";
        else if(f.sourceState!=="present"||!valueEqual(f.value,g.expectedValue!)||(g.expectedUnit!==undefined&&norm(f.unit??"")!==norm(g.expectedUnit??""))||
          (g.expectedSubjectId!==undefined&&norm(f.subjectId??"")!==norm(g.expectedSubjectId??""))||
          (g.expectedAsOf!==undefined&&norm(f.asOf??"")!==norm(g.expectedAsOf??""))||
          (g.expectedPeriodStart!==undefined&&norm(f.periodStart??"")!==norm(g.expectedPeriodStart??""))||
          (g.expectedPeriodEnd!==undefined&&norm(f.periodEnd??"")!==norm(g.expectedPeriodEnd??"")))status="misrecognition";
        else status="correct";
      }else if(g.state==="not_applicable"){
        if(f?.sourceState==="explicit_none"&&f.applicability==="not_applicable"&&anchored(f))status="not_applicable_confirmed";
        else status=readValue(f??{})?"false_positive":"not_applicable_missed";
      }else if(g.state==="not_provided"){
        status=readValue(f??{})?"false_positive":"not_provided";
      }else if(g.state==="blank"){
        status=readValue(f??{})?"false_positive":"source_blank";
      }else { status=readValue(f??{})?"false_positive":"unscorable_unreadable"; }
    }
    findings.push({goldId:g.id,documentId:g.documentId,logicalDocumentId:g.logicalDocumentId??g.documentId,page:g.page,fieldId:g.canonicalFieldId,status,expectedState:g.state});
  }
  const counts:Record<IndependentStatus,number>={correct:0,omission:0,misrecognition:0,not_applicable_confirmed:0,not_applicable_missed:0,not_provided:0,source_blank:0,unscorable_unreadable:0,false_positive:0,unresolved_ambiguity:0};
  for(const x of findings)counts[x.status]++;
  const denominator=gold.filter(g=>g.state==="present").length;
  const accuracyPercent=denominator?Math.round(10000*counts.correct/denominator)/100:null;
  const naTotal=gold.filter(g=>g.state==="not_applicable").length;
  const byDocument=Object.values(gold.reduce((acc,g,index)=>{
    const id=g.logicalDocumentId??g.documentId;
    const group=acc[id]??={documentId:id,presentGoldCount:0,correct:0,omission:0,misrecognition:0,notApplicableCount:0,notApplicableConfirmed:0,unresolved:0};
    const status=findings[index].status;
    if(g.state==="present"){group.presentGoldCount++;if(status==="correct")group.correct++;else if(status==="omission")group.omission++;else if(status==="misrecognition")group.misrecognition++;else group.unresolved++;}
    if(g.state==="not_applicable"){group.notApplicableCount++;if(status==="not_applicable_confirmed")group.notApplicableConfirmed++;}
    return acc;
  },{} as Record<string,{documentId:string;presentGoldCount:number;correct:number;omission:number;misrecognition:number;notApplicableCount:number;notApplicableConfirmed:number;unresolved:number}>)).map(group=>({...group,accuracyPercent:group.presentGoldCount?Math.round(group.correct/group.presentGoldCount*10000)/100:null}));
  return {schema:"ocr-independent-evaluation/1" as const,accuracyPercent,denominator,counts,notApplicableTotal:naTotal,notApplicableConfirmed:counts.not_applicable_confirmed,
    /** If the blind gold is partial, unmatched output values are not yet false positives. */
    unmatchedObservedCount:observations.length-used.size,byDocument,findings};
}
