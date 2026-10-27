import test from "node:test";
import assert from "node:assert/strict";
import { applyExtraction,createCase,DRAFT_RULESET } from "../lib/domain.ts";
import { projectPage,type ReadField,type PageRead } from "../lib/extraction.ts";
import { calculateCase } from "../lib/assessment.ts";
import { buildFormBindings,MISSING_FORM_VALUE } from "../lib/form-mapping.ts";
import { buildCourtPackage } from "../lib/exports.ts";

const hash="f".repeat(64);
const f=(key:string,value:string,unit:string|null=null):ReadField=>({key,label:key,value,unit,quote:key==="gross_value"?`해약환급금 ${value}${unit??""}`:`${key} ${value}`,confidence:"clear",bbox:null});
function fixture(conflicting=false){
  let data=createCase("Synthetic output linkage","synthetic-output","2026-10-27");
  data.documents=[{id:"evidence",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1,2]}];
  for(const page of [1,2]){
    const read:PageRead={documentType:"insurance",complete:true,warnings:[],records:[{category:"asset",label:"합성 보험",fields:[f("kind","insurance"),f("label","합성 보험"),f("policy_number","SYNTHETIC-POLICY-1234"),f("issuer_identity_id","ISSUER-1001"),f("owner_identity_id","OWNER-2002"),f("insurer","합성 보험사"),f("gross_value",conflicting&&page===2?"5000":"4000","원"),f("as_of",conflicting&&page===2?"2026-09-30":"2026-10-27"),f("ownership_bps","10000"),f("valuation_basis","합성 환급 증명"),f("secured_payoff","0","원"),f("disposal_costs","0","원"),f("protected_value","0","원")]}]};
    data.pages.push({documentId:"evidence",page,role:"evidence",imageUrl:`/synthetic/${page}.png`,text:read.records[0].fields.map(x=>x.quote).join("\n")});
    data=applyExtraction(data,projectPage(read,"evidence",page,hash));
  }
  data.context.inventoryComplete.asset="yes";
  return data;
}

test("공식 서식·Office 부록·계산이 동일하게 확인된 중복 자산을 한 번만 표시한다",()=>{
  const data=fixture(),calc=calculateCase(data,DRAFT_RULESET),bindings=buildFormBindings(data,calc),pack=buildCourtPackage(data,DRAFT_RULESET);
  assert.equal(data.assets.length,2,"source observations remain in the ledger");
  assert.equal(calc.assetRows.length,1);
  assert.equal(bindings.rows.asset.length,1);
  assert.equal(bindings.rows.asset[0].institution,"합성 보험사");
  assert.equal(bindings.rows.asset[0].account_number,"SYNTHETIC-POLICY-1234");
  assert.equal(bindings.scalars.insurance_surrender,"4,000");
  assert.equal(pack.documents.find(d=>d.kind==="assets")?.tables[0].rows.length,1);
  assert.equal(pack.workbook.find(s=>s.name==="재산청산가치")?.rows.length,2);
});

test("같은 자산의 상충하는 평가일·금액을 서식 집계에서 합산하거나 임의 선택하지 않는다",()=>{
  const data=fixture(true),calc=calculateCase(data,DRAFT_RULESET),bindings=buildFormBindings(data,calc);
  assert.equal(calc.assetRows.length,2);
  assert.equal(calc.liquidationValueWon,null);
  assert.equal(bindings.rows.asset.length,2);
  assert.equal(bindings.scalars.insurance_surrender,MISSING_FORM_VALUE);
});
