/** Office generation is deterministic code; no model, filesystem, or network call occurs here. */
import { AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageNumber, PageOrientation, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from "docx";
import * as XLSX from "xlsx";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createCaseReadIndex } from "./domain.ts";
import type { ArtifactKind, CaseData, RuleSet } from "./domain.ts";
import { assessCase } from "./assessment.ts";
import { buildCourtPackage, escapeHtml } from "./exports.ts";
import type { CourtDocument, ExportPackage, ExportTable } from "./exports.ts";
import { renderPublicForm } from "./form-mapping.ts";
import { buildFormBindings } from "./form-mapping.ts";
import type { FormProvenance } from "./form-mapping.ts";
import { buildExportProvenance,type ExportPageReceipt,type ExportProvenance } from "./export-provenance.ts";

export type OfficeMode = "draft" | "final";
export interface OfficeArtifact {
  id: string;
  kind: ArtifactKind | "print_html" | "rendered_json" | "package_zip";
  name: string;
  mime: string;
  bytes: Uint8Array;
  hash: string;
  sha256: string;
}
export interface RenderedTable {
  index: number;
  title: string;
  headers: string[];
  rows: string[][];
  sha256?: string;
}
export interface RenderedField {
  documentKind: ArtifactKind;
  documentName: string;
  table: number;
  row: number;
  column: number;
  header: string;
  value: string;
  entity?: string;
  featureKey?: string;
  tableSha256?: string;
}
export type RenderedBlock = { type: "paragraph"; text: string; heading?: number } | { type: "table"; index: number } | { type: "page_break" };
export interface RenderedOffice {
  schemaVersion: "firmengine-office-v1";
  caseId: string;
  caseRevision: number;
  mode: OfficeMode;
  generatedAt: string;
  extractionMethod: "reopened-docx-xml-and-xlsx-cells";
  metadata:ExportProvenance;
  documents: { kind: ArtifactKind; name: string; title: string; paragraphs: string[]; tables: RenderedTable[]; blocks: RenderedBlock[]; form?: FormProvenance }[];
  fields: RenderedField[];
  workbook: { name: string; rows: string[][] }[];
  artifacts: { kind: string; name: string; sha256: string }[];
}

const FONT = { ascii: "Malgun Gothic", hAnsi: "Malgun Gothic", eastAsia: "맑은 고딕", cs: "Malgun Gothic" };
const modeLabel = (mode: OfficeMode) => mode === "final" ? "최종 검토본 · 서명·제출 승인 전" : "검토용 초안";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function cleanText(value: string): string {
  // XML 1.0 excludes most control characters. Preserve ordinary tab/newline content.
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "�");
}
function paragraph(text: string, options: { bold?: boolean; size?: number; color?: string; keepNext?: boolean } = {}): Paragraph {
  const lines = cleanText(text).split(/\r?\n/);
  return new Paragraph({
    spacing: { after: 110, line: 280 }, keepNext: options.keepNext,
    children: lines.map((line, index) => new TextRun({ text: line, break: index ? 1 : undefined, font: FONT, size: options.size ?? 20, bold: options.bold, color: options.color ?? "17251E" })),
  });
}
function documentTable(table: ExportTable, availableWidth: number): Table {
  const count = Math.max(1, table.headers.length);
  const widths = Array.from({ length: count }, (_, index) => Math.floor(availableWidth / count) + (index < availableWidth % count ? 1 : 0));
  const row = (values: string[], header: boolean) => new TableRow({
    tableHeader: header, cantSplit: true,
    children: widths.map((width, index) => new TableCell({
      width: { size: width, type: WidthType.DXA },
      margins: { top: 90, bottom: 90, left: 90, right: 90 },
      shading: { fill: header ? "EAF1EC" : "FFFFFF" },
      children: [paragraph(values[index] ?? "", { size: count >= 7 ? 16 : 18, bold: header })],
    })),
  });
  return new Table({
    width: { size: availableWidth, type: WidthType.DXA }, columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, { style: BorderStyle.SINGLE, size: 4, color: "CAD5CD" }])),
    rows: [row(table.headers, true), ...(table.rows.length ? table.rows : [["[확인된 기재 항목 없음 · 검토 필요]"]]).map((values) => row(values, false))],
  });
}

async function writeDocx(item: CourtDocument, payload: ExportPackage, mode: OfficeMode): Promise<Uint8Array> {
  const landscape = item.tables.some((table) => table.headers.length > 6);
  const pageWidth = landscape ? 16838 : 11906;
  const width = pageWidth - 1800;
  const children: (Paragraph | Table)[] = [
    paragraph("FIRM ENGINE  /  " + modeLabel(mode), { size: 17, bold: true, color: "000000" }),
    new Paragraph({ heading: HeadingLevel.TITLE, spacing: { before: 80, after: 260 }, children: [new TextRun({ text: cleanText(item.title), font: FONT, size: 34, bold: true, color: "000000" })] }),
    ...item.paragraphs.map((text) => paragraph(text, { size: 18 })),
  ];
  for (const table of item.tables) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, keepNext: true, children: [new TextRun({ text: cleanText(table.title), font: FONT, size: 24, bold: true, color: "000000" })] }));
    children.push(documentTable(table, width));
    children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
  }
  const doc = new Document({
    creator: "Firm Engine", title: item.title, subject: modeLabel(mode), description: payload.scope,
    styles: { default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 280, after: 100 } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 900, right: 900, bottom: 900, left: 900, header: 360, footer: 360 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `v${payload.caseRevision} · ${modeLabel(mode)}  |  `, font: FONT, size: 15, color: "607064" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15 }), new TextRun({ text: " / ", size: 15 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 15 })] })] }) },
      children,
    }],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}

function writeWorkbook(payload: ExportPackage, mode: OfficeMode): Uint8Array {
  const workbook = XLSX.utils.book_new();
  workbook.Props = { Title: "Firm Engine 계산·근거 검토", Subject: modeLabel(mode), Author: "Firm Engine", Comments: payload.scope };
  const modeSheet: XLSX.WorkSheet = {
    A1: { t: "s", v: "문서 상태" }, B1: { t: "s", v: modeLabel(mode) },
    A2: { t: "s", v: "사건 버전" }, B2: { t: "s", v: String(payload.caseRevision) },
    A3: { t: "s", v: "금액 저장" }, B3: { t: "s", v: "모든 값은 문자열입니다. 정수 원화 정밀도와 원문을 보존하며 셀 수식을 실행하지 않습니다." },
    "!ref": "A1:B3", "!cols": [{ wch: 20 }, { wch: 90 }],
  };
  XLSX.utils.book_append_sheet(workbook, modeSheet, "문서정보");
  for (const item of payload.workbook) {
    const sheet: XLSX.WorkSheet = {};
    let width = 1;
    item.rows.forEach((row, r) => {
      width = Math.max(width, row.length);
      row.forEach((cell, c) => {
        // Deliberately never set `f`, `F`, `l`, or a numeric cell type from source data.
        sheet[XLSX.utils.encode_cell({ r, c })] = { t: "s", v: cleanText(cell.value), z: "@" };
      });
    });
    sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, item.rows.length - 1), c: width - 1 } });
    sheet["!cols"] = Array.from({ length: width }, (_, column) => ({ wch: Math.min(70, Math.max(15, ...item.rows.map((row) => Math.min(70, [...(row[column]?.value ?? "")].length + 2)))) }));
    sheet["!autofilter"] = { ref: sheet["!ref"] };
    XLSX.utils.book_append_sheet(workbook, sheet, item.name.slice(0, 31));
  }
  const bytes: ArrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true, bookSST: true, cellStyles: true });
  return new Uint8Array(bytes);
}

function decodeXml(text: string): string {
  return text.replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10))).replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}
function xmlText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\s*\/>|<w:tab\s*\/>|<\/w:p>/g)].map((m) => m[0].startsWith("<w:br") || m[0] === "</w:p>" ? "\n" : m[0].startsWith("<w:tab") ? "\t" : decodeXml(m[1])).join("").replace(/\n$/, "");
}

/** Evaluation fields are read from the Office file actually written, never from a gold target. */
export function readRenderedDocx(bytes: Uint8Array, metadata: CourtDocument, formTableCount=0): { paragraphs: string[]; tables: RenderedTable[]; blocks: RenderedBlock[] } {
  const archive = unzipSync(bytes);
  const document = archive["word/document.xml"];
  if (!document) throw new Error("생성 DOCX의 본문을 확인할 수 없습니다.");
  const xml = strFromU8(document);
  const tables: RenderedTable[] = [];
  for (const [index, table] of [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/g)].entries()) {
    const rows = [...table[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map((row) => [...row[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map((cell) => xmlText(cell[1])));
    tables.push({ index, title: index < formTableCount ? `공개 서식 표 ${index + 1}` : metadata.tables[index-formTableCount]?.title ?? `표 ${index + 1}`, headers: rows[0] ?? [], rows: rows.slice(1) });
  }
  const outsideTables = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "");
  const paragraphs = [...outsideTables.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map((p) => xmlText(p[1])).filter(Boolean);
  const blocks: RenderedBlock[] = [];
  let tableIndex=0;
  for (const match of xml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
    if (match[0].startsWith("<w:tbl")) { blocks.push({ type: "table", index: tableIndex++ }); continue; }
    const text = xmlText(match[0]);
    if (text) {
      const style=match[0].match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1];
      const heading=style==="Title"?1:style?.match(/^Heading([1-5])$/)?Number(style.slice(-1))+1:undefined;
      blocks.push({ type: "paragraph", text, ...(heading ? { heading } : {}) });
    }
    if (match[0].includes("<w:sectPr") || /<w:br[^>]*w:type="page"/.test(match[0])) blocks.push({ type: "page_break" });
  }
  return { paragraphs, tables, blocks };
}

/** HTML is reconstructed from the DOCX we reopened, so printed and downloaded fields agree. */
function renderedPrintableHtml(rendered: RenderedOffice): string {
  const body=rendered.documents.map((doc)=>`<article><div class="mode">${escapeHtml(modeLabel(rendered.mode))} · ${escapeHtml(doc.kind)} · v${rendered.caseRevision}</div>${doc.blocks.map((block)=>{
    if(block.type==="page_break")return '<div class="page-break"></div>';
    if(block.type==="paragraph"){const tag=block.heading?`h${block.heading}`:"p";return `<${tag}>${escapeHtml(block.text)}</${tag}>`;}
    const table=doc.tables[block.index];return `<table><thead><tr>${table.headers.map((v)=>`<th>${escapeHtml(v)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row)=>`<tr>${row.map((v)=>`<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }).join("")}</article>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Firm Engine 공개 서식 검토본</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#111;background:#f4f5f4;font:13px/1.65 "Malgun Gothic",system-ui,sans-serif}article{max-width:1120px;margin:24px auto;padding:40px;background:white}h1,h2,h3{color:#000;break-after:avoid}h1{font-size:26px}h2{font-size:19px;margin-top:28px}h3{font-size:16px}p{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:12px 0 22px;font-size:11px}th,td{border:1px solid #d9d9d9;padding:8px;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#eef1f4;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}.mode{font-size:11px;color:#555}.page-break{margin-top:32px;border-top:1px solid #eee}@media print{body{background:white;font-size:10px}article{margin:0;padding:0;max-width:none;break-after:page}.page-break{break-before:page;margin:0;border:0}table{font-size:8px}th,td{padding:5px}article:last-child{break-after:auto}}</style></head><body>${body}</body></html>`;
}
function canonicalField(kind: ArtifactKind, header: string, row: string[], column: number): { featureKey?: string; entity?: string } {
  if (kind === "creditors") return { entity: row[1], featureKey: ({ "계약 ID": "debts[].contractId", "채권자": "debts[].creditor", "원금": "debts[].principal", "이자": "debts[].interest", "합계": "debts[].total", "기준일": "debts[].asOf" } as Record<string, string>)[header] };
  if (kind === "income_expense") return { entity: row[0], featureKey: ({ "총수입": "incomes[].gross", "필요경비": "incomes[].expenses", "순수입": "incomes[].net", "월평균": "incomes[].monthly" } as Record<string, string>)[header] };
  if (kind === "assets") return { entity: row[0], featureKey: ({ "평가액": "assets[].grossValue", "담보상환": "assets[].securedPayoff", "처분비용": "assets[].disposalCosts", "면제 검토액": "assets[].protectedValue", "기여 청산가치": "assets[].liquidation" } as Record<string, string>)[header] };
  if (column === 1) return { featureKey: ({ "성명": "person.name", "주소": "person.address", "월 변제예정액": "plan.monthlyPayment", "변제기간": "plan.months", "명목 총변제액": "plan.nominalTotal", "검토 현재가치": "plan.presentValue" } as Record<string, string>)[row[0]] };
  return {};
}
export async function artifactHash(bytes: Uint8Array): Promise<string> {
  const buffer = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function artifact(kind: OfficeArtifact["kind"], name: string, mime: string, bytes: Uint8Array): Promise<OfficeArtifact> {
  const hash = await artifactHash(bytes);
  return { id: `${kind}-${hash.slice(0, 20)}`, kind, name, mime, bytes, hash, sha256: hash };
}

export async function writeOfficePackage(input: { data: CaseData; rules: RuleSet; payload?: ExportPackage; mode?: OfficeMode; pageReceipts?:ExportPageReceipt[] }): Promise<OfficeArtifact[]> {
  const mode = input.mode ?? "draft";
  const sourceIndex=createCaseReadIndex(input.data);
  const assessment = assessCase(input.data, input.rules,sourceIndex);
  if (mode === "final" && !assessment.generationGate.canFinalize) throw new Error("미확정 자료·인정·법리 검토가 남아 최종 검토본 생성을 보류했습니다.");
  if (input.payload && (input.payload.caseId !== input.data.context.id || input.payload.caseRevision !== input.data.context.revision)) throw new Error("내보낼 사건 버전이 변경되었습니다.");
  // Rebuild from the canonical ledger so an old/mutated payload cannot override current values.
  const payload = buildCourtPackage(input.data, input.rules, assessment,sourceIndex);
  const formBindings=buildFormBindings(input.data,assessment.calculation,sourceIndex);
  const artifacts: OfficeArtifact[] = [];
  const rendered: RenderedOffice = { schemaVersion: "firmengine-office-v1", caseId: payload.caseId, caseRevision: payload.caseRevision, mode, generatedAt: payload.generatedAt, extractionMethod: "reopened-docx-xml-and-xlsx-cells", metadata:buildExportProvenance(input.data,input.pageReceipts), documents: [], fields: [], workbook: [], artifacts: [] };
  for (const item of payload.documents) {
    const displayed = mode === "final" ? { ...item, title: item.title.replaceAll("초안", "최종 검토본"), paragraphs: item.paragraphs.map((p) => p.replaceAll("검토용 편집 초안", "최종 검토용 편집본")) } : item;
    const appendix = await writeDocx(displayed, payload, mode);
    const mappedForm = await renderPublicForm({ kind: item.kind, data: input.data, calculation: assessment.calculation, appendixDocx: appendix, mode,sourceIndex,bindings:formBindings });
    const bytes = mappedForm?.bytes ?? appendix;
    const output = await artifact(item.kind, item.filename, DOCX_MIME, bytes);
    artifacts.push(output);
    const actual = readRenderedDocx(bytes, item, mappedForm?.formTableCount ?? 0);
    const calculationTables = actual.tables.slice(mappedForm?.formTableCount ?? 0);
    // Fail if the physical document differs from the table values sent to the writer.
    if (calculationTables.length !== item.tables.length || calculationTables.some((table, index) => JSON.stringify(table.headers) !== JSON.stringify(item.tables[index].headers.map(cleanText)) || (item.tables[index].rows.length > 0 && JSON.stringify(table.rows) !== JSON.stringify(item.tables[index].rows.map((row) => row.map(cleanText)))))) throw new Error("생성 DOCX 표와 입력 데이터가 일치하지 않습니다: " + item.kind);
    for (const table of actual.tables) table.sha256 = await artifactHash(strToU8(JSON.stringify({ headers: table.headers, rows: table.rows })));
    rendered.documents.push({ kind: item.kind, name: item.filename, title: displayed.title, ...actual, ...(mappedForm ? { form: mappedForm.provenance } : {}) });
    for (const table of actual.tables) table.rows.forEach((row, r) => row.forEach((value, column) => rendered.fields.push({ documentKind: item.kind, documentName: item.filename, table: table.index, row: r, column, header: table.headers[column] ?? "", value, tableSha256: table.sha256, ...canonicalField(item.kind, table.headers[column] ?? "", row, column) })));
  }
  const workbookBytes = writeWorkbook(payload, mode);
  artifacts.push(await artifact("review_workbook", "08_review_workbook.xlsx", XLSX_MIME, workbookBytes));
  const actualWorkbook = XLSX.read(workbookBytes, { type: "array", cellFormula: true, cellText: false });
  for (const name of actualWorkbook.SheetNames) {
    const sheet = actualWorkbook.Sheets[name];
    for (const [address, cell] of Object.entries(sheet)) if (!address.startsWith("!") && cell && typeof cell === "object" && ("f" in cell || "F" in cell)) throw new Error("생성 워크북에 허용하지 않은 수식이 있습니다.");
    rendered.workbook.push({ name, rows: XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: true, defval: "" }) });
  }
  const html = renderedPrintableHtml(rendered);
  artifacts.push(await artifact("print_html", "09_printable.html", "text/html; charset=utf-8", strToU8(html)));
  rendered.artifacts = artifacts.map((a) => ({ kind: a.kind, name: a.name, sha256: a.sha256 }));
  artifacts.push(await artifact("rendered_json", "rendered.json", "application/json; charset=utf-8", strToU8(JSON.stringify(rendered, null, 2))));
  const zip = zipSync(Object.fromEntries(artifacts.map((a) => [a.name, a.bytes])), { level: 6 });
  artifacts.push(await artifact("package_zip", "firmengine_court_package.zip", "application/zip", zip));
  return artifacts;
}
