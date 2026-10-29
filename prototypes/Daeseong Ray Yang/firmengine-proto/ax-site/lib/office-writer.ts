/** Office generation is deterministic code; no model, filesystem, or network call occurs here. */
import * as XLSX from "xlsx";
import { strFromU8, strToU8, unzipSync, zipSync, Zip, ZipDeflate } from "fflate";
import { createCaseReadIndex } from "./domain.ts";
import type { ArtifactKind, CaseData, RuleSet } from "./domain.ts";
import { assessCase } from "./assessment.ts";
import { buildCourtPackage, escapeHtml } from "./exports.ts";
import type { CourtDocument, ExportPackage, ExportTable } from "./exports.ts";
import { renderPublicForm } from "./form-mapping.ts";
import { buildFormBindings } from "./form-mapping.ts";
import type { FormProvenance } from "./form-mapping.ts";
import type { ExecutionSnapshot } from "./reactive-evaluation.ts";
import { buildExportProvenance,type ExportPageReceipt,type ExportProvenance } from "./export-provenance.ts";
import { assessDocumentFilingReadiness, type FilingReadinessReport } from "./document-filing-readiness.ts";
import { buildRepaymentPlanModel } from "./repayment-plan-model.ts";
import { reconcilePlanLedger } from "./plan-reconciliation.ts";
import { adaptCalculationInput } from "./calculation-adapter.ts";

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
  metadata:ExportProvenance & {writer_receipt?:unknown};
  filingReadiness?: FilingReadinessReport;
  documents: { kind: ArtifactKind; name: string; title: string; paragraphs: string[]; tables: RenderedTable[]; blocks: RenderedBlock[]; form?: FormProvenance }[];
  fields: RenderedField[];
  workbook: { name: string; rows: string[][] }[];
  artifacts: { kind: string; name: string; sha256: string }[];
}

/** Serialize the complete audit payload without indentation-only bytes. */
export function serializeRenderedOffice(rendered: RenderedOffice): Uint8Array {
  return strToU8(JSON.stringify(rendered));
}

const modeLabel = (mode: OfficeMode) => mode === "final" ? "최종 검토본 · 서명·제출 승인 전" : "검토용 초안";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function cleanText(value: string): string {
  // XML 1.0 excludes most control characters. Preserve ordinary tab/newline content.
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "�");
}
function xmlEscape(value: string): string {
  return cleanText(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function directLargeTableDocx(item: CourtDocument, payload: ExportPackage, mode: OfficeMode): Uint8Array {
  const landscape=item.tables.some(table=>table.headers.length>6), pageWidth=landscape?16838:11906, pageHeight=landscape?11906:16838, width=pageWidth-1800;
  const p=(text:string,style="Normal",size=18,bold=false,keepNext=false)=>`<w:p><w:pPr><w:pStyle w:val="${style}"/>${keepNext?"<w:keepNext/>":""}<w:spacing w:after="110" w:line="280"/></w:pPr>${cleanText(text).split(/\r?\n/).map((line,index)=>`${index?"<w:r><w:br/></w:r>":""}<w:r><w:rPr>${bold?"<w:b/>":""}<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="맑은 고딕"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`).join("")}</w:p>`;
  const tableStart=(table:ExportTable)=>{const count=Math.max(1,table.headers.length),col=Math.floor(width/count),widths=Array.from({length:count},(_,i)=>col+(i<width%count?1:0));return {widths,start:`<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${["top","bottom","left","right","insideH","insideV"].map(side=>`<w:${side} w:val="single" w:sz="4" w:color="CAD5CD"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`};};
  const rowXml=(values:string[],widths:number[],header:boolean)=>`<w:tr><w:trPr><w:cantSplit/>${header?"<w:tblHeader/>":""}</w:trPr>${widths.map((w,i)=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:shd w:fill="${header?"EAF1EC":"FFFFFF"}"/><w:tcMar><w:top w:w="90" w:type="dxa"/><w:start w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:end w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>${p(values[i]??"","Normal",widths.length>=7?16:18,header)}</w:tc>`).join("")}</w:tr>`;
  const documentPrefix=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${p("FIRM ENGINE  /  "+modeLabel(mode),"Normal",17,true)}${p(item.title,"Title",34,true)}${item.paragraphs.map(text=>p(text,"Normal",18)).join("")}`;
  const documentSuffix=`<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="${pageWidth}" w:h="${pageHeight}"${landscape?' w:orient="landscape"':""}/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="360" w:footer="360"/></w:sectPr></w:body></w:document>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="맑은 고딕"/><w:sz w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="280"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/></w:style></w:styles>`;
  const footer=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="15"/><w:color w:val="607064"/></w:rPr><w:t xml:space="preserve">v${payload.caseRevision} · ${xmlEscape(modeLabel(mode))}  |  </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t> / </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
  const output:Uint8Array[]=[];let zipError:Error|undefined;
  const zip=new Zip((error,data)=>{if(error)zipError=error;else if(data)output.push(data);});
  const addText=(name:string,text:string)=>{const file=new ZipDeflate(name,{level:6});zip.add(file);file.push(strToU8(text),true);};
  addText("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  addText("_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  addText("docProps/core.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Firm Engine</dc:creator><dc:title>${xmlEscape(item.title)}</dc:title><dc:subject>${xmlEscape(modeLabel(mode))}</dc:subject><dc:description>${xmlEscape(payload.scope)}</dc:description></cp:coreProperties>`);addText("word/styles.xml",styles);addText("word/footer1.xml",footer);addText("word/_rels/document.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  const documentFile=new ZipDeflate("word/document.xml",{level:6});zip.add(documentFile);
  const push=(text:string)=>documentFile.push(strToU8(text));push(documentPrefix);
  for(const table of item.tables){push(p(table.title,"Heading2",24,true,true));const spec=tableStart(table);push(spec.start);push(rowXml(table.headers,spec.widths,true));const rows=table.rows.length?table.rows:[["[확인된 기재 항목 없음 · 검토 필요]"]];for(const row of rows)push(rowXml(row,spec.widths,false));push("</w:tbl><w:p><w:pPr><w:spacing w:after=\"60\"/></w:pPr></w:p>");}
  documentFile.push(strToU8(documentSuffix),true);zip.end();if(zipError)throw zipError;
  const size=output.reduce((sum,chunk)=>sum+chunk.length,0),result=new Uint8Array(size);let offset=0;for(const chunk of output){result.set(chunk,offset);offset+=chunk.length;}return result;
}
async function writeDocx(item: CourtDocument, payload: ExportPackage, mode: OfficeMode): Promise<Uint8Array> {
  // Stream appendix XML into the DOCX ZIP so large fact tables do not allocate a docx object per cell.
  return directLargeTableDocx(item,payload,mode);
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

export async function writeOfficePackage(input: { data: CaseData; rules: RuleSet; payload?: ExportPackage; mode?: OfficeMode; pageReceipts?:ExportPageReceipt[]; preparedExecution?:ExecutionSnapshot; writerReceipt?:unknown }): Promise<OfficeArtifact[]> {
  const mode = input.mode ?? "draft";
  const sourceIndex=createCaseReadIndex(input.data);
  const assessment = input.preparedExecution?.assessment ?? assessCase(input.data, input.rules,sourceIndex);
  const calculationContract=input.preparedExecution?.calculationContract??adaptCalculationInput(input.data,assessment.calculation);
  const planLedger=input.preparedExecution?.planLedger??buildRepaymentPlanModel(input.data,assessment.calculation);
  const planReconciliation=input.preparedExecution?.planReconciliation??reconcilePlanLedger(input.data,assessment.calculation,planLedger);
  const planValidationApplies=(input.data.context.paymentSchedule?.phases.length??0)>0||assessment.calculation.planTotalWon!==null;
  const planIssues=planValidationApplies?[...new Set([...(planLedger.status==="blocked"||planReconciliation.status==="blocked"?[...planLedger.issues,...planReconciliation.issues]:[]),...(planReconciliation.legalReviewTasks??[]),...((input.data.context.paymentSchedule?.phases.length??0)>0&&(!input.data.context.paymentSchedule?.reviewed||!input.data.context.paymentSchedule.reviewReason?.trim())?["PAYMENT_SCHEDULE_REVIEW_REQUIRED"]:[])])]:[];
  const calculationIssues=calculationContract.applicable?[...(calculationContract.status==="blocked"?calculationContract.blockers:[]),...(calculationContract.status==="provisional"?calculationContract.warnings.map(issue=>"CALCULATION_CONTRACT_REVIEW:"+issue):[])]:[];
  if(input.preparedExecution&&(input.preparedExecution.caseId!==input.data.context.id||input.preparedExecution.caseRevision!==input.data.context.revision||!input.preparedExecution.formBindings||!input.preparedExecution.documentPayloads))throw new Error("내보낼 저장 계산·서식 결과가 현재 사건 버전과 일치하지 않습니다.");
  if (mode === "final" && (!assessment.generationGate.canFinalize||planIssues.length>0||calculationIssues.length>0)) throw new Error("미확정 자료·인정·법리 검토, 계산 입력 또는 변제 일정 정합성 문제가 남아 최종 검토본 생성을 보류했습니다."+([...planIssues,...calculationIssues].length?" "+[...planIssues,...calculationIssues].join(", "):""));
  if (input.payload && (input.payload.caseId !== input.data.context.id || input.payload.caseRevision !== input.data.context.revision)) throw new Error("내보낼 사건 버전이 변경되었습니다.");
  // Rebuild from the canonical ledger so an old/mutated payload cannot override current values.
  const rebuiltPayload = buildCourtPackage(input.data, input.rules, assessment,sourceIndex,planLedger,planReconciliation);
  const payload:ExportPackage = input.preparedExecution ? {...rebuiltPayload,documents:input.preparedExecution.documentPayloads!} : rebuiltPayload;
  const formBindings=input.preparedExecution?.formBindings ?? buildFormBindings(input.data,assessment.calculation,sourceIndex,planLedger,planReconciliation);
  const artifacts: OfficeArtifact[] = [];
  const rendered: RenderedOffice = { schemaVersion: "firmengine-office-v1", caseId: payload.caseId, caseRevision: payload.caseRevision, mode, generatedAt: payload.generatedAt, extractionMethod: "reopened-docx-xml-and-xlsx-cells", metadata:{...buildExportProvenance(input.data,input.pageReceipts),...(input.writerReceipt===undefined?{}:{writer_receipt:input.writerReceipt})}, documents: [], fields: [], workbook: [], artifacts: [] };
  for (const item of payload.documents) {
    const displayed = mode === "final" ? { ...item, title: item.title.replaceAll("초안", "최종 검토본"), paragraphs: item.paragraphs.map((p) => p.replaceAll("검토용 편집 초안", "최종 검토용 편집본")) } : item;
    const appendix = await writeDocx(displayed, payload, mode);
    const mappedForm = await renderPublicForm({ kind: item.kind, data: input.data, calculation: assessment.calculation, appendixDocx: appendix, mode,sourceIndex,bindings:formBindings,planLedger,planReconciliation });
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
  rendered.filingReadiness = assessDocumentFilingReadiness({mode,documents:rendered.documents.map(document=>({...document,sha256:artifacts.find(item=>item.name===document.name)?.sha256}))});
  const arithmeticMismatch=rendered.filingReadiness.documents.find(document=>document.formulaStatus==="inconsistent");
  if(arithmeticMismatch)throw new Error("OFFICIAL_FORM_ARITHMETIC_MISMATCH: "+arithmeticMismatch.name);
  artifacts.push(await artifact("rendered_json", "rendered.json", "application/json; charset=utf-8", serializeRenderedOffice(rendered)));
  const zip = zipSync(Object.fromEntries(artifacts.map((a) => [a.name, a.bytes])), { level: 6 });
  artifacts.push(await artifact("package_zip", "firmengine_court_package.zip", "application/zip", zip));
  return artifacts;
}
