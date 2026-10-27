import { currentFacts, formatWon, moneyValue, requiredKindsForCase } from "./domain.ts";
import type { ArtifactKind, CaseData, ExportManifest, Fact, RuleSet } from "./domain.ts";
import { assessCase } from "./assessment.ts";
import type { Assessment } from "./assessment.ts";
import { bankAccountsAnnex, leasesAnnex, repaymentScheduleAnnex } from "./document-annexes.ts";
import { resolveAssetRows } from "./asset-resolution.ts";
import { resolveDebtRows } from "./debt-resolution.ts";

export interface ExportTable { title: string; headers: string[]; rows: string[][] }
export interface CourtDocument {
  kind: ArtifactKind;
  title: string;
  filename: string;
  paragraphs: string[];
  tables: ExportTable[];
}
export interface WorkbookSheet {
  name: string;
  /** Always write as string cells. Never infer formulas from evidence. */
  rows: { value: string; type: "text" }[][];
}
export interface ExportPackage {
  caseId: string;
  caseRevision: number;
  generatedAt: string;
  status: "draft";
  scope: string;
  documents: CourtDocument[];
  workbook: WorkbookSheet[];
  assessment: Assessment;
}

function readable(value: unknown): string {
  if (value === undefined || value === null || value === "") return "[확인 필요]";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function factValue(data: CaseData, keys: string[]): string {
  const candidates = currentFacts(data).filter((f) => keys.includes(f.key) && f.state !== "disputed" && f.recognition !== "rejected");
  const values = [...new Set(candidates.map((f) => readable(f.value)))];
  return values.length === 1 ? values[0] : values.length ? "[상충: 원문 대조 필요]" : "[확인 필요]";
}
function refs(data: CaseData, factIds: string[]): string {
  const facts = currentFacts(data).filter((f) => factIds.includes(f.id));
  return facts.flatMap((f) => f.refs.map((r) => `${data.documents.find((d) => d.id === r.documentId)?.name ?? r.documentId} ${r.page}쪽`)).filter((r, i, all) => all.indexOf(r) === i).join("; ") || "[현재 원문 근거 연결 필요]";
}
function textSheet(name: string, rows: (string | null | undefined)[][]): WorkbookSheet {
  return { name, rows: rows.map((row) => row.map((value) => ({ value: readable(value), type: "text" as const }))) };
}
function verifiedWon(input: import("./domain.ts").NumericInput | null | undefined): string | null {
  return moneyValue(input)?.toString() ?? null;
}
const recognitionLabels = { unreviewed: "인정 검토 전", accepted: "인정 검토 완료", rejected: "불인정" };
const kindLabels: Record<string, string> = { wage: "근로", business: "사업", rent: "임대", interest: "이자", dividend: "배당", pension: "연금", benefit: "급여·수급", other: "기타", ordinary: "일반채권", secured: "담보채권", tax: "조세채권", estate: "재단채권", non_dischargeable: "면책 제외 검토", disputed: "다툼 있는 채권", unknown: "분류 미확정" };

/** Native document writers consume this payload; no court finding is invented to fill blanks. */
export function buildCourtPackage(data: CaseData, rules: RuleSet, existingAssessment?: Assessment): ExportPackage {
  const assessment = existingAssessment?.caseRevision === data.context.revision ? existingAssessment : assessCase(data, rules);
  const c = assessment.calculation;
  const resolvedAssets = resolveAssetRows(data).rows;
  const resolvedDebts = resolveDebtRows(data).rows;
  const name = data.context.applicant?.name || factValue(data, ["person.name", "client_name"]);
  const applicantAddress = data.context.applicant?.address || factValue(data, ["person.address", "address", "jurisdiction.residence"]);
  const note = "검토용 편집 초안입니다. 누락·상충 항목은 표시한 상태로 보존합니다. 현재 법원 서식·첨부·서명 및 사건별 인정 내용을 담당자와 변호사가 확인해야 합니다.";
  const common = [`사건명: ${data.context.caseName}`, `사건 버전: ${data.context.revision} / 신청 예정일: ${data.context.applicationDate} / 금액 기준일: ${data.context.asOf}`, note];
  const documents: CourtDocument[] = [
    { kind: "application", title: "개인회생절차 개시신청서 초안", filename: "01_application.docx", paragraphs: [...common, "아래 사실과 증빙을 기초로 개인회생절차 개시신청서의 기재 내용을 정리합니다. 신청취지·법적 요건·서명란은 최종 검토 후 확정합니다."], tables: [
      { title: "신청인 및 사건", headers: ["항목", "기재 내용"], rows: [["성명", name], ["주민등록번호", data.context.applicant?.residentIdMasked || "[보안 입력·최종 서식 대조 필요]"], ["주소", applicantAddress], ["관할", data.context.courtId], ["신청 예정일", data.context.applicationDate], ["금액 산정기준일", data.context.asOf]] },
      { title: "재무 현황", headers: ["항목", "금액 또는 상태"], rows: [["채무 원금 합계", formatWon(c.debtPrincipalWon)], ["채무 이자 합계", formatWon(c.debtInterestWon)], ["월평균 순소득", formatWon(c.monthlyIncomeWon)], ["검토 청산가치", formatWon(c.liquidationValueWon)], ["사전점검", assessment.label]] },
      { title: "채무 경위·신청 사유", headers: ["항목", "내용"], rows: [["진술", data.context.applicant?.statement || factValue(data, ["statement.text", "person.statement", "form.statement", "statement"])], ["검토 범위", assessment.scope]] },
    ] },
    { kind: "creditors", title: "개인회생채권자목록 초안", filename: "02_creditors.docx", paragraphs: [...common, "원금과 이자를 별도 열로 유지하며 동일 계약의 중복·상충을 확인합니다. 조세·재단채권·담보부족액·우선권은 법적 분류 검토 후 확정합니다."], tables: [
      { title: "채권별 명세", headers: ["계약 ID", "채권자", "원금", "이자", "합계", "기준일", "분류·담보", "보증·연대·구상 검토", "보증 청구액 / 한도", "원문 근거"], rows: c.debtRows.map((r) => { const d = resolvedDebts.find((debt) => debt.id === r.id)!; const g = d.guaranteeDetails; const guarantee = g ? `${g.liabilityRole} / ${g.claimNature} / 주채무 ${g.underlyingDebtId || "[미연결]"} / 대위 ${g.recourseStatus} / 한도 ${g.capTreatment} (${g.capTreatmentReviewed === true ? "검토" : "검토 전"})` : "[보증·연대 여부 확인 필요]"; const sourceAmounts = g ? `${formatWon(verifiedWon(g.sourceGuaranteeAmount))} / ${formatWon(verifiedWon(g.sourceGuaranteeLimit))} (신청인 채무액과 별도)` : "[확인 필요]"; return [d.contractId || "[계약 식별 필요]", r.creditor, formatWon(r.principalWon), formatWon(r.interestWon), formatWon(r.totalWon), d.asOf || "[확인 필요]", `${kindLabels[d.classification]} / ${d.secured}`, guarantee, sourceAmounts, refs(data, d.factIds)]; }) },
      { title: "집계", headers: ["구분", "금액"], rows: [["원금", formatWon(c.debtPrincipalWon)], ["이자", formatWon(c.debtInterestWon)], ["전체 채무", formatWon(c.totalDebtWon)], ["한도 비교용 담보채무", formatWon(c.securedDebtWon)], ["한도 비교용 무담보채무", formatWon(c.unsecuredDebtWon)]] },
    ] },
    { kind: "assets", title: "재산목록 및 청산가치 검토표", filename: "03_assets.docx", paragraphs: [...common, "재산 처분 가정은 매각대금·담보상환·비용·잔여현금의 보존을 확인해야 합니다. 단순히 재산을 목록에서 제외하는 방식으로 청산가치를 줄이지 않습니다."], tables: [
      { title: "재산별 평가", headers: ["재산", "평가액", "지분", "담보상환", "처분비용", "면제 검토액", "기여 청산가치", "기준·근거"], rows: resolvedAssets.map((a) => [a.label, formatWon(a.grossValue?.amountWon), a.ownershipBps === null || a.ownershipBps === undefined ? "[확인 필요]" : `${a.ownershipBps / 100}%`, formatWon(a.securedPayoff?.amountWon), formatWon(a.disposalCosts?.amountWon), formatWon(a.protectedValue?.amountWon), formatWon(c.assetRows.find((r) => r.id === a.id)?.liquidationWon), `${a.asOf || "[평가일 필요]"} / ${a.valuationBasis || "[평가근거 필요]"} / ${refs(data, a.factIds)}`]) },
      { title: "청산가치 대조", headers: ["항목", "내용"], rows: [["재산 목록 완전성", data.context.inventoryComplete.asset], ["검토 청산가치 합계", formatWon(c.liquidationValueWon)], ["변제액 현재가치", formatWon(c.presentValueWon)], ["보장 비교", c.liquidationComparison === "met" ? "현재 입력 기준 충족" : c.liquidationComparison === "not_met" ? "현재 입력 기준 미충족" : "[자료·산식 검토 필요]"]] },
    ] },
    { kind: "income_expense", title: "수입·지출에 관한 목록 초안", filename: "04_income_expense.docx", paragraphs: [...common, "근로·사업·임대·이자·배당·연금 등 소득원별 기간과 비용을 구별합니다. 합계 기간이 없는 금액은 월평균으로 변환하지 않습니다."], tables: [
      { title: "기간별 소득 관측 명세", headers: ["소득원", "유형", "기간·분모", "총수입", "필요경비", "순수입", "월평균", "인정·근거"], rows: data.incomes.map((s) => [s.label, kindLabels[s.kind] || s.kind, `${s.periodStart || "?"} ~ ${s.periodEnd || "?"} / ${s.amountBasis === "monthly" ? "명시적 월액" : `${s.periodMonths ?? "날짜 범위 확인"}개월`}`, formatWon(s.gross?.amountWon), formatWon(s.expenses?.amountWon), formatWon(s.net?.amountWon), formatWon(c.incomeRows.find((r) => r.id === s.id)?.monthlyWon), `${recognitionLabels[s.recognition ?? "unreviewed"]} / ${refs(data, s.factIds)}`]) },
      { title: "지급자·기간을 연결한 소득 집계", headers: ["소득원", "대표기간", "증빙 개월", "기간가중 월평균", "연결 관측·확인 사항"], rows: c.incomeGroups.map(group=>[group.label,group.selectedPeriod?`${group.selectedPeriod.start} ~ ${group.selectedPeriod.end}`:"[대표기간 선택 필요]",String(group.observedMonths),formatWon(group.monthlyObservedAverageWon),`${group.sourceIds.length}개 관측 / ${group.reasons.join("; ")||"기간별 집계"}`]) },
      { title: "월 수입·지출", headers: ["항목", "금액"], rows: [["월평균 순소득 합계", formatWon(c.monthlyIncomeWon)], ["인정 생계비", formatWon(c.recognizedLivingCostWon)], ["회생위원 보수", formatWon(data.context.monthlyTrusteeFee?.amountWon)], ["우선채권 월 변제", formatWon(data.context.monthlyPriorityPayment?.amountWon)], ["재단채권 월 변제", formatWon(data.context.monthlyEstatePayment?.amountWon)], ["월 가용소득", formatWon(c.disposableIncomeWon)]] },
    ] },
    { kind: "repayment_plan", title: "변제계획안 및 채권별 배분 검토 초안", filename: "05_repayment_plan.docx", paragraphs: [...common, "변제기간·생계비·우선채권·현재가치·배분 기준은 사건별 검토가 필요합니다. 명목 총변제액을 현재가치로 간주하지 않습니다."], tables: [
      { title: "변제계획 입력", headers: ["항목", "내용"], rows: [["월 변제예정액", formatWon(c.monthlyPaymentWon)], ["변제기간", data.context.planMonths ? `${data.context.planMonths}개월` : "[확인 필요]"], ["명목 총변제액", formatWon(c.planTotalWon)], ["검토 현재가치", formatWon(c.presentValueWon)], ["현재가치 근거", data.context.presentValueBasis || "[산식·기준일 확인 필요]"], ["현재가치 산식 검토", data.context.presentValueReviewed === true ? "검토 기록 있음" : "검토 전"], ["배분 기준", data.context.allocationBasis || "[검토 필요]"], ["배분 기준 검토", data.context.allocationBasisReviewed ? "검토 기록 있음" : "검토 전"]] },
      { title: "일반채권 배분 검토", headers: ["채권자", "채권 원금", "채권 이자", "원금 배분", "이자 배분", "배분 합계", "상태"], rows: c.allocations.map((a) => [a.creditor, formatWon(a.principalWon), formatWon(a.interestWon), formatWon(a.allocatedPrincipalWon), formatWon(a.allocatedInterestWon), formatWon(a.totalWon), a.status === "reviewed_basis" ? "기준 검토 완료" : "검토 전 가정"]) },
    ] },
    { kind: "statement", title: "진술서 초안", filename: "06_statement.docx", paragraphs: [...common, "현재 진술·증빙에 나타난 내용을 보존합니다. 누락된 경력·주거·채무발생 경위·과거 절차는 신청인의 확인을 받아 보완하며, 확인되지 않은 이야기를 생성하지 않습니다."], tables: [
      { title: "신청인 진술", headers: ["항목", "내용"], rows: [["성명", name], ["주소", applicantAddress], ["채무 발생 및 신청 경위", data.context.applicant?.statement || factValue(data, ["statement.text", "person.statement", "form.statement", "statement"])], ["경력", factValue(data, ["statement.career_history", "person.career_history", "career_history"])], ["현재 주거", factValue(data, ["statement.housing_type", "person.housing_type", "housing_type"])], ["과거 회생·면책 등 절차", factValue(data, ["statement.prior_proceedings", "case.prior_proceedings", "prior_proceedings"])]] },
      { title: "진술 근거 및 원문 대조", headers: ["항목", "원문", "증빙", "원문 확인", "인정 검토"], rows: currentFacts(data).filter((f) => f.key.startsWith("statement.") || ["person.statement", "form.statement", "statement"].includes(f.key)).map((f) => [f.key, readable(f.value), refs(data, [f.id]), f.state, recognitionLabels[f.recognition]]) },
    ] },
    { kind: "evidence_index", title: "증빙 색인 및 보완·검토 목록", filename: "07_evidence_index.docx", paragraphs: [...common], tables: [
      { title: "현재 증빙", headers: ["문서 ID", "파일명", "유형", "페이지", "SHA-256"], rows: data.documents.filter((d) => d.status === "active").map((d) => [d.id, d.name, d.type || "[분류 필요]", d.pages.join(", "), d.sha256]) },
      { title: "보완·검토 항목", headers: ["구분", "점검 항목", "내용", "다음 조치"], rows: assessment.findings.filter((f) => f.outcome !== "pass").map((f) => [f.category, f.title, f.detail, f.nextAction || "[검토 기록 필요]"]) },
      { title: "적용 규칙 출처", headers: ["ID", "원문", "URL", "시행일"], rows: rules.sources.map((s) => [s.id, s.title, s.url, s.effectiveFrom || "[확인 필요]"]) },
    ] },
  ];
  const appendAnnex=(kind:ArtifactKind,filename:string,annex:ReturnType<typeof bankAccountsAnnex>)=>{
    const tables:ExportTable[]=[{title:annex.title,headers:annex.headers,rows:annex.rows}];
    if(annex.summary)tables.push(annex.summary);
    documents.push({kind,title:annex.title,filename,paragraphs:[...common,...annex.notes,...(annex.status==="blocked"?["상태: 입력·원문 대조 또는 검토가 남아 있어 확정되지 않았습니다."]:[])],tables});
  };
  const requiredAnnexKinds=requiredKindsForCase(data);
  if(requiredAnnexKinds.includes("bank_accounts"))appendAnnex("bank_accounts","10_bank_accounts.docx",bankAccountsAnnex(data));
  if(requiredAnnexKinds.includes("leases"))appendAnnex("leases","11_leases.docx",leasesAnnex(data));
  if(requiredAnnexKinds.includes("repayment_schedule")){
    const schedule=data.context.paymentSchedule;
    const annex=repaymentScheduleAnnex(schedule?.phases??[],schedule?.expectedInstallments??undefined);
    const reviewed=schedule?.reviewed===true&&!!schedule.reviewReason?.trim();
    const tables:ExportTable[]=[{title:annex.title,headers:annex.headers,rows:annex.rows}];if(annex.summary)tables.push(annex.summary);
    documents.push({kind:"repayment_schedule",title:annex.title,filename:"12_repayment_schedule.docx",paragraphs:[...common,...annex.notes,reviewed?"단계 입력 검토 기록이 있습니다. 검토 근거: "+schedule!.reviewReason:"상태: 일정은 제안 입력이며 담당자 검토 전입니다. 검토 완료로 자동 표시하지 않습니다."],tables});
  }
  const facts = currentFacts(data);
  const workbook: WorkbookSheet[] = [
    textSheet("채권원금이자", [["채무 ID", "계약 ID", "채권자", "원금(원)", "이자(원)", "합계(원)", "분류", "기준일", "보증역할", "채권성격", "주채무 ID", "대위·구상 상태", "한도 처리", "처리 검토", "근거"], ...c.debtRows.map((r) => { const d = resolvedDebts.find((debt) => debt.id === r.id)!; const g = d.guaranteeDetails; return [r.id, d.contractId, r.creditor, r.principalWon, r.interestWon, r.totalWon, r.classification, d.asOf, g?.liabilityRole, g?.claimNature, g?.underlyingDebtId, g?.recourseStatus, g?.capTreatment, g?.capTreatmentReviewed === true ? "검토됨" : "검토 전", refs(data, d.factIds)]; })]),
    textSheet("보증연대 검토", [["채무 ID", "채권자", "신청인 채무 원금", "신청인 채무 이자", "원문 보증청구액", "원문 보증한도", "역할", "채권 성격", "주채무 ID", "대위·구상 상태", "한도 처리", "검토 여부", "검토 사유", "근거"], ...data.debts.filter((d) => d.guaranteeDetails || d.factIds.some((id) => currentFacts(data).some((f) => f.id === id && /guarantee|surety|보증|연대/i.test(f.key)))).map((d) => { const g = d.guaranteeDetails; return [d.id, d.creditor, verifiedWon(d.principal), verifiedWon(d.interest), verifiedWon(g?.sourceGuaranteeAmount), verifiedWon(g?.sourceGuaranteeLimit), g?.liabilityRole, g?.claimNature, g?.underlyingDebtId, g?.recourseStatus, g?.capTreatment, g?.capTreatmentReviewed === true ? "검토됨" : "검토 전", g?.reviewReason, refs(data, d.factIds)]; })]),
    textSheet("소득원", [["ID", "소득원", "유형", "금액 기준", "개월수", "총수입(원)", "경비(원)", "순소득(원)", "월평균(원)", "근거"], ...data.incomes.map((s) => [s.id, s.label, s.kind, s.amountBasis, s.periodMonths?.toString(), s.gross?.amountWon, s.expenses?.amountWon, s.net?.amountWon, c.incomeRows.find((r) => r.id === s.id)?.monthlyWon, refs(data, s.factIds)])]),
    textSheet("소득기간 집계", [["집계 ID","소득원","연결 관측 ID","기간 시작","기간 종료","증빙 개월","기간가중 월평균(원)","확인 사항"],...c.incomeGroups.map(g=>[g.id,g.label,g.sourceIds.join("; "),g.selectedPeriod?.start,g.selectedPeriod?.end,String(g.observedMonths),g.monthlyObservedAverageWon,g.reasons.join("; ")])]),
    textSheet("재산청산가치", [["ID", "재산", "평가액(원)", "지분(1/10000)", "담보상환(원)", "비용(원)", "면제(원)", "청산기여(원)", "평가일", "평가근거"], ...resolvedAssets.map((a) => [a.id, a.label, a.grossValue?.amountWon, a.ownershipBps?.toString(), a.securedPayoff?.amountWon, a.disposalCosts?.amountWon, a.protectedValue?.amountWon, c.assetRows.find((r) => r.id === a.id)?.liquidationWon, a.asOf, a.valuationBasis])]),
    textSheet("산식대조", [["계산 ID", "제목", "산식", "입력", "결과(원)", "상태", "확인 사항"], ...c.traces.map((t) => [t.id, t.title, t.formula, t.inputs.map((i) => i.label + "=" + (i.value ?? "미확인")).join("; "), t.resultWon, t.status, t.reasons.join("; ")])]),
    textSheet("사실과인정", [["사실 ID", "논리 ID", "버전", "대상", "피처", "원문값", "값", "정규화 원화", "원문 검증", "법적 인정", "문서·페이지", "인용"], ...facts.map((f) => [f.id, f.logicalId, f.version.toString(), f.subjectId, f.key, f.rawValue ?? readable(f.numeric?.rawValue), readable(f.value), f.numeric?.amountWon, f.state, f.recognition, refs(data, [f.id]), f.refs.map((r) => r.quote).join(" / ")])]),
    textSheet("보완검토", [["점검 ID", "항목", "구분", "결과", "내용", "다음 조치"], ...assessment.findings.map((f) => [f.id, f.title, f.category, f.outcome, f.detail, f.nextAction])]),
    textSheet("평가범위", [["항목", "내용"], ["결과", assessment.label], ["범위", assessment.scope], ["지표 안내", assessment.quality.note], ["현재 사실", String(facts.length)], ["원문 검증 완료", String(assessment.quality.sourceVerified)], ["인정 검토 완료", String(assessment.quality.legallyAccepted)]]),
  ];
  for(const item of documents.filter(d=>["bank_accounts","leases","repayment_schedule"].includes(d.kind))){
    for(const [index,table] of item.tables.entries())workbook.push(textSheet((item.kind+"_"+(index+1)).slice(0,31),[[table.title],table.headers,...table.rows]));
  }
  return { caseId: data.context.id, caseRevision: data.context.revision, generatedAt: new Date().toISOString(), status: "draft", scope: assessment.scope, documents, workbook, assessment };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function printableHtml(payload: ExportPackage, kind?: ArtifactKind): string {
  const docs = kind ? payload.documents.filter((d) => d.kind === kind) : payload.documents;
  const body = docs.map((doc) => `<article class="document"><div class="eyebrow">FIRM ENGINE · 검토용 초안 · v${payload.caseRevision}</div><h1>${escapeHtml(doc.title)}</h1>${doc.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}${doc.tables.map((table) => `<h2>${escapeHtml(table.title)}</h2><table><thead><tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${table.rows.length ? table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${table.headers.length}">[확인된 기재 항목 없음 · 원문 및 적용 여부 검토 필요]</td></tr>`}</tbody></table>`).join("")}<footer>생성 ${escapeHtml(payload.generatedAt)} · 법원 최신 양식·첨부·서명 대조 후 확정</footer></article>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Firm Engine · ${escapeHtml(docs[0]?.title || "검토 초안")}</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;background:#f1f3f1;color:#17251e;font:13px/1.65 system-ui,-apple-system,"Malgun Gothic",sans-serif}.document{max-width:1120px;margin:28px auto;padding:44px;background:white;border:1px solid #d8dfd9;page-break-after:always}.eyebrow{font-size:11px;letter-spacing:.14em;color:#52705d}h1{font-size:26px;line-height:1.3;margin:12px 0 24px}h2{font-size:16px;margin:28px 0 10px}p{margin:8px 0;white-space:pre-wrap}table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:10px}th,td{padding:8px;border:1px solid #d7ddd7;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#eef4ee;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}footer{margin-top:32px;border-top:1px solid #d7ddd7;padding-top:10px;color:#607064;font-size:10px}@media print{body{background:white}.document{border:0;margin:0;padding:0;max-width:none}h2{break-after:avoid}h1{font-size:22px}p{font-size:10px}.document:last-child{page-break-after:auto}}@media(max-width:700px){.document{margin:0;padding:20px}table{font-size:9px}th,td{padding:5px}}</style></head><body>${body}</body></html>`;
}

export function newExportManifest(caseRevision: number, files: ExportManifest["files"], data?:CaseData): ExportManifest {
  return { caseRevision, requiredKinds: data?requiredKindsForCase(data):["application","creditors","assets","income_expense","repayment_plan","statement","evidence_index","repayment_schedule"], files, reviews: { caseworker: null, lawyer: null } };
}

export function sourceQuote(fact: Fact): string { return fact.refs.map((ref) => `${ref.documentId} / ${ref.page}쪽: ${ref.quote}`).join("\n"); }
