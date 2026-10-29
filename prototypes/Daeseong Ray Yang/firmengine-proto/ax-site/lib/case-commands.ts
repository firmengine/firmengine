import { currentFacts,reviewFact,touchCase,retractDocument,reviewExport,archiveExport,validSourceRef,moneyValue,type CaseData,type Json,type SourceRef,type NumericInput } from "./domain.ts";
import { parseContextPatch,parseHouseholdPatch } from "./context-validation.ts";
import { upsertObject,removeObject } from "./object-editor.ts";
import { applyFactProjection,invalidateFactSupport } from "./fact-object-projection.ts";
import { caseWorkflow } from "./case-workflow-state.ts";
import { assertKeys,commandHash,CommandError,type CaseCommand } from "./case-command-contract.ts";
import { applyRequirementOverride } from "./case-requirements.ts";
import { adoptIntakeRun,buildIntakeCrosswalk } from "./intake-case-bridge.ts";
import { confirmSubjectLink,rejectSubjectLink } from "./party-identity.ts";
import { transitionDocumentMatch } from "./document-fulfillment.ts";
import { makeCaseTask,mergeCaseTasks,updateCaseTask } from "./case-tasks.ts";
import { validateProcedureEvent } from "./case-procedure-events.ts";
import { FORM_CONTRACTS } from "./form-contracts.ts";
import { executeCaseNodes } from "./case-execution.ts";
import { recordLegalCheckDisposition,type LegalCheckRun } from "./legal-check-dispositions.ts";
import { samplePageRole } from "./sample-manifest.ts";
import { assessCase,sourceFactMoneyValue } from "./assessment.ts";
import { CURRENT_RULESET } from "./legal-rules.ts";
import { adoptCalculationOverride,calculationBaseFingerprint,proposeCalculationOverride,type OverrideField } from "./calculation-overrides.ts";
import { disposalApplicabilityBasisFingerprint,evaluateDisposalApplicability } from "./disposal-applicability.ts";
import type { IntakeCatalog,IntakeRun } from "./intake-types.ts";
import { applyCaseSchemaMigration,assertWritableWorkflowSchema,type CaseSchemaMigrationPlan } from "./case-schema-migration.ts";
export interface CommandAuthority {actor:string;roles:string[];at:string;intakeRun?:IntakeRun;intakeCatalog?:IntakeCatalog;legalRun?:LegalCheckRun;legalRunVerified?:boolean;referenceSha256?:string;requirementFingerprint?:string;requirementComplete?:boolean;processingReady?:boolean;migrationPlan?:CaseSchemaMigrationPlan;documentBases?:{artifactId:string;fieldId:string;rowId?:string|null;value:string}[]}
function fail(message:string,status=400,code="INVALID_COMMAND"):never{throw new CommandError(code,status,message);}
const text=(v:unknown,label:string)=>typeof v==="string"&&v.trim()?v.trim():fail(`${label}을 지정하세요.`);
const strings=(v:unknown)=>Array.isArray(v)&&v.every(x=>typeof x==="string")?v as string[]:fail("항목 목록을 확인하세요.");
const review=(auth:CommandAuthority,role="caseworker_review")=>{if(!auth.actor||auth.actor==="private-site-service"||!auth.roles.includes(role))fail("지정된 사람 검토 권한이 필요합니다.",403,"HUMAN_ROLE_REQUIRED");};
const isSynthetic=(data:CaseData)=>!!(data.structuredTest||data.referenceTest);
const enumValue=<T extends string>(value:unknown,values:readonly T[],label:string):T=>typeof value==="string"&&values.includes(value as T)?value as T:fail(`${label}을 확인하세요.`);
const KNOWN_PAGE_ROLES=["evidence","filed_form","administrative","unknown"] as const;
const SOURCE_STATES=["reported","extracted","verified","disputed","retracted"] as const;
const RECOGNITIONS=["unreviewed","accepted","rejected"] as const;
const BASIS_REF=(data:CaseData)=>new Set([...currentFacts(data).map(f=>f.id),...data.documents.filter(d=>d.status==="active").flatMap(d=>d.pages.map(p=>`${d.id}:${p}`)),...(data.exportManifest?.files.filter(f=>f.status==="current").map(f=>f.id)??[])]);
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function validateCommandSourceRefs(data:CaseData,refs:unknown){
 if(refs===undefined)return;
 if(!Array.isArray(refs)||refs.length>100)fail("원문 근거 목록을 확인하세요.");
 for(const raw of refs){if(!raw||typeof raw!=="object"||Array.isArray(raw)||!validSourceRef(data,raw as SourceRef))fail("현재 사건의 유효한 원문 문서·페이지·인용을 지정하세요.");}
}
export async function documentEditBaseHash(input:{artifactId:string;fieldId:string;rowId?:string|null;value:string}){return commandHash(input);}
export function assertMutableCase(data:CaseData){assertWritableWorkflowSchema(data);if(data.context.id==="8429888a-1861-48b5-b1f4-66af1d36273e")fail("보호 사건의 수정은 잠겨 있습니다.",409,"PROTECTED_CASE");if(isSynthetic(data)&&!data.evaluationClone)fail("원본 평가 사건은 수정할 수 없습니다. 전용 복제 사건을 사용하세요.",409,"FIXTURE_IMMUTABLE");}
function resetReviews(data:CaseData,impact?:Record<string,unknown>){
 const invalidated:{key:string;prior:unknown}[]=[];
 const reset=(key:keyof CaseData["context"])=>{const prior=data.context[key];if(prior!==undefined&&prior!==false&&prior!==null)invalidated.push({key:String(key),prior:structuredClone(prior)});(data.context as unknown as Record<string,unknown>)[key]=false;};
 reset("ruleApplicationReviewed");if(data.context.referenceReviewSha256){invalidated.push({key:"referenceReviewSha256",prior:data.context.referenceReviewSha256});delete data.context.referenceReviewSha256;}reset("incomePeriodReviewed");reset("presentValueReviewed");reset("assetValuationBasisReviewed");reset("allocationBasisReviewed");if(data.context.shortenedTermReview){invalidated.push({key:"shortenedTermReview",prior:structuredClone(data.context.shortenedTermReview)});delete data.context.shortenedTermReview;}
 if(data.context.paymentSchedule?.reviewed){invalidated.push({key:"paymentSchedule.reviewed",prior:true});data.context.paymentSchedule.reviewed=false;}
 if(impact){const prior=impact.reviewInvalidation as unknown[];impact.reviewInvalidation=[...prior,...invalidated];}
 if(data.workflowState)for(const decision of data.workflowState.decisions)if(decision.status==="proposed")decision.status="stale";
}
/** Pure command reducer. Trusted external contexts are loaded by the server, never accepted as client caseData. */
export async function reduceCaseCommand(previous:CaseData,command:CaseCommand,auth:CommandAuthority):Promise<{data:CaseData;impact:Record<string,unknown>}> {
 assertMutableCase(previous);
 assertWritableWorkflowSchema(previous);
 if(!auth.actor||auth.actor==="private-site-service"||!auth.roles.includes("case_editor"))fail("사건 수정 권한이 필요합니다.",403,"HUMAN_ROLE_REQUIRED");
 if(command.commandType==="schema.migrate"){
   assertKeys(command.target,[]);assertKeys(command.patch,["planId","sourceSha256","migrationVersion","mode"],["planId","sourceSha256","migrationVersion","mode"]);
   if(command.sourceRefs||command.effectivePeriod||!auth.migrationPlan||auth.migrationPlan.planId!==command.patch.planId||auth.migrationPlan.sourceSha256!==command.patch.sourceSha256||auth.migrationPlan.migrationVersion!==command.patch.migrationVersion||auth.migrationPlan.mode!==command.patch.mode)fail("현재 사건에서 생성한 전환 미리보기가 필요합니다.",409,"MIGRATION_PREVIEW_REQUIRED");
   const migrated=await applyCaseSchemaMigration(previous,auth.migrationPlan,auth.at);
   const data=structuredClone(migrated.data);data.context.revision=previous.context.revision+1;
   return {data,impact:{commandType:command.commandType,migrationReceipt:migrated.receipt,alreadyApplied:migrated.alreadyApplied,reviewInvalidation:[],projectionBlockers:[]}};
 }
 validateCommandSourceRefs(previous,command.sourceRefs);
 const {patch,target,commandType:kind}=command;let data=touchCase(previous);data.workflowState=caseWorkflow(previous.workflowState);const work=data.workflowState;
 if(command.sourceRefs?.length&&!(["fact.correct","decision.propose"].includes(kind)))fail("이 명령 유형에는 원문 근거 필드를 사용할 수 없습니다.");
 if(command.effectivePeriod&&!(["decision.propose"].includes(kind)))fail("이 명령 유형에는 적용기간 필드를 사용할 수 없습니다.");
 const impact:Record<string,unknown>={commandType:kind,reviewInvalidation:[],projectionBlockers:[]};
 if(kind==="context.update"||kind==="schedule.replace"){
   assertKeys(target,[]);assertKeys(patch,kind==="schedule.replace"?["schedule"]:["context","household"]);
   const update=parseContextPatch(kind==="schedule.replace"?{paymentSchedule:patch.schedule}:patch.context,previous.context),old=structuredClone(previous.context),householdUpdate=patch.household?parseHouseholdPatch(patch.household,previous):undefined;
   const requestedReview=Object.entries(update).some(([k,v])=>(/Reviewed$/.test(k)&&v===true)||(k==="shortenedTermReview"&&!!v)||(k==="disposalApplicabilityReview"&&(v as {status?:string}|null)?.status==="confirmed")||(k==="paymentSchedule"&&!!(v as {reviewed?:boolean})?.reviewed));
   if(requestedReview||(patch.household as {recognition?:string})?.recognition==="accepted"){review(auth);if(isSynthetic(data))fail("합성 사건에 사람의 사실·법적 인정을 부여할 수 없습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");}
   const householdRecognitionChanged=!!householdUpdate&&householdUpdate.recognition!==undefined&&householdUpdate.recognition!==previous.household.recognition;
   const meaningful=Object.keys(update).some(k=>{
    if(k==="caseName"||/Reviewed$/.test(k)||k==="shortenedTermReview")return false;
    if(k==="disposalApplicabilityReview"){
      const semantic=(value:unknown)=>{if(!value||typeof value!=="object")return value;const review=value as Record<string,unknown>;return {disposition:review.disposition,reason:review.reason,basisFingerprint:review.basisFingerprint,factIds:review.factIds};};
      return JSON.stringify(semantic(update.disposalApplicabilityReview))!==JSON.stringify(semantic(previous.context.disposalApplicabilityReview));
    }
    if(k==="paymentSchedule"){const strip=(value:unknown)=>{if(!value||typeof value!=="object")return value;const {reviewed:_reviewed,reviewReason:_reason,...inputs}=value as Record<string,unknown>;return inputs;};return JSON.stringify(strip(update.paymentSchedule))!==JSON.stringify(strip(previous.context.paymentSchedule));}
    return JSON.stringify(update[k as keyof typeof update])!==JSON.stringify(previous.context[k as keyof typeof previous.context]);
   })||!!householdUpdate&&Object.keys(householdUpdate).some(k=>k!=="recognition"&&JSON.stringify(householdUpdate[k as keyof typeof householdUpdate])!==JSON.stringify(previous.household[k as keyof typeof previous.household]));
   if(meaningful&&requestedReview)fail("입력 변경과 사람 검토 승인은 별도 명령으로 처리하세요.",409,"CASE_STATE_CONFLICT");
   if(update.disposalApplicabilityReview){
    const declaration=update.disposalApplicabilityReview;
    if(declaration.status==="confirmed"){
     review(auth);if(isSynthetic(data))fail("합성 시험자료의 재산 비해당 판단을 승인할 수 없습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");
     const candidate=structuredClone(data);Object.assign(candidate.context,update);const checked=evaluateDisposalApplicability(candidate);
     if(checked.status!=="candidate"||declaration.basisFingerprint!==disposalApplicabilityBasisFingerprint(candidate))fail("현재 재산·사실 근거와 불일치하거나 검토되지 않은 비해당 선언입니다.",409,"CASE_STATE_CONFLICT");
     declaration.reviewedBy=auth.actor;declaration.reviewedAt=auth.at;
    }else{delete declaration.reviewedBy;delete declaration.reviewedAt;}
   }
   if(meaningful||householdRecognitionChanged){resetReviews(data,impact);work.reviewHistory.push({at:auth.at,actor:auth.actor,reason:command.reason,before:old});}
   if(requestedReview||householdUpdate?.recognition!==undefined)work.reviewHistory.push({at:auth.at,actor:auth.actor,reason:command.reason,before:{reviewState:old,householdRecognition:previous.household.recognition}});
   Object.assign(data.context,update);if(householdUpdate)data.household={...data.household,...householdUpdate};
   if(update.ruleApplicationReviewed){if(!auth.referenceSha256||!/^[a-f0-9]{64}$/i.test(auth.referenceSha256))fail("현재 법령 기준 지문을 불러온 뒤 검토하세요.",409,"CASE_STATE_CONFLICT");data.context.referenceReviewSha256=auth.referenceSha256;}
   if(kind==="schedule.replace"){const result=executeCaseNodes(data);if(result.planReconciliation.status==="blocked")fail("월별 예산·채권 배분이 일치하지 않습니다: "+result.planReconciliation.issues.join(", "),422,"REQUIRED_INPUT_UNRESOLVED");}
 }else if(kind==="fact.correct"||kind==="fact.review"){
   assertKeys(target,["factId"],["factId"]);assertKeys(patch,kind==="fact.correct"?["value","sourceUnit"]:["state","recognition"]);
   const fact=currentFacts(previous).find(f=>f.id===target.factId);if(!fact)fail("현재 사실을 찾을 수 없습니다.",409,"CASE_STATE_CONFLICT");
   if(kind==="fact.correct"&&(!command.baseValueHash||command.baseValueHash!==await commandHash({value:fact.value,sourceUnit:fact.sourceUnit??fact.numeric?.unit??null})))fail("정정할 원래 값이 변경되었습니다.",409,"CASE_STATE_CONFLICT");
   if(kind==="fact.correct"){if(!Object.hasOwn(patch,"value")&&!Object.hasOwn(patch,"sourceUnit"))fail("정정할 값 또는 원문 단위를 지정하세요.");if(Object.hasOwn(patch,"value")&&(patch.value===undefined||typeof patch.value==="object"&&patch.value!==null&&!Array.isArray(patch.value)))fail("정정 값은 단일 원문 값이어야 합니다.");if(Object.hasOwn(patch,"sourceUnit")&&patch.sourceUnit!==null&&(typeof patch.sourceUnit!=="string"||patch.sourceUnit.length>64))fail("원문 단위는 64자 이내 문자열 또는 미확인이어야 합니다.");}
   if(kind==="fact.review"){review(auth);if(isSynthetic(data))fail("합성 증빙의 인정은 금지되어 있습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");if(patch.state!==undefined&&!["reported","extracted","verified","disputed","retracted"].includes(String(patch.state)))fail("확인 상태를 확인하세요.");if(patch.recognition!==undefined&&!["unreviewed","accepted","rejected"].includes(String(patch.recognition)))fail("인정 상태를 확인하세요.");}
   const changed=reviewFact(previous,fact.id,{actor:auth.actor,reason:command.reason,...(kind==="fact.correct"?{value:patch.value as Json,state:"extracted" as const,recognition:"unreviewed" as const,...(Object.hasOwn(patch,"sourceUnit")?{sourceUnit:patch.sourceUnit as string|null}:{})}:{state:patch.state as "verified"|undefined,recognition:patch.recognition as "accepted"|undefined})});
   const latest=changed.facts.filter(f=>f.logicalId===fact.logicalId).sort((a,b)=>b.version-a.version)[0];if(!latest)fail("사실 정정의 연결을 확인하지 못했습니다.");
   if(kind==="fact.correct"&&command.sourceRefs?.length){const next=changed.facts.find(f=>f.id===latest.id);if(next)next.refs=command.sourceRefs as SourceRef[];}
   data=changed;data.workflowState=caseWorkflow(previous.workflowState);
   if(kind==="fact.correct"){
    const projected=applyFactProjection(previous,changed,[fact.id],[latest.id]);data=projected.data;data.workflowState=caseWorkflow(previous.workflowState);resetReviews(data,impact);
    const w=data.workflowState;w.reviewHistory.push({at:auth.at,actor:auth.actor,reason:command.reason,before:projected.audit});impact.reviewInvalidation=[...impact.reviewInvalidation as unknown[],...projected.audit.resetReviews];
    w.projectionBlockers=w.projectionBlockers.filter(b=>!b.factIds.includes(fact.id));
    for(const blocker of projected.projection.blockers){w.projectionBlockers.push({code:blocker.code,factIds:[fact.id,latest.id],reason:JSON.stringify(blocker)});w.tasks=mergeCaseTasks(w.tasks,[await makeCaseTask({type:"projection_remap",subject:fact.logicalId,title:"정정 사실의 계산 연결 확인",dependency:latest,evidenceIds:[latest.id],reason:command.reason,at:auth.at})]);}
    impact.projectionBlockers=projected.projection.blockers;
   }else if(latest.state==="retracted"||latest.state==="disputed"||latest.recognition==="rejected"||fact.recognition==="accepted"&&latest.recognition!=="accepted"||fact.state==="verified"&&latest.state!=="verified"){
    const projected=invalidateFactSupport(previous,changed,fact.id,latest.id);data=projected.data;data.workflowState=caseWorkflow(previous.workflowState);resetReviews(data,impact);
    const w=data.workflowState;w.reviewHistory.push({at:auth.at,actor:auth.actor,reason:command.reason,before:projected.audit});impact.reviewInvalidation=[...impact.reviewInvalidation as unknown[],...projected.audit.resetReviews];
    for(const blocker of projected.projection.blockers){w.projectionBlockers.push({code:blocker.code,factIds:[fact.id,latest.id],reason:JSON.stringify(blocker)});w.tasks=mergeCaseTasks(w.tasks,[await makeCaseTask({type:"projection_remap",subject:fact.logicalId,title:"철회·하향 검토 사실의 계산 연결 재확인",dependency:latest,evidenceIds:blocker.candidateFactIds.filter(id=>id!==latest.id),reason:command.reason,at:auth.at})]);}
    impact.projectionBlockers=projected.projection.blockers;
   }else{
    for(const group of [data.incomes,data.debts,data.assets,data.transactions])for(const item of group)item.factIds=item.factIds.map(id=>id===fact.id?latest.id:id);
    data.household.factIds=data.household.factIds.map(id=>id===fact.id?latest.id:id);
    resetReviews(data,impact);
    data.workflowState.reviewHistory.push({at:auth.at,actor:auth.actor,reason:command.reason,before:{factId:fact.id,version:fact.version}});
   }
 }else if(kind==="object.upsert"||kind==="object.remove"||kind==="object.review"){
   assertKeys(target,["collection","objectId"],["collection"]);const collection=enumValue(target.collection,["incomes","debts","assets","transactions"],"수정할 데이터 유형");
   if(kind==="object.upsert"){assertKeys(patch,["item","source"],["item","source"]);if(!patch.item||typeof patch.item!=="object"||Array.isArray(patch.item))fail("편집할 객체를 확인하세요.");if(target.objectId!==undefined&&((patch.item as Record<string,unknown>).id!==target.objectId||typeof target.objectId!=="string"))fail("대상 ID와 수정 객체 ID가 일치하지 않습니다.",409,"CASE_STATE_CONFLICT");data=upsertObject(previous,collection,patch.item as Record<string,unknown>,patch.source as SourceRef,command.reason,auth.actor);}
   else if(kind==="object.remove"){assertKeys(patch,[]);data=removeObject(previous,collection,text(target.objectId,"항목"),command.reason,auth.actor);}
   else {assertKeys(patch,["recognition"],["recognition"]);review(auth);if(isSynthetic(data))fail("합성 객체의 인정은 금지되어 있습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");if(!["unreviewed","accepted","rejected"].includes(String(patch.recognition))||collection==="transactions")fail("객체의 반영 상태를 확인하세요.");const item=data[collection as "incomes"|"debts"|"assets"].find(v=>v.id===target.objectId);if(!item)fail("항목을 찾을 수 없습니다.",404);if(collection==="debts")(item as {legalReview:string}).legalReview=String(patch.recognition);else(item as {recognition:string}).recognition=String(patch.recognition);}
   data.workflowState=caseWorkflow(previous.workflowState);resetReviews(data,impact);
 }else if(kind==="document.retract"){
   assertKeys(target,["documentId"],["documentId"]);assertKeys(patch,[]);data=retractDocument(previous,text(target.documentId,"문서"));data.workflowState=caseWorkflow(previous.workflowState);const retired=data.documents.filter(d=>d.status==="deleted"&&previous.documents.some(p=>p.id===d.id&&p.status==="active")).map(d=>d.id);impact.withdrawPageJobs=retired;for(const m of data.workflowState.documentMatches)if(retired.includes(m.documentId)&&m.state==="accepted"){m.state="stale";m.version++;}resetReviews(data,impact);
 }else if(kind==="document.role"){
   assertKeys(target,["documentId","page"],["documentId","page"]);assertKeys(patch,["role"],["role"]);
   const documentId=text(target.documentId,"문서"),pageNo=target.page,role=enumValue(patch.role,KNOWN_PAGE_ROLES,"페이지 역할");
   if(!Number.isSafeInteger(pageNo)||(pageNo as number)<1)fail("페이지 번호를 확인하세요.");
   const document=data.documents.find(d=>d.id===documentId&&d.status==="active"),page=data.pages.find(p=>p.documentId===documentId&&p.page===pageNo);
   if(!document||!page)fail("현재 사건의 활성 문서 페이지를 선택하세요.",404);
   const immutable=samplePageRole(document.sha256,page.page).role;
   if((page.role==="filed_form"||immutable==="filed_form")&&role!=="filed_form")fail("평가 정답으로 분리한 페이지의 역할은 변경할 수 없습니다.",409,"IMMUTABLE_PAGE_ROLE");
   if(page.role!==role){page.role=role;if(role!=="evidence"){for(const fact of currentFacts(data).filter(f=>f.refs.some(ref=>ref.documentId===documentId&&ref.page===pageNo)))data.facts.push({...fact,id:crypto.randomUUID(),version:fact.version+1,supersedes:fact.id,state:"retracted",recognition:"rejected",reviewer:auth.actor,reviewReason:command.reason,createdAt:auth.at});for(const match of work.documentMatches)if(match.documentId===documentId&&match.state==="accepted"){match.state="stale";match.version++;}}}
   impact.pageRoleMutation={documentId,page:pageNo,role};resetReviews(data,impact);
 }else if(kind==="intake.adopt"){
   assertKeys(target,["runId"],["runId"]);assertKeys(patch,[]);if(!auth.intakeRun||!auth.intakeCatalog||auth.intakeRun.id!==target.runId||auth.intakeRun.caseId!==data.context.id||auth.intakeRun.stale)fail("최신 상담 결과를 다시 확인하세요.",409,"CASE_STATE_CONFLICT");
   data.workflowState={...work,...adoptIntakeRun({workflow:work,run:auth.intakeRun,crosswalk:buildIntakeCrosswalk(auth.intakeCatalog),idFactory:()=>crypto.randomUUID()})};
   for(const r of data.workflowState.requirements)if(!r.retired)data.workflowState.tasks=mergeCaseTasks(data.workflowState.tasks,[await makeCaseTask({type:"requirement",subject:r.requirementId,title:"요구서류와 대상·기간 확인",dependency:r,reason:command.reason,at:auth.at})]);
 }else if(kind==="subject.link"){
   assertKeys(target,["linkId"],["linkId"]);assertKeys(patch,["operation","typedEntityId","expectedVersion","evidenceRefs"],["operation","expectedVersion"]);review(auth);if(isSynthetic(data))fail("합성 사건의 주체 확인을 승인할 수 없습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");const operation=enumValue(patch.operation,["confirm","reject"],"주체 연결 작업"),expectedVersion=patch.expectedVersion;if(!Number.isSafeInteger(expectedVersion)||(expectedVersion as number)<1)fail("연결 판본을 확인하세요.");const index=work.subjectLinks.findIndex(v=>v.linkId===target.linkId);if(index<0)fail("대상 연결이 없습니다.",404);
   const basis=strings(patch.evidenceRefs);if(operation==="confirm"&&basis.some(id=>!BASIS_REF(data).has(id)))fail("현재 사건의 원문 또는 사실 근거를 지정하세요.");
   const ids=[data.context.id,...data.incomes.map(v=>v.id),...data.debts.map(v=>v.id),...data.assets.map(v=>v.id)];if(operation==="confirm"&&!ids.includes(String(patch.typedEntityId)))fail("같은 사건의 실제 대상을 지정하세요.");
   work.subjectLinks[index]=operation==="confirm"?confirmSubjectLink(work.subjectLinks[index]!,{typedEntityId:String(patch.typedEntityId),reviewer:auth.actor,expectedVersion:expectedVersion as number,evidenceRefs:basis}):rejectSubjectLink(work.subjectLinks[index]!,expectedVersion as number,auth.actor);
 }else if(kind==="requirement.override"){
   assertKeys(target,["requirementId"],["requirementId"]);assertKeys(patch,["operation","period","subjectLinkId","alternativeId","basisRefs","mappingReview"],["operation"]);const operation=enumValue(patch.operation,["automatic","add_manual","change_period","change_subject","select_alternative","review_mapping","waive_with_reason","declare_not_applicable","reopen","retire"],"요구서류 변경 작업");const index=work.requirements.findIndex(v=>v.requirementId===target.requirementId);if(index<0)fail("요구서류를 찾지 못했습니다.",404);
   if(["review_mapping","waive_with_reason","declare_not_applicable"].includes(operation)){review(auth);if(isSynthetic(data))fail("합성 사건의 요구서류 검토·면제 승인은 금지되어 있습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");}
   const basis=patch.basisRefs?strings(patch.basisRefs):[];if(basis.some(id=>!BASIS_REF(data).has(id)))fail("현재 사건의 원문 또는 사실 근거를 지정하세요.");
   if(["waive_with_reason","declare_not_applicable"].includes(operation)&&!basis.length)fail("검토 처분에 현재 원문 또는 사실 근거가 필요합니다.");
   if(operation==="change_period"&&(typeof patch.period!=="string"||!patch.period.trim()||patch.period.length>200))fail("요구서류 적용기간을 확인하세요.");
   if(operation==="change_subject"&&patch.subjectLinkId!==null&&(!work.subjectLinks.some(link=>link.linkId===patch.subjectLinkId)))fail("현재 사건의 주체 연결을 선택하세요.");
   if(operation==="select_alternative"&&(typeof patch.alternativeId!=="string"||!patch.alternativeId.trim()))fail("대체 서류 선택을 확인하세요.");
   if(operation==="review_mapping"){
    const raw=patch.mappingReview;if(!raw||typeof raw!=="object"||Array.isArray(raw))fail("요구서류 유형 매핑을 확인하세요.");const mapping=raw as Record<string,unknown>;
    assertKeys(mapping,["expectedCrosswalkId","expectedCrosswalkVersion","requiredFieldGroups","optionalFieldIds","typedTargets","noRequiredFields","subjectScope","periodPolicy"],["expectedCrosswalkId","expectedCrosswalkVersion","requiredFieldGroups","optionalFieldIds","typedTargets","noRequiredFields","subjectScope","periodPolicy"]);
    const requiredFieldGroups=Array.isArray(mapping.requiredFieldGroups)?mapping.requiredFieldGroups.map(group=>strings(group)):fail("필수 필드 그룹을 확인하세요."),optionalFieldIds=strings(mapping.optionalFieldIds),typedTargets=Array.isArray(mapping.typedTargets)?mapping.typedTargets.map(item=>{if(!item||typeof item!=="object"||Array.isArray(item))fail("유형 필드 연결을 확인하세요.");const field=item as Record<string,unknown>;assertKeys(field,["fieldId","targetPath"],["fieldId","targetPath"]);return {fieldId:text(field.fieldId,"필드"),targetPath:text(field.targetPath,"대상 필드")};}):fail("유형 필드 연결을 확인하세요.");
    if(typeof mapping.noRequiredFields!=="boolean")fail("필수 항목 없음 여부를 확인하세요.");
    const prior=work.requirements[index]!;work.requirements[index]=applyRequirementOverride(prior,{operation,expectedId:String(target.requirementId),reason:command.reason,reviewer:auth.actor,reviewedAt:auth.at,mappingReview:{expectedCrosswalkId:text(mapping.expectedCrosswalkId,"교차표 ID"),expectedCrosswalkVersion:text(mapping.expectedCrosswalkVersion,"교차표 판본"),requiredFieldGroups,optionalFieldIds,typedTargets,noRequiredFields:mapping.noRequiredFields,subjectScope:text(mapping.subjectScope,"대상 범위"),periodPolicy:text(mapping.periodPolicy,"적용기간 정책")}});
    work.reviewHistory.push({at:auth.at,actor:auth.actor,reason:command.reason,before:{requirementId:prior.requirementId,priorMapping:prior.crosswalkReview??null}});
   }else work.requirements[index]=applyRequirementOverride(work.requirements[index]!,{...patch,operation:operation as Parameters<typeof applyRequirementOverride>[1]["operation"],expectedId:String(target.requirementId),reason:command.reason,reviewer:auth.actor,basisRefs:basis,waiverAllowed:work.requirements[index]!.requirement==="recommended"});
 }else if(kind==="document.match"){
   assertKeys(target,["requirementId","matchId"],["requirementId"]);assertKeys(patch,["operation","subjectLinkId","documentId","pageIds","coveredPeriod","expectedMatchVersion"],["operation"]);const operation=enumValue(patch.operation,["suggest","accept","reject","unlink","relink"],"문서 연결 작업");
   const req=work.requirements.find(r=>r.requirementId===target.requirementId);if(!req)fail("요구서류가 없습니다.",404);const old=work.documentMatches.find(m=>m.matchId===target.matchId);const docId=String(patch.documentId??old?.documentId??""),doc=data.documents.find(d=>d.id===docId&&d.status==="active"),link=work.subjectLinks.find(l=>l.linkId===(patch.subjectLinkId??old?.subjectLinkId));if(!doc)fail("현재 사건의 활성 문서를 선택하세요.");
   const pageIds=patch.pageIds?strings(patch.pageIds):old?.pageIds??[];if(!pageIds.length||pageIds.some(p=>!data.pages.some(page=>`${page.documentId}:${page.page}`===p&&page.documentId===docId&&page.role==="evidence")))fail("같은 문서의 증빙 페이지를 선택하세요.");
   if(operation!=="suggest"){review(auth);if(isSynthetic(data))fail("합성 사건의 문서 충족 확인을 승인할 수 없습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");}
   if(operation==="suggest"&&target.matchId!==undefined)fail("새 문서 제안에는 기존 연결 ID를 지정할 수 없습니다.");
   if(patch.expectedMatchVersion!==undefined&&(!Number.isSafeInteger(patch.expectedMatchVersion)||(patch.expectedMatchVersion as number)<1))fail("문서 연결 판본을 확인하세요.");
   if(patch.coveredPeriod!==undefined&&patch.coveredPeriod!==null){const period=patch.coveredPeriod as {start?:unknown;end?:unknown};if(!period||typeof period!=="object"||typeof period.start!=="string"||typeof period.end!=="string"||!validDate(period.start)||!validDate(period.end)||period.start>period.end)fail("문서가 포함하는 기간을 확인하세요.");}
   if(!link)fail("현재 사건의 주체 연결을 선택하세요.");
   if(req.subjectLinkId&&link.linkId!==req.subjectLinkId)fail("요구서류에 연결된 확인 주체를 선택하세요.",409,"CASE_STATE_CONFLICT");
   const proposal={matchId:crypto.randomUUID(),requirementId:req.requirementId,subjectLinkId:String(patch.subjectLinkId??old?.subjectLinkId??""),documentId:docId,pageIds,coveredPeriod:patch.coveredPeriod as {start:string;end:string}|null??null,sourceDocumentHash:doc.sha256,reason:command.reason};
   const match=transitionDocumentMatch({operation:operation as "suggest",match:old,proposal,context:{requirement:req,subjectLink:link,document:doc,expectedMatchVersion:Number(patch.expectedMatchVersion)},reviewer:auth.actor});
   work.documentMatches=work.documentMatches.filter(m=>m.matchId!==match.matchId);work.documentMatches.push(match);
 }else if(kind==="requirement.confirm"){
   assertKeys(target,["requirementId"],["requirementId"]);assertKeys(patch,[]);review(auth);if(isSynthetic(data))fail("Synthetic requirement confirmations are prohibited.",409,"SYNTHETIC_REVIEW_PROHIBITED");if(!work.requirements.some(r=>r.requirementId===target.requirementId&&!r.retired))fail("Current requirement is required.",404);if(!auth.requirementComplete||!auth.requirementFingerprint)fail("対象·기간·필수 필드 확인을 먼저 완료하세요.",422,"REQUIRED_INPUT_UNRESOLVED");work.requirementConfirmations.push({requirementId:String(target.requirementId),fingerprint:auth.requirementFingerprint,actor:auth.actor,at:auth.at,reason:command.reason});
 }else if(kind==="task.update"){
   assertKeys(target,["taskId"],["taskId"]);assertKeys(patch,["status","ownerId","dueAt","waitingOn"]);const index=work.tasks.findIndex(t=>t.id===target.taskId);if(index<0)fail("작업을 찾을 수 없습니다.",404);work.tasks[index]=updateCaseTask(work.tasks[index],patch,auth.actor,command.reason,auth.at);data.context.revision=previous.context.revision;data.exportManifest=structuredClone(previous.exportManifest);
 }else if(kind==="decision.propose"||kind==="decision.adopt"){
   if(kind==="decision.propose"){
    assertKeys(target,["path"],["path"]);assertKeys(patch,["value"],["value"]);const path=text(target.path,"계산 입력");if(!["monthlyTrusteeFee","monthlyPriorityPayment","monthlyEstatePayment","approvedMonthlyPayment","planMonths","allocationBasis"].includes(path))fail("이 값은 계산 입력 제안으로 변경할 수 없습니다.");const monetaryPath=["monthlyTrusteeFee","monthlyPriorityPayment","monthlyEstatePayment","approvedMonthlyPayment"].includes(path);if(!monetaryPath&&(command.sourceRefs?.length||command.effectivePeriod))fail("원문 근거와 적용기간은 계산 금액 제안에만 사용할 수 있습니다.");
    const parsed=parseContextPatch({[path]:patch.value},previous.context);let calculationOverride:import("./calculation-overrides.ts").CalculationOverride|undefined;
    if(["monthlyTrusteeFee","monthlyPriorityPayment","monthlyEstatePayment","approvedMonthlyPayment"].includes(path)){
     const refs=command.sourceRefs as SourceRef[]|undefined,period=command.effectivePeriod;if(!refs?.length||!period||!validDate(period.start)||!validDate(period.end)||period.start>period.end)fail("계산 금액 제안에는 현재 원문 근거와 적용기간이 필요합니다.",422,"REQUIRED_INPUT_UNRESOLVED");
     const amount=moneyValue(parsed[path as OverrideField] as NumericInput);const matching=currentFacts(previous).filter(f=>f.state==="verified"&&f.recognition==="accepted"&&refs.some(ref=>f.refs.some(source=>source.documentId===ref.documentId&&source.page===ref.page&&source.quote===ref.quote&&(!source.sourceHash||source.sourceHash===ref.sourceHash)))&&sourceFactMoneyValue(f)===amount);
     if(amount===null||matching.length!==1)fail("계산 금액 제안과 현재 확인된 원문 금액을 일치시켜야 합니다.",422,"REQUIRED_INPUT_UNRESOLVED");
     calculationOverride=proposeCalculationOverride(previous,path as OverrideField,parsed[path as OverrideField] as NumericInput,{scope:`case:${previous.context.id}`,sourceIds:[matching[0]!.id],reason:command.reason,effectivePeriod:period});
    }
    const baseFingerprint=calculationOverride?.baseFingerprint??await commandHash({context:{...previous.context,revision:0},incomes:previous.incomes,debts:previous.debts,household:previous.household,assets:previous.assets});
    work.decisions.push({id:crypto.randomUUID(),path,proposedValue:parsed[path as keyof typeof parsed],status:"proposed",baseFingerprint,actor:auth.actor,reason:command.reason,at:auth.at,...(calculationOverride?{calculationOverride}:{})});
   }
   else {
    assertKeys(target,["proposalId"],["proposalId"]);assertKeys(patch,[]);review(auth);if(isSynthetic(data))fail("합성 사건의 계산 입력 승인은 금지되어 있습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");const decision=work.decisions.find(d=>d.id===target.proposalId);if(!decision||decision.status!=="proposed")fail("현재 제안을 찾을 수 없습니다.",409);
    const currentFingerprint=decision.calculationOverride?calculationBaseFingerprint(previous):await commandHash({context:{...previous.context,revision:0},incomes:previous.incomes,debts:previous.debts,household:previous.household,assets:previous.assets});if(decision.baseFingerprint!==currentFingerprint)fail("제안 이후 계산 입력이 바뀌었습니다.",409,"CASE_STATE_CONFLICT");
    if(decision.calculationOverride){const adopted=adoptCalculationOverride(previous,assessCase(previous,CURRENT_RULESET).calculation,decision.calculationOverride);if(adopted.status!=="adopted"||!adopted.context)fail("계산 입력 근거가 만료되었거나 예산 정합성을 통과하지 못했습니다: "+adopted.issues.join(", "),422,"REQUIRED_INPUT_UNRESOLVED");(data.context as unknown as Record<string,unknown>)[decision.calculationOverride.field]=adopted.context[decision.calculationOverride.field];}
    else Object.assign(data.context,parseContextPatch({[decision.path]:decision.proposedValue},previous.context));
    resetReviews(data,impact);decision.status="adopted";
   }
 }else if(kind==="legalCheck.dispose"){
   assertKeys(target,["runId","checkId"],["runId","checkId"]);assertKeys(patch,["status","evidenceFactIds","role"],["status","evidenceFactIds","role"]);const role=enumValue(patch.role,["caseworker","lawyer"],"검토 역할"),status=enumValue(patch.status,["accepted","rejected","needs_review"],"검토 처분");review(auth,role==="lawyer"?"lawyer_review":"caseworker_review");if(isSynthetic(data))fail("합성 사건의 법률 판단 승인은 금지되어 있습니다.",409,"SYNTHETIC_REVIEW_PROHIBITED");const run=auth.legalRun;if(!auth.legalRunVerified||!run||run.id!==target.runId||run.checkId!==target.checkId||!run.dependencyFingerprint||!run.subjectFingerprint||!Array.isArray(run.factIds)||!run.factIds.length||! ["pass","fail","missing","conflict","not_applicable","legal_review"].includes(run.status)||(status==="accepted"&&(run.truncated===true||run.coverageComplete!==true)))fail("현재 서버 검증 법률 실행을 확인하세요. 불완전한 근거에서는 승인할 수 없습니다.",409,"CASE_STATE_CONFLICT");const currentIds=new Set(currentFacts(data).map(f=>f.id));if(run.factIds.some(id=>!currentIds.has(id)))fail("법률 실행의 근거 사실이 현재 판본이 아닙니다.",409,"CASE_STATE_CONFLICT");const ids=strings(patch.evidenceFactIds);if(!ids.length||ids.some(id=>!currentIds.has(id)))fail("현재 사실 근거를 선택하세요.");work.legalDispositions.push(recordLegalCheckDisposition(run,{status,evidenceFactIds:ids,reason:command.reason,actor:auth.actor,role,dependencyFingerprint:run.dependencyFingerprint,at:auth.at}));
 }else if(kind==="document.edit"){
   assertKeys(target,["artifactId","fieldId","rowId"],["artifactId","fieldId"]);assertKeys(patch,["value","baseValue"],["value","baseValue"]);const artifactId=text(target.artifactId,"생성물"),fieldId=text(target.fieldId,"문서 필드"),rowId=target.rowId===undefined||target.rowId===null?null:text(target.rowId,"행");const field=Object.values(FORM_CONTRACTS).flatMap(f=>f.fields).find(f=>f.token===fieldId);if(!field||!["prose","layout"].includes(field.kind))fail("금액·원천 항목은 원장 또는 계산 입력에서 정정하세요.",422,"SOURCE_COMMAND_REQUIRED");if(!previous.exportManifest?.files.some(f=>f.id===artifactId&&f.status==="current"))fail("현재 생성물 문서 후보를 선택하세요.",409,"CASE_STATE_CONFLICT");if(typeof patch.value!=="string"||patch.value.length>20000||typeof patch.baseValue!=="string")fail("문서 편집 값을 확인하세요.");const docBase=auth.documentBases?.find(v=>v.artifactId===artifactId&&v.fieldId===fieldId&&(v.rowId??null)===rowId);if(!docBase||patch.baseValue!==docBase.value||!command.baseValueHash||command.baseValueHash!==await documentEditBaseHash({artifactId,fieldId,rowId,value:docBase.value}))fail("문서 기준값이 변경되었습니다. 현재 생성물을 다시 불러오세요.",409,"CASE_STATE_CONFLICT");work.documentEdits.push({id:crypto.randomUUID(),artifactId,fieldId,rowId,kind:field.kind as "prose"|"layout",baseValue:docBase.value,value:patch.value,actor:auth.actor,reason:command.reason,at:auth.at});
 }else if(kind==="document.review"){
   assertKeys(target,[]);assertKeys(patch,["role","fingerprint"],["role","fingerprint"]);const role=enumValue(patch.role,["caseworker","lawyer"],"검토 역할");review(auth,role==="lawyer"?"lawyer_review":"caseworker_review");if(isSynthetic(data)||previous.exportManifest?.mode!=="final"||auth.processingReady!==true||!executeCaseNodes(previous).assessment.generationGate.canFinalize)fail("최신 최종 검토본과 모든 검토 요건을 확인하세요.",422,"REQUIRED_INPUT_UNRESOLVED");if(typeof patch.fingerprint!=="string"||!patch.fingerprint)fail("생성물 지문이 필요합니다.");try{data=reviewExport(previous,role,auth.actor,patch.fingerprint);}catch(error){if(error instanceof Error&&error.message==="검토한 생성물 집합이 변경되었습니다.")fail("검토한 생성물 집합이 변경되었습니다.",409,"CASE_STATE_CONFLICT");throw error;}data.context.revision=previous.context.revision;
 }else if(kind==="document.archive"){
   assertKeys(target,["fileId"],["fileId"]);assertKeys(patch,[]);data=archiveExport(previous,String(target.fileId));
 }else if(kind==="procedure.record"){
   assertKeys(target,[]);assertKeys(patch,["state","occurredAt","sourceDocumentIds","courtReference","relatedFields","artifactIds"],["state","occurredAt","sourceDocumentIds","artifactIds"]);review(auth);if(isSynthetic(data))fail("합성 사건의 실제 제출·법원 상태는 기록할 수 없습니다.",409,"SYNTHETIC_FINAL_PROHIBITED");const state=enumValue(patch.state,["generated","human_reviewed","sent","submitted","received","correction_requested","amended","approved","discontinued","discharged"],"절차 상태"),sourceDocumentIds=strings(patch.sourceDocumentIds),artifactIds=strings(patch.artifactIds),activeDocs=new Set(data.documents.filter(d=>d.status==="active").map(d=>d.id)),currentArtifacts=new Set(previous.exportManifest?.files.filter(f=>f.status==="current").map(f=>f.id)??[]);if(sourceDocumentIds.some(id=>!activeDocs.has(id))||artifactIds.some(id=>!currentArtifacts.has(id)))fail("현재 사건의 활성 문서와 생성물을 지정하세요.");const event=validateProcedureEvent({id:crypto.randomUUID(),state,occurredAt:String(patch.occurredAt),recordedAt:auth.at,actor:auth.actor,sourceDocumentIds,courtReference:patch.courtReference?String(patch.courtReference):null,reason:command.reason,relatedFields:patch.relatedFields?strings(patch.relatedFields):[],artifactIds},[...activeDocs],[...currentArtifacts]);work.procedureEvents.push(event);if(event.state==="correction_requested")work.tasks=mergeCaseTasks(work.tasks,[await makeCaseTask({type:"court_correction",subject:event.id,title:"보정 요청 확인 및 자료 보완",dependency:event,evidenceIds:event.sourceDocumentIds,reason:command.reason,at:auth.at})]);
 }else fail("지원하지 않는 명령입니다.");
 if(data.workflowState)data.workflowState.version++;
 return {data,impact};
}
