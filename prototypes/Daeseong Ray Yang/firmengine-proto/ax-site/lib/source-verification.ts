import { AI_MODEL, normalizeMoney } from "./domain.ts";
import { isSourceMoney } from "./source-quantity.ts";
import { bboxLocatorFingerprintSegment, isValidSourceBBox, sameSourceBBox, sourceBBoxesAreDistinctAndDisjoint, type BBoxReceiptLocator, type SourceBBox } from "./source-verification-identity.ts";

/** Trusted server-side cross-read proof; it never grants legal recognition. */
export const SOURCE_VERIFICATION_METHOD = "independent_luna_cross_read" as const;
export const SOURCE_VERIFICATION_MODEL = AI_MODEL;
export interface ReadField { key: string; value: string | null; unit: string | null; quote: string | null; confidence: "clear" | "uncertain" | "unreadable"; bbox?: SourceBBox | null }
export interface ReadRecord { category: string; fields: ReadField[] }
export interface PageRead { documentType: string; complete: boolean; records: ReadRecord[] }
export interface Check { recordIndex: number; fieldIndex: number; meaningStatus?: string; status: "agrees" | "corrected" | "unreadable" | "ambiguous"; value: string | null; unit: string | null; quote: string | null; bbox?: number[] | null; reason?: string }
export interface ReviewPass {
  kind: "verify" | "repair";
  /** Only coordinate-bound checks may participate in verification or receipts. */
  checks: readonly Check[];
  /** Original model response retained for audit; never used to bind facts. */
  originalChecks?: readonly Check[];
  bindingStatus?: "bound" | "unbound";
  bindingIssues?: readonly string[];
  model: typeof AI_MODEL; promptVersion: string; promptHash: string; verifiedAt: string;
}
export interface FieldError { recordIndex: number; fieldIndex: number; code: string }
export interface SourceVerificationInput {
  documentId: string; page: number; sourceHash: string; promptVersion: string; verifiedAt: string;
  originalRead: PageRead; read: PageRead; passes: readonly ReviewPass[]; errors?: readonly FieldError[];
}
export interface SourceVerificationReceipt {
  method: typeof SOURCE_VERIFICATION_METHOD; model: typeof AI_MODEL; promptVersion: string; verifiedAt: string;
  /** Absent on historical value/unit/quote-only receipts. */
  verificationScope?: "field_meaning_v1";
  source: { documentId: string; page: number; sha256: string };
  field: { recordCategory: string; key: string; value: string; unit: string | null; quote: string; locator?: BBoxReceiptLocator };
  extractionReading: { value: string; unit: string | null; quote: string; bbox?: SourceBBox };
  verificationQuotes: string[]; fieldFingerprint: string;
  proofReads: Array<{ pass: "verify" | "repair"; model: typeof AI_MODEL; promptVersion: string; promptHash: string; verifiedAt: string; recordIndex: number; fieldIndex: number; meaningStatus?: string; status: "agrees" | "corrected"; value: string; unit: string | null; quote: string; bbox?: SourceBBox }>;
  proofReadIndexes: Array<{ pass: "verify" | "repair"; recordIndex: number; fieldIndex: number }>;
  recognition: "unreviewed";
}

const normalize = (s: string) => s.normalize("NFKC").trim();
const canonicalKey = (s: string) => normalize(s).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const validHash = (s: string) => /^[a-f0-9]{64}$/i.test(s);
const validInstant = (s: string) => { try { return Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s; } catch { return false; } };
const nonempty = (s: unknown): s is string => typeof s === "string" && !!normalize(s);
const sameUnit = (a: string | null, b: string | null) => a === null ? b === null : b !== null && normalize(a) === normalize(b);
const fieldKey = (f: ReadField) => canonicalKey(f.key);
const isMonetary = (key: string,unit:string|null) => isSourceMoney(key,unit);
const fieldAt = (read: PageRead, ri: number, fi: number) => read.records[ri]?.fields[fi];
const checksAt = (pass: ReviewPass, ri: number, fi: number) => pass.checks.filter(c => c.recordIndex === ri && c.fieldIndex === fi);
function matchingAgreement(check: Check, field: ReadField) { return check.meaningStatus === "supported" && check.status === "agrees" && check.value !== null && check.value === field.value && sameUnit(check.unit, field.unit) && nonempty(check.quote); }

type ProofCheck = { pass: ReviewPass; check: Check };
function proofFor(read: PageRead, passes: readonly ReviewPass[], ri: number, fi: number): ProofCheck[] | null {
  const verifies = passes.filter(p => p.kind === "verify"), repairs = passes.filter(p => p.kind === "repair");
  if (verifies.length !== 1 || repairs.length > 1) return null;
  const firsts = checksAt(verifies[0],ri,fi), field = fieldAt(read,ri,fi);
  if (!field || field.confidence !== "clear" || field.value === null || !nonempty(field.quote)) return null;
  if (isMonetary(fieldKey(field),field.unit) && (!nonempty(field.unit) || normalizeMoney(field.value,normalize(field.unit)).normalizationStatus !== "exact")) return null;
  if (!firsts.length) {
    if (repairs.length !== 1) return null;
    const seconds = checksAt(repairs[0],ri,fi);
    return seconds.length === 1 && matchingAgreement(seconds[0],field) ? [{pass:repairs[0],check:seconds[0]}] : null;
  }
  if (firsts.length !== 1) return null;
  const first = firsts[0];
  if (matchingAgreement(first,field)) return [{pass:verifies[0],check:first}];
  // A wrong/ambiguous first reading cannot be erased by a later agreement.
  if (first.status !== "corrected" || repairs.length !== 1) return null;
  const seconds=checksAt(repairs[0],ri,fi);
  if(seconds.length!==1)return null;
  const second=seconds[0];
  if(first.meaningStatus!=="supported"||second.meaningStatus!=="supported"||second.status!=="corrected"||first.value===null||first.value!==second.value||first.value!==field.value||!sameUnit(first.unit,second.unit)||!sameUnit(second.unit,field.unit)||!nonempty(first.quote)||!nonempty(second.quote))return null;
  return [{pass:verifies[0],check:first},{pass:repairs[0],check:second}];
}
function fingerprint(input: SourceVerificationInput, category: string, key: string, value: string, unit: string | null, quote: string, proofQuotes: string[], extractionReading:{value:string;unit:string|null;quote:string;bbox?:SourceBBox},verificationScope?:"field_meaning_v1",locatorSegment?:ReturnType<typeof bboxLocatorFingerprintSegment>) {
  // Content identity only; trusted persistence must authenticate this receipt separately.
  const content=[input.sourceHash.toLowerCase(),input.documentId,input.page,normalize(category),key,normalize(value),unit===null?null:normalize(unit),normalize(quote),proofQuotes.map(normalize),[normalize(extractionReading.value),extractionReading.unit===null?null:normalize(extractionReading.unit),normalize(extractionReading.quote)]];
  return verificationScope?JSON.stringify(locatorSegment?[...content,verificationScope,locatorSegment]:[...content,verificationScope]):JSON.stringify(content);
}

function sameContent(record:ReadRecord,field:ReadField,category:string,key:string,value:string,unit:string|null,quote:string):boolean{
  return normalize(record.category)===normalize(category)&&fieldKey(field)===key&&field.value!==null&&normalize(field.value)===value&&sameUnit(field.unit,unit)&&normalize(field.quote??"")===quote;
}
function resolveReceiptLocation(receipt:SourceVerificationReceipt,read:PageRead):{recordIndex:number;fieldIndex:number}|null{
  const candidates:Array<{recordIndex:number;fieldIndex:number;field:ReadField}> = [];
  read.records.forEach((record,recordIndex)=>record.fields.forEach((field,fieldIndex)=>{
    if(normalize(record.category)===normalize(receipt.field.recordCategory)&&fieldKey(field)===receipt.field.key&&field.value!==null&&normalize(field.value)===receipt.field.value&&sameUnit(field.unit,receipt.field.unit)&&normalize(field.quote??"")===receipt.field.quote)candidates.push({recordIndex,fieldIndex,field});
  }));
  const locator=receipt.field.locator;
  if(!locator)return candidates.length===1?{recordIndex:candidates[0].recordIndex,fieldIndex:candidates[0].fieldIndex}:null;
  if(locator.version!=="bbox_v1"||!isValidSourceBBox(locator.bbox))return null;
  if(candidates.length>1&&!sourceBBoxesAreDistinctAndDisjoint(candidates.map(candidate=>candidate.field.bbox)))return null;
  const located=candidates.filter(candidate=>sameSourceBBox(candidate.field.bbox,locator.bbox));
  return located.length===1?{recordIndex:located[0].recordIndex,fieldIndex:located[0].fieldIndex}:null;
}

/** Build server-only receipts. Page incompleteness leaves missing facts unproved but preserves proof for clear cited fields. */
export function createSourceVerificationReceipts(input: SourceVerificationInput): SourceVerificationReceipt[] {
  if(!input.documentId.trim()||!Number.isSafeInteger(input.page)||input.page<1||!validHash(input.sourceHash)||!input.promptVersion.trim()||!validInstant(input.verifiedAt)||input.passes.some(p=>p.kind!=="verify"&&p.kind!=="repair"||p.model!==AI_MODEL||p.promptVersion!==input.promptVersion||!validHash(p.promptHash)||!validInstant(p.verifiedAt)))return [];
  const errors=new Set((input.errors??[]).map(e=>`${e.recordIndex}:${e.fieldIndex}`));
  const drafts:SourceVerificationReceipt[]=[];
  input.read.records.forEach((record,ri)=>record.fields.forEach((field,fi)=>{
    if(errors.has(`${ri}:${fi}`))return;
    const proof=proofFor(input.read,input.passes,ri,fi),originalRecord=input.originalRead.records[ri],originalField=fieldAt(input.originalRead,ri,fi);if(!proof||!originalRecord||normalize(originalRecord.category)!==normalize(record.category)||!originalField||fieldKey(originalField)!==fieldKey(field)||originalField.value===null||!nonempty(originalField.quote))return;
    const key=fieldKey(field),value=normalize(field.value!),unit=field.unit===null?null:normalize(field.unit),quote=normalize(field.quote!),proofQuotes=proof.map(p=>normalize(p.check.quote!));
    const occurrences=input.read.records.flatMap((r,recordIndex)=>r.fields.map((f,fieldIndex)=>({r,f,recordIndex,fieldIndex}))).filter(({r,f})=>sameContent(r,f,record.category,key,value,unit,quote));
    const duplicated=occurrences.length>1;
    let locator:BBoxReceiptLocator|undefined,extractionBBox:SourceBBox|undefined;
    let receiptOriginal=originalField;
    if(duplicated){
      if(!sourceBBoxesAreDistinctAndDisjoint(occurrences.map(item=>item.f.bbox))||!isValidSourceBBox(field.bbox)||!sameSourceBBox(originalField.bbox,field.bbox)||proof.some(item=>item.pass.bindingStatus!=="bound"||!!item.pass.bindingIssues?.length||!sameSourceBBox(item.check.bbox,field.bbox)))return;
      const originalMatches=input.originalRead.records.flatMap(r=>r.fields.map(f=>({r,f}))).filter(({r,f})=>normalize(r.category)===normalize(record.category)&&fieldKey(f)===key&&sameSourceBBox(f.bbox,field.bbox));
      if(originalMatches.length!==1||originalMatches[0].f.value===null||!nonempty(originalMatches[0].f.quote))return;
      receiptOriginal=originalMatches[0].f;
      locator={version:"bbox_v1",bbox:[...field.bbox]};extractionBBox=[...receiptOriginal.bbox!];
    }else if(occurrences.length!==1)return;
    const extractionReading={value:normalize(receiptOriginal.value!),unit:receiptOriginal.unit===null?null:normalize(receiptOriginal.unit),quote:normalize(receiptOriginal.quote!),...(extractionBBox?{bbox:extractionBBox}:{})};
    const verificationScope="field_meaning_v1" as const;
    const proofBBoxes=locator?proof.map(item=>[...item.check.bbox!] as SourceBBox):undefined;
    const locatorSegment=locator?bboxLocatorFingerprintSegment({locator,extractionBBox:extractionBBox!,proofBBoxes:proofBBoxes!}):undefined;
    drafts.push({method:SOURCE_VERIFICATION_METHOD,model:SOURCE_VERIFICATION_MODEL,promptVersion:input.promptVersion,verifiedAt:input.verifiedAt,verificationScope,source:{documentId:input.documentId,page:input.page,sha256:input.sourceHash.toLowerCase()},field:{recordCategory:record.category,key,value,unit,quote,...(locator?{locator}:{})},extractionReading,verificationQuotes:proofQuotes,fieldFingerprint:fingerprint(input,record.category,key,value,unit,quote,proofQuotes,extractionReading,verificationScope,locatorSegment),proofReadIndexes:proof.map(p=>({pass:p.pass.kind,recordIndex:ri,fieldIndex:fi})),proofReads:proof.map(p=>({pass:p.pass.kind,model:p.pass.model,promptVersion:p.pass.promptVersion,promptHash:p.pass.promptHash,verifiedAt:p.pass.verifiedAt,recordIndex:ri,fieldIndex:fi,meaningStatus:p.check.meaningStatus,status:p.check.status as "agrees"|"corrected",value:normalize(p.check.value!),unit:p.check.unit===null?null:normalize(p.check.unit),quote:normalize(p.check.quote!),...(locator?{bbox:[...p.check.bbox!] as SourceBBox}:{})})),recognition:"unreviewed"});
  }));
  const counts=new Map<string,number>();for(const r of drafts)counts.set(r.fieldFingerprint,(counts.get(r.fieldFingerprint)??0)+1);
  return drafts.filter(r=>counts.get(r.fieldFingerprint)===1);
}
export function sourceVerificationReceiptMatches(receipt: SourceVerificationReceipt, input: Pick<SourceVerificationInput,"documentId"|"page"|"sourceHash"|"read">):boolean {
  if(receipt.source.documentId!==input.documentId||receipt.source.page!==input.page||receipt.source.sha256!==input.sourceHash.toLowerCase()||!validHash(input.sourceHash))return false;
  const location=resolveReceiptLocation(receipt,input.read);if(!location)return false;
  const candidate=input.read.records[location.recordIndex]?.fields[location.fieldIndex];
  const category=input.read.records[location.recordIndex]?.category;
  if(!candidate||candidate.confidence!=="clear"||!category)return false;
  const fingerprintHasMeaningScope=(()=>{try{const parsed=JSON.parse(receipt.fieldFingerprint);return Array.isArray(parsed)&&(parsed.at(-1)==="field_meaning_v1"||parsed.at(-2)==="field_meaning_v1");}catch{return false;}})();
  if(!Array.isArray(receipt.proofReads))return false;
  const hasMeaningReadMetadata=receipt.proofReads.some(proof=>Object.hasOwn(proof,"meaningStatus"));
  if(receipt.verificationScope==="field_meaning_v1"){if(!fingerprintHasMeaningScope||!receipt.proofReads.length||receipt.proofReads.some(proof=>proof.meaningStatus!=="supported"))return false;}
  else if(receipt.verificationScope!==undefined||fingerprintHasMeaningScope||hasMeaningReadMetadata)return false;
  let locatorSegment:ReturnType<typeof bboxLocatorFingerprintSegment>|undefined;
  if(receipt.field.locator){
    if(receipt.field.locator.version!=="bbox_v1"||!isValidSourceBBox(receipt.field.locator.bbox)||!sameSourceBBox(candidate.bbox,receipt.field.locator.bbox)||!isValidSourceBBox(receipt.extractionReading.bbox)||!sameSourceBBox(receipt.extractionReading.bbox,receipt.field.locator.bbox)||receipt.proofReads.some(proof=>!isValidSourceBBox(proof.bbox)||!sameSourceBBox(proof.bbox,receipt.field.locator!.bbox)))return false;
    locatorSegment=bboxLocatorFingerprintSegment({locator:receipt.field.locator,extractionBBox:receipt.extractionReading.bbox,proofBBoxes:receipt.proofReads.map(proof=>proof.bbox!)});
  }else if(receipt.extractionReading.bbox!==undefined||receipt.proofReads.some(proof=>proof.bbox!==undefined))return false;
  return fingerprint({...input,originalRead:input.read,promptVersion:receipt.promptVersion,verifiedAt:receipt.verifiedAt,passes:[]},category,receipt.field.key,receipt.field.value,receipt.field.unit,receipt.field.quote,receipt.verificationQuotes,receipt.extractionReading,receipt.verificationScope,locatorSegment)===receipt.fieldFingerprint;
}

/** Locate a receipt's exact source field in a current read after safe array-index drift. */
export function sourceVerificationFieldLocation(receipt:SourceVerificationReceipt,read:PageRead):{recordIndex:number;fieldIndex:number}|null{
  if(!sourceVerificationReceiptMatches(receipt,{documentId:receipt.source.documentId,page:receipt.source.page,sourceHash:receipt.source.sha256,read}))return null;
  const location=resolveReceiptLocation(receipt,read);if(!location)return null;
  return read.records[location.recordIndex]?.fields[location.fieldIndex]?.confidence==="clear"?location:null;
}

/** Reuse only baseline fields already source-agreed and faithfully preserved in a missing-row reread. */
export function createPreservedOmissionReceipts(input:{documentId:string;page:number;sourceHash:string;promptVersion:string;verifiedAt:string;baselineRead:PageRead;baselinePass:ReviewPass;mergedRead:PageRead}):SourceVerificationReceipt[]{
  const candidates=createSourceVerificationReceipts({documentId:input.documentId,page:input.page,sourceHash:input.sourceHash,promptVersion:input.promptVersion,verifiedAt:input.verifiedAt,originalRead:input.baselineRead,read:input.baselineRead,passes:[input.baselinePass]});
  return candidates.filter(receipt=>sourceVerificationFieldLocation(receipt,input.mergedRead)!==null);
}
