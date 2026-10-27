import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate";
import { createCase, DRAFT_RULESET, normalizeMoney } from "../lib/domain.ts";
import { buildCourtPackage } from "../lib/exports.ts";
import { artifactHash, writeOfficePackage } from "../lib/office-writer.ts";
import type { RenderedOffice } from "../lib/office-writer.ts";

function sourceCase() {
  const data = createCase("합성 Office 회귀검증", "synthetic-office", "2026-10-27");
  data.documents = [{ id: "proof", name: "synthetic-only.pdf", sha256: "b".repeat(64), pages: [1], status: "active" }];
  data.pages = [{ documentId: "proof", page: 1, role: "evidence", text: "Synthetic principal 100000000 interest 1000000" }];
  data.facts = [{ id: "debt-source", logicalId: "debt-source", version: 1, subjectId: "loan", key: "debts[].amounts", value: "Synthetic principal 100000000 interest 1000000", state: "verified", recognition: "accepted", refs: [{ documentId: "proof", page: 1, quote: "principal 100000000 interest 1000000" }], validation: [] }];
  data.debts = [{ id: "loan", contractId: "synthetic-contract", creditor: '=HYPERLINK("https://invalid.test","<script>")', principal: normalizeMoney("100000000"), interest: normalizeMoney("1000000"), secured: "no", classification: "ordinary", asOf: data.context.asOf, priority: "ordinary", factIds: ["debt-source"] }];
  data.context.inventoryComplete.debt = "yes";
  data.context.applicant = { name: "<script>합성</script>", statement: "원문 문자 {{template}} 보존" };
  return data;
}

test("실제 DOCX·XLSX·ZIP·rendered JSON의 원금/이자와 이스케이프가 일치한다", async () => {
  const data = sourceCase();
  const files = await writeOfficePackage({ data, rules: DRAFT_RULESET, mode: "draft" });
  assert.equal(files.filter((f) => f.mime.includes("wordprocessingml")).length, 8);
  const creditors = files.find((f) => f.kind === "creditors")!;
  const xml = strFromU8(unzipSync(creditors.bytes)["word/document.xml"]);
  assert.ok(xml.includes("100,000,000원"));
  assert.ok(xml.includes("1,000,000원"));
  assert.ok(xml.includes("&lt;script&gt;"));
  assert.ok(!xml.includes("<script>"));
  assert.ok(xml.includes("맑은 고딕"));
  assert.ok(xml.includes('w:orient="landscape"'));
  const workbookFile = files.find((f) => f.kind === "review_workbook")!;
  const workbook = XLSX.read(workbookFile.bytes, { type: "array", cellFormula: true });
  const claims = workbook.Sheets["채권원금이자"];
  assert.equal(claims.D2.v, "100000000");
  assert.equal(claims.E2.v, "1000000");
  assert.equal(claims.D2.t, "s"); assert.equal(claims.E2.t, "s");
  assert.equal(claims.C2.v, data.debts[0].creditor); assert.equal(claims.C2.t, "s"); assert.equal(claims.C2.f, undefined);
  for (const name of workbook.SheetNames) for (const [key, cell] of Object.entries(workbook.Sheets[name])) if (!key.startsWith("!") && cell && typeof cell === "object") assert.ok(!("f" in cell));
  const rendered = JSON.parse(strFromU8(files.find((f) => f.kind === "rendered_json")!.bytes)) as RenderedOffice;
  assert.equal(rendered.extractionMethod, "reopened-docx-xml-and-xlsx-cells");
  assert.equal(rendered.fields.find((f) => f.documentKind === "creditors" && f.featureKey === "debts[].principal")?.value, "100,000,000원");
  assert.equal(rendered.fields.find((f) => f.documentKind === "creditors" && f.featureKey === "debts[].interest")?.value, "1,000,000원");
  assert.equal(rendered.workbook.find((s) => s.name === "채권원금이자")?.rows[1][3], "100000000");
  const zip = unzipSync(files.find((f) => f.kind === "package_zip")!.bytes);
  assert.equal(Object.keys(zip).filter((name) => name.endsWith(".docx")).length, 8);
  assert.ok(zip["08_review_workbook.xlsx"]); assert.ok(zip["rendered.json"]); assert.ok(zip["09_printable.html"]);
  for (const file of files) assert.equal(await artifactHash(file.bytes), file.hash);
});

test("과거·변조된 중립 payload로 실제출력을 바꾸거나 미확정사건을 final로 만들 수 없다", async () => {
  const data = sourceCase();
  await assert.rejects(writeOfficePackage({ data, rules: DRAFT_RULESET, mode: "final" }), /최종 검토본 생성을 보류/);
  const payload = buildCourtPackage(data, DRAFT_RULESET);
  payload.caseRevision -= 1;
  await assert.rejects(writeOfficePackage({ data, rules: DRAFT_RULESET, payload }), /사건 버전이 변경/);
  payload.caseRevision = data.context.revision;
  payload.documents.find((d) => d.kind === "creditors")!.tables[0].rows[0][2] = "999원";
  const result = await writeOfficePackage({ data, rules: DRAFT_RULESET, payload });
  const rendered = JSON.parse(strFromU8(result.find((f) => f.kind === "rendered_json")!.bytes)) as RenderedOffice;
  assert.equal(rendered.fields.find((f) => f.featureKey === "debts[].principal")?.value, "100,000,000원");
});

test("공개 서식의 독립 진술서·반복 채권행·서명 공란과 출처를 유지한다", async () => {
  const data=sourceCase();
  data.pages[0].text+="\nSynthetic principal 2000000 interest 20000";
  data.facts.push({ ...data.facts[0], id:"debt-source-2",logicalId:"debt-source-2",subjectId:"loan-2",refs:[{documentId:"proof",page:1,quote:"principal 2000000 interest 20000"}] });
  data.debts.push({ ...data.debts[0], id:"loan-2",contractId:"synthetic-contract-2",principal:normalizeMoney("2000000"),interest:normalizeMoney("20000"),factIds:["debt-source-2"] });
  const files=await writeOfficePackage({data,rules:DRAFT_RULESET});
  const rendered=JSON.parse(strFromU8(files.find(f=>f.kind==="rendered_json")!.bytes)) as RenderedOffice;
  assert.equal(rendered.documents.filter(d=>["application","creditors","assets","income_expense","repayment_plan","statement","evidence_index"].includes(d.kind)).length,7);
  assert.ok(rendered.documents.some(d=>d.kind==="repayment_schedule"));
  for(const document of rendered.documents.filter(d=>d.kind!=="repayment_schedule")){
    assert.ok(document.form);assert.equal(document.form.approvalStatus,"reviewer_pending");assert.equal(document.form.templateSha256.length,64);
    assert.ok(document.tables.length>0);assert.ok(document.tables.every(t=>t.sha256?.length===64));
    assert.ok(document.blocks.some(b=>b.type==="table"));
  }
  const statement=rendered.documents.find(d=>d.kind==="statement")!;
  const statementArchive=unzipSync(files.find(f=>f.kind==="statement")!.bytes);
  assert.ok(!strFromU8(statementArchive["word/header1.xml"]).includes("{{revision}}"));
  assert.ok(!strFromU8(statementArchive["word/header1.xml"]).includes("{{review_status}}"));
  assert.ok(strFromU8(statementArchive["word/_rels/document.xml.rels"]).includes("https://file.scourt.go.kr/AttachDownload"));
  assert.equal(statement.form?.code,"D5105");
  assert.ok(statement.paragraphs.includes("I. 경력"));assert.ok(statement.paragraphs.includes("II. 현재 주거 상황"));assert.ok(statement.paragraphs.includes("IV. 과거 면책절차 등의 이용 상황"));
  assert.ok(statement.paragraphs.includes(data.context.applicant!.statement!));
  assert.ok(statement.paragraphs.some(p=>p.includes("서명 또는 날인: __________________")));
  assert.ok(statement.form!.sourceUrls.some(u=>u.startsWith("https://file.scourt.go.kr/")));
  assert.ok(statement.form!.unresolvedTokens.includes("education"));
  const creditors=rendered.documents.find(d=>d.kind==="creditors")!;
  const originalRows=creditors.tables.find(t=>t.headers[0]==="채권번호·채권자 / 기준일")!;
  assert.equal(originalRows.rows.length,2);
  assert.ok(originalRows.rows[1][0].includes("synthetic-contract-2"));
  assert.ok(originalRows.rows[1][3].includes("원금: 2,000,000 원"));assert.ok(originalRows.rows[1][3].includes("이자: 20,000 원"));
  assert.ok(originalRows.rows[0][0].includes("synthetic-contract"));
  assert.ok(originalRows.rows[0][3].includes("원금: 100,000,000 원"));assert.ok(originalRows.rows[0][3].includes("이자: 1,000,000 원"));
  const html=strFromU8(files.find(f=>f.kind==="print_html")!.bytes);
  assert.ok(html.includes("II. 현재 주거 상황"));assert.ok(html.includes("원문 문자 {{template}} 보존"));assert.ok(!html.includes("<script>"));assert.ok(html.includes("&lt;script&gt;"));
});

test("원형 D5110 기본 가용소득 산식과 승인한 일반채권 변제액을 혼동하지 않는다",async()=>{
  const data=sourceCase();
  data.pages[0].text+="\nSynthetic income 30000 living 10000";
  data.facts.push({...data.facts[0],id:"income-f",logicalId:"income-f",subjectId:"income",key:"income.net",refs:[{documentId:"proof",page:1,quote:"income 30000"}]});
  data.facts.push({...data.facts[0],id:"household-f",logicalId:"household-f",subjectId:"household",key:"household.living",refs:[{documentId:"proof",page:1,quote:"living 10000"}]});
  data.incomes=[{id:"income",kind:"wage",label:"합성 월소득",net:normalizeMoney("30000"),amountBasis:"monthly",recurring:"yes",recognition:"accepted",factIds:["income-f"]}];
  data.household={recognizedMembers:1,recognizedLivingCost:normalizeMoney("10000"),livingCostIncludesAdditional:true,recognition:"accepted",factIds:["household-f"]};
  Object.assign(data.context,{inventoryComplete:{income:"yes",debt:"yes",asset:"unknown"},monthlyTrusteeFee:normalizeMoney("1000"),monthlyPriorityPayment:normalizeMoney("2000"),monthlyEstatePayment:normalizeMoney("500"),approvedMonthlyPayment:normalizeMoney("10000"),planMonths:36});
  const files=await writeOfficePackage({data,rules:DRAFT_RULESET});
  const rendered=JSON.parse(strFromU8(files.find(f=>f.kind==="rendered_json")!.bytes)) as RenderedOffice;
  const plan=rendered.documents.find(d=>d.kind==="repayment_plan")!;
  const formula=plan.tables.find(t=>t.headers[0].startsWith("①"))!;
  assert.ok(plan.paragraphs.some(p=>p.includes("검토한 일반채권 월 변제계획액을 안분하여")));
  assert.deepEqual(formula.rows[0],["30,000","10,000","20,000","1,000","19,000","36","684,000"]);
  const planned=plan.tables.find(t=>t.title==="변제계획 입력")!;
  assert.equal(planned.rows.find(r=>r[0]==="월 변제예정액")?.[1],"10,000원");
  assert.equal(planned.rows.find(r=>r[0]==="명목 총변제액")?.[1],"360,000원");
});

test("large source appendix writes and reopens every synthetic row", async () => {
  const data = sourceCase();
  data.pages[0].role = "evidence";
  data.pages[0].text = Array.from({ length: 5_200 }, (_, i) => i===5_199 ? `Synthetic citation ${i} & <xml>\ncontinued` : `Synthetic citation ${i} & <xml>`).join(" ");
  data.facts = Array.from({ length: 5_200 }, (_, i) => ({
    id: `synthetic-${i}`, logicalId: `synthetic-${i}`, version: 1, subjectId: `synthetic-${i}`, key: "person.synthetic_observation",
    value: i===5_199 ? `Synthetic observation ${i} & <xml>\ncontinued` : `Synthetic observation ${i} & <xml>`, state: "verified" as const, recognition: "accepted" as const,
    refs: [{ documentId: "proof", page: 1, quote: i===5_199 ? `Synthetic citation ${i} & <xml>\ncontinued` : `Synthetic citation ${i} & <xml>` }], validation: [],
  }));
  const files = await writeOfficePackage({ data, rules: DRAFT_RULESET, mode: "draft" });
  const rendered = JSON.parse(strFromU8(files.find((file) => file.kind === "rendered_json")!.bytes)) as RenderedOffice;
  const appendix = rendered.documents.find((document) => document.kind === "application")!;
const observed = appendix.tables.find((table) => table.title.includes("출처 기반 원문 관측"))!;
  assert.equal(observed.rows.length, 5_200);
  assert.equal(observed.rows[5_199][2], "Synthetic observation 5199 & <xml>\ncontinued");
  assert.equal(observed.rows[5_199][7], "synthetic-only.pdf, p.1: “Synthetic citation 5199 & <xml>\ncontinued”");
});
