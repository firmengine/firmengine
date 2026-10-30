import { legalReviewInputFingerprint } from "./legal-review-identity.ts";
import { parseCaseCommand,commandHash,CommandError,type CaseCommand } from "./case-command-contract.ts";
import { reduceCaseCommand,assertMutableCase,type CommandAuthority } from "./case-commands.ts";
import { db,getCase,saveCase,readCommandReceipt,caseStateFingerprint,requireUploadedSource,getProcessingReadiness,requireHumanActor,now } from "./server-store";
import { rolesForActor } from "./app-roles";
import { getConsultationView,getIntakeCatalog } from "./intake-store";
import { buildCaseWorkflowView } from "./case-workflow-view.ts";
import { caseResponse } from "./case-response";
import { referenceIdentity } from "./reference-runtime.ts";
import { snapshotSha256 } from "./calculator-tools.ts";
import { EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import referenceRelease from "./reference-release.json" with { type: "json" };
import type { CaseData } from "./domain.ts";
import { legacyCaseCommand } from "./legacy-case-command.ts";
import { legalCheckCoverageComplete } from "./legal-review-packet.ts";
import { RISK_CATALOG } from "./legal-rules.ts";
import { prepareCaseSchemaMigration,type CaseSchemaMigrationRequest } from "./case-schema-migration.ts";

function conflict(message:string):never{throw new CommandError("CASE_STATE_CONFLICT",409,message);}
async function authorize(caseId:string){const actor=await requireHumanActor(),roles=await rolesForActor(actor,caseId);if(!roles.includes("case_editor"))throw new CommandError("HUMAN_ROLE_REQUIRED",403,"사건 수정 권한을 지정받아야 합니다.");return {actor,roles};}
export async function commandReceipt(caseId:string,commandId:string){
  const {actor}=await authorize(caseId),receipt=await readCommandReceipt(caseId,commandId);
  if(receipt&&receipt.actor!==actor)throw new CommandError("HUMAN_ROLE_REQUIRED",403,"다른 담당자의 명령 영수증입니다.");
  return receipt;
}
async function commandResult(caseId:string,receipt:Record<string,unknown>,duplicate:boolean){
  // The commit receipt is authoritative even if read-side calculation/storage is temporarily unavailable.
  try{return {committed:true,duplicate,receipt,...await caseResponse(caseId)};}
  catch{return {committed:true,duplicate,receipt,pending:true,code:"EVALUATION_PENDING",message:"변경은 저장되었습니다. 같은 명령을 새로 만들지 말고 결과를 다시 조회하세요."};}
}
async function currentLegalRun(data:CaseData,command:CaseCommand){
  const row=await db().prepare("SELECT id,payload FROM analyses WHERE id=? AND case_id=? AND type IN ('legal_advisory','legal_review')").bind(command.target.runId,data.context.id).first<{id:string;payload:string}>();
  if(!row)conflict("현재 사건 판본의 법률 검토 실행을 찾지 못했습니다.");
  const payload=JSON.parse(row.payload),receipt=payload.calculatorExecution;
  const refHash=referenceIdentity()?.sha256??referenceRelease.sha256;
  const semanticHash=await legalReviewInputFingerprint(data,refHash,EXECUTION_CONTRACT_VERSION);
  const sourceVersion=await db().prepare("SELECT data_version AS version FROM case_data_change_state WHERE case_id=?")
    .bind(data.context.id).first<{version:number}>();
  if(!sourceVersion||payload.sourceDataVersion!==sourceVersion.version)
    conflict("법률 AI 검토 이후 OCR·상담·사건 원천 데이터가 바뀌었습니다.");
  const inputMatches=payload.reviewInputFingerprint?payload.reviewInputFingerprint===semanticHash:receipt?.inputSha256===await snapshotSha256(data);
  if(!inputMatches||receipt?.referenceRelease?.sha256!==(referenceIdentity()?.sha256??referenceRelease.sha256)||receipt?.contractVersion!==EXECUTION_CONTRACT_VERSION)conflict("검토 실행 이후 입력·기준이 바뀌었습니다.");
  const checks=Array.isArray(payload.checks)?payload.checks:[],matches=checks.filter((c:{id?:string})=>c.id===command.target.checkId);
  if(matches.length!==1)conflict("검토 항목이 누락되었거나 중복되어 있습니다.");
  const check=matches[0],dependencyFingerprint=await commandHash({input:semanticHash,reference:receipt.referenceRelease.sha256,contract:receipt.contractVersion,checkId:check.id});
  const sourceRisk=RISK_CATALOG.find(item=>item.id===check.id);
  if(!sourceRisk)conflict("검토 항목이 현재 법률 기준 카탈로그에 없습니다.");
  const risk={id:sourceRisk.id,title:sourceRisk.title,conditions:String(sourceRisk.conditions??""),features:sourceRisk.required_features??[],request:String(sourceRisk.evidence_request??""),legalRuleIds:sourceRisk.current_rule_ids??[],manual:!sourceRisk.implementation.may_auto_clear};
  const incomplete=!legalCheckCoverageComplete(risk,payload.evidenceCoverage??{});
  if(incomplete&&command.patch.status==="accepted")throw new CommandError("REQUIRED_INPUT_UNRESOLVED",422,"누락·잘림이 있는 법률 보조판단은 종결할 수 없습니다.");
  return {id:row.id,checkId:String(check.id),subjectFingerprint:await commandHash({checkId:check.id,factIds:check.factIds}),dependencyFingerprint,status:String(check.status),factIds:check.factIds,source:"ai" as const,truncated:incomplete,coverageComplete:!incomplete};
}
export async function executeLegacyCaseCommand(caseId:string,body:Record<string,unknown>){
  const identity=await authorize(caseId),legacyRequestHash=await commandHash(body);
  const existingResult=async()=>{
    const receipt=typeof body.commandId==="string"?await readCommandReceipt(caseId,body.commandId):null;
    if(!receipt)return null;
    let impact:Record<string,unknown>={};try{impact=typeof receipt.impact==="string"?JSON.parse(receipt.impact):receipt.impact as Record<string,unknown>;}catch{conflict("저장된 명령 영수증의 무결성을 확인하세요.");}
    if(receipt.actor!==identity.actor||impact.legacyRequestHash!==legacyRequestHash)conflict("같은 명령 식별자가 다른 변경에 사용되었습니다.");
    return commandResult(caseId,receipt,true);
  };
  const existing=await existingResult();if(existing)return existing;
  try{return await executeCaseCommand(caseId,await legacyCaseCommand(body,await getCase(caseId)),{legacyRequestHash});}
  catch(error){
    // A concurrent copy may commit after the first lookup and supersede the fact
    // that the legacy adapter needs. Resolve the original request from its receipt.
    const committed=await existingResult();if(committed)return committed;
    throw error;
  }
}
export async function executeCaseCommand(caseId:string,raw:unknown,audit?:{legacyRequestHash:string}){
  const command=parseCaseCommand(raw),identity=await authorize(caseId),requestHash=await commandHash(command);
  const existing=await readCommandReceipt(caseId,command.commandId);
  if(existing){if(existing.actor!==identity.actor||existing.requestHash!==requestHash)conflict("같은 명령 식별자가 다른 요청에 사용되었습니다.");return commandResult(caseId,existing,true);}
  const previous=await getCase(caseId);await assertMutableCase(previous);
  const before=await caseStateFingerprint(previous);
  if(previous.context.revision!==command.expectedRevision||before!==command.expectedStateFingerprint)throw new CommandError("CASE_STATE_CONFLICT",409,"사건 상태가 바뀌었습니다. 최신 내용을 불러와 차이를 확인하세요.",{expectedRevision:command.expectedRevision,currentRevision:previous.context.revision,expectedStateFingerprint:command.expectedStateFingerprint,currentStateFingerprint:before,target:command.target,currentContext:command.commandType==="context.update"?Object.fromEntries(Object.keys((command.patch.context??{}) as object).map(key=>[key,(previous.context as unknown as Record<string,unknown>)[key]])):undefined,reloadUrl:`/api/cases/${encodeURIComponent(caseId)}`});
  const authority:CommandAuthority={...identity,at:now(),referenceSha256:referenceIdentity()?.sha256??referenceRelease.sha256};
  if(command.commandType==="schema.migrate"){
    try{authority.migrationPlan=await prepareCaseSchemaMigration(previous,{caseId,expectedRevision:previous.context.revision,expectedInputSha256:String(command.patch.sourceSha256??""),migrationVersion:command.patch.migrationVersion,mode:command.patch.mode} as CaseSchemaMigrationRequest,[caseId]);}
    catch(error){throw new CommandError("MIGRATION_STATE_CONFLICT",409,"전환 대상 또는 판본이 달라졌습니다. 최신 전환 미리보기를 확인하세요.",{reason:error instanceof Error?error.message:"MIGRATION_INVALID"});}
  }
  if(command.commandType==="intake.adopt"){
    const [view,catalog]=await Promise.all([getConsultationView(caseId),getIntakeCatalog()]);authority.intakeRun=view.run??undefined;authority.intakeCatalog=catalog.catalog;
  }
  if(command.commandType==="requirement.override"&&["review_mapping","review_substitution"].includes(String(command.patch.operation)))authority.intakeCatalog=(await getIntakeCatalog()).catalog;
  if(command.commandType==="requirement.confirm"){
    const view=await buildCaseWorkflowView(previous),id=String(command.target.requirementId);authority.requirementFingerprint=view.requirementFingerprints[id];authority.requirementComplete=view.requirementStates.some(state=>state.requirementId===id&&state.engineFulfillment==="complete"&&state.requirementStatus==="eligible_for_confirmation");
  }
  if(command.commandType==="legalCheck.dispose"){authority.legalRun=await currentLegalRun(previous,command);authority.legalRunVerified=true;}
  if(command.commandType==="document.edit"){
    const manifest=previous.exportManifest;
    const bases=manifest?.documentWriter?.fieldBases??[];
    authority.documentBases=bases.filter(raw=>{
      if(!raw||typeof raw!=="object")return false;
      const base=raw as Record<string,unknown>;
      return typeof base.artifactId==="string"&&typeof base.fieldId==="string"&&typeof base.value==="string"&&(base.rowId===null||typeof base.rowId==="string")&&!!manifest?.files.some(file=>file.id===base.artifactId&&file.status==="current"&&file.hash===base.artifactHash);
    });
  }
  if(command.commandType==="object.upsert")await requireUploadedSource(previous,command.patch.source as {documentId?:string;page?:number});
  if(command.commandType==="document.review"){authority.processingReady=(await getProcessingReadiness(previous)).complete;if(!authority.processingReady)throw new CommandError("REQUIRED_INPUT_UNRESOLVED",422,"증빙 처리와 독립 대조를 먼저 완료하세요.");}
  let result:Awaited<ReturnType<typeof reduceCaseCommand>>;
  try{result=await reduceCaseCommand(previous,command,authority);}catch(error){if(error instanceof Error&&error.constructor===Error)throw new CommandError("INVALID_COMMAND",400,error.message);throw error;}
  if(audit)result.impact.legacyRequestHash=audit.legacyRequestHash;
  // Verify again after asynchronous dependency reads, before the transaction's own authorization guard.
  const currentRoles=await rolesForActor(identity.actor,caseId);
  if(identity.roles.some(role=>!currentRoles.includes(role)))throw new CommandError("HUMAN_ROLE_REQUIRED",403,"처리 중 권한이 변경되었습니다.");
  const roles=identity.roles.filter(role=>role!=="role_admin"),marks=roles.map(()=>"?").join(",");
  const authSql=`(SELECT COUNT(DISTINCT role) FROM app_role_grants WHERE actor_id=? AND role IN (${marks}) AND scope_id IN ('*',?) AND status='active' AND effective_from<=? AND (effective_to IS NULL OR effective_to>?))=?`;
  try{
    await saveCase(result.data,command.expectedRevision,previous,{commandId:command.commandId,commandType:command.commandType,requestHash,actor:identity.actor,beforeStateHash:before,impact:result.impact,authorization:{sql:authSql,params:[identity.actor,...roles,caseId,now(),now(),roles.length]},guardedStatements:(token)=>{
      const guard="EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=? AND storage_token=?)",args=[caseId,result.data.context.revision,token];
      if(command.commandType==="document.retract")return [db().prepare(`UPDATE page_jobs SET status='withdrawn',lease_until=NULL WHERE case_id=? AND document_id=? AND ${guard}`).bind(caseId,command.target.documentId,...args)];
      if(command.commandType==="document.role"){
        const role=command.patch.role;
        // Role changes do not automatically start OCR. Explicit process controls remain separate.
        return [db().prepare(`UPDATE page_jobs SET role=?,status=CASE WHEN ?='evidence' AND image_key IS NOT NULL THEN 'pending' WHEN ?='evidence' THEN 'awaiting_upload' ELSE 'held' END,error=NULL,lease_until=NULL WHERE case_id=? AND document_id=? AND page=? AND ${guard}`).bind(role,role,role,caseId,command.target.documentId,command.target.page,...args)];
      }
      return [];
    }});
  }catch(error){
    const committed=await readCommandReceipt(caseId,command.commandId).catch(()=>null);
    if(committed&&committed.actor===identity.actor&&committed.requestHash===requestHash)return commandResult(caseId,committed,true);
    throw error;
  }
  const receipt=await readCommandReceipt(caseId,command.commandId).catch(()=>null);
  if(!receipt)return {committed:true,pending:true,commandId:command.commandId,code:"EVALUATION_PENDING"};
  return commandResult(caseId,receipt,false);
}
