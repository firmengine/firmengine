import test from "node:test";
import assert from "node:assert/strict";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {buildFeatureLineageAudit} from "../lib/feature-lineage-audit.ts";

const audit=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,"a".repeat(64),{limit:1000});
const byId=new Map(audit.fields.map(row=>[row.canonicalFieldId,row]));
const find=(id:string)=>{const row=byId.get(id);assert.ok(row,id);return row;};

test("11 crypto transaction extensions routed by bank_transactions retain specialist review candidate",()=>{
  const ids=[
    "asset_symbol","completed_at","counterparty_account_identity","crypto_event_kind",
    "destination_address","fee_asset","fee_quantity","gross_trade_amount",
    "network","quantity","quote_currency"
  ];
  for(const key of ids){
    const id="crypto_transactions::"+key;
    const row=find(id);
    assert.ok(row.familyIds.includes("bank_transactions"),id);
    assert.ok(row.legal.referenceReviewCandidates.includes("SEOUL-408"),id);
    assert.equal(row.legal.approvalInferred,false,id);
    assert.equal(row.typedProjections.length,0,id);
    assert.ok(!row.forms.some(f=>!!f.token),id);
  }
});

test("ordinary fiat bank transactions do not gain crypto-specific legal review candidate",()=>{
  for(const id of ["bank_transactions::amount","bank_transactions::direction","bank_transactions::counterparty"]){
    assert.ok(!find(id).legal.referenceReviewCandidates.includes("SEOUL-408"),id);
  }
});

test("crypto source observations never promote trade amount or fee to confirmed calculator or eform token",()=>{
  for(const id of ["crypto_transactions::gross_trade_amount","crypto_transactions::fee_quantity","crypto_transactions::quantity"]){
    const row=find(id);
    assert.equal(row.calculations.length,0,id);
    assert.equal(row.legal.legalRequiredness,"case_condition_and_court_review_needed",id);
    assert.equal(row.blockerPolicy.unobserved,"not_observed_not_zero_or_inapplicable",id);
  }
});
