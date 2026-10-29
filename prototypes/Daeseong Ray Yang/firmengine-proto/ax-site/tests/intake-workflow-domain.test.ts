import test from "node:test";
import assert from "node:assert/strict";
import { intakeInputFingerprint, intakeSemanticPayload } from "../lib/intake-fingerprint.ts";
import { applyRequirementMappingReview, applyRequirementOverride, makeCaseRequirement, mergeRequirements, type CaseRequirement } from "../lib/case-requirements.ts";
import { confirmSubjectLink, candidateSubjectLinks, type SubjectLink } from "../lib/party-identity.ts";
import { aggregateDocumentReception, createRequirementStaffDisposition, deriveRequirementStatus, fulfillmentDependencyFingerprint, transitionDocumentMatch, type DocumentMatch } from "../lib/document-fulfillment.ts";
import { adoptIntakeRun, buildIntakeCrosswalk, type IntakeCaseWorkflow } from "../lib/intake-case-bridge.ts";
import { documentFamilyContract } from "../lib/document-agent-registry.ts";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import type { IntakeRun, IntakeRequirement } from "../lib/intake-types.ts";

const source: IntakeRequirement = { id:"r1", documentTypeId:"bank", documentName:"Bank records", subjectId:"s1", subjectLabel:"Client", period:"12 months", requirement:"required_when_applicable", status:"requested", reason:["rule"], matchedRuleIds:["rule1"], workflowIds:["bank"], sourceClaimIds:["claim1"], sourceIds:["law1"], alternatives:[], alternativePolicy:"any_of", fields:["balance"], issuer:"Bank" };
const requirement = (): CaseRequirement => makeCaseRequirement({source,intakeRunId:"run1",subjectLinkId:"link1",scopeKey:"account:one",fieldGroups:[["balance"]],idFactory:()=>"req1"});
const link: SubjectLink = { linkId:"link1",intakeRunId:"run1",intakeSubjectId:"s1",subjectScope:"account",typedEntityId:"account1",scopeKey:"account:one",status:"confirmed",basisRefs:["staff-review"],version:2,reviewer:"staff" };
const match: DocumentMatch = { matchId:"m1",requirementId:"req1",subjectLinkId:"link1",documentId:"doc1",pageIds:["p1"],coveredPeriod:{start:"2025-01",end:"2025-11"},sourceDocumentHash:"hash1",state:"accepted",version:2,reason:"records",staffReviewer:"staff",dispositionFingerprint:"old" };

test("v2 fingerprint includes semantic classifier inputs and excludes workflow/document edits", async () => {
  const base = { notes:[{id:"n1",textSha256:"t1",occurredAt:null,supersedesId:null,sequence:1}],catalogHash:"c1",courtId:"court",asOf:"2026-01-01",engineVersion:"e1",promptVersion:"p1",model:"m1",outputContractVersion:"o1" };
  const first = await intakeInputFingerprint(base);
  assert.equal(first, await intakeInputFingerprint({...base}));
  assert.notEqual(first, await intakeInputFingerprint({...base,courtId:"other"}));
  assert.notEqual(first, await intakeInputFingerprint({...base,catalogHash:"c2"}));
  assert.deepEqual(Object.keys(intakeSemanticPayload(base)), ["schema","consultationHistory","catalogHash","courtId","asOf","engineVersion","promptVersion","model","outputContractVersion"]);
});

test("origin key merges compatible automatic requirements but preserves scope distinctions", () => {
  const first = requirement(), same = {...requirement(),requirementId:"req2",matchedRuleIds:["rule2"],sourceClaimIds:["claim2"]};
  const merged = mergeRequirements([first],[same]);
  assert.equal(merged.length,1);
  assert.deepEqual(merged[0].matchedRuleIds,["rule1","rule2"]);
  assert.equal(mergeRequirements([first],[{...same,requiredPeriod:"6 months",originKey:"different-period"}]).length,2);
});

test("waiver and non-applicability overrides require human basis and waiver policy", () => {
  const req = requirement();
  assert.throws(()=>applyRequirementOverride(req,{operation:"waive_with_reason",expectedId:"req1",reason:"not needed",reviewer:"staff",basisRefs:["review"]}));
  assert.throws(()=>applyRequirementOverride(req,{operation:"declare_not_applicable",expectedId:"req1",reason:"not applicable",reviewer:"staff"}));
  const waived = applyRequirementOverride(req,{operation:"waive_with_reason",expectedId:"req1",reason:"policy exception",reviewer:"staff",basisRefs:["decision"],waiverAllowed:true});
  assert.equal(waived.waivedByReview,true);
  assert.equal(req.waivedByReview,false);
});

test("crosswalk defaults to mapping_required and only approved required groups or explicit no-fields policy map", () => {
  const candidate = buildIntakeCrosswalk(INTAKE_CATALOG_SEED).find(x=>x.familyId);
  assert.ok(candidate);
  assert.equal(candidate.mappingState,"mapping_required");
  const contract = documentFamilyContract(candidate.familyId);
  assert.ok(contract?.fields.length);
  const base = {intakeDocumentTypeId:candidate.intakeDocumentTypeId,workflowDocumentType:candidate.workflowDocumentType,requiredFieldGroups:[[contract.fields[0].global_field_id]],typedTargets:[{fieldId:contract.fields[0].global_field_id,targetPath:"source_only"}],subjectScope:"income",periodPolicy:"monthly",reason:"Reviewed field scope",reviewer:"staff"};
  const approved = buildIntakeCrosswalk(INTAKE_CATALOG_SEED,[base]).find(x=>x.crosswalkId===candidate.crosswalkId);
  assert.equal(approved?.mappingState,"mapped");
  assert.equal(approved?.coveragePolicy,"required_groups");
  const emptyWithoutPolicy = buildIntakeCrosswalk(INTAKE_CATALOG_SEED,[{...base,requiredFieldGroups:[]}]).find(x=>x.crosswalkId===candidate.crosswalkId);
  assert.equal(emptyWithoutPolicy?.mappingState,"mapping_required");
  const invalidTarget = buildIntakeCrosswalk(INTAKE_CATALOG_SEED,[{...base,typedTargets:[{fieldId:contract.fields[0].global_field_id,targetPath:"debts[].inventedField"}]}]).find(x=>x.crosswalkId===candidate.crosswalkId);
  assert.equal(invalidTarget?.mappingState,"mapping_required");
  const noFields = buildIntakeCrosswalk(INTAKE_CATALOG_SEED,[{...base,requiredFieldGroups:[],noRequiredFields:true}]).find(x=>x.crosswalkId===candidate.crosswalkId);
  assert.equal(noFields?.mappingState,"mapped");
  assert.equal(noFields?.coveragePolicy,"no_required_fields");
  const unmappedRequirement=makeCaseRequirement({source:{...source,documentTypeId:candidate.intakeDocumentTypeId},intakeRunId:"run1",subjectLinkId:"link1",scopeKey:"scope1",crosswalk:candidate,availableFieldIds:candidate.availableFieldIds,idFactory:()=>"mapped-req"});
  assert.equal(unmappedRequirement.mappingRequired,true);
  assert.throws(()=>applyRequirementMappingReview(unmappedRequirement,{expectedId:"mapped-req",expectedCrosswalkId:candidate.crosswalkId,expectedCrosswalkVersion:candidate.version,requiredFieldGroups:[],optionalFieldIds:[],typedTargets:[],noRequiredFields:false,subjectScope:"income",periodPolicy:"monthly",reviewer:"staff",reviewedAt:"2026-10-29T00:00:00Z",reason:"No mapping yet"}));
  const reviewedMapping=applyRequirementMappingReview(unmappedRequirement,{expectedId:"mapped-req",expectedCrosswalkId:candidate.crosswalkId,expectedCrosswalkVersion:candidate.version,requiredFieldGroups:[[contract.fields[0].global_field_id]],optionalFieldIds:[],typedTargets:[{fieldId:contract.fields[0].global_field_id,targetPath:"source_only"}],noRequiredFields:false,subjectScope:"income",periodPolicy:"monthly",reviewer:"staff",reviewedAt:"2026-10-29T00:00:00Z",reason:"Reviewed field scope"});
  assert.equal(reviewedMapping.mappingRequired,false);
  assert.equal(reviewedMapping.requiredFieldGroups[0][0],contract.fields[0].global_field_id);
  assert.equal(reviewedMapping.crosswalkReview?.reviewer,"staff");
});

test("reclassification reuses exact subject lineage and does not duplicate unchanged requirements", () => {
  const empty: IntakeCaseWorkflow = {schema:"case-workflow/1",version:0,requirements:[],subjectLinks:[],documentMatches:[]};
  const run = (id:string) => ({id,caseId:"case1",result:{claims:[],requirements:[source],questions:[],warnings:[],matchedRuleIds:[],counts:{requested:1,qualificationNeeded:0,conflict:0,legalReview:0,questions:0}},classifierReceipt:{subjects:[{subjectId:"debt:loan-1",subjectLabel:"Masked creditor"}],sourceSpanCoverage:{},unreferencedSubjectIds:[]}} as unknown as IntakeRun);
  let serial=0; const idFactory=()=>`id-${++serial}`;
  const first=adoptIntakeRun({workflow:empty,run:run("run1"),crosswalk:[],idFactory});
  const second=adoptIntakeRun({workflow:first,run:run("run2"),crosswalk:[],idFactory});
  assert.equal(second.subjectLinks.length,1);
  assert.equal(second.requirements.length,1);
  assert.equal(second.subjectLinks[0].status,"candidate");
  assert.equal(second.requirements[0].mappingRequired,true);
  assert.equal(first.requirements[0].requirementId,second.requirements[0].requirementId);
});

test("subject candidates require explicit evidence-backed confirmation", () => {
  const run = { id:"run1",classifierReceipt:{subjects:[{subjectId:"s1",subjectLabel:"Client"}]},result:{claims:[]} } as unknown as IntakeRun;
  const [candidate] = candidateSubjectLinks(run,()=>"candidate");
  assert.equal(candidate.status,"candidate");
  assert.throws(()=>confirmSubjectLink(candidate,{typedEntityId:"account1",reviewer:"staff",expectedVersion:1,evidenceRefs:[]}));
  assert.equal(confirmSubjectLink(candidate,{typedEntityId:"account1",reviewer:"staff",expectedVersion:1,evidenceRefs:["human-confirmation"]}).status,"confirmed");
});

test("match acceptance enforces confirmed subject, active document, and current hash", () => {
  const proposed = {...match,state:"proposed" as const,version:1,staffReviewer:null,dispositionFingerprint:null};
  const proposal = {matchId:"m1",requirementId:"req1",subjectLinkId:"link1",documentId:"doc1",pageIds:["p1"],coveredPeriod:{start:"2025-01",end:"2025-11"},sourceDocumentHash:"hash1",reason:"suggestion"};
  assert.throws(()=>transitionDocumentMatch({operation:"accept",match:proposed,context:{requirement:requirement(),subjectLink:{...link,status:"candidate"},document:{id:"doc1",status:"active",sha256:"hash1"},expectedMatchVersion:1},reviewer:"staff"}));
  assert.throws(()=>transitionDocumentMatch({operation:"accept",match:proposed,context:{requirement:requirement(),subjectLink:link,document:{id:"doc1",status:"deleted",sha256:"hash1"},expectedMatchVersion:1},reviewer:"staff"}));
  const accepted = transitionDocumentMatch({operation:"accept",match:proposed,context:{requirement:requirement(),subjectLink:link,document:{id:"doc1",status:"active",sha256:"hash1"},expectedMatchVersion:1},reviewer:"staff"});
  assert.equal(accepted.state,"accepted");
  assert.deepEqual(proposal.pageIds,["p1"]);
});

test("11 of 12 months is partial, hash changes stale, and completion never implies legal/source acceptance", async () => {
  const partial = await deriveRequirementStatus({requirement:requirement(),matches:[match],subjectLink:link,currentDocumentHashes:{doc1:"hash1"},requiredFieldGroupsMet:true,applicability:"confirmed",staffConfirmationRequired:false,legalReview:false});
  assert.equal(partial.engineFulfillment,"partial");
  assert.equal(partial.requirementStatus,"partial");
  const overlap = await deriveRequirementStatus({requirement:requirement(),matches:[match,{...match,matchId:"m2",coveredPeriod:{start:"2025-11",end:"2025-11"}}],subjectLink:link,currentDocumentHashes:{doc1:"hash1"},requiredMonths:12,applicability:"confirmed",staffConfirmationRequired:false,legalReview:false});
  assert.equal(overlap.engineFulfillment,"partial");
  const stale = await deriveRequirementStatus({requirement:requirement(),matches:[match],subjectLink:link,currentDocumentHashes:{doc1:"new-hash"},requiredMonths:12,applicability:"confirmed",staffConfirmationRequired:false,legalReview:false});
  assert.equal(stale.engineFulfillment,"stale");
  const invalidRange=await deriveRequirementStatus({requirement:requirement(),matches:[{...match,coveredPeriod:{start:"2025-00",end:"9999-12"}}],subjectLink:link,currentDocumentHashes:{doc1:"hash1"},applicability:"confirmed",staffConfirmationRequired:false,legalReview:false});
  assert.equal(invalidRange.engineFulfillment,"conflict");
  const invalidDay=await deriveRequirementStatus({requirement:requirement(),matches:[{...match,coveredPeriod:{start:"2025-02-30",end:"2025-12-31"}}],subjectLink:link,currentDocumentHashes:{doc1:"hash1"},applicability:"confirmed",staffConfirmationRequired:false,legalReview:false});
  assert.equal(invalidDay.engineFulfillment,"conflict");
  const unbounded=await deriveRequirementStatus({requirement:{...requirement(),requiredPeriod:"999 months"},matches:[{...match,coveredPeriod:{start:"2025-01",end:"2034-12"}}],subjectLink:link,currentDocumentHashes:{doc1:"hash1"},applicability:"confirmed",staffConfirmationRequired:false,legalReview:false});
  assert.equal(unbounded.engineFulfillment,"partial");
  const fullInput = {requirement:requirement(),matches:[{...match,coveredPeriod:{start:"2025-01",end:"2025-12"}}],subjectLink:link,currentDocumentHashes:{doc1:"hash1"},applicability:"confirmed" as const,staffConfirmationRequired:true,legalReview:false};
  const full = await deriveRequirementStatus(fullInput);
  assert.equal(full.engineFulfillment,"complete");
  assert.equal(full.requirementStatus,"eligible_for_confirmation");
  assert.equal(full.staffDisposition,"unreviewed");
  const currentFingerprint=await fulfillmentDependencyFingerprint(fullInput);
  const reviewed=await createRequirementStaffDisposition({...fullInput,decision:"confirmed",expectedFingerprint:currentFingerprint,reviewer:"reviewer",role:"caseworker_review",reason:"Coverage checked",basisRefs:["doc1:p1"]});
  const confirmed=await deriveRequirementStatus({...fullInput,staffDispositionReceipt:reviewed});
  assert.equal(confirmed.engineFulfillment,"complete");
  assert.equal(confirmed.staffDisposition,"confirmed");
  assert.equal(confirmed.requirementStatus,"satisfied");
  const staleReview=await deriveRequirementStatus({...fullInput,currentDocumentHashes:{doc1:"rotated"},staffDispositionReceipt:reviewed});
  assert.equal(staleReview.staffDisposition,"stale");
  assert.equal(staleReview.requirementStatus,"stale");
  await assert.rejects(createRequirementStaffDisposition({...fullInput,decision:"confirmed",expectedFingerprint:"old",reviewer:"reviewer",role:"caseworker_review",reason:"Coverage checked",basisRefs:["doc1:p1"]}));
});

test("receipt view preserves per-page statuses and does not mark partial or unreadable evidence complete", () => {
  const base = {document:{id:"doc1",status:"active" as const,originalReady:true,pagesReady:true},requiredPages:[1,2],sourceRevision:7};
  const split = aggregateDocumentReception({...base,pages:[{documentId:"doc1",page:1,role:"evidence",status:"completed",imageReady:true},{documentId:"doc1",page:2,role:"evidence",status:"review_required",imageReady:true}]});
  assert.equal(split.primaryStatus,"attention_required");
  assert.deepEqual(split.processingCountsByStatus,{completed:1,review_required:1});
  assert.deepEqual(split.requiredPageCoverage.completed,[1]);
  assert.deepEqual(split.requiredPageCoverage.incomplete,[2]);
  const unreadable = aggregateDocumentReception({...base,requiredPages:[1],pages:[{documentId:"doc1",page:1,role:"evidence",status:"completed",imageReady:true}],fieldIssues:[{documentId:"doc1",page:1,fieldId:"income.monthly",required:true,state:"unreadable",quote:"원문 구간",bbox:[1,2,3,4]}]});
  assert.equal(unreadable.primaryStatus,"attention_required");
  assert.equal(unreadable.readingIssues[0].quote,"원문 구간");
  const optional = aggregateDocumentReception({...base,requiredPages:[1],pages:[{documentId:"doc1",page:1,role:"evidence",status:"completed",imageReady:true}],fieldIssues:[{documentId:"doc1",page:1,fieldId:"optional.note",required:false,state:"masked"}]});
  assert.equal(optional.primaryStatus,"read_complete");
  assert.equal(optional.readingIssues[0].severity,"warning");
});

test("missing pages, failed or unknown statuses and unknown roles require attention", () => {
  const base = {document:{id:"doc1",status:"active" as const,originalReady:true,pagesReady:true},requiredPages:[1,2],sourceRevision:"r2"};
  const missing = aggregateDocumentReception({...base,pages:[{documentId:"doc1",page:1,role:"evidence",status:"completed",imageReady:true}]});
  assert.equal(missing.primaryStatus,"attention_required");
  assert.deepEqual(missing.requiredPageCoverage.missing,[2]);
  const failed = aggregateDocumentReception({...base,requiredPages:[1],pages:[{documentId:"doc1",page:1,role:"evidence",status:"failed",imageReady:true}]});
  assert.equal(failed.primaryStatus,"attention_required");
  const unknownRole = aggregateDocumentReception({...base,requiredPages:[1],pages:[{documentId:"doc1",page:1,role:"mystery",status:"completed",imageReady:true}]});
  assert.equal(unknownRole.primaryStatus,"attention_required");
  assert.ok(unknownRole.readingIssues.some(issue=>issue.code==="page_role_unknown"));
  const unknownStatus = aggregateDocumentReception({...base,requiredPages:[1],pages:[{documentId:"doc1",page:1,role:"evidence",status:"legacy_done",imageReady:true}]});
  assert.equal(unknownStatus.primaryStatus,"attention_required");
  assert.ok(unknownStatus.processingCountsByStatus.legacy_done===1);
});
