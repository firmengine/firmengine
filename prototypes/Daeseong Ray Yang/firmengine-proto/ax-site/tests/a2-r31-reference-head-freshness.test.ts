import test from "node:test";
import assert from "node:assert/strict";
import {isCalculationHeadStale} from "../lib/calculation-head-freshness.ts";

/** Synthetic reference labels only; never treat a reference comparison as legal approval. */
const A="a".repeat(64),B="b".repeat(64);
const current={data_version:4,revision:7};
const head={data_version:4,case_revision:7,reference_sha256:B};
test("matching case/source/reference is not stale",()=>assert.equal(isCalculationHeadStale(head,current,B),false));
test("old reference with identical case revision and source version is stale",()=>assert.equal(isCalculationHeadStale({...head,reference_sha256:A},current,B),true));
test("active reference change without source update is stale",()=>assert.equal(isCalculationHeadStale(head,current,A),true));
test("case revision change is stale",()=>assert.equal(isCalculationHeadStale(head,{...current,revision:8},B),true));
test("source version change is stale",()=>assert.equal(isCalculationHeadStale(head,{...current,data_version:5},B),true));
test("SQL NULL data version is not a valid current version",()=>assert.equal(isCalculationHeadStale(head,{...current,data_version:null},B),true));
test("zero source version stays distinguishable from SQL NULL",()=>{
  assert.equal(isCalculationHeadStale({...head,data_version:0},{data_version:0,revision:7},B),false);
  assert.equal(isCalculationHeadStale({...head,data_version:0},{data_version:null,revision:7},B),true);
});
test("no persisted head does not fabricate a stale head",()=>assert.equal(isCalculationHeadStale(null,current,B),false));
