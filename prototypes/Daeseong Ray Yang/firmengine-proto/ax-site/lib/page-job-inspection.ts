import type { CaseData } from "./domain";
import { hasBoundExtractionProvenance, hasCurrentProjection, parseHistoricalReadProvenance, prepareStoredReadReprojection, requireReprojectionProvenance, type StoredPageJobForReprojection, type StoredReadResult } from "./reprojection";
import { isValidSourceBBox, validatePageRead } from "./extraction";
import { samplePageRole } from "./sample-manifest";
import { db, bucket, getCase, HttpError, sha256 } from "./server-store";

type JobRow = StoredPageJobForReprojection & { image_key: string | null; image_hash: string | null; cache_key: string | null; lease_until: string | null; document_sha256: string; ready: number; original_key: string | null; active_processing_jobs: number; error: string | null; document_type: string | null };
const mapJob = (row: JobRow): StoredPageJobForReprojection & { error: string | null; documentType: string | null } => ({ id: row.id, caseId: row.caseId, documentId: row.documentId, page: row.page, role: row.role, status: row.status, stage: row.stage, leaseUntil: row.lease_until, imageKey: row.image_key, imageHash: row.image_hash, cacheKey: row.cache_key, result: row.result, error: row.error, documentType: row.document_type });
function parseResult(raw: string | null): StoredReadResult {
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value as StoredReadResult;
  } catch { throw new HttpError(409, "저장된 판독 결과가 없거나 손상되어 재투영을 보류합니다."); }
}

async function loadBoundJob(caseId: string, jobId: string, data?: CaseData) {
  if (!jobId.trim() || jobId.length > 300) throw new HttpError(400, "페이지 작업 ID가 필요합니다.");
  const current = data ?? await getCase(caseId);
  const row = await db().prepare(`SELECT p.id,p.case_id AS caseId,p.document_id AS documentId,p.page,p.role,p.status,p.stage,p.error,p.document_type,p.lease_until,p.image_key,p.image_hash,p.cache_key,p.result,d.sha256 AS document_sha256,d.ready,d.original_key,(SELECT COUNT(*) FROM page_jobs active WHERE active.case_id = p.case_id AND active.status = 'processing') AS active_processing_jobs FROM page_jobs p JOIN documents d ON d.id = p.document_id AND d.case_id = p.case_id WHERE p.case_id = ? AND p.id = ?`).bind(caseId, jobId).first<JobRow>();
  if (!row || row.caseId !== caseId || current.context.id !== caseId) throw new HttpError(404, "현재 사건의 페이지 작업을 찾을 수 없습니다.");
  const job = mapJob(row), saved = parseResult(row.result);
  const document = current.documents.find(item => item.id === job.documentId && item.status === "active");
  if (!document || document.sha256 !== row.document_sha256) throw new HttpError(409, "문서가 철회되었거나 현재 원본 해시와 저장 상태가 다릅니다.");
  const expectedOriginalPrefix = `cases/${caseId}/documents/${job.documentId}/original/`;
  const original = row.ready === 1 && !!row.original_key?.startsWith(expectedOriginalPrefix) ? await bucket().get(row.original_key) : null;
  const originalReady = !!original && await sha256(await original.arrayBuffer()) === row.document_sha256;
  const expectedImagePrefix = `cases/${caseId}/documents/${job.documentId}/pages/${job.page}/${job.imageHash}`;
  const image = job.imageKey && job.imageHash && job.imageKey === expectedImagePrefix ? await bucket().get(job.imageKey) : null;
  const imageReady = !!image && !!job.imageHash && await sha256(await image.arrayBuffer()) === job.imageHash;
  return { data: current, job, saved, rawResult: row.result!, document, originalReady, imageReady, activeProcessingJobs: row.active_processing_jobs };
}

async function inspect(caseId: string, jobId: string, data?: CaseData) {
  const bound = await loadBoundJob(caseId, jobId, data);
  const prepared = prepareStoredReadReprojection({ data: bound.data, job: bound.job, saved: bound.saved, originalReady: bound.originalReady, imageReady: bound.imageReady, activeProcessingJobs: bound.activeProcessingJobs });
  return { ...bound, prepared, provenance: prepared.provenance };
}

/** Read one completed evidence job. Returns only the stored source read and its historical provenance. */
export async function inspectStoredPageJob(caseId: string, jobId: string) {
  const { job, saved, provenance } = await inspect(caseId, jobId);
  const extractionPasses=Array.isArray(saved.extractionPasses)?saved.extractionPasses:[];
  return {
    job: { id: job.id, documentId: job.documentId, page: job.page, role: job.role, status: job.status, stage: job.stage, cacheKey: job.cacheKey },
    historicalProvenance: { ...provenance, extractionPassCount: extractionPasses.length, hasBoundExtractionProvenance: hasBoundExtractionProvenance(saved,job,provenance) },
    stored: { read: saved.read, firstRead: saved.firstRead, extractionRead: saved.extractionRead, review: saved.review, verifierPasses: saved.verifierPasses, extractionPasses: saved.extractionPasses, reverification: saved.reverification, historicalReceiptCounter: provenance.storedReceiptCount, projection: saved.projection },
  };
}

const FAMILY_MISMATCH_ERROR = "원문 판독의 문서 family가 라우팅 계약과 일치하지 않아 판독 결과를 보존하고 사람 검토를 요청했습니다.";

function hasBoundFailedExtractionTask(job: StoredPageJobForReprojection, saved: StoredReadResult, documentSha256: string): boolean {
  const passes = Array.isArray(saved.extractionPasses) ? saved.extractionPasses : [];
  const validRunId = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!passes.length || !validRunId(saved.taskRunId) || typeof job.imageHash !== "string" || !/^[a-f0-9]{64}$/i.test(job.imageHash)) return false;
  return passes.every(passValue => {
    if (!passValue || typeof passValue !== "object" || Array.isArray(passValue)) return false;
    const pass = passValue as Record<string, unknown>;
    const taskValue = pass.agentTask;
    if (!taskValue || typeof taskValue !== "object" || Array.isArray(taskValue)) return false;
    const task = taskValue as Record<string, unknown>;
    const sentImages = Array.isArray(task.sentImageSha256) ? task.sentImageSha256 : [];
    return task.schemaVersion === "document-task-envelope-1"
      && task.runId === saved.taskRunId && validRunId(task.taskId) && task.taskRole === "family_extractor"
      && task.caseId === job.caseId && task.pageJobId === job.id && task.documentId === job.documentId && task.page === job.page
      && task.sourceSha256 === documentSha256 && pass.sourceHash === documentSha256
      && task.imageSha256 === job.imageHash && pass.baseImageHash === job.imageHash && sentImages.includes(job.imageHash)
      && task.model === "gpt-6-luna" && pass.model === task.model
      && typeof task.promptVersion === "string" && !!task.promptVersion.trim() && pass.promptVersion === task.promptVersion
      && typeof pass.promptHash === "string" && /^[a-f0-9]{64}$/i.test(pass.promptHash)
      && typeof pass.verifiedAt === "string" && Number.isFinite(Date.parse(pass.verifiedAt));
  });
}

/** Read-only access to an exact, source-bound extraction preserved by the family-mismatch hold. */
export async function inspectPreservedFamilyRead(caseId: string, jobId: string) {
  const { data, job, saved, document, originalReady, imageReady, activeProcessingJobs } = await loadBoundJob(caseId, jobId);
  if (job.status !== "review_required" || job.stage !== "failed" || job.leaseUntil !== null || activeProcessingJobs !== 0 || job.role !== "evidence") throw new HttpError(409, "보존 판독을 확인할 수 없는 페이지 상태입니다.");
  const page = data.pages.find(value => value.documentId === job.documentId && value.page === job.page);
  if (!page || page.role !== "evidence" || !document.pages.includes(job.page) || ["filed_form", "administrative"].includes(samplePageRole(document.sha256, job.page).role)) throw new HttpError(409, "현재 증빙 페이지와 작업 연결을 확인할 수 없어 저장 판독을 표시하지 않았습니다.");
  if (!saved.read) throw new HttpError(409, "저장된 판독을 확인할 수 없습니다.");
  // Only the explicit fail-closed family-mismatch hold is inspectable here.
  if (job.error !== FAMILY_MISMATCH_ERROR) throw new HttpError(409, "문서 유형 불일치로 보존된 판독 상태가 확인되지 않습니다.");
  if (!originalReady || !imageReady) throw new HttpError(409, "현재 원본 또는 페이지 이미지의 해시를 확인할 수 없어 저장 판독을 표시하지 않았습니다.");
  let provenance;
  try {
    if (job.cacheKey !== null) {
      provenance = parseHistoricalReadProvenance(job, document.sha256, saved);
      if (!hasBoundExtractionProvenance(saved, job, provenance)) throw new Error("unbound extraction");
    } else if (!hasBoundFailedExtractionTask(job, saved, document.sha256)) throw new Error("unbound extraction task");
    const read = validatePageRead(saved.read);
    if (read.records.some(record => record.fields.some(field => field.bbox !== null && !isValidSourceBBox(field.bbox)))) throw new Error("invalid source bbox");
  } catch { throw new HttpError(409, "저장 판독의 원본·이미지·추출 출처 연결 또는 형식을 확인할 수 없어 표시하지 않았습니다."); }
  return {
    mode: "preserved_unverified_extraction" as const,
    caseId,
    job: { id: job.id, documentId: job.documentId, page: job.page, status: job.status, stage: job.stage, routedDocumentType: job.documentType },
    source: { documentSha256: document.sha256, imageHash: job.imageHash },
    extraction: saved.read,
    notice: "보존된 미검증 판독입니다. 문서 유형 불일치로 자동 처리를 중단했습니다. 이 판독은 확인된 사실이나 승인된 결과가 아닙니다. 원본 페이지와 대조해 주세요.",
  };
}

/** Reproject a single saved read without calling the model or modifying page-job completion state. */
export async function reprojectCasePage(caseId: string, jobId: string) {
  const inspection = await inspect(caseId, jobId);
  // Enforce before any claim/write, including a legacy current-version marker.
  // Receipt reuse remains a separate exact-field check in reprojectStoredPage.
  requireReprojectionProvenance(inspection.saved,inspection.job,inspection.provenance);
  if (hasCurrentProjection(inspection.saved, inspection.job, inspection.provenance.documentSha256)) return { ...inspection, alreadyApplied: true as const };
  return { ...inspection, alreadyApplied: false as const };
}
