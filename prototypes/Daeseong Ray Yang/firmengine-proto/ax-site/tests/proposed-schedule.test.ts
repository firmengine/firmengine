import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, DRAFT_RULESET } from "../lib/domain.ts";
import type { CaseData } from "../lib/domain.ts";
import { calculateCase } from "../lib/assessment.ts";
import { buildCourtPackage } from "../lib/exports.ts";
import { proposedInstallmentAnnex } from "../lib/document-annexes.ts";

function fixture():CaseData {
  const data=createCase("Synthetic schedule only","synthetic-schedule","2026-10-27");
  data.documents=[{id:"doc",name:"synthetic.pdf",sha256:"a".repeat(64),status:"active",pages:[1]}];
  data.pages=[{documentId:"doc",page:1,role:"evidence",text:"Quoted synthetic creditor claim principal interest"}];
  const fact=(id:string,key:string)=>{data.facts.push({id,logicalId:id,version:1,subjectId:"debt-a",key,value:"quoted synthetic",state:"extracted",recognition:"unreviewed",refs:[{documentId:"doc",page:1,quote:"Quoted synthetic creditor claim principal interest"}],validation:[]});return id;};
  data.debts=[{id:"debt-a",contractId:"contract-a",creditor:"Synthetic Creditor A",principal:normalizeMoney("100"),interest:normalizeMoney("20"),secured:"no",classification:"ordinary",priority:"ordinary",asOf:data.context.asOf,factIds:[fact("p","debt.principal"),fact("i","debt.interest")]}];
  data.context.inventoryComplete.debt="yes";
  data.context.planMonths=2;
  data.context.approvedMonthlyPayment=normalizeMoney("30");
  data.context.allocationBasis="principal_then_interest_pro_rata";
  data.context.allocationBasisReviewed=false;
  return data;
}

test("explicit term, payment and complete ordinary allocation produce a date-unknown proposal with exact totals",()=>{
  const data=fixture(),calc=calculateCase(data,DRAFT_RULESET),table=proposedInstallmentAnnex(data,calc);
  assert.equal(table.status,"blocked","proposal is never marked approved or final");
  assert.equal(table.rows.length,2);
  assert.deepEqual(table.rows.map(row=>row[1]),["[확인 필요]","[확인 필요]"]);
  assert.deepEqual(table.rows.map(row=>row[6]),["30","30"]);
  assert.deepEqual(table.summary?.rows.filter(row=>row[0].startsWith("회차 ")).map(row=>row[2]),["30","30"]);
  assert.ok(table.notes.some(note=>note.includes("승인")));
});

test("remainder distribution keeps each exact monthly budget across multiple creditors and both components",()=>{
  const data=fixture();
  data.debts.push({...data.debts[0]!,id:"debt-b",contractId:"contract-b",creditor:"Synthetic Creditor B",principal:normalizeMoney("100"),interest:normalizeMoney("20"),factIds:[...data.debts[0]!.factIds]});
  const table=proposedInstallmentAnnex(data,calculateCase(data,DRAFT_RULESET));
  assert.equal(table.rows.length,4);
  assert.deepEqual(table.summary?.rows.filter(row=>row[0].startsWith("회차 ")).map(row=>row[2]),["30","30"]);
  assert.deepEqual(table.rows.map(row=>row[3]).sort(),["Synthetic Creditor A","Synthetic Creditor A","Synthetic Creditor B","Synthetic Creditor B"]);
});

test("missing term or explicit monthly amount does not invent a schedule",()=>{
  const data=fixture(),calc=calculateCase(data,DRAFT_RULESET);
  data.context.planMonths=null;
  assert.equal(proposedInstallmentAnnex(data,calculateCase(data,DRAFT_RULESET)).rows.length,0);
  data.context.planMonths=2;
  data.context.approvedMonthlyPayment=null;
  const table=proposedInstallmentAnnex(data,calculateCase(data,DRAFT_RULESET));
  assert.equal(table.rows.length,0);
  assert.ok(table.notes.some(note=>note.includes("EXPLICIT_POSITIVE_MONTHLY_PAYMENT_REQUIRED")));
});

test("mixed secured or priority claims block automatic pro-rata into ordinary creditors",()=>{
  const data=fixture();
  data.debts.push({...data.debts[0]!,id:"secured",contractId:"secured-contract",creditor:"Synthetic Secured",secured:"yes",classification:"secured",priority:"ordinary",principal:normalizeMoney("50"),interest:normalizeMoney("0"),factIds:[data.debts[0]!.factIds[0]]});
  data.debts.push({...data.debts[0]!,id:"priority",contractId:"priority-contract",creditor:"Synthetic Priority",secured:"no",classification:"tax",priority:"priority",principal:normalizeMoney("10"),interest:normalizeMoney("0"),factIds:[data.debts[0]!.factIds[0]]});
  const table=proposedInstallmentAnnex(data,calculateCase(data,DRAFT_RULESET));
  assert.equal(table.rows.length,0);
  assert.ok(table.notes.includes("생성 보류: SEPARATE_CLAIM_ALLOCATION_REQUIRED"));
});

test("manual phases take precedence and are preserved by export",()=>{
  const data=fixture();
  data.context.paymentSchedule={reviewed:true,reviewReason:"Synthetic reviewer entry",expectedInstallments:1,phases:[{id:"manual",firstInstallment:1,lastInstallment:1,monthlyAvailableWon:"30",allocations:[{creditorId:"debt-a",principalWon:"30",interestWon:"0"}]}]};
  const doc=buildCourtPackage(data,DRAFT_RULESET).documents.find(item=>item.kind==="repayment_schedule");
  assert.equal(doc?.title,"변제예정액표 (검토 기록 있음)");
  assert.equal(doc?.tables[0].rows[0][6],"manual");
  assert.ok(!doc?.title.includes("자동 계산"));
});
