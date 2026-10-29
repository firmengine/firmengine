import { caseExtras,db,errorResponse,HttpError,getCase,jsonBody,requireHumanActor,requireSameOrigin } from "../../../lib/server-store";
import { REFERENCE_RELEASE,referenceRecord,referenceRecordsPage } from "../../../lib/reference-registry.ts";
import { activateReferenceChange,approveReferenceBundle,bootstrapReferenceData,getPendingReferenceChange,listPendingReferenceChanges,listReferenceReleaseHistory,previewReferenceReleaseRestore,proposeReferenceChange,referenceStorageStatus,restoreReferenceRelease } from "../../../lib/reference-store.ts";
import { loadReferenceSnapshot } from "../../../lib/reference-context.ts";
import { currentReferenceSnapshot } from "../../../lib/reference-runtime.ts";
import { inspectReferenceSnapshotBundle } from "../../../lib/reference-context.ts";
import { requireAppRole } from "../../../lib/app-roles.ts";
import { env } from "cloudflare:workers";
import { planReferenceImpact,type ReferenceDependency } from "../../../lib/reference-impact.ts";

const response=(value:unknown)=>Response.json(value,{headers:{"Cache-Control":"no-store"}});
async function referenceImpactPreview(request:Request){
  const query=new URL(request.url).searchParams,proposalId=query.get("proposalId")??"",caseIds=query.getAll("caseId");
  if(!proposalId||!caseIds.length||caseIds.length>52||new Set(caseIds).size!==caseIds.length||caseIds.some(id=>!id||id.length>180))throw new HttpError(400,"제안 ID와 중복 없는 사건 ID 1~52개를 지정하세요.");
  const reviewer=await requireAppRole("reference_approve"),proposal=await getPendingReferenceChange(db(),proposalId);
  if(!proposal)throw new HttpError(404,"검토 대기 중인 기준 제안을 찾을 수 없습니다.");
  const record=referenceRecord(proposal.referenceId);if(!record)throw new HttpError(400,"기준 항목을 확인할 수 없습니다.");
  const change={artifactIds:[proposal.referenceId],...(proposal.applicationContract?.jurisdiction?{jurisdictions:[proposal.applicationContract.jurisdiction]}:record.courtIds.length?{jurisdictions:record.courtIds}:{}),...(proposal.applicationContract?.dateBasis?{dateBasis:proposal.applicationContract.dateBasis}:{}),...(proposal.effectiveFrom?{effectiveFrom:proposal.effectiveFrom}:{}),...(proposal.applicationContract?.effectiveTo?{effectiveTo:proposal.applicationContract.effectiveTo}:{})};
  const dependencies:ReferenceDependency[]=[],details:{caseId:string;dependencyStatus:"known"|"unknown";matchingArtifactIds:string[];currentArtifactIds:string[]}[]=[];
  for(const caseId of caseIds){
    const owner=await db().prepare("SELECT owner FROM cases WHERE id=?").bind(caseId).first<{owner:string}>();
    if(!owner)throw new HttpError(404,"지정한 사건을 찾을 수 없습니다.");
    if(owner.owner!==reviewer)throw new HttpError(403,"지정한 사건의 영향 정보를 볼 권한이 없습니다.");
    const data=await getCase(caseId),extras=await caseExtras(data),envelope=extras.derivedEvaluation as {status?:string;execution?:{referenceApplication?:{status?:string;artifactIds?:string[]}}}|null;
    const receipt=envelope?.status==="complete"?envelope.execution?.referenceApplication:undefined;
    const dependencyIds=receipt?.status==="resolved"&&Array.isArray(receipt.artifactIds)?receipt.artifactIds:undefined;
    const dates:Record<string,string>={};if(data.context.applicationDate)dates.applicationDate=data.context.applicationDate;if(data.context.asOf)dates.asOf=data.context.asOf;
    dependencies.push({caseId,jurisdiction:data.context.courtId||null,dates,dependencyIds,state:"unknown"});
    details.push({caseId,dependencyStatus:dependencyIds?"known":"unknown",matchingArtifactIds:(dependencyIds??[]).filter(id=>change.artifactIds.includes(id)),currentArtifactIds:(data.exportManifest?.files??[]).filter(file=>file.status==="current").map(file=>file.id)});
  }
  const impact=planReferenceImpact(dependencies,change);
  return response({proposalId,baseSha256:proposal.baseSha256,artifactIds:change.artifactIds,impact,details,readOnly:true,caseWrites:0,submittedOrCurrentArtifactsChanged:false});
}
export async function GET(request:Request){try{
  const query=new URL(request.url).searchParams;
  if(query.get("action")==="impact")return await referenceImpactPreview(request);
  if(query.get("action")==="restore_preview"){
    await requireAppRole("reference_approve");
    return response(await previewReferenceReleaseRestore(db(),query.get("targetSha256")??"",query.get("expectedActiveSha256")??""));
  }
  const page=referenceRecordsPage({kind:query.get("kind")||undefined,q:query.get("q")||undefined,offset:Number(query.get("offset")??0),limit:Number(query.get("limit")??50)});
  const active=currentReferenceSnapshot()??await loadReferenceSnapshot(db());
  return response({release:REFERENCE_RELEASE,active,bundleInspection:inspectReferenceSnapshotBundle(active),history:await listReferenceReleaseHistory(db()),storage:await referenceStorageStatus(db()),proposals:await listPendingReferenceChanges(db()),...page});
}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{
  requireSameOrigin(request);const input=await jsonBody(request);
  if(input.action==="bootstrap"){await requireAppRole("role_admin");return response(await bootstrapReferenceData(db(),input.offset??0,input.limit??200));}
  if(input.action==="propose")return response(await proposeReferenceChange(db(),input,await requireHumanActor()));
  if(input.action==="approve_bundle"){const actor=await requireAppRole("reference_approve");return response(await approveReferenceBundle(db(),{artifactIds:input.artifactIds,expectedActiveSha256:String(input.expectedActiveSha256??""),reason:String(input.reason??"")},actor));}
  if(input.action==="restore_release"){const actor=await requireAppRole("reference_approve");return response(await restoreReferenceRelease(db(),{targetSha256:String(input.targetSha256??""),expectedActiveSha256:String(input.expectedActiveSha256??""),reason:String(input.reason??"")},actor));}
  if(input.action==="activate"){const actor=await requireAppRole("reference_approve");return response(await activateReferenceChange(db(),String(input.proposalId??""),String(input.expectedActiveSha256??""),actor,String(input.expectedProposalFingerprint??""),{fourEyesRequired:(env as unknown as Record<string,string>).FIRMENGINE_REFERENCE_FOUR_EYES==="true"}));}
  throw new HttpError(400,"기준정보 작업을 확인하세요.");
}catch(error){if(error instanceof Error&&/^(INVALID_|UNKNOWN_|REFERENCE_|OFFICIAL_)/.test(error.message))return errorResponse(new HttpError(error.message.includes("FOUR_EYES_REQUIRED")?403:error.message.includes("TARGET_NOT_FOUND")?404:error.message.includes("CONFLICT")?409:400,error.message));return errorResponse(error);}}
