import test from "node:test";
import assert from "node:assert/strict";
import { createCase,factHasValidStructuredRefs } from "../lib/domain.ts";
import { buildLegalReviewPacket,currentCompletedLegalCheckIds,gateLegalReviewChecks,legalCheckCoverageComplete,LEGAL_REVIEW_BATCH_SIZE,LEGAL_REVIEW_PACKET_CHAR_BUDGET,type LegalReviewRisk } from "../lib/legal-review-packet.ts";
import type { Fact } from "../lib/domain.ts";
import type { Finding } from "../lib/assessment.ts";
import { scanTransactions } from "../lib/transaction-review.ts";

const risk=(id:string,feature:string):LegalReviewRisk=>({id,title:`Synthetic ${id}`,conditions:"Source-backed condition",features:[feature],request:"Synthetic evidence request",legalRuleIds:["rule-1"],manual:true});
function fact(id:string,key:string,value:string,state:Fact["state"]="verified",recognition:Fact["recognition"]="accepted"):Fact{return {id,logicalId:id,version:1,subjectId:`subject-${id}`,key,value,state,recognition,refs:[{documentId:"doc",page:1,quote:`Synthetic quote ${id} `.repeat(20)}],validation:[]};}
const gate=(input:Omit<Parameters<typeof gateLegalReviewChecks>[0],"eligibleFactIds">&{eligibleFactIds?:Set<string>})=>gateLegalReviewChecks({...input,eligibleFactIds:input.eligibleFactIds??new Set(input.providedFacts.map(item=>item.id))});

test("check-specific coverage ignores the packet-wide incomplete marker and rejects only missing relevant evidence",()=>{
  const check=risk("risk-priority","debt.priority"),coverage={complete:false,featureCounts:{"risk-priority:debt.priority":{total:1,provided:1,omitted:0,axisFallbackProvided:0}},checkRules:{"risk-priority":{total:1,provided:1,omitted:0}},checkGuidance:{"risk-priority":{total:0,provided:0,omitted:0}},inventoryRowsOmitted:{debts:0},truncatedFactIdsByCheck:{"risk-priority":[]},truncatedRuleIdsByCheck:{"risk-priority":[]},truncatedGuidanceIdsByCheck:{"risk-priority":[]},truncatedCheckIds:[]};
  assert.equal(legalCheckCoverageComplete(check,coverage),true);
  assert.equal(legalCheckCoverageComplete(check,{...coverage,featureCounts:{...coverage.featureCounts,"risk-priority:debt.priority":{total:2,provided:1,omitted:1,axisFallbackProvided:0}}}),false);
});

test("data-only legal review keeps JSON source provenance and scenario assumptions visible",()=>{
  const data=createCase("Synthetic data-only review","synthetic-json-review","2026-10-29");
  const source=fact("json-cost","household.recognized_living_cost","1550000","reported","unreviewed");
  source.refs=[];source.structuredRefs=[{sourceRecordId:"hypothesis",jsonPointer:"/cost/value"}];
  data.facts=[source];data.structuredTest={mode:"assumed_extracted_synthetic",sourceRecords:[{id:"hypothesis",recordType:"hypothetical_assumption",recordId:source.subjectId,data:{cost:{fieldId:source.key,presence:"present",value:source.value}}}]};
  const packet=buildLegalReviewPacket({data,facts:data.facts,checks:[risk("living-cost",source.key)],rules:[],guidance:[],findings:[],transactionReview:scanTransactions(data)});
  const row=packet.payload.providedFacts[0];
  assert.equal(row.evidenceMode,"assumed_extracted_synthetic");assert.deepEqual(row.refs,[]);
  assert.deepEqual(row.structuredRefs,[{sourceRecordId:"hypothesis",jsonPointer:"/cost/value",recordType:"hypothetical_assumption"}]);
  assert.equal(row.recognition,"unreviewed");assert.equal(data.documents.length,0);
});

test("legal gating accepts only upstream validated structured citations and keeps review state as the clearance gate",()=>{
  const data=createCase("Synthetic structured citation gate","structured-citation-gate","2026-10-29"),check=risk("living-cost", "household.recognized_living_cost");
  const source=fact("json-cost",check.features[0],"1550000","reported","unreviewed");source.refs=[];source.structuredRefs=[{sourceRecordId:"row-1",jsonPointer:"/cost/value"}];
  data.structuredTest={mode:"assumed_extracted_synthetic",sourceRecords:[{id:"row-1",recordType:"hypothetical_assumption",recordId:source.subjectId,data:{cost:{fieldId:source.key,presence:"present",value:source.value}}}]};
  const packet=buildLegalReviewPacket({data,facts:[source],checks:[check],rules:[{id:"rule-1",title:"rule"}],guidance:[],findings:[],transactionReview:null});
  const response=[{id:check.id,status:"pass",reason:"synthetic",factIds:[source.id],ruleIds:["rule-1"],missingDocuments:[],nextAction:""}],validCoverage=packet.coverage;
  assert.equal(factHasValidStructuredRefs(data,source),true);
  const validated=gateLegalReviewChecks({batch:[check],response,providedFacts:[source],eligibleFactIds:new Set(factHasValidStructuredRefs(data,source)?[source.id]:[]),validRuleIds:new Set(["rule-1"]),coverage:validCoverage})[0];
  assert.deepEqual(validated.factIds,[source.id],"validated structured citation survives the citation gate");
  assert.equal(validated.status,"missing","unreviewed synthetic facts cannot clear a check");
  const invalid={...source,structuredRefs:[{sourceRecordId:"unknown",jsonPointer:"/cost/value"}]};
  assert.equal(factHasValidStructuredRefs(data,invalid),false);
  const rejected=gateLegalReviewChecks({batch:[check],response,providedFacts:[invalid],eligibleFactIds:new Set(factHasValidStructuredRefs(data,invalid)?[invalid.id]:[]),validRuleIds:new Set(["rule-1"]),coverage:validCoverage})[0];
  assert.deepEqual(rejected.factIds,[]);
});

test("legal review packet bounds large advisory context and reports omitted coverage without mutating full case evidence",()=>{
  const data=createCase("Synthetic large review","synthetic-review","2026-10-27");
  data.facts=Array.from({length:1200},(_,i)=>fact(`fact-${i}`,i%3===0?"debt.classification":i%3===1?"asset.ownership":"income.kind",`synthetic-${i}`));
  data.debts=Array.from({length:1000},(_,i)=>({id:`debt-${i}`,factIds:[`fact-${i}`]} as any));
  const findings:Finding[]=Array.from({length:3189},(_,i)=>({id:`finding-${i}`,category:"legal_review",severity:"warning",outcome:"review_required",title:`Finding ${i}`,detail:"Synthetic deterministic finding",factIds:[`fact-${i%1200}`],ruleSourceIds:[]}));
  const checks=[risk("risk-debt","debt.classification"),risk("risk-assets","asset.ownership"),risk("risk-income","income.kind"),risk("risk-other-1","transaction.counterparty"),risk("risk-other-2","household.members"),risk("risk-other-3","case.prior_proceedings")];
  const before=[data.facts.length,data.debts.length,findings.length];
  const transactionReview=scanTransactions(data);
  const packet=buildLegalReviewPacket({data,facts:data.facts,checks,rules:[{id:"rule-1",title:"Synthetic rule",source_url:"https://example.invalid",effective_date:"2026-01-01"}],guidance:Array.from({length:40},(_,i)=>({id:`guidance-${i}`,trigger:"Synthetic".repeat(1000),ruleIds:["rule-1"]})),findings,transactionReview});
  assert.equal(checks.length,LEGAL_REVIEW_BATCH_SIZE);
  assert.ok(packet.text.length<=LEGAL_REVIEW_PACKET_CHAR_BUDGET);
  assert.equal(packet.coverage.complete,false);
  assert.equal(packet.coverage.absenceIsNotNegativeEvidence,true);
  assert.equal(packet.coverage.totalCurrentFacts,1200);
  assert.ok(packet.coverage.omittedRelevantFactCount>0);
  assert.equal(packet.coverage.deterministicFindingCount,3189);
  assert.ok(packet.coverage.omittedFindingCount>3000);
  assert.equal(packet.coverage.omittedGuidanceCount,32);
  assert.equal(packet.payload.transactionReview.coverage.state,"unknown");
  assert.equal(packet.payload.transactionReview.coverage.unresolvedRowCount,0);
  assert.equal(packet.payload.transactionReview.coverage.completePeriodProven,false);
  assert.equal(packet.payload.transactionReview.totals.scope,"supplied_rows_only");
  assert.ok(packet.payload.transactionReview.items.some((item:any)=>item.id==="transactions-coverage"));
  assert.equal(packet.payload.inventoryCounts.debts,1000);
  assert.ok(packet.payload.inventory.debts.length<=10);
  assert.equal(packet.payload.transactionReview.complete,false);
  assert.deepEqual([data.facts.length,data.debts.length,findings.length],before,"packet building does not reduce full source facts, inventories, or deterministic findings");
});

test("only well-formed checks from the exact input, reference release, and engine contract suppress a paid review batch",()=>{
  const receipt={inputSha256:"a".repeat(64),referenceSha256:"b".repeat(64),contractVersion:"1.1.0"},expected=new Set(["risk-current"]),check={id:"risk-current",status:"missing",reason:"reviewed",factIds:[],ruleIds:[],missingDocuments:[],nextAction:""};
  const row=(calculatorExecution:unknown,checks:unknown=[check])=>({payload:JSON.stringify({calculatorExecution,checks})}),base={inputSha256:receipt.inputSha256,referenceRelease:{sha256:receipt.referenceSha256},contractVersion:receipt.contractVersion};
  const completed=currentCompletedLegalCheckIds([
    row({...base,referenceRelease:{sha256:"c".repeat(64)}}),
    row({...base,contractVersion:"1.0.0"}),
    {payload:"not-json"},
    row(base,[{...check,id:"obsolete-risk"}]),
    row(base,[{...check,status:"unexpected"}]),
    row(base),
  ],receipt,expected);
  assert.deepEqual([...completed], ["risk-current"]);
  const excludesOldReference=currentCompletedLegalCheckIds([row({...base,referenceRelease:{sha256:"c".repeat(64)}})],receipt,expected);
  assert.equal(excludesOldReference.has("risk-current"),false,"same input hash cannot let an old-reference result suppress a fresh review");
});

test("exact required-feature facts outrank namespace fallback and fallback evidence never completes a feature",()=>{
  const data=createCase("Synthetic feature matching","synthetic-review-match","2026-10-27"),checks=[risk("priority","debt.priority")];
  const facts=[fact("classification","debt.classification","ordinary"),fact("contract","debt.contract_id","contract-1"),fact("priority","debt.priority","ordinary")];
  const packet=buildLegalReviewPacket({data,facts,checks,rules:[{id:"rule-1",title:"rule"}],guidance:[],findings:[],transactionReview:null});
  assert.ok(packet.providedFactIds.includes("priority"));
  assert.equal(packet.coverage.featureCounts["priority:debt.priority"].total,1);
  assert.equal(packet.coverage.featureCounts["priority:debt.priority"].axisFallbackProvided,0);
  const fallback=buildLegalReviewPacket({data,facts:facts.filter(item=>item.id!=="priority"),checks,rules:[{id:"rule-1",title:"rule"}],guidance:[],findings:[],transactionReview:null});
  assert.equal(fallback.coverage.featureCounts["priority:debt.priority"].total,0);
  assert.equal(fallback.coverage.featureCounts["priority:debt.priority"].axisFallbackProvided,2);
  const gated=gate({batch:checks,response:[{id:"priority",status:"pass",reason:"fallback cannot prove priority",factIds:["classification"],ruleIds:["rule-1"],missingDocuments:[],nextAction:""}],providedFacts:facts.filter(item=>item.id==="classification"),validRuleIds:new Set(["rule-1"]),coverage:fallback.coverage});
  assert.equal(gated[0].status,"missing");
});

test("plural inventory omission counts block a pass for the matching inventory scope",()=>{
  const check=risk("debt-inventory","debt.classification"),source=fact("debt-fact","debt.classification","ordinary");
  const gated=gate({batch:[check],response:[{id:check.id,status:"pass",reason:"synthetic",factIds:[source.id],ruleIds:["rule-1"],missingDocuments:[],nextAction:""}],providedFacts:[source],validRuleIds:new Set(["rule-1"]),coverage:{featureCounts:{[`${check.id}:debt.classification`]:{total:1,provided:1,omitted:0,axisFallbackProvided:0}},checkRules:{[check.id]:{total:1,provided:1,omitted:0}},checkGuidance:{[check.id]:{total:0,provided:0,omitted:0}},inventoryRowsOmitted:{incomes:0,debts:17,assets:0,transactions:0}}});
  assert.equal(gated[0].status,"missing");
});

test("truncated fact and legal rule text cannot support pass, and boolean negatives stay boolean",()=>{
  const data=createCase("Synthetic truncation gate","synthetic-review-truncation","2026-10-27"),check=risk("truncation","debt.classification"),longFact=fact("long-fact","debt.classification","A qualification may follow. ".repeat(40));check.features.push("debt.priority");
  const noFact=fact("negative-fact","debt.priority","no");noFact.value=false;
  const nullFact=fact("null-fact","debt.priority","unknown");nullFact.value=null;
  const packet=buildLegalReviewPacket({data,facts:[longFact,noFact,nullFact],checks:[check],rules:[{id:"rule-1",title:"Synthetic rule",condition:"Condition detail ".repeat(50),effect:"Effect"}],guidance:[],findings:[],transactionReview:null});
  assert.ok(packet.coverage.truncatedFactIdsByCheck[check.id].includes(longFact.id));
  assert.ok(packet.coverage.truncatedRuleIdsByCheck[check.id].includes("rule-1"));
  assert.equal(packet.payload.providedFacts.find((item:any)=>item.id===noFact.id).value,false);
  assert.equal(packet.payload.providedFacts.find((item:any)=>item.id===nullFact.id).value,null);
  const gated=gate({batch:[check],response:[{id:check.id,status:"pass",reason:"synthetic",factIds:[longFact.id],ruleIds:["rule-1"],missingDocuments:[],nextAction:""}],providedFacts:[longFact],validRuleIds:new Set(["rule-1"]),coverage:packet.coverage});
  assert.equal(gated[0].status,"missing","truncated qualifications cannot satisfy a pass gate");
});

test("omitted facts cannot clear a legal check or establish not-applicable",()=>{
  const data=createCase("Synthetic missing evidence","synthetic-review-gate","2026-10-27");
  const facts=Array.from({length:12},(_,i)=>fact(`fact-${i}`,"debt.priority",i===11?"no":"priority"));
  const check=risk("risk-priority","debt.priority"),packet=buildLegalReviewPacket({data,facts,checks:[check],rules:[{id:"rule-1",title:"rule"}],guidance:[],findings:[],transactionReview:null});
  const omitted=facts.find(item=>!packet.providedFactIds.includes(item.id))!;
  const responses=[{id:check.id,status:"pass",reason:"synthetic response",factIds:[omitted.id],ruleIds:["rule-1"],missingDocuments:[],nextAction:""}];
  const gated=gate({batch:[check],response:responses,providedFacts:facts.filter(item=>packet.providedFactIds.includes(item.id)),validRuleIds:new Set(["rule-1"]),coverage:packet.coverage});
  assert.equal(gated[0].status,"missing");assert.deepEqual(gated[0].factIds,[]);assert.deepEqual(gated[0].ruleIds,["rule-1"]);
  const citedButIncomplete=gate({batch:[check],response:[{...responses[0],factIds:[packet.providedFactIds[0]]}],providedFacts:facts.filter(item=>packet.providedFactIds.includes(item.id)),validRuleIds:new Set(["rule-1"]),coverage:packet.coverage});
  assert.equal(citedButIncomplete[0].status,"missing","an included fact cannot override omitted facts for the same check");
  const notApplicable=gate({batch:[check],response:[{...responses[0],status:"not_applicable",factIds:[omitted.id]}],providedFacts:facts.filter(item=>packet.providedFactIds.includes(item.id)),validRuleIds:new Set(["rule-1"]),coverage:packet.coverage});
  assert.equal(notApplicable[0].status,"missing");assert.deepEqual(notApplicable[0].factIds,[]);
});

test("zero observed required features cannot pass merely because zero items were omitted",()=>{
  const data=createCase("Synthetic absent feature","absent-feature","2026-10-27"),check={...risk("required","debt.classification"),manual:false},source=fact("classification","debt.classification","ordinary");
  source.refs[0].quote="Source explicitly states ordinary classification.";
  const response={id:check.id,status:"pass",reason:"synthetic",factIds:[source.id],ruleIds:["rule-1"],missingDocuments:[],nextAction:""};
  const base=buildLegalReviewPacket({data,facts:[source],checks:[check],rules:[{id:"rule-1",title:"rule"}],guidance:[],findings:[],transactionReview:null});
  assert.equal(gate({batch:[check],response:[response],providedFacts:[source],validRuleIds:new Set(["rule-1"]),coverage:base.coverage})[0].status,"pass");
  check.features.push("case.business_income");
  const missing=buildLegalReviewPacket({data,facts:[source],checks:[check],rules:[{id:"rule-1",title:"rule"}],guidance:[],findings:[],transactionReview:null});
  assert.equal(missing.coverage.featureCounts["required:case.business_income"].total,0);
  assert.equal(gate({batch:[check],response:[response],providedFacts:[source],validRuleIds:new Set(["rule-1"]),coverage:missing.coverage})[0].status,"missing");
});

test("nonmanual auto-clear requires a cited clearable fact for each required feature",()=>{
  const data=createCase("Synthetic citation completeness","citation-completeness","2026-10-29"),check={...risk("two-features","debt.classification"),features:["debt.classification","debt.priority"],manual:false};
  const classification=fact("classification","debt.classification","ordinary"),priorityFact=fact("priority","debt.priority","ordinary");
  const packet=buildLegalReviewPacket({data,facts:[classification,priorityFact],checks:[check],rules:[{id:"rule-1",title:"rule"}],guidance:[],findings:[],transactionReview:null});
  const response=[{id:check.id,status:"pass",reason:"synthetic",factIds:[classification.id],ruleIds:["rule-1"],missingDocuments:[],nextAction:""}];
  const gated=gate({batch:[check],response,providedFacts:[classification,priorityFact],validRuleIds:new Set(["rule-1"]),coverage:packet.coverage})[0];
  assert.equal(gated.status,"missing","an unrelated citation cannot stand in for the priority feature");
});

test("a clipped secondary source reference remains explicit incomplete evidence",()=>{
  const data=createCase("Synthetic multiple citations","multiple-citations","2026-10-27"),check=risk("reference","debt.classification"),source=fact("classification","debt.classification","ordinary");
  source.refs.push({documentId:"doc",page:2,quote:"A material qualification is printed on another source page."});
  const packet=buildLegalReviewPacket({data,facts:[source],checks:[check],rules:[{id:"rule-1",title:"rule"}],guidance:[],findings:[],transactionReview:null});
  assert.ok(packet.payload.providedFacts[0].truncatedFields.includes("refs"));
  assert.ok(packet.coverage.truncatedFactIdsByCheck[check.id].includes(source.id));
});

test("source-less facts are excluded before legal AI packet construction without treating 0 as proof",()=>{
  const data=createCase("Synthetic source anchor audit","synthetic-source-anchor-r23","2026-10-31");
  const check=risk("income-source-anchor","income.net");
  const unanchored=fact("unanchored-string",check.features[0],"UNANCHORED_SYNTHETIC_SENTINEL");unanchored.refs=[];
  const unanchoredZero=fact("unanchored-zero",check.features[0],"0");unanchoredZero.refs=[];
  const unanchoredNull=fact("unanchored-null",check.features[0],"0");unanchoredNull.refs=[];unanchoredNull.value=null;
  const anchored=fact("anchored",check.features[0],"150000");
  const packet=buildLegalReviewPacket({data,facts:[unanchored,unanchoredZero,unanchoredNull,anchored],checks:[check],rules:[],guidance:[],findings:[],transactionReview:null});
  assert.deepEqual(packet.providedFactIds,["anchored"]);
  assert.equal(packet.coverage.featureCounts["income-source-anchor:income.net"].total,1);
  assert.ok(!packet.text.includes("UNANCHORED_SYNTHETIC_SENTINEL"),"unanchored raw values must not reach the model");
  assert.ok(!packet.text.includes("unanchored-zero"),"unanchored zero must not be used as observed 0");
  const missing=buildLegalReviewPacket({data,facts:[unanchored,unanchoredZero,unanchoredNull],checks:[check],rules:[],guidance:[],findings:[],transactionReview:null});
  assert.deepEqual(missing.providedFactIds,[]);
  assert.equal(missing.coverage.featureCounts["income-source-anchor:income.net"].total,0,"missing sources are not supplied evidence");
  const structured=fact("structured",check.features[0],"100000");structured.refs=[];structured.structuredRefs=[{sourceRecordId:"synthetic-row",jsonPointer:"/income/net"}];
  const structuredPacket=buildLegalReviewPacket({data,facts:[structured],checks:[check],rules:[],guidance:[],findings:[],transactionReview:null});
  assert.deepEqual(structuredPacket.providedFactIds,["structured"],"source-anchored structured records remain visible for human review");
});
