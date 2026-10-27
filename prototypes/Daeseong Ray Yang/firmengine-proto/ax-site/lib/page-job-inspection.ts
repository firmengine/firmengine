import type { CaseData } from "./domain";
import { hasBoundExtractionProvenance, hasCurrentProjection, prepareStoredReadReprojection, requireReprojectionProvenance, type StoredPageJobForReprojection, type StoredReadResult } from "./reprojection";
import { db, bucket, getCase, HttpError, sha256 } from "./server-store";

type JobRow = StoredPageJobForReprojection & { image_key: string | null; image_hash: string | null; cache_key: string | null; lease_until: string | null; document_sha256: string; ready: number; original_key: string | null; active_processing_jobs: number };
const mapJob = (row: JobRow): StoredPageJobForReprojection => ({ id: row.id, caseId: row.caseId, documentId: row.documentId, page: row.page, role: row.role, status: row.status, stage: row.stage, leaseUntil: row.lease_until, imageKey: row.image_key, imageHash: row.image_hash, cacheKey: row.cache_key, result: row.result });
function parseResult(raw: string | null): StoredReadResult {
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value as StoredReadResult;
  } catch { throw new HttpError(409, "저장된 판독 결과가 없거나 손상되어 재투영을 보류합니다."); }
}

async function inspect(caseId: string, jobId: string, data?: CaseData) {
  if (!jobId.trim() || jobId.length > 300) throw new HttpError(400, "페이지 작업 ID가 필요합니다.");
  const current = data ?? await getCase(caseId);
  const row = await db().prepare(`SELECT p.id,p.case_id AS caseId,p.document_id AS documentId,p.page,p.role,p.status,p.stage,p.lease_until,p.image_key,p.image_hash,p.cache_key,p.result,d.sha256 AS document_sha256,d.ready,d.original_key,(SELECT COUNT(*) FROM page_jobs active WHERE active.case_id = p.case_id AND active.status = 'processing') AS active_processing_jobs FROM page_jobs p JOIN documents d ON d.id = p.document_id AND d.case_id = p.case_id WHERE p.case_id = ? AND p.id = ?`).bind(caseId, jobId).first<JobRow>();
  if (!row || current.context.id !== caseId) throw new HttpError(404, "현재 사건의 페이지 작업을 찾을 수 없습니다.");
  const job = mapJob(row), saved = parseResult(row.result);
  const document = current.documents.find(item => item.id === job.documentId && item.status === "active");
  if (!document || document.sha256 !== row.document_sha256) throw new HttpError(409, "문서가 철회되었거나 현재 원본 해시와 저장 상태가 다릅니다.");
  const expectedOriginalPrefix = `cases/${caseId}/documents/${job.documentId}/original/`;
  const original = row.ready === 1 && !!row.original_key?.startsWith(expectedOriginalPrefix) ? await bucket().get(row.original_key) : null;
  const originalReady = !!original && await sha256(await original.arrayBuffer()) === row.document_sha256;
  const expectedImagePrefix = `cases/${caseId}/documents/${job.documentId}/pages/${job.page}/${job.imageHash}`;
  const image = job.imageKey && job.imageHash && job.imageKey === expectedImagePrefix ? await bucket().get(job.imageKey) : null;
  const imageReady = !!image && !!job.imageHash && await sha256(await image.arrayBuffer()) === job.imageHash;
  const prepared = prepareStoredReadReprojection({ data: current, job, saved, originalReady, imageReady, activeProcessingJobs: row.active_processing_jobs });
  return { data: current, job, saved, rawResult: row.result!, prepared, provenance: prepared.provenance };
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

/** Reproject a single saved read without calling the model or modifying page-job completion state. */
export async function reprojectCasePage(caseId: string, jobId: string) {
  const inspection = await inspect(caseId, jobId);
  // Enforce before any claim/write, including a legacy current-version marker.
  // Receipt reuse remains a separate exact-field check in reprojectStoredPage.
  requireReprojectionProvenance(inspection.saved,inspection.job,inspection.provenance);
  if (hasCurrentProjection(inspection.saved, inspection.job, inspection.provenance.documentSha256)) return { ...inspection, alreadyApplied: true as const };
  return { ...inspection, alreadyApplied: false as const };
}
