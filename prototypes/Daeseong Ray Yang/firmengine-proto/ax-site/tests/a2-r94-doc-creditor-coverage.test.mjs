import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentPreflight } from "../lib/document-preflight.ts";

// Public synthetic-only reviewer fixture. Never a court-approved document.
const identity = {evaluationId:"SYN-R94",evaluationResultHash:"SYN-HASH",referenceBundleHash:"SYN-REF",templateHash:"SYN-TEMPLATE",documentEditsHash:"SYN-EDITS"};
const creditorContract = {code:"D5106",title:"SYN creditor contract",templateVersion:"synthetic",templateHash:"SYN-TEMPLATE",approvalStatus:"reviewer_pending",reconstruction:true,limitations:"synthetic reviewer test only",fields:[],repeatGroups:[{id:"creditor",fields:["principal","interest"],identitySource:"SYN-debtId"}]};
const nonCreditorContract = {...creditorContract,code:"D5103",repeatGroups:[]};
const fixture=(totals,rows=[],isCreditorForm=true)=>({
  formCode:isCreditorForm?"D5106":"D5103",
  bindings:{scalars:{total_principal:totals[0],total_interest:totals[1]},rows:{creditor:rows}},
  identity,contract:isCreditorForm?creditorContract:nonCreditorContract
});
const cases=[
 ["positive principal without any creditor row",fixture(["1,200원","0"]), "REPEAT_ROW_CREDITOR_COVERAGE_MISSING"],
 ["positive interest without any creditor row",fixture(["0","35"]), "REPEAT_ROW_CREDITOR_COVERAGE_MISSING"],
 ["negative unexpected debt total without creditor row",fixture(["-1","0"]), "REPEAT_ROW_CREDITOR_COVERAGE_MISSING"],
 ["explicit zero without claim",fixture(["0원","0원"]), null],
 ["unobserved total not silently treated as zero",fixture(["[확인 필요]","[확인 필요]"]), null],
 ["form without creditor repeat group",fixture(["100","0"],[],false), null],
 ["one matching creditor",fixture(["1,200원","0"],[{principal:"1,200원",interest:"0"}]), null],
 ["two matching creditors, 300+900=1200 and 5+7=12",fixture(["1,200","12"],[{principal:"300",interest:"5"},{principal:"900",interest:"7"}]), null],
 ["two creditors, 1200 != 1201",fixture(["1,201","12"],[{principal:"300",interest:"5"},{principal:"900",interest:"7"}]),"REPEAT_ROW_TOTAL_MISMATCH"],
 ["malformed creditor amount from parent PR r88",fixture(["120","0"],[{principal:"1,20",interest:"0"}]),"REPEAT_ROW_AMOUNT_FORMAT_INVALID"],
 ["unobserved interest is not explicit zero",fixture(["0","0"],[{principal:"0",interest:"[미관찰]"}]),"REPEAT_ROW_AMOUNT_FORMAT_INVALID"]
];
for(const [name,entry,requiredCode] of cases){
  test("A2 r94 final: "+name,async()=>{
    const result=await evaluateDocumentPreflight({...entry,mode:"final"});
    const codes=result.blockers.map(issue=>issue.code);
    if(requiredCode)assert.ok(codes.includes(requiredCode),JSON.stringify({name,codes}));
    else assert.deepEqual(codes,[],name);
    if(requiredCode)assert.equal(result.status,"blocked");
  });
}
for(const index of [0,1,2]){
  const [name,entry]=cases[index];
  test("A2 r94 draft warning only: "+name,async()=>{
    const result=await evaluateDocumentPreflight({...entry,mode:"draft"});
    assert.ok(result.warnings.some(issue=>issue.code==="REPEAT_ROW_CREDITOR_COVERAGE_MISSING"));
    assert.ok(!result.blockers.some(issue=>issue.code==="REPEAT_ROW_CREDITOR_COVERAGE_MISSING"));
  });
}
test.todo("integration: independently replay actual Fact/typed/SQL case owner and run identity (no synthetic acceptance)");
test.todo("integration: generate and reopen actual D5106/D5110/D5111 DOCX and count rendered creditor rows");
test.todo("legal: lawyer and document reviewer sign off statutory and court-form applicability before final");
