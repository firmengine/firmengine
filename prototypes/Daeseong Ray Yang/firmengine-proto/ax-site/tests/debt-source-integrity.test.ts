import test from "node:test";
import assert from "node:assert/strict";
import { createCase,normalizeMoney,type CaseData,type Fact,type Debt } from "../lib/domain.ts";
import { assessCase,calculateCase } from "../lib/assessment.ts";

const hash="d".repeat(64);
function fixture(options:{total?:string;cost?:string;costKey?:string;costUnit?:string|null;costValidation?:Fact["validation"];costState?:Fact["state"];costSubject?:string;costPage?:number;secondTotal?:string;retractedCost?:boolean;splitAmountSubjects?:boolean}={}){
  const data=createCase("Synthetic debt integrity","synthetic-debt-integrity","2026-10-27");
  data.documents=[{id:"doc",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1,2]}];
  const quotes:string[]=[];
  const fact=(id:string,subjectId:string,key:string,amount:string,quote:string,unit:string|null="원",extra:Partial<Fact>={})=>{
    quotes.push(quote);
    const normalized=normalizeMoney(amount,unit??"unknown");
    const row:Fact={id,logicalId:id,version:1,subjectId,key,value:amount,rawValue:amount,numeric:normalized,state:"verified",recognition:"unreviewed",refs:[{documentId:"doc",page:1,sourceHash:hash,quote}],validation:[],...extra};
    data.facts.push(row);return row.id;
  };
  const principalSubject="source-debt-row",interestSubject=options.splitAmountSubjects?"another-debt-row":principalSubject;
  const principalId=fact("principal-source",principalSubject,"debt.principal_balance","100","원금잔액 100원");
  const interestId=fact("interest-source",interestSubject,"debt.interest","20","이자 20원");
  const factIds=[principalId,interestId];
  if(options.total!==undefined)fact("total-source",principalSubject,"debt.total_claim",options.total,`총 청구액 ${options.total}원`);
  if(options.secondTotal!==undefined)fact("total-alias",principalSubject,"debt.total",options.secondTotal,`채무 총액 ${options.secondTotal}원`);
  if(options.cost!==undefined){
    const key=options.costKey??"debt.legal_costs",id="cost-source",quote=options.costUnit===null?`법률비용 ${options.cost}`:`별도 법률비용 ${options.cost}${options.costUnit??"원"}`;
    fact(id,options.costSubject??principalSubject,key,options.cost,quote,options.costUnit===undefined?"원":options.costUnit,{validation:options.costValidation??[],state:options.costState??"verified",refs:[{documentId:"doc",page:options.costPage??1,sourceHash:hash,quote}]});
    if(options.retractedCost)data.facts.push({...data.facts.find(row=>row.id===id)!,id:"cost-source-v2",version:2,supersedes:id,state:"retracted"});
  }
  data.pages=[{documentId:"doc",page:1,role:"evidence",text:quotes.join(" | ")},{documentId:"doc",page:2,role:"evidence",text:"Second source page"}];
  data.debts=[{id:"typed-debt-id-differs-from-source-row",creditor:"Synthetic creditor",contractId:"synthetic-contract",principal:normalizeMoney("100"),interest:normalizeMoney("20"),secured:"no",classification:"ordinary",priority:"ordinary",legalReview:"accepted",asOf:"2026-10-27",factIds} as Debt];
  const incomeId=fact("income-source","income-row","income.net","1000","net income 1000원");
  const householdId=fact("household-source","household-row","household.recognized_living_cost","0","recognized living cost 0원");
  data.incomes=[{id:"income-row",kind:"wage",label:"Synthetic wage",net:normalizeMoney("1000"),amountBasis:"monthly",recurring:"yes",recognition:"accepted",factIds:[incomeId]}];
  data.household={recognizedMembers:1,recognizedLivingCost:normalizeMoney("0"),livingCostIncludesAdditional:true,recognition:"accepted",factIds:[householdId]};
  Object.assign(data.context,{inventoryComplete:{income:"yes",debt:"yes",asset:"yes"},monthlyTrusteeFee:normalizeMoney("0"),monthlyPriorityPayment:normalizeMoney("0"),monthlyEstatePayment:normalizeMoney("0"),approvedMonthlyPayment:normalizeMoney("50"),planMonths:1,allocationBasis:"principal_then_interest_pro_rata",allocationBasisReviewed:true,ruleReleaseId:"synthetic",ruleApplicationReviewed:true});
  return data;
}
function addDuplicateContractSource(data:CaseData,options:{total?:string;cost?:string;costValidation?:Fact["validation"]}={}){
  const original=data.debts[0] as Debt,sourceFacts=data.facts.filter(fact=>original.factIds.includes(fact.id));
  const page2=data.pages.find(page=>page.page===2)!;
  const append=(quote:string)=>{page2.text=`${page2.text??""} | ${quote}`;};
  const page1=data.pages.find(page=>page.page===1)!;
  const duplicateFactIds:string[]=[];
  for(const source of sourceFacts.filter(fact=>fact.key.startsWith("debt.principal")||fact.key==="debt.interest")){
    const id=`duplicate-${source.id}`;duplicateFactIds.push(id);
    data.facts.push({...structuredClone(source),id,logicalId:id,subjectId:"duplicate-source-row",refs:[{...source.refs[0]!,documentId:"doc",page:2,sourceHash:hash}]});
    append(source.refs[0]!.quote);
  }
  for(const [suffix,key,value,quote] of [
    ["issuer","debt.creditor_identity_id","SYNTHETIC-ISSUER-1001","issuer identity SYNTHETIC-ISSUER-1001"],
    ["contract","debt.contract_id","synthetic-contract","contract synthetic-contract"],
  ] as const){
    const id=`duplicate-${suffix}`;duplicateFactIds.push(id);append(quote);
    data.facts.push({id,logicalId:id,version:1,subjectId:`duplicate-${suffix}-header`,key,value,state:"verified",recognition:"unreviewed",refs:[{documentId:"doc",page:2,sourceHash:hash,quote}],validation:[]});
  }
  for(const [suffix,key,value,quote] of [
    ["issuer","debt.creditor_identity_id","SYNTHETIC-ISSUER-1001","issuer identity SYNTHETIC-ISSUER-1001"],
    ["contract","debt.contract_id","synthetic-contract","contract synthetic-contract"],
  ] as const){
    const id=`primary-${suffix}`;original.factIds.push(id);page1.text=`${page1.text??""} | ${quote}`;
    data.facts.push({id,logicalId:id,version:1,subjectId:`primary-${suffix}-header`,key,value,state:"verified",recognition:"unreviewed",refs:[{documentId:"doc",page:1,sourceHash:hash,quote}],validation:[]});
  }
  if(options.total!==undefined){
    const id="duplicate-total",quote=`총 청구액 ${options.total}원`;duplicateFactIds.push(id);append(quote);
    data.facts.push({id,logicalId:id,version:1,subjectId:"duplicate-source-row",key:"debt.total_claim",value:options.total,numeric:normalizeMoney(options.total,"원"),state:"verified",recognition:"unreviewed",refs:[{documentId:"doc",page:2,sourceHash:hash,quote}],validation:[]});
  }
  if(options.cost!==undefined){
    const id="duplicate-cost",quote=`별도 법률비용 ${options.cost}원`;duplicateFactIds.push(id);append(quote);
    data.facts.push({id,logicalId:id,version:1,subjectId:"duplicate-source-row",key:"debt.legal_costs",value:options.cost,numeric:normalizeMoney(options.cost,"원"),state:"verified",recognition:"unreviewed",refs:[{documentId:"doc",page:2,sourceHash:hash,quote}],validation:options.costValidation??[]});
  }
  data.debts.push({...structuredClone(original),id:"duplicate-typed-debt",factIds:duplicateFactIds});
}
const rules={id:"synthetic",status:"source_verified" as const,sources:[],debtCaps:{unsecuredWon:"1000000000",securedWon:"1500000000",comparison:"lte" as const}};

test("same-row current source total equal to principal plus interest reconciles; equal alias observations are not false conflicts",()=>{
  const data=fixture({total:"120",secondTotal:"120"}),result=calculateCase(data,rules);
  assert.equal(result.debtRows[0].principalWon,"100");assert.equal(result.debtRows[0].interestWon,"20");
  assert.equal(result.debtRows[0].totalWon,"120");assert.equal(result.totalDebtWon,"120");assert.equal(result.unsecuredDebtWon,"120");
  assert.ok(!result.issues.some(issue=>issue.includes("DEBT_SOURCE_TOTAL")));
});

test("a source total with an explicit parenthesized unit remains reconcilable",()=>{
  const data=fixture({total:"120"});
  const total=data.facts.find(fact=>fact.id==="total-source")!;
  total.refs[0]!.quote="합계 (원) 120";
  const page=data.pages.find(item=>item.page===1)!;
  page.text=(page.text??"").replace("총 청구액 120원","합계 (원) 120");
  const result=calculateCase(data,rules);
  assert.equal(result.debtRows[0].totalWon,"120");
});

test("source total disagreement blocks row total, aggregate total, debt caps, allocations, and finalization",()=>{
  const data=fixture({total:"121"}),result=calculateCase(data,rules),assessment=assessCase(data,rules);
  assert.equal(result.debtRows[0].principalWon,"100");assert.equal(result.debtRows[0].interestWon,"20");
  assert.equal(result.debtRows[0].totalWon,null);assert.equal(result.totalDebtWon,null);
  assert.equal(result.securedDebtWon,null);assert.equal(result.unsecuredDebtWon,null);
  assert.deepEqual(result.allocations,[]);assert.ok(result.issues.includes("DEBT_SOURCE_TOTAL_CONFLICT:typed-debt-id-differs-from-source-row"));
  assert.equal(assessment.generationGate.canFinalize,false);
  assert.ok(result.traces.find(trace=>trace.id.startsWith("debt:"))?.reasons.some(reason=>reason.includes("DEBT_SOURCE_TOTAL_CONFLICT")));
});

test("nonzero separate legal or collection cost blocks even when the source total matches principal plus interest",()=>{
  for(const costKey of ["debt.legal_costs","debt.collection_costs","debt.enforcement_costs","debt.other_costs"]){
    const result=calculateCase(fixture({total:"120",cost:"5",costKey}),rules);
    assert.equal(result.debtRows[0].totalWon,null,costKey);assert.equal(result.totalDebtWon,null,costKey);
    assert.equal(result.unsecuredDebtWon,null,costKey);assert.deepEqual(result.allocations,[],costKey);
    assert.ok(result.issues.includes("DEBT_SEPARATE_COST_REQUIRES_REVIEW:typed-debt-id-differs-from-source-row"),costKey);
  }
});

test("explicit zero cost permits reconciliation, while missing cost is not invented as a separate observation",()=>{
  const zero=calculateCase(fixture({total:"120",cost:"0"}),rules);
  assert.equal(zero.debtRows[0].totalWon,"120");assert.equal(zero.totalDebtWon,"120");
  const missing=calculateCase(fixture({total:"120"}),rules);
  assert.equal(missing.debtRows[0].totalWon,"120");assert.equal(missing.totalDebtWon,"120");
});

test("uncertain, unknown-unit, negative, and source-mismatched cost slots cannot vanish when omitted from typed debt factIds",()=>{
  const cases=[
    fixture({total:"120",cost:"0",costValidation:[{code:"UNCERTAIN_READING",message:"synthetic uncertain amount",severity:"warning"}]}),
    fixture({total:"120",cost:"0",costUnit:null}),
    fixture({total:"120",cost:"-1"}),
    fixture({total:"120",cost:"0",costValidation:[{code:"FIELD_CONFLICT",message:"synthetic source conflict",severity:"error"}]}),
  ];
  for(const data of cases){
    assert.equal(data.debts[0].factIds.some(id=>id.startsWith("cost-source")),false,"unusable cost stays outside the typed factIds under test");
    const result=calculateCase(data,rules);
    assert.equal(result.debtRows[0].totalWon,null);assert.equal(result.totalDebtWon,null);
    assert.ok(result.issues.some(issue=>issue.startsWith("DEBT_SEPARATE_COST_INVALID:")));
  }
  const mismatched=fixture({total:"120",cost:"0"});
  const cost=mismatched.facts.find(fact=>fact.id==="cost-source")!;
  cost.refs[0].sourceHash="f".repeat(64);
  const result=calculateCase(mismatched,rules);
  assert.equal(result.debtRows[0].totalWon,null);assert.ok(result.issues.includes("DEBT_SEPARATE_COST_INVALID:typed-debt-id-differs-from-source-row"));
});

test("conflicting total aliases and a latest retracted cost slot block instead of falling back",()=>{
  const conflict=calculateCase(fixture({total:"120",secondTotal:"121"}),rules);
  assert.equal(conflict.debtRows[0].totalWon,null);assert.ok(conflict.issues.includes("DEBT_SOURCE_TOTAL_CONFLICT:typed-debt-id-differs-from-source-row"));
  const retracted=calculateCase(fixture({total:"120",cost:"0",retractedCost:true}),rules);
  assert.equal(retracted.debtRows[0].totalWon,null);assert.ok(retracted.issues.includes("DEBT_SEPARATE_COST_INVALID:typed-debt-id-differs-from-source-row"));
});

test("facts from another source row or page cannot be borrowed to complete a debt slot",()=>{
  const otherRow=calculateCase(fixture({total:"120",cost:"100",costSubject:"other-debt-row"}),rules);
  assert.equal(otherRow.debtRows[0].totalWon,"120");
  const otherPage=calculateCase(fixture({total:"120",cost:"100",costPage:2}),rules);
  assert.equal(otherPage.debtRows[0].totalWon,"120");
});

test("a linked total needs a same-page total quote with the exact amount and unit",()=>{
  const wrongQuote=fixture({total:"120"});
  const total=wrongQuote.facts.find(fact=>fact.id==="total-source")!;
  total.refs[0]!.quote="원금 100원, 이자 20원, 총 청구액 130원";
  const wrongQuotePage=wrongQuote.pages.find(page=>page.page===1)!;
  wrongQuotePage.text=(wrongQuotePage.text??"").replace("총 청구액 120원","원금 100원, 이자 20원, 총 청구액 130원");
  const wrongSemantics=calculateCase(wrongQuote,rules);
  assert.equal(wrongSemantics.debtRows[0].totalWon,null);
  assert.ok(wrongSemantics.issues.includes("DEBT_SOURCE_TOTAL_INVALID:typed-debt-id-differs-from-source-row"));

  const wrongUnit=fixture({total:"120"});
  const unitFact=wrongUnit.facts.find(fact=>fact.id==="total-source")!;
  unitFact.refs[0]!.quote="총 청구액 120만원";
  const wrongUnitPage=wrongUnit.pages.find(page=>page.page===1)!;
  wrongUnitPage.text=(wrongUnitPage.text??"").replace("총 청구액 120원","총 청구액 120만원");
  const unitMismatch=calculateCase(wrongUnit,rules);
  assert.equal(unitMismatch.debtRows[0].totalWon,null);
  assert.ok(unitMismatch.issues.includes("DEBT_SOURCE_TOTAL_INVALID:typed-debt-id-differs-from-source-row"));

  const principalDecoy=fixture({total:"100"});
  const decoyFact=principalDecoy.facts.find(fact=>fact.id==="total-source")!;
  decoyFact.refs[0]!.quote="원금 100원, 이자 20원, 총 청구액 120원";
  const decoyPage=principalDecoy.pages.find(page=>page.page===1)!;
  decoyPage.text=(decoyPage.text??"").replace("총 청구액 100원","원금 100원, 이자 20원, 총 청구액 120원");
  const decoy=calculateCase(principalDecoy,rules);
  assert.equal(decoy.debtRows[0].totalWon,null);
  assert.ok(decoy.issues.includes("DEBT_SOURCE_TOTAL_INVALID:typed-debt-id-differs-from-source-row"));

  const nonAdjacent=fixture({total:"100"});
  const nonAdjacentFact=nonAdjacent.facts.find(fact=>fact.id==="total-source")!;
  nonAdjacentFact.refs[0]!.quote="합계 미확인 원금 100원";
  const nonAdjacentPage=nonAdjacent.pages.find(page=>page.page===1)!;
  nonAdjacentPage.text=(nonAdjacentPage.text??"").replace("총 청구액 100원","합계 미확인 원금 100원");
  const separated=calculateCase(nonAdjacent,rules);
  assert.equal(separated.debtRows[0].totalWon,null);
  assert.ok(separated.issues.includes("DEBT_SOURCE_TOTAL_INVALID:typed-debt-id-differs-from-source-row"));
});

test("source total punctuation and explicit parenthesized unit keep exact adjacent amounts",()=>{
  for(const quote of ["합계: 120원","원리금 합계 = 120원","합계 (원) 120","합계 (단위: 원) 120"]){
    const data=fixture({total:"120"});
    const total=data.facts.find(f=>f.id==="total-source")!;
    total.refs[0].quote=quote;data.pages[0].text+=" | "+quote;
    assert.equal(calculateCase(data,rules).debtRows[0].totalWon,"120",quote);
  }
});

test("a same-subject total spanning pages is ambiguous even when one reference matches the amount row",()=>{
  const data=fixture({total:"120"});
  const total=data.facts.find(fact=>fact.id==="total-source")!;
  total.refs.push({documentId:"doc",page:2,sourceHash:hash,quote:"총 청구액 120원"});
  data.pages[1].text="총 청구액 120원";
  const result=calculateCase(data,rules);
  assert.equal(result.debtRows[0].totalWon,null);
  assert.ok(result.issues.includes("DEBT_SOURCE_TOTAL_INVALID:typed-debt-id-differs-from-source-row"));
});

test("deduplicated complete-contract source rows are checked independently for totals and costs",()=>{
  const consistent=fixture({total:"120"});addDuplicateContractSource(consistent,{total:"120"});
  const good=calculateCase(consistent,rules);
  assert.equal(good.debtRows.length,1);assert.equal(good.totalDebtWon,"120");

  const conflicting=fixture({total:"120"});addDuplicateContractSource(conflicting,{total:"121"});
  const conflict=calculateCase(conflicting,rules);
  assert.equal(conflict.debtRows.length,1);assert.equal(conflict.debtRows[0].totalWon,null);assert.equal(conflict.totalDebtWon,null);
  assert.ok(conflict.issues.includes("DEBT_SOURCE_TOTAL_CONFLICT:typed-debt-id-differs-from-source-row"));

  const uncertainCost=fixture({total:"120"});
  addDuplicateContractSource(uncertainCost,{cost:"0",costValidation:[{code:"UNCERTAIN_READING",message:"synthetic unclear duplicate-row cost",severity:"warning"}]});
  const blockedCost=calculateCase(uncertainCost,rules);
  assert.equal(blockedCost.debtRows.length,1);assert.equal(blockedCost.debtRows[0].totalWon,null);
  assert.ok(blockedCost.issues.includes("DEBT_SEPARATE_COST_INVALID:typed-debt-id-differs-from-source-row"));
});

test("reviewed excluded rows with unresolved costs do not block included-row caps or allocation",()=>{
  const data=fixture({cost:"5",retractedCost:true});
  Object.assign(data.debts[0],{excludedByReview:true,exclusionReason:"Synthetic reviewed exclusion"});
  const row=structuredClone(data.debts[0]) as Debt;
  row.id="included-debt";row.contractId="separate-contract";row.principal=normalizeMoney("200");row.interest=normalizeMoney("30");row.excludedByReview=false;row.exclusionReason=undefined;
  row.factIds=[];
  const sourceSubject="included-source-row",page=data.pages.find(item=>item.page===2)!;
  const addAmount=(id:string,key:string,amount:string,quote:string)=>{
    page.text=`${page.text??""} | ${quote}`;
    data.facts.push({id,logicalId:id,version:1,subjectId:sourceSubject,key,value:amount,numeric:normalizeMoney(amount,"원"),state:"verified",recognition:"unreviewed",refs:[{documentId:"doc",page:2,sourceHash:hash,quote}],validation:[]});
    row.factIds.push(id);
  };
  addAmount("included-principal","debt.principal_balance","200","원금잔액 200원");
  addAmount("included-interest","debt.interest","30","이자 30원");
  addAmount("included-total","debt.total_claim","230","총 청구액 230원");
  data.debts.push(row);
  Object.assign(data.context,{asOf:data.context.applicationDate,allocationBasis:"principal_then_interest_pro_rata",allocationBasisReviewed:true});
  const result=calculateCase(data,rules);
  assert.equal(result.debtRows.find(debt=>debt.id==="included-debt")?.totalWon,"230");
  assert.equal(result.unsecuredDebtWon,"230");
  assert.equal(result.allocations.length,1);assert.equal(result.allocations[0]?.debtId,"included-debt");
  assert.ok(result.issues.some(issue=>issue.startsWith("DEBT_SEPARATE_COST_INVALID:")));
});

test("principal and interest linked to different source rows are not assembled into a synthetic debt total",()=>{
  const result=calculateCase(fixture({splitAmountSubjects:true,total:"120"}),rules);
  assert.equal(result.debtRows[0].totalWon,null);assert.ok(result.issues.includes("DEBT_SOURCE_ROW_IDENTITY_AMBIGUOUS:typed-debt-id-differs-from-source-row"));
});
