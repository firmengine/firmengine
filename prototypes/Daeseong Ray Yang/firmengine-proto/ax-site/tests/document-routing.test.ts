import test from "node:test";
import assert from "node:assert/strict";
import { documentFamily, equivalentDocumentTypes } from "../lib/document-routing.ts";
import { clampDocumentParallelism, compactFamilyFieldContract, continuationRelationship, createDocumentTaskEnvelope, documentFieldContract, documentTypeMatchesFamily, mapBounded, routeDocumentTask } from "../lib/document-agent-registry.ts";
import { projectPage, type ReadField, type PageRead } from "../lib/extraction.ts";

test("source families survive printed title spacing, qualifiers and English synonyms", () => {
  for (const [label, expected] of [
    ["신용 정보 조회서 (대출개설·이용 이력)", "credit_report"],
    ["XX카드 부채증명서", "debt_certificate"],
    ["자동차등록원부(갑) 등본·초본", "vehicle_registry"],
    ["주택 전대차 계약서", "lease"],
    ["Local_Tax_Assessment_Certificate", "local_tax"],
    ["income_amount_certificate", "tax_income"],
    ["national_pension_contribution_history", "pension"],
    ["payroll_payslip", "payroll"], ["lease_housing", "lease"], ["insurance_policy_asset", "insurance"],
    ["bank_account_balance", "bank_account"],
  ]) assert.equal(documentFamily(label), expected, label);
});

test("paid, billed, arrears, premiums and benefits keep different meaning", () => {
  assert.equal(documentFamily("건강보험료 납부확인서"), "health_insurance_payment");
  assert.equal(documentFamily("건강보험료 미납내역서"), "health_insurance_arrears");
  assert.equal(documentFamily("건강보험자격득실확인서"), "health_insurance");
  assert.equal(documentFamily("국민연금가입내역안내서"), "pension");
  assert.equal(documentFamily("연금수급증명서"), "pension_benefit");
  assert.equal(documentFamily("지방세 세목별 과세증명서"), "local_tax");
  assert.equal(documentFamily("지방세 체납 및 정리보류내역 안내"), "tax_arrears");
  assert.equal(documentFamily("부가가치세 과세표준증명"), "tax_revenue");
});

test("unknown titles do not acquire stronger ownership or current balance meaning", () => {
  for (const label of ["금융거래확인서", "보험 관련 메모", "재산 설명", "tax_certificate", "pension unknown", "임대인 메모"]) assert.equal(documentFamily(label), "unknown", label);
  assert.equal(documentFamily("매각채권 미보유채권 현황(매각 당시 정보 기반의 채권 이력 자료)"), "credit_report");
  assert.ok(!equivalentDocumentTypes("credit_report").includes("debt_certificate"));
  assert.ok(!equivalentDocumentTypes("health_insurance_payment").includes("health_insurance_arrears"));
});

test("workflow aliases connect actual contracts without broad lexical matching", () => {
  assert.ok(equivalentDocumentTypes("부동산임대차계약서(월세)").includes("lease_contract"));
  assert.ok(equivalentDocumentTypes("소득금액증명원").includes("income_amount_certificate"));
  assert.deepEqual(equivalentDocumentTypes("not-catalogued"), ["not-catalogued"]);
});

test("document agent contracts route known family scopes and keep unknown reads on review",()=>{
  assert.equal(documentFieldContract("payroll")?.family_id,"payroll_payslip","legacy extraction key remains explicitly mapped to the versioned family");
  assert.equal(documentTypeMatchesFamily("lease_housing","lease_housing"),true);
  assert.equal(documentTypeMatchesFamily("unknown","lease_housing"),false);
  assert.equal(documentTypeMatchesFamily("insurance_policy_asset","lease_housing"),false);
  assert.deepEqual(routeDocumentTask("debt_certificate","extract"),{familyId:"debt_certificate",taskRole:"family_extractor",reviewRequired:false});
  assert.deepEqual(routeDocumentTask("unlisted attachment","extract"),{familyId:null,taskRole:"human_review_route",reviewRequired:true});
  assert.equal(routeDocumentTask("debt_certificate","verify").taskRole,"source_verifier");
  const task=createDocumentTaskEnvelope({runId:"run",taskId:"task",taskRole:"family_extractor",caseId:"case",pageJobId:"job",documentId:"doc",sourceSha256:"a".repeat(64),imageSha256:"b".repeat(64),page:4,familyId:"debt_certificate",promptVersion:"prompt-v",model:"gpt-6-luna"});
  assert.equal(task.logicalBoundaryStatus,"page_only_unverified");
  assert.equal(task.logicalDocumentId,null);
  assert.equal(task.legalApproval,"not_provided");
  assert.equal(task.modelContextIndependence,"separate_task_context_same_model");
  const contract=documentFieldContract("debt_certificate");
  assert.equal(contract?.family_id,"debt_certificate");
  assert.ok(contract?.fields.length && contract.fields.every(field=>field.global_field_id.startsWith("debt_certificate::")));
  assert.ok(contract?.fields.some(field=>field.subject_role && field.temporal_role && field.canonical_unit));
  assert.equal(documentFieldContract("unlisted attachment"),null);
});

test("parallelism is bounded and adjacent pages remain unverified continuation candidates",()=>{
  assert.equal(clampDocumentParallelism(undefined),2);
  assert.equal(clampDocumentParallelism(99),4);
  assert.throws(()=>clampDocumentParallelism(0));
  assert.equal(continuationRelationship({documentId:"d",page:1,familyId:"debt_certificate"},{documentId:"d",page:2,familyId:"debt_certificate"}),"page_only_unverified","adjacent pages alone do not establish a continuation");
  assert.equal(continuationRelationship({documentId:"d",page:1,familyId:"debt_certificate",boundaryObservation:"continuation_candidate",boundaryQuote:"다음 쪽 계속"},{documentId:"d",page:2,familyId:"debt_certificate"}),"continuation_candidate_unverified");
  assert.equal(continuationRelationship({documentId:"d",page:1,familyId:"debt_certificate"},{documentId:"d",page:2,familyId:"credit_report"}),"boundary_conflict_pending");
  // Equal-looking values do not participate in the relationship decision.
  assert.equal(continuationRelationship({documentId:"d",page:1,familyId:"debt_certificate"},{documentId:"d",page:3,familyId:"debt_certificate"}),"page_only_unverified");
});
test("family prompt carries source conditions without converting case conditions into applicability decisions",()=>{
  const contract=documentFieldContract("bank_account_balance");
  const view=compactFamilyFieldContract(contract);
  assert.ok(view);
  assert.equal(view.applicabilityDecision,"source_claim_only_case_unreviewed");
  assert.ok(view.caseCondition);
  assert.ok(view.sourceAvailability);
  assert.equal(view.fields.length,contract!.fields.length);
  assert.ok(view.fields.every(field=>field.sourceCondition&&field.id.startsWith("bank_account_balance::")));
  assert.equal(compactFamilyFieldContract(null),null);
});

test("bounded job mapper preserves request order while permitting only configured overlap",async()=>{
  let active=0,maximum=0;
  const values=await mapBounded(["a","b","c","d"],2,async(value,index)=>{
    active++;maximum=Math.max(maximum,active);
    await new Promise(resolve=>setTimeout(resolve,value==="a"?8:1));
    active--;return `${index}:${value}`;
  });
  assert.deepEqual(values,["0:a","1:b","2:c","3:d"]);
  assert.equal(maximum,2);
});

const field=(key:string,value:string,unit:string|null=null):ReadField=>({key,label:key,value,unit,quote:`${key}: ${value}${unit??""}`,confidence:"clear",bbox:[0.1,0.1,0.8,0.2]});
const read=(documentType:string,category:PageRead["records"][number]["category"],fields:ReadField[]):PageRead=>({documentType,complete:true,warnings:[],records:[{category,label:"source row",fields}]});

test("bank header facts reach the account schedule without reclassifying transaction balances",()=>{
  const p=projectPage(read("bank_statement","statement",[field("bank","가상은행"),field("account_holder","가상인"),field("account_number","123-***"),field("balance","1200","원")]),"synthetic",1,"a".repeat(64));
  assert.deepEqual(p.facts?.map(f=>f.key),["bank_account.institution","bank_account.owner","bank_account.account_number","bank_account.balance"]);
  assert.equal(p.assets?.length,0);
  const row=projectPage(read("bank_statement","transaction",[field("date","2026-01-02"),field("amount","100","원"),field("balance","1200","원")]),"synthetic",2,"a".repeat(64));
  assert.ok(row.facts?.some(f=>f.key==="transaction.balance"));
  assert.ok(!row.facts?.some(f=>f.key==="bank_account.balance"));
});

test("lease party and deposit observations survive category variation without applicant ownership",()=>{
  const p=projectPage(read("부동산임대차계약서(월세)","other",[field("lessee","가상 임차인"),field("lessor","가상 임대인"),field("security_deposit","1000","만원")]),"synthetic",1,"a".repeat(64));
  assert.deepEqual(p.facts?.map(f=>f.key),["lease.tenant","lease.landlord","lease.deposit"]);
  assert.equal(p.facts?.[2].numeric?.amountWon,"10000000");
  assert.equal(p.assets?.length,0);
  assert.equal(p.incomes?.length,0);
});

test("explicit source category aliases do not turn coverage premiums into surrender value",()=>{
  const p=projectPage(read("보험가입내역조회결과","asset",[field("kind","보험계약"),field("label","가상보험"),field("gross_value","10000","원")]),"synthetic",1,"a".repeat(64));
  assert.equal(p.assets?.[0].kind,"insurance");
  assert.equal(p.assets?.[0].grossValue,null);
  assert.equal(p.assets?.[0].recognition,"unreviewed");
});

test("translated period basis remains a period total and never invents dates or months",()=>{
  const p=projectPage(read("income_certificate","income",[field("label","가상사업"),field("amount_basis","기간 합계(증명서상 연간 귀속)"),field("net","12000000","원")]),"synthetic",1,"a".repeat(64));
  assert.equal(p.incomes?.[0].amountBasis,"period_total");
  assert.equal(p.incomes?.[0].periodStart,undefined);
  assert.equal(p.incomes?.[0].periodMonths,null);
  assert.equal(p.incomes?.[0].recurring,"unknown");
});
