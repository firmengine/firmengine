import { AI_MODEL, normalizeMoney } from "./domain.ts";

/** Trusted server-side cross-read proof; it never grants legal recognition. */
export const SOURCE_VERIFICATION_METHOD = "independent_luna_cross_read" as const;
export const SOURCE_VERIFICATION_MODEL = AI_MODEL;
export interface ReadField { key: string; value: string | null; unit: string | null; quote: string | null; confidence: "clear" | "uncertain" | "unreadable" }
export interface ReadRecord { category: string; fields: ReadField[] }
export interface PageRead { documentType: string; complete: boolean; records: ReadRecord[] }
export interface Check { recordIndex: number; fieldIndex: number; status: "agrees" | "corrected" | "unreadable" | "ambiguous"; value: string | null; unit: string | null; quote: string | null }
export interface ReviewPass { kind: "verify" | "repair"; checks: readonly Check[]; model: typeof AI_MODEL; promptVersion: string; promptHash: string; verifiedAt: string }
export interface FieldError { recordIndex: number; fieldIndex: number; code: string }
export interface SourceVerificationInput {
  documentId: string; page: number; sourceHash: string; promptVersion: string; verifiedAt: string;
  originalRead: PageRead; read: PageRead; passes: readonly ReviewPass[]; errors?: readonly FieldError[];
}
export interface SourceVerificationReceipt {
  method: typeof SOURCE_VERIFICATION_METHOD; model: typeof AI_MODEL; promptVersion: string; verifiedAt: string;
  source: { documentId: string; page: number; sha256: string };
  field: { recordCategory: string; key: string; value: string; unit: string | null; quote: string };
  extractionReading: { value: string; unit: string | null; quote: string };
  verificationQuotes: string[]; fieldFingerprint: string;
  proofReads: Array<{ pass: "verify" | "repair"; model: typeof AI_MODEL; promptVersion: string; promptHash: string; verifiedAt: string; recordIndex: number; fieldIndex: number; status: "agrees" | "corrected"; value: string; unit: string | null; quote: string }>;
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
const monetaryKeys = new Set(["principal","interest","total","gross","expenses","net","gross_value","secured_payoff","disposal_costs","protected_value","amount","reported_amount","balance","monthly_rent","deposit","secured_balance","arrears_deduction","tax_arrears","premium_arrears","late_charge","total_arrears","disposition_amount","arrears_amount","current_balance","claim_amount","amount_due","refund_value","guarantee_limit","guarantee_amount"]);
const isMonetary = (key: string) => monetaryKeys.has(key.split(".").at(-1) ?? key);
const fieldAt = (read: PageRead, ri: number, fi: number) => read.records[ri]?.fields[fi];
const checksAt = (pass: ReviewPass, ri: number, fi: number) => pass.checks.filter(c => c.recordIndex === ri && c.fieldIndex === fi);
function matchingAgreement(check: Check, field: ReadField) { return check.status === "agrees" && check.value !== null && check.value === field.value && sameUnit(check.unit, field.unit) && nonempty(check.quote); }

type ProofCheck = { pass: ReviewPass; check: Check };
function proofFor(read: PageRead, passes: readonly ReviewPass[], ri: number, fi: number): ProofCheck[] | null {
  const verifies = passes.filter(p => p.kind === "verify"), repairs = passes.filter(p => p.kind === "repair");
  if (verifies.length !== 1 || repairs.length > 1) return null;
  const firsts = checksAt(verifies[0],ri,fi), field = fieldAt(read,ri,fi);
  if (!field || field.confidence !== "clear" || field.value === null || !nonempty(field.quote)) return null;
  if (isMonetary(fieldKey(field)) && (!nonempty(field.unit) || normalizeMoney(field.value,normalize(field.unit)).normalizationStatus !== "exact")) return null;
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
  if(second.status!=="corrected"||first.value===null||first.value!==second.value||first.value!==field.value||!sameUnit(first.unit,second.unit)||!sameUnit(second.unit,field.unit)||!nonempty(first.quote)||!nonempty(second.quote))return null;
  return [{pass:verifies[0],check:first},{pass:repairs[0],check:second}];
}
function fingerprint(input: SourceVerificationInput, category: string, key: string, value: string, unit: string | null, quote: string, proofQuotes: string[], extractionReading:{value:string;unit:string|null;quote:string}) {
  // Content identity only; trusted persistence must authenticate this receipt separately.
  return JSON.stringify([input.sourceHash.toLowerCase(),input.documentId,input.page,normalize(category),key,normalize(value),unit===null?null:normalize(unit),normalize(quote),proofQuotes.map(normalize),[normalize(extractionReading.value),extractionReading.unit===null?null:normalize(extractionReading.unit),normalize(extractionReading.quote)]]);
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
    const extractionReading={value:normalize(originalField.value),unit:originalField.unit===null?null:normalize(originalField.unit),quote:normalize(originalField.quote)};
    const occurrenceCount=input.read.records.flatMap(r=>r.fields.map(f=>({r,f}))).filter(({r,f})=>normalize(r.category)===normalize(record.category)&&fieldKey(f)===key&&f.value!==null&&normalize(f.value)===value&&sameUnit(f.unit,unit)&&normalize(f.quote??"")===quote).length;
    if(occurrenceCount!==1)return;
    drafts.push({method:SOURCE_VERIFICATION_METHOD,model:SOURCE_VERIFICATION_MODEL,promptVersion:input.promptVersion,verifiedAt:input.verifiedAt,source:{documentId:input.documentId,page:input.page,sha256:input.sourceHash.toLowerCase()},field:{recordCategory:record.category,key,value,unit,quote},extractionReading,verificationQuotes:proofQuotes,fieldFingerprint:fingerprint(input,record.category,key,value,unit,quote,proofQuotes,extractionReading),proofReadIndexes:proof.map(p=>({pass:p.pass.kind,recordIndex:ri,fieldIndex:fi})),proofReads:proof.map(p=>({pass:p.pass.kind,model:p.pass.model,promptVersion:p.pass.promptVersion,promptHash:p.pass.promptHash,verifiedAt:p.pass.verifiedAt,recordIndex:ri,fieldIndex:fi,status:p.check.status as "agrees"|"corrected",value:normalize(p.check.value!),unit:p.check.unit===null?null:normalize(p.check.unit),quote:normalize(p.check.quote!)})),recognition:"unreviewed"});
  }));
  const counts=new Map<string,number>();for(const r of drafts)counts.set(r.fieldFingerprint,(counts.get(r.fieldFingerprint)??0)+1);
  return drafts.filter(r=>counts.get(r.fieldFingerprint)===1);
}
export function sourceVerificationReceiptMatches(receipt: SourceVerificationReceipt, input: Pick<SourceVerificationInput,"documentId"|"page"|"sourceHash"|"read">):boolean {
  if(receipt.source.documentId!==input.documentId||receipt.source.page!==input.page||receipt.source.sha256!==input.sourceHash.toLowerCase()||!validHash(input.sourceHash))return false;
  const candidates=input.read.records.flatMap(r=>r.fields.map(f=>({r,f}))).filter(({r,f})=>normalize(r.category)===normalize(receipt.field.recordCategory)&&fieldKey(f)===receipt.field.key&&f.value!==null&&normalize(f.value)===receipt.field.value&&sameUnit(f.unit,receipt.field.unit)&&normalize(f.quote??"")===receipt.field.quote);
  if(candidates.length!==1||candidates[0].f.confidence!=="clear")return false;
  return fingerprint({...input,originalRead:input.read,promptVersion:receipt.promptVersion,verifiedAt:receipt.verifiedAt,passes:[]},candidates[0].r.category,receipt.field.key,receipt.field.value,receipt.field.unit,receipt.field.quote,receipt.verificationQuotes,receipt.extractionReading)===receipt.fieldFingerprint;
}

/** Locate a receipt's exact source field in a current read after safe array-index drift. */
export function sourceVerificationFieldLocation(receipt:SourceVerificationReceipt,read:PageRead):{recordIndex:number;fieldIndex:number}|null{
  const matches:Array<{recordIndex:number;fieldIndex:number}>=[];
  read.records.forEach((record,recordIndex)=>record.fields.forEach((field,fieldIndex)=>{
    if(normalize(record.category)===normalize(receipt.field.recordCategory)&&fieldKey(field)===receipt.field.key&&field.confidence==="clear"&&field.value!==null&&normalize(field.value)===receipt.field.value&&sameUnit(field.unit,receipt.field.unit)&&normalize(field.quote??"")===receipt.field.quote)matches.push({recordIndex,fieldIndex});
  }));
  return matches.length===1?matches[0]:null;
}

/** Reuse only baseline fields already source-agreed and faithfully preserved in a missing-row reread. */
export function createPreservedOmissionReceipts(input:{documentId:string;page:number;sourceHash:string;promptVersion:string;verifiedAt:string;baselineRead:PageRead;baselinePass:ReviewPass;mergedRead:PageRead}):SourceVerificationReceipt[]{
  const candidates=createSourceVerificationReceipts({documentId:input.documentId,page:input.page,sourceHash:input.sourceHash,promptVersion:input.promptVersion,verifiedAt:input.verifiedAt,originalRead:input.baselineRead,read:input.baselineRead,passes:[input.baselinePass]});
  return candidates.filter(receipt=>sourceVerificationFieldLocation(receipt,input.mergedRead)!==null);
}
