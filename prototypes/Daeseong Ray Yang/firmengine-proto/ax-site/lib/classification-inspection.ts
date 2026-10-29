import { bucket, db, getCase, HttpError, sha256 } from "./server-store";

type ClassificationJobRow = {
  id: string; case_id: string; document_id: string; page: number;
  role: string; document_type: string | null; status: string; stage: string;
  attempts: number; result: string | null; ready: number;
  image_key: string | null; image_hash: string | null;
  original_key: string | null; document_sha256: string;
};
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Observations are diagnostics, never source receipts or a page-role approval. */
function observation(value: unknown) {
  const read = object(value);
  if (!read) return null;
  const output: Record<string, string | number | boolean | null> = {};
  let truncated = false;
  for (const key of ["role", "documentType", "documentTypeId", "documentTypeName", "documentCatalogSha256", "familyId", "catalogRelease", "boundaryObservation", "boundaryQuote", "sourceNature", "sourceNatureQuote", "confidence", "legibility", "reason", "titleQuote", "issuerQuote", "structureQuote", "evidenceRowsQuote", "administrativeStructureQuote"]) {
    const text = read[key];
    if (typeof text === "string") {
      output[key] = text.slice(0, 4000);
      truncated ||= text.length > 4000;
    } else output[key] = null;
  }
  output.documentCatalogVersion = typeof read.documentCatalogVersion === "number" && Number.isSafeInteger(read.documentCatalogVersion) && read.documentCatalogVersion > 0 ? read.documentCatalogVersion : null;
  return { ...output, truncated };
}

/**
 * Read-only inspection also works when classification stopped before OCR.
 * The completed-evidence inspector and every mutation guard remain separate.
 * The original pointer was SHA-checked at its one-time upload CAS; a diagnostic
 * checks that immutable pointer without reading a large PDF into memory.
 */
export async function inspectClassificationJob(caseId: string, jobId: string) {
  if (!jobId.trim() || jobId.length > 300) throw new HttpError(400, "분류 상태를 확인할 페이지 작업 ID가 필요합니다.");
  const data = await getCase(caseId);
  const row = await db().prepare("SELECT p.id,p.case_id,p.document_id,p.page,p.role,p.document_type,p.status,p.stage,p.attempts,p.result,p.image_key,p.image_hash,d.ready,d.original_key,d.sha256 AS document_sha256 FROM page_jobs p JOIN documents d ON d.id = p.document_id AND d.case_id = p.case_id WHERE p.case_id = ? AND p.id = ?").bind(caseId, jobId).first<ClassificationJobRow>();
  if (!row || row.id !== jobId || row.case_id !== caseId || data.context.id !== caseId) throw new HttpError(404, "현재 사건의 페이지 작업을 찾을 수 없습니다.");
  const document = data.documents.find(value => value.id === row.document_id && value.status === "active");
  const page = data.pages.find(value => value.documentId === row.document_id && value.page === row.page);
  if (!document || !page || !document.pages.includes(row.page) || page.role !== row.role || !/^[a-f0-9]{64}$/i.test(document.sha256) || document.sha256 !== row.document_sha256) throw new HttpError(409, "현재 원본과 페이지 역할의 연결이 달라 분류 관측을 표시하지 않았습니다.");
  const originalPrefix = `cases/${caseId}/documents/${row.document_id}/original/`;
  if (row.ready !== 1 || !row.original_key?.startsWith(originalPrefix) || !await bucket().head(row.original_key)) throw new HttpError(409, "현재 원본의 저장 상태를 확인할 수 없습니다.");
  const expectedImageKey = `cases/${caseId}/documents/${row.document_id}/pages/${row.page}/${row.image_hash}`;
  if (!row.image_hash || !/^[a-f0-9]{64}$/i.test(row.image_hash) || row.image_key !== expectedImageKey) throw new HttpError(409, "분류에 사용한 원본 페이지 이미지 연결이 유효하지 않습니다.");
  const image = await bucket().get(row.image_key);
  if (!image || await sha256(await image.arrayBuffer()) !== row.image_hash) throw new HttpError(409, "분류에 사용한 페이지 이미지가 변경되었거나 없습니다.");
  let saved: Record<string, unknown>;
  try {
    saved = row.result === null ? {} : object(JSON.parse(row.result))!;
    if (!saved) throw new Error("invalid");
  } catch { throw new HttpError(409, "저장된 분류 상태를 읽을 수 없습니다."); }
  const recovery = object(saved.classificationRecovery), plan = object(recovery?.plan ?? saved.rescuePlan);
  if (recovery && (recovery.sourceHash !== document.sha256 || recovery.baseImageHash !== row.image_hash)) throw new HttpError(409, "과거 분류 복구 관측이 현재 원본과 연결되지 않습니다.");
  if (plan && (plan.documentId !== row.document_id || plan.page !== row.page || plan.sourceHash !== document.sha256 || plan.baseImageHash !== row.image_hash)) throw new HttpError(409, "분류 복구 계획이 현재 페이지와 연결되지 않습니다.");
  const attempts = typeof saved.classificationAttempts === "number" && Number.isSafeInteger(saved.classificationAttempts) && saved.classificationAttempts >= 0 ? saved.classificationAttempts : null;
  const hashes = Array.isArray(recovery?.imageHashes) ? recovery.imageHashes.filter((value): value is string => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)).slice(0, 5) : [];
  const storedRead = object(saved.read) ?? object(saved.rawRead);
  const observedType = typeof storedRead?.documentType === "string" ? storedRead.documentType : null;
  return {
    mode: "classification_diagnostic" as const, modelCalls: 0, mutatesState: false,
    job: { id: row.id, documentId: row.document_id, page: row.page, role: row.role, documentType: row.document_type, status: row.status, stage: row.stage, claimAttempts: row.attempts },
    source: { sha256: document.sha256, imageHash: row.image_hash },
    classification: observation(saved.classification), recovery: observation(recovery?.read),
    routing: { routedDocumentType: row.document_type, observedDocumentType: observedType?.slice(0, 160) ?? null, observedTypeTruncated: (observedType?.length ?? 0) > 160, observationOnly: true },
    provenance: { storedClassificationAttempts: attempts, hasStoredExtraction: !!saved.read, initialObservationBinding: "stored_job_only" as const, recoverySourceBound: !!recovery, recoveryImageHashes: hashes },
    rescuePlan: plan ? { planId: typeof plan.planId === "string" ? plan.planId : null, reason: typeof plan.reason === "string" ? plan.reason : null, recipeVersion: typeof plan.recipeVersion === "string" ? plan.recipeVersion : null } : null,
  };
}
