import { db, errorResponse, HttpError } from "../../../lib/server-store";
import { readIntakeReferences } from "../../../lib/intake-reference-store.ts";

/** Read-only monitor/MCP bridge. Catalogue edits use /api/checklist-catalog. */
export async function GET() {
  try { return Response.json(await readIntakeReferences(db()), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error instanceof Error && error.message === "INTAKE_CATALOG_INTEGRITY_FAILED" ? new HttpError(409, "상담 서류 기준정보의 저장 판본과 해시를 확인해 주세요.") : error); }
}
