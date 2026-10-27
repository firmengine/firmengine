import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8 } from "fflate";
import { serializeRenderedOffice, type RenderedOffice } from "../lib/office-writer.ts";

function syntheticRendered(): RenderedOffice {
  const rows = Array.from({ length: 25_000 }, (_, i) => [`fact-${i}`, `원문 인용 ${i}`, `값 ${i}`]);
  const fields = rows.flatMap((row, r) => row.map((value, column) => ({ documentKind: "evidence_index" as const, documentName: "evidence.docx", table: 0, row: r, column, header: ["ID", "인용", "값"][column], value, tableSha256: "a".repeat(64) })));
  return {
    schemaVersion: "firmengine-office-v1", caseId: "synthetic", caseRevision: 7, mode: "draft", generatedAt: "2026-01-01T00:00:00.000Z", extractionMethod: "reopened-docx-xml-and-xlsx-cells",
    metadata: { source_sha256: null, evidence_pages_used: [], receipt_basis: "unavailable", model: "gpt-6-luna", case_revision: 7, sources: [], page_receipts: [], evidence_pages_expected: 0, evidence_pages_read: 0, evidence_pages_completed: 0, note: "synthetic" },
    documents: [{ kind: "evidence_index", name: "evidence.docx", title: "Synthetic", paragraphs: [], tables: [{ index: 0, title: "facts", headers: ["ID", "인용", "값"], rows, sha256: "b".repeat(64) }], blocks: [] }],
    fields, workbook: [{ name: "facts", rows: [["ID", "인용", "값"], ...rows] }], artifacts: [],
  };
}

test("compact rendered JSON round-trips the full synthetic audit payload", () => {
  const payload = syntheticRendered();
  const bytes = serializeRenderedOffice(payload);
  assert.deepEqual(JSON.parse(strFromU8(bytes)), payload);
  assert.ok(bytes.byteLength < new TextEncoder().encode(JSON.stringify(payload, null, 2)).byteLength);
});
