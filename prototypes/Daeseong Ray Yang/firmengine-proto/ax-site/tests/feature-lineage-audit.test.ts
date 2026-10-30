import test from "node:test";
import assert from "node:assert/strict";
import {INTAKE_CATALOG_SEED} from "../lib/intake-catalog.ts";
import {buildFeatureLineageAudit,auditLegalRiskContracts,auditCourtPracticeGaps,evaluateCaseFieldLineage} from "../lib/feature-lineage-audit.ts";
const sha="a".repeat(64);
test("one record for each of the 693 active canonical fields, including 19 supplemental fields",()=>{
 const r=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000});
 assert.equal(r.summary.documentTypes,85);
 assert.equal(r.summary.canonicalFieldIds,693);
 assert.equal(r.summary.sourceSlots,1808);
 assert.equal(new Set(r.fields.map(f=>f.canonicalFieldId)).size,693);
 assert.ok(r.fields.every(f=>f.database.missingTable==="extraction_field_coverage"&&f.forms.length>0));
 assert.equal(r.legalApprovalInferred,false);
});
test("known salary and debt keys reach explicit typed case candidates; premium is not surrender",()=>{
 const r=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000});
 const get=(id:string)=>r.fields.find(f=>f.canonicalFieldId===id)!;
 assert.ok(get("payroll_payslip::income.payroll.net_pay").typedProjections.some(p=>p.caseFactKey==="income.net"));
 assert.ok(get("debt_certificate::interest_balance").typedProjections.some(p=>p.caseFactKey==="debt.interest"));
 assert.equal(get("insurance_policy_asset::total_premium").typedProjections.length,0);
 assert.equal(get("debt_certificate::original_principal").calculations.length,0);
});
test("law check gaps are explicitly unresolved, not grounds for automatic legal pass",()=>{
 assert.equal(auditLegalRiskContracts().riskChecks,95);
 assert.equal(auditLegalRiskContracts().featurelessRiskChecks,88);
 assert.ok(auditCourtPracticeGaps().gaps.some(x=>x.condition==="business_income"));
});
test("only expressly reviewed case-required canonical IDs become missing-evidence blocker candidates",()=>{
 const r=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000});
 const d={context:{id:"synthetic-case",revision:1},facts:[],workflowState:{requirements:[{
  requirementId:"R1",retired:false,waivedByReview:false,notApplicableConfirmed:false,mappingRequired:false,
  crosswalkReview:{reviewer:"staff"},requiredFieldGroups:[["debt_certificate::principal_balance"]]
 }]}} as unknown as Parameters<typeof evaluateCaseFieldLineage>[0];
 const a=evaluateCaseFieldLineage(d,r.fields,{limit:1000});
 assert.equal(a.summary.requiredBlocked,1);
 assert.equal(a.summary.requiredFieldIds,1);
 assert.ok(a.fields.find(f=>f.canonicalFieldId==="debt_certificate::principal_balance")?.blockerCandidates.includes("REQUIRED_CANONICAL_FIELD_NOT_OBSERVED"));
 assert.equal(a.fields.find(f=>f.canonicalFieldId==="debt_certificate::original_principal")?.blockerCandidates.length,0);
});

test("shared extension IDs repeated across distinct OCR families are merged, not rejected",()=>{
 const result=buildFeatureLineageAudit(INTAKE_CATALOG_SEED,sha,{limit:1000});
 const row=result.fields.find(f=>f.canonicalFieldId==="income_source_inventory::income_source_id");
 assert.ok(row);
 assert.ok(row.familyIds.includes("employment_relationship"));
 assert.ok(row.familyIds.includes("current_nonwage_income"));
 assert.ok(row.familyIds.includes("business_current_income_summary"));
 assert.equal(new Set(row.familyIds).size,row.familyIds.length);
 assert.equal(result.summary.canonicalFieldIds,693);
 assert.equal(result.summary.sourceSlots,1808);
});

test("current case required-source scope excludes an identical amount from another uploaded document",()=>{
 const data={
  context:{id:"synthetic-case",revision:1},
  documents:[{id:"A",status:"active",sha256:"a".repeat(64),pages:[1]},{id:"B",status:"active",sha256:"b".repeat(64),pages:[1]}],
  pages:[{documentId:"A",page:1,role:"evidence",text:"source A"},{documentId:"B",page:1,role:"evidence",text:"source B"}],
  facts:[{id:"fB",logicalId:"fB",version:1,subjectId:"income-b",canonicalFieldId:"payroll_payslip::income.payroll.net_pay",key:"income.net",
    value:"100",numeric:null,state:"verified",recognition:"accepted",refs:[{documentId:"B",page:1,quote:"source B",sourceHash:"b".repeat(64)}],
    fieldObservation:{sourceState:"present"},validation:[],periodStart:"2026-01-01",periodEnd:"2026-01-31"}],
  workflowState:{subjectLinks:[{linkId:"linkA",status:"confirmed",typedEntityId:"income-a"}],requirements:[{requirementId:"R",subjectLinkId:"linkA",mappingRequired:false,retired:false,waivedByReview:false,notApplicableConfirmed:false,
    crosswalkReview:{reviewer:"staff",periodPolicy:"any"},requiredFieldGroups:[["payroll_payslip::income.payroll.net_pay"]]}],
   documentMatches:[{requirementId:"R",subjectLinkId:"linkA",documentId:"A",state:"accepted",sourceDocumentHash:"a".repeat(64),pageIds:["A:1"]}]}
 } as unknown as Parameters<typeof evaluateCaseFieldLineage>[0];
 const rows=[{canonicalFieldId:"payroll_payslip::income.payroll.net_pay",datatype:"money",sourceRequirements:{periodIdentity:true}}];
 const result=evaluateCaseFieldLineage(data,rows);
 assert.ok(result.fields[0].blockerCandidates.includes("REQUIRED_FIELD_WRONG_SOURCE_SCOPE_OR_NO_ACCEPTED_MATCH"));
});
test("monthly required evidence must cover every complete calendar month, not just one accepted payslip",()=>{
 const data={
  context:{id:"synthetic",revision:1},
  documents:[{id:"A",status:"active",sha256:"a".repeat(64),pages:[1]}],
  pages:[{documentId:"A",page:1,role:"evidence",text:"month 1"}],
  facts:[{id:"f1",logicalId:"f1",version:1,subjectId:"wage1",canonicalFieldId:"payroll_payslip::income.payroll.net_pay",key:"income.net",
    value:"100",state:"verified",recognition:"accepted",refs:[{documentId:"A",page:1,quote:"month 1",sourceHash:"a".repeat(64)}],
    fieldObservation:{sourceState:"present"},validation:[],periodStart:"2026-01-01",periodEnd:"2026-01-31"}],
  workflowState:{subjectLinks:[{linkId:"owner",status:"confirmed",typedEntityId:"wage1"}],requirements:[{requirementId:"R",subjectLinkId:"owner",mappingRequired:false,retired:false,waivedByReview:false,notApplicableConfirmed:false,
    requiredPeriod:"2026-01-01 ~ 2026-02-28",crosswalkReview:{periodPolicy:"monthly",reviewer:"staff"},
    requiredFieldGroups:[["payroll_payslip::income.payroll.net_pay"]]}],
   documentMatches:[{requirementId:"R",subjectLinkId:"owner",documentId:"A",state:"accepted",sourceDocumentHash:"a".repeat(64),pageIds:["A:1"]}]}
 } as unknown as Parameters<typeof evaluateCaseFieldLineage>[0];
 const rows=[{canonicalFieldId:"payroll_payslip::income.payroll.net_pay",datatype:"money",sourceRequirements:{periodIdentity:true}}];
 const first=evaluateCaseFieldLineage(data,rows).fields[0];
 assert.ok(first.blockerCandidates.includes("REQUIRED_MONTHLY_FIELD_COVERAGE_INCOMPLETE"));
 data.facts.push({...data.facts[0],id:"f2",logicalId:"f2",version:1,periodStart:"2026-02-01",periodEnd:"2026-02-28"});
 assert.ok(!evaluateCaseFieldLineage(data,rows).fields[0].blockerCandidates.includes("REQUIRED_MONTHLY_FIELD_COVERAGE_INCOMPLETE"));
});

test("reviewed canonical proof never borrows another subject on one accepted source page",()=>{
 const id="conditional_nonstandard_income_or_household_event::conditional.change.income_delta";
 const hash="a".repeat(64);
 const data={
  context:{id:"synthetic-multi-subject",revision:1},
  documents:[{id:"D",status:"active",sha256:hash,pages:[1]}],
  pages:[{documentId:"D",page:1,role:"evidence",text:"Person A income change 100; Person B income change 200"}],
  facts:[
   {id:"fA",logicalId:"fA",version:1,subjectId:"person-A",canonicalFieldId:id,key:"income.change",value:"100",
    state:"verified",recognition:"accepted",refs:[{documentId:"D",page:1,quote:"Person A income change 100",sourceHash:hash}],fieldObservation:{sourceState:"present"},validation:[],periodStart:"2026-01-01",periodEnd:"2026-01-31"},
   {id:"fB",logicalId:"fB",version:1,subjectId:"person-B",canonicalFieldId:id,key:"income.change",value:"200",
    state:"verified",recognition:"accepted",refs:[{documentId:"D",page:1,quote:"Person B income change 200",sourceHash:hash}],fieldObservation:{sourceState:"present"},validation:[],periodStart:"2026-01-01",periodEnd:"2026-01-31"}
  ],
  workflowState:{
   subjectLinks:[{linkId:"link-A",status:"confirmed",typedEntityId:"person-A"}],
   requirements:[{requirementId:"R",subjectLinkId:"link-A",mappingRequired:false,retired:false,waivedByReview:false,notApplicableConfirmed:false,
     crosswalkReview:{reviewer:"staff",periodPolicy:"any"},requiredFieldGroups:[[id]]}],
   documentMatches:[{requirementId:"R",subjectLinkId:"link-A",documentId:"D",state:"accepted",sourceDocumentHash:hash,pageIds:["D:1"]}]
  }
 } as unknown as Parameters<typeof evaluateCaseFieldLineage>[0];
 const rows=[{canonicalFieldId:id,datatype:"money",temporalRole:"period_scope",sourceRequirements:{periodIdentity:true}}];
 const view=()=>evaluateCaseFieldLineage(data,rows).fields[0];
 assert.equal(view().sourceObservations,2);
 assert.equal(view().matchedSourceFacts,1); // only A, not the other person on the same page
 data.facts.splice(0,1);
 assert.equal(view().matchedSourceFacts,0);
 assert.ok(view().blockerCandidates.includes("REQUIRED_FIELD_WRONG_SOURCE_SCOPE_OR_NO_ACCEPTED_MATCH"));
 data.workflowState.subjectLinks[0].typedEntityId="person-B";
 assert.equal(view().matchedSourceFacts,1); // same reviewed subject must match the fact's typed entity
 data.workflowState.subjectLinks[0].status="candidate";
 assert.equal(view().matchedSourceFacts,0); // unconfirmed relink never clears proof
});
