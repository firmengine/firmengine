import { applyExtraction, currentFacts, factSourceLineageIssues, type CaseData, type ExtractionPayload } from "./domain.ts";
import { projectPage, validatePageRead, type PageRead } from "./extraction.ts";
import { samplePageRole } from "./sample-manifest.ts";

export class ReprojectionError extends Error { readonly status = 409; }
const conflict = (message: string) => new ReprojectionError(message);

/** Bump whenever source-to-fact projection semantics change. This is not a model prompt version. */
export const PAGE_PROJECTION_VERSION = "source-projection-2026-10-27.4";

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
  return { document, page, read, provenance };
}

/** Pure projection stage: no model call, no receipt creation, no review-state promotion. */
export function reprojectStoredPage(data: CaseData, prepared: ReturnType<typeof prepareStoredReadReprojection>) {
  const payload: ExtractionPayload = projectPage(prepared.read, prepared.document.id, prepared.page.page, prepared.document.sha256);
  const projected = applyExtraction(data, payload);
  const retainedReceipts = currentFacts(projected).filter(fact => fact.refs.some(ref => ref.documentId === prepared.document.id && ref.page === prepared.page.page) && !!fact.sourceVerification && !factSourceLineageIssues(projected, [fact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID")).length;
  return { data: projected, payload, retainedReceipts, newReceiptsCreated: 0, projectionVersion: PAGE_PROJECTION_VERSION };
}
