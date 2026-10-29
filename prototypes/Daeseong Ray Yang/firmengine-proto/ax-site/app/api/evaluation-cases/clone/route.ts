import { requireSameOrigin,jsonBody,errorResponse,getCase,db,now,HttpError } from "../../../../lib/server-store";
import { requireAppRole } from "../../../../lib/app-roles";
import { cloneEvaluationCase,evaluationCloneMatchesSource } from "../../../../lib/case-migration.ts";
import { caseResponse } from "../../../../lib/case-response";
export async function POST(request:Request){try{
 requireSameOrigin(request);const actor=await requireAppRole("case_editor"),body=await jsonBody(request);
 if(Object.keys(body).some(k=>!["sourceCaseId","targetCaseId","reason"].includes(k))||typeof body.reason!=="string"||!body.reason.trim())throw new HttpError(400,"복제 대상과 평가 사유를 입력하세요.");
 const target=String(body.targetCaseId??"");if(!/^evaluation-clone-[a-zA-Z0-9_-]{8,128}$/.test(target))throw new HttpError(400,"전용 복제 사건 식별자가 필요합니다.");
 const source=await getCase(String(body.sourceCaseId)),at=now();let clone;
 try{clone=await cloneEvaluationCase(source,target,at);}catch(error){throw new HttpError(409,error instanceof Error?error.message:"복제 원본을 확인하세요.");}
 const prior=await db().prepare("SELECT id FROM cases WHERE id=?").bind(target).first();
 if(prior){const current=await getCase(target);if(!evaluationCloneMatchesSource(current,source,clone.evaluationClone!.sourceInputSha256))throw new HttpError(409,"다른 원본에서 만든 사건 ID입니다.");return Response.json({duplicate:true,...await caseResponse(current)});}
 await db().batch([
 db().prepare("INSERT INTO cases (id,name,owner,revision,payload,created_at,updated_at,storage_token) VALUES (?,?,?,?,?,?,?,?)").bind(target,clone.context.caseName,actor,1,JSON.stringify(clone),at,at,crypto.randomUUID()),
 db().prepare("INSERT INTO events (id,case_id,actor,type,detail,at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),target,actor,"evaluation.clone_created",JSON.stringify({sourceCaseId:source.context.id,inputSha256:clone.evaluationClone!.sourceInputSha256,reason:body.reason,finalSubmissionProhibited:true}),at),
 ]);
 return Response.json({duplicate:false,...await caseResponse(await getCase(target))},{status:201,headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
