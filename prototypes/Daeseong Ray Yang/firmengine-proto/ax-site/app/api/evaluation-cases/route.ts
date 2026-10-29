import type { CaseData } from "../../../lib/domain.ts";
import { actor, db, errorResponse, event, getCase, now, requireSameOrigin, HttpError } from "../../../lib/server-store.ts";
import { caseResponse } from "../../../lib/case-response.ts";
import { parseEvaluationInventoryQuery } from "../../../lib/evaluation-inventory.ts";
import { canonicalSha256, storedCaseMatchesImport, STRUCTURED_CASE_IMPORT_MAX_BYTES, structuredCaseCounts, validateStructuredCaseImport, type StructuredCaseImportBatch } from "../../../lib/structured-case-import.ts";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new HttpError(415, "JSON 형식이 필요합니다.");
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > STRUCTURED_CASE_IMPORT_MAX_BYTES) throw new HttpError(413, "평가 사례 묶음이 허용 크기를 초과했습니다.");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new HttpError(400, "JSON을 읽을 수 없습니다."); }
    let batch: StructuredCaseImportBatch;
    try { batch = await validateStructuredCaseImport(parsed, request.headers.get("x-canonical-body-sha256")); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "평가 사례 묶음이 올바르지 않습니다."); }
    const owner = await actor();
    const receipts: Array<{ caseId: string; scenarioId: string; revision: number; caseDataSha256: string; alreadyPresent: boolean; counts: ReturnType<typeof structuredCaseCounts> }> = [];
    for (const entry of batch.cases) {
      const data = structuredClone(entry.caseData) as CaseData;
      const id = entry.scenarioId;
      const structuredTest = data.structuredTest! as CaseData["structuredTest"] & { datasetManifestSha256: string; caseDataSha256: string };
      structuredTest.datasetManifestSha256 = batch.manifestSha256;
      structuredTest.caseDataSha256 = entry.caseDataSha256;
      const at = now();
      let alreadyPresent = false;
      const existing = await db().prepare("SELECT id FROM cases WHERE id = ?").bind(id).first<{ id: string }>();
      if (existing) {
        const current = await getCase(id);
        if (current.context.id !== id || !(await storedCaseMatchesImport(current, entry, batch.manifestSha256))) throw new HttpError(409, `합성 평가 사건 ID가 이미 다른 데이터에 사용 중입니다: ${id}`);
        alreadyPresent = true;
      } else {
        let inserted: { meta: { changes: number } } | undefined;
        try {
          inserted = await db().prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM cases WHERE id = ?)")
            .bind(id, data.context.caseName, owner, data.context.revision, JSON.stringify(data), at, at, id).run();
        } catch {
          // A concurrent identical import may win the unique-ID race. Validate its marker below.
        }
        if (!inserted?.meta.changes) {
          const concurrent = await getCase(id);
          if (!(await storedCaseMatchesImport(concurrent, entry, batch.manifestSha256))) throw new HttpError(409, `합성 평가 사건 ID가 이미 다른 데이터에 사용 중입니다: ${id}`);
          alreadyPresent = true;
        } else {
          await event(id, "evaluation_case.imported", { manifestSha256: batch.manifestSha256, caseDataSha256: entry.caseDataSha256, scenarioId: entry.scenarioId, sourceRecords: data.structuredTest!.sourceRecords.length });
        }
      }
      // Reload through the canonical store so the response and any derived evaluation
      // are bound to the persisted storage token, not a caller-supplied object.
      const stored = await getCase(id);
      await caseResponse(stored);
      receipts.push({ caseId: id, scenarioId: entry.scenarioId, revision: stored.context.revision, caseDataSha256: entry.caseDataSha256, alreadyPresent, counts: structuredCaseCounts(stored) });
    }
    const result = { schemaVersion: "firmengine-structured-case-import-receipt/v1", manifestSha256: batch.manifestSha256, imported: receipts.filter(item => !item.alreadyPresent).length, alreadyPresent: receipts.filter(item => item.alreadyPresent).length, cases: receipts };
    const receiptSha256 = await canonicalSha256(result);
    return Response.json({ ...result, receiptSha256 }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    requireSameOrigin(request);
    let query: ReturnType<typeof parseEvaluationInventoryQuery>;
    try { query = parseEvaluationInventoryQuery(new URL(request.url)); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "조회 조건이 올바르지 않습니다."); }
    const rows = await db().prepare("SELECT id,revision,updated_at AS updatedAt FROM cases WHERE id LIKE ? AND id > ? ORDER BY id LIMIT ?").bind(`${query.prefix}%`, query.after, query.limit + 1).all<{ id: string; revision: number; updatedAt: string }>();
    const page = rows.results.slice(0, query.limit);
    const cases = (await Promise.all(page.map(async row => {
      try {
        const data = await getCase(row.id);
        const marker = data.structuredTest as (typeof data.structuredTest & { datasetManifestSha256?: string; caseDataSha256?: string }) | undefined;
        return marker?.mode === "assumed_extracted_synthetic" && marker.datasetManifestSha256 ? { caseId: row.id, revision: row.revision, scenarioId: marker.scenarioId ?? row.id, manifestSha256: marker.datasetManifestSha256, caseDataSha256: marker.caseDataSha256 ?? null, updatedAt: row.updatedAt } : null;
      } catch { return null; }
    }))).filter((item): item is NonNullable<typeof item> => item !== null);
    return Response.json({ schemaVersion: "firmengine-structured-case-import-inventory/v1", cases, prefix: query.prefix, limit: query.limit, hasMore: rows.results.length > query.limit, nextCursor: rows.results.length > query.limit ? page.at(-1)!.id : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
