import { isSourceReadModel, applyExtraction, currentFacts, factSourceLineageIssues, moneyValue, normalizeMoney, type CaseData, type ExtractionPayload, type Fact } from "./domain.ts";
import { projectPage, validatePageRead, type PageRead } from "./extraction.ts";
import { samplePageRole } from "./sample-manifest.ts";
import { sourceVerificationFieldLocation, sourceVerificationReceiptMatches, type SourceVerificationReceipt } from "./source-verification.ts";
import { sameSourceBBox } from "./source-verification-identity.ts";

export class ReprojectionError extends Error { readonly status = 409; }
const conflict = (message: string) => new ReprojectionError(message);

/** Bump whenever source-to-fact projection semantics change. This is not a model prompt version. */
export const PAGE_PROJECTION_VERSION = "source-projection-2026-10-28.17";

export interface StoredPageJobForReprojection {
  id: string;
  caseId: string;
  documentId: string;
  page: number;
  role: string;
  status: string;
  stage: string;
  leaseUntil: string | null;
  imageKey: string | null;
  imageHash: string | null;
  cacheKey: string | null;
  result: string | null;
}
export interface StoredReadResult {
  read?: unknown;
  firstRead?: unknown;
  extractionRead?: unknown;
  review?: unknown;
  verifierPasses?: unknown;
  extractionPasses?: unknown;
  reverification?: unknown;
  sourceReceiptCount?: unknown;
  projection?: { version?: string; appliedAt?: string; caseRevision?: number; sourceSha256?: string; cacheKey?: string | null };
  [key: string]: unknown;
}
export interface HistoricalReadProvenance {
  documentId: string;
  documentSha256: string;
  page: number;
  mappingVersion: string;
  promptVersion: string;
  model: string;
  ruleReleaseId: string;
  verificationPasses: number;
  storedReceiptCount: number;
}

export function parseHistoricalReadProvenance(job: StoredPageJobForReprojection, documentSha256: string, saved: StoredReadResult): HistoricalReadProvenance {
  let tuple: unknown;
  try { tuple = job.cacheKey ? JSON.parse(job.cacheKey) : undefined; } catch { tuple = undefined; }
  if (!Array.isArray(tuple) || tuple.length !== 7 || tuple[0] !== job.documentId || tuple[1] !== documentSha256 || !Array.isArray(tuple[2]) || tuple[2].length !== 1 || tuple[2][0] !== job.page || tuple.slice(3).some(value => typeof value !== "string" || !value.trim())) {
    throw conflict("저장된 판독의 문서·페이지·모델 프롬프트 출처를 확인할 수 없어 재투영을 보류합니다.");
  }
  const passes = Array.isArray(saved.verifierPasses) ? saved.verifierPasses : [];
  return { documentId: tuple[0], documentSha256: tuple[1], page: job.page, mappingVersion: tuple[3], promptVersion: tuple[4], model: tuple[5], ruleReleaseId: tuple[6], verificationPasses: passes.length, storedReceiptCount: Number.isSafeInteger(saved.sourceReceiptCount) && Number(saved.sourceReceiptCount) >= 0 ? Number(saved.sourceReceiptCount) : 0 };
}

export function hasCurrentProjection(saved: StoredReadResult, job: StoredPageJobForReprojection, sourceSha256: string): boolean {
  return saved.projection?.version === PAGE_PROJECTION_VERSION && saved.projection.sourceSha256 === sourceSha256 && saved.projection.cacheKey === job.cacheKey;
}

/** Diagnostic reads may expose legacy records; mutations need actual extraction provenance. */
export function hasBoundExtractionProvenance(saved: StoredReadResult, job: StoredPageJobForReprojection, provenance: HistoricalReadProvenance): boolean {
  const passes = Array.isArray(saved.extractionPasses) ? saved.extractionPasses : [];
  return passes.length > 0 && passes.every(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const pass = value as Record<string, unknown>;
    return pass.model === provenance.model && isSourceReadModel(pass.model) && typeof pass.promptVersion === "string" && !!pass.promptVersion.trim() && typeof pass.promptHash === "string" && /^[a-f0-9]{64}$/i.test(pass.promptHash) && pass.sourceHash === provenance.documentSha256 && pass.baseImageHash === job.imageHash && typeof pass.verifiedAt === "string" && Number.isFinite(Date.parse(pass.verifiedAt));
  });
}

export function requireReprojectionProvenance(saved: StoredReadResult, job: StoredPageJobForReprojection, provenance: HistoricalReadProvenance): void {
  if (!hasBoundExtractionProvenance(saved, job, provenance)) throw conflict("저장 판독의 추출 모델·프롬프트·원본·이미지 연결이 없어 재투영할 수 없습니다. 같은 원본의 이 증빙 페이지만 현행 방식으로 재판독하세요.");
}

export function prepareStoredReadReprojection(input: {
  data: CaseData;
  job: StoredPageJobForReprojection;
  saved: StoredReadResult;
  originalReady: boolean;
  imageReady: boolean;
  activeProcessingJobs: number;
}) {
  const { data, job, saved } = input;
  if (job.caseId !== data.context.id || !job.id) throw conflict("현재 사건의 페이지 판독을 찾을 수 없습니다.");
  const document = data.documents.find(row => row.id === job.documentId && row.status === "active");
  const page = data.pages.find(row => row.documentId === job.documentId && row.page === job.page);
  if (!document || !document.pages.includes(job.page) || !page) throw conflict("철회되었거나 현재 문서에 속하지 않는 페이지입니다.");
  const frozenRole = samplePageRole(document.sha256, job.page).role;
  if (job.role !== "evidence" || page.role !== "evidence" || frozenRole === "filed_form" || frozenRole === "administrative") throw conflict("제출서식·행정·분리 페이지는 재투영할 수 없습니다.");
  if (job.status !== "completed" && job.status !== "review_required" || job.stage !== "completed" || job.leaseUntil !== null) throw conflict("판독이 완료되어 검토 대기 중인 증빙 페이지에서만 저장된 판독을 재투영할 수 있습니다.");
  if (input.activeProcessingJobs !== 0) throw conflict("다른 페이지 처리가 진행 중입니다. 모든 처리가 끝난 뒤 다시 시도하세요.");
  if (!input.originalReady || !input.imageReady || !job.imageKey || !job.imageHash || !/^[a-f0-9]{64}$/i.test(job.imageHash)) throw conflict("원본 파일과 불변 페이지 이미지의 저장 상태를 확인할 수 없습니다.");
  if (!/^[a-f0-9]{64}$/i.test(document.sha256)) throw conflict("현재 원본 문서의 해시가 올바르지 않습니다.");
  const provenance = parseHistoricalReadProvenance(job, document.sha256, saved);
  if (!saved.read) throw conflict("저장된 원문 판독이 없어 재투영할 수 없습니다.");
  let read: PageRead;
  try { read = validatePageRead(saved.read); } catch { throw conflict("저장된 원문 판독 형식이 현재 검증기를 통과하지 못했습니다."); }
  let originalRead:PageRead;
  try { originalRead=validatePageRead(saved.extractionRead??saved.firstRead??saved.read); } catch { throw conflict("저장된 최초 판독 원문 형식이 현재 검증기를 통과하지 못했습니다."); }
  return { document, page, read, originalRead, provenance };
}

const normalized=(value:string)=>value.normalize("NFKC").trim();
function sameRefs(a:Fact["refs"],b:NonNullable<ExtractionPayload["facts"]>[number]["refs"]):boolean{
  const refs=(items:typeof a)=>items.map(ref=>[ref.documentId,ref.page,ref.quote,ref.sourceHash??null]).sort((left,right)=>JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify(refs(a))===JSON.stringify(refs(b as Fact["refs"]));
}
function sameOrNewExactNormalization(prior:Fact,raw:NonNullable<ExtractionPayload["facts"]>[number]):boolean{
  if(JSON.stringify(prior.numeric??null)===JSON.stringify(raw.numeric??null))return true;
  const numeric=raw.numeric,proof=prior.sourceVerification;
  // A receipt attests to the read value and source unit. Adding its exact
  // deterministic won normalization does not require another model reading.
  // Changing an existing normalization, scale or amount never takes this path.
  if(prior.numeric||!numeric||!proof||typeof proof.field.unit!=="string"||!proof.field.unit.trim()||typeof raw.sourceUnit!=="string"||normalized(raw.sourceUnit)!==normalized(proof.field.unit)||normalized(numeric.unit)!==normalized(proof.field.unit)||numeric.currency!=="KRW"||moneyValue(numeric)===null)return false;
  if(raw.value===null||raw.value===undefined||normalized(String(numeric.rawValue))!==normalized(String(raw.value)))return false;
  return normalizeMoney(proof.field.value,proof.field.unit).amountWon===numeric.amountWon;
}
function historicalProofIsCurrent(data:CaseData,prior:Fact,raw:NonNullable<ExtractionPayload["facts"]>[number],prepared:ReturnType<typeof prepareStoredReadReprojection>):boolean{
  const proof=prior.sourceVerification;
  if(!proof||prior.state!=="verified"||prior.recognition!=="unreviewed"||prior.reviewer)return false;
  if(data.facts.some(fact=>fact.logicalId===prior.logicalId&&fact.version>prior.version&&(!!fact.reviewer||fact.state==="reported"||fact.state!=="retracted"&&fact.recognition!=="unreviewed")))return false;
  if(proof.factBinding?.id!==prior.id||proof.factBinding.logicalId!==prior.logicalId||proof.factBinding.version!==prior.version)return false;
  if(prior.key!==raw.key||JSON.stringify(prior.value)!==JSON.stringify(raw.value)||prior.rawValue!==raw.rawValue||!sameOrNewExactNormalization(prior,raw)||prior.periodStart!==raw.periodStart||prior.periodEnd!==raw.periodEnd||prior.asOf!==raw.asOf||!raw.refs?.length||!sameRefs(prior.refs,raw.refs))return false;
  if(Object.hasOwn(raw,"sourceUnit")&&(raw.sourceUnit===null?proof.field.unit!==null:typeof raw.sourceUnit!=="string"||typeof proof.field.unit!=="string"||normalized(raw.sourceUnit)!==normalized(proof.field.unit)))return false;
  if(proof.source.documentId!==prepared.document.id||proof.source.page!==prepared.page.page||proof.source.sha256!==prepared.document.sha256)return false;
  const receipt=proof as unknown as SourceVerificationReceipt;
  if(!sourceVerificationReceiptMatches(receipt,{documentId:prepared.document.id,page:prepared.page.page,sourceHash:prepared.document.sha256,read:prepared.read}))return false;
  const location=sourceVerificationFieldLocation(receipt,prepared.read);
  if(!location||raw.id!==`${prepared.document.id}:p${prepared.page.page}:${receipt.field.recordCategory}:${location.recordIndex}:f${location.fieldIndex}`)return false;
  // The proof's original extraction reading must still be locatable in the
  // preserved first read. Corrected final values are allowed only because the
  // existing receipt separately binds both correction passes to `read`.
  const extractionReading=proof.extractionReading;
  const originalMatches=prepared.originalRead.records.flatMap(record=>record.fields.map(field=>({record,field}))).filter(({record,field})=>normalized(record.category)===normalized(proof.field.recordCategory)&&normalized(field.key).replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase()===proof.field.key&&field.value!==null&&normalized(field.value)===normalized(extractionReading.value)&&((field.unit===null&&extractionReading.unit===null)||(field.unit!==null&&extractionReading.unit!==null&&normalized(field.unit)===normalized(extractionReading.unit)))&&normalized(field.quote??"")===normalized(extractionReading.quote)&&(!proof.field.locator||sameSourceBBox(field.bbox,proof.field.locator.bbox)));
  if(originalMatches.length!==1)return false;
  // Validate this one receipt as its active historical version against the full
  // current document/page context. This check has no cross-fact calculation, so
  // unrelated ledger history need not be regrouped for every source field.
  const validationView:CaseData={...data,facts:[prior]};
  const issues=factSourceLineageIssues(validationView,[prior.id]);
  return issues.length===0;
}
function sameFactProjection(fact:Fact,raw:NonNullable<ExtractionPayload["facts"]>[number]):boolean{
  const sourceUnitMatches=!Object.hasOwn(raw,"sourceUnit")||!Object.hasOwn(fact,"sourceUnit")||(fact.sourceUnit==null&&raw.sourceUnit==null||typeof fact.sourceUnit==="string"&&typeof raw.sourceUnit==="string"&&normalized(fact.sourceUnit)===normalized(raw.sourceUnit));
  return sourceUnitMatches&&!!raw.logicalId&&fact.logicalId===raw.logicalId&&fact.key===raw.key&&fact.subjectId===raw.subjectId&&JSON.stringify(fact.value)===JSON.stringify(raw.value)&&fact.rawValue===raw.rawValue&&JSON.stringify(fact.numeric??null)===JSON.stringify(raw.numeric??null)&&fact.periodStart===raw.periodStart&&fact.periodEnd===raw.periodEnd&&fact.asOf===raw.asOf&&!!raw.refs?.length&&sameRefs(fact.refs,raw.refs);
}
/** Pure projection stage: no model call, no receipt creation, no review-state promotion. */
export function reprojectStoredPage(data: CaseData, prepared: ReturnType<typeof prepareStoredReadReprojection>) {
  const payload: ExtractionPayload = projectPage(prepared.read, prepared.document.id, prepared.page.page, prepared.document.sha256);
  const projected = applyExtraction(data, payload);
  // A trusted stored-read reprojection may rebind only an already-issued server
  // receipt when the exact original field and projected fact remain unchanged.
  // General extraction still strips all machine proof and human review fields.
  const current=currentFacts(projected);
  for(const raw of payload.facts??[]){
    if(!raw.logicalId||!raw.refs?.some(ref=>ref.documentId===prepared.document.id&&ref.page===prepared.page.page&&ref.sourceHash===prepared.document.sha256))continue;
    const candidates=data.facts.filter(fact=>fact.key===raw.key&&historicalProofIsCurrent(data,fact,raw,prepared)).sort((a,b)=>b.version-a.version);
    if(!candidates.length)continue;
    const prior=candidates[0];
    const replacements=current.filter(fact=>sameFactProjection(fact,raw));
    if(replacements.length!==1)continue;
    const fact=replacements[0];
    if(fact.reviewer||fact.state!=="extracted"&&fact.state!=="verified"||fact.recognition!=="unreviewed")continue;
    const proof=structuredClone(prior.sourceVerification!);
    fact.state="verified";fact.recognition="unreviewed";fact.sourceVerification={...proof,factBinding:{id:fact.id,logicalId:fact.logicalId,version:fact.version}};
  }
  const retainedReceipts = currentFacts(projected).filter(fact => fact.refs.some(ref => ref.documentId === prepared.document.id && ref.page === prepared.page.page) && !!fact.sourceVerification && !factSourceLineageIssues(projected, [fact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID")).length;
  return { data: projected, payload, retainedReceipts, newReceiptsCreated: 0, projectionVersion: PAGE_PROJECTION_VERSION };
}
