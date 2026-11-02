// A2 r92 synthetic-only contract checks. No customer documents or legal approvals.
import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {projectLawgraphDocumentFields} from "../lib/lawgraph-document-field-projection.ts";

for(const months of [36,48,60]){
  const data=createCase("합성 AX 데이터계보",`SYN-A2-R92-${months}`,"2026-11-03");
  data.context.planMonths=months;
  data.facts=[];

  const run=(display:string|null,sourceFactIds:unknown,subjectId:string|null)=>{
    const rows=projectLawgraphDocumentFields({
      data,
      bindings:{scalars:{monthly_income:display},rows:{}} as any,
      calculation:{incomeRows:[],debtRows:[],assetRows:[]},
      calculationRows:[{id:"SYN-RUN:INCOME",outputName:"monthlyIncomeWon",
        subjectId,rowOrdinal:null,value:display==="0원"?"0":"1000",
        status:"computed",sourceFactIds:sourceFactIds as string[]}]
    });
    const row=rows.find(x=>x.formCode==="D5103"&&x.token==="monthly_income");
    assert.ok(row,"D5103/monthly_income must be present");
    return row;
  };

  test(`A2 r92 ${months} months: empty source IDs require review, not linked calculation`,()=>{
    const row=run("1,000원",[],null);
    assert.equal((row.citation as any).status,"lineage_review_required");
    assert.equal((row.citation as any).manualReviewRequired,true);
    assert.deepEqual(row.calcFeatureRefs,["SYN-RUN:INCOME"]);
    assert.deepEqual(row.sourceFactIds,[]);
  });

  test(`A2 r92 ${months} months: scalar must not attach a foreign subject calculation`,()=>{
    const row=run("1,000원",["SYN-FOREIGN"],"SYN-OTHER-SUBJECT");
    assert.equal((row.citation as any).status,"lineage_review_required");
    assert.deepEqual(row.calcFeatureRefs,[]);
  });

  test(`A2 r92 ${months} months: zero and unknown source remain distinct`,()=>{
    const zero=run("0원",[],null);
    assert.equal(zero.value,"0원");
    assert.equal((zero.citation as any).status,"lineage_review_required");
    const unknown=run(null,[],null);
    assert.equal(unknown.value,null);
    assert.equal((unknown.citation as any).status,"missing_value");
  });

  test(`A2 r92 ${months} months: unverified source ID preserves calculation reference for review`,()=>{
    const row=run("1,000원",["SYN-FOREIGN"],null);
    assert.equal((row.citation as any).status,"lineage_review_required");
    assert.deepEqual(row.calcFeatureRefs,["SYN-RUN:INCOME"]);
    assert.deepEqual(row.sourceFactIds,["SYN-FOREIGN"]);
  });
}
test.todo("A real accepted Fact with valid source verification must be exercised in the project runner");
test.todo("SQL run owner/version/feature evidence must be replayed against staging D1");
test.todo("D5103/D5110/D5111 DOCX ZIP/XML and lawyer approval require independent evidence");
