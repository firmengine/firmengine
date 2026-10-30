import test from "node:test";
import assert from "node:assert/strict";
import {createCase,normalizeMoney} from "../lib/domain.ts";
import {invalidateWithdrawnDocumentEvidence} from "../lib/document-evidence-cascade.ts";

function caseData(){
  return createCase("Synthetic A1 source cascade","a1-source-cascade","2026-10-30");
}

test("page reclassification removes the withdrawn income source but preserves amounts and surviving evidence for manual review",()=>{
  const data=caseData();
  data.incomes=[{id:"income-1",kind:"wage",label:"synthetic wage",net:normalizeMoney("100","원"),recognition:"accepted",factIds:["old-fact","other-fact"]}];
  const affected=invalidateWithdrawnDocumentEvidence(data,["old-fact"]);
  assert.equal(affected.length,1);
  assert.equal(affected[0]?.collection,"incomes");
  assert.equal(affected[0]?.previousRecognition,"accepted");
  assert.deepEqual(affected[0]?.remainingFactIds,["other-fact"]);
  assert.deepEqual(data.incomes[0]?.factIds,["other-fact"]);
  assert.equal(data.incomes[0]?.recognition,"unreviewed");
  assert.equal(data.incomes[0]?.net?.amountWon,"100");
});

test("whole document withdrawal revokes approved debt treatment without mutating unrelated creditors",()=>{
  const data=caseData();
  data.debts=[
    {id:"debt-1",creditor:"synthetic creditor A",principal:normalizeMoney("100","원"),secured:"unknown",classification:"unknown",legalReview:"accepted",factIds:["old-fact"]},
    {id:"debt-2",creditor:"synthetic creditor B",principal:normalizeMoney("200","원"),secured:"unknown",classification:"unknown",legalReview:"accepted",factIds:["different-document"]}
  ];
  const affected=invalidateWithdrawnDocumentEvidence(data,["old-fact"]);
  assert.equal(affected.length,1);
  assert.equal(data.debts[0]?.legalReview,"unreviewed");
  assert.deepEqual(data.debts[0]?.factIds,[]);
  assert.equal(data.debts[0]?.principal?.amountWon,"100");
  assert.equal(data.debts[1]?.legalReview,"accepted");
  assert.deepEqual(data.debts[1]?.factIds,["different-document"]);
});

test("household approval is downgraded and historical case amounts are retained",()=>{
  const data=caseData();
  data.household.recognition="accepted";
  data.household.factIds=["withdrawn-family","independent-family"];
  const targets=invalidateWithdrawnDocumentEvidence(data,["withdrawn-family"]);
  assert.equal(targets[0]?.collection,"household");
  assert.equal(data.household.recognition,"unreviewed");
  assert.deepEqual(data.household.factIds,["independent-family"]);
});

test("two withdrawn facts in one typed object produce one deduplicated review target",()=>{
  const data=caseData();
  data.incomes=[{id:"income-1",kind:"wage",label:"synthetic",recognition:"accepted",factIds:["fact-A","fact-B","fact-B"]}];
  const results=invalidateWithdrawnDocumentEvidence(data,["fact-A","fact-B"]);
  assert.equal(results.length,1);
  assert.deepEqual(results[0]?.withdrawnFactIds,["fact-A","fact-B"]);
  assert.deepEqual(data.incomes[0]?.factIds,[]);
  assert.equal(invalidateWithdrawnDocumentEvidence(data,["fact-A","fact-B"]).length,0);
});

test("withdrawn source-only facts remain history, but cannot silently preserve an inventory-complete claim",()=>{
  const data=caseData();
  data.context.inventoryComplete={income:"yes",debt:"yes",asset:"yes"};
  const results=invalidateWithdrawnDocumentEvidence(data,["source-only-evidence"]);
  assert.deepEqual(results,[]);
  assert.deepEqual(data.context.inventoryComplete,{income:"unknown",debt:"unknown",asset:"unknown"});
});
