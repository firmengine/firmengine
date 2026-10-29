import { env } from "cloudflare:workers";
import { db,requireHumanActor,HttpError,now } from "./server-store";
export const APP_ROLES=["case_editor","caseworker_review","lawyer_review","reference_approve","role_admin"] as const;
export type AppRole=typeof APP_ROLES[number];
export interface RoleGrant {actorId:string;role:AppRole;scopeId:string;status:string;effectiveFrom:string;effectiveTo:string|null;policyRevision:number}
export function roleGrantApplies(grant:RoleGrant,actorId:string,role:AppRole,scopeId:string,at:string){return grant.actorId===actorId&&grant.role===role&&(grant.scopeId==="*"||grant.scopeId===scopeId)&&grant.status==="active"&&grant.effectiveFrom<=at&&(!grant.effectiveTo||grant.effectiveTo>at);}
export async function rolesForActor(actorId:string,scopeId="*"){
  if(actorId===(env as unknown as Record<string,string>).FIRMENGINE_OWNER_ID){
    // Preserve the verified site's existing editing capability. Professional review roles still require explicit grants.
    const at=now();
    await db().prepare("INSERT OR IGNORE INTO app_role_grants (actor_id,role,scope_id,status,effective_from,effective_to,granted_by,reason,policy_revision,created_at,revoked_at) VALUES (?,'case_editor','*','active',?,NULL,'system:verified-site-owner','기존 사이트 소유자의 편집 권한 유지',1,?,NULL)").bind(actorId,at,at).run();
  }
  const grants=(await db().prepare("SELECT actor_id AS actorId,role,scope_id AS scopeId,status,effective_from AS effectiveFrom,effective_to AS effectiveTo,policy_revision AS policyRevision FROM app_role_grants WHERE actor_id=?").bind(actorId).all<RoleGrant>()).results;
  const roles=APP_ROLES.filter(role=>grants.some(g=>roleGrantApplies(g,actorId,role,scopeId,now())));
  // The control-plane verified owner may administer app roles, not impersonate professional reviewers.
  if(actorId===(env as unknown as Record<string,string>).FIRMENGINE_OWNER_ID&&!roles.includes("role_admin"))roles.push("role_admin");
  return roles;
}
export async function requireAppRole(role:AppRole,scopeId="*"){
  const who=await requireHumanActor();if(!(await rolesForActor(who,scopeId)).includes(role))throw new HttpError(403,`HUMAN_ROLE_REQUIRED: ${role} 권한을 지정받은 담당자가 필요합니다.`);return who;
}
export async function updateRoleGrant(body:Record<string,unknown>){
  const who=await requireAppRole("role_admin");
  if(typeof body.actorId!=="string"||! /^[a-zA-Z0-9_-]{3,128}$/.test(body.actorId)||!APP_ROLES.includes(body.role as AppRole)||body.role==="role_admin"||typeof body.reason!=="string"||!body.reason.trim()||!["grant","revoke"].includes(String(body.operation)))throw new HttpError(400,"권한 대상·종류·사유를 확인하세요.");
  const scope=body.scopeId??"*";if(typeof scope!=="string"||!scope.trim()||scope.length>128)throw new HttpError(400,"권한 범위를 확인하세요.");
  if(body.actorId==="private-site-service")throw new HttpError(403,"서비스·모델에게 사람 검토 권한을 줄 수 없습니다.");
  const at=now(),prior=await db().prepare("SELECT policy_revision AS revision FROM app_role_grants WHERE actor_id=? AND role=? AND scope_id=?").bind(body.actorId,body.role,scope).first<{revision:number}>();
  if(body.expectedPolicyRevision!==(prior?.revision??0))throw new HttpError(409,"권한 정책이 변경되었습니다. 다시 불러오세요.");
  const n=(prior?.revision??0)+1,status=body.operation==="grant"?"active":"revoked";
  const statement=db().prepare("INSERT INTO app_role_grants (actor_id,role,scope_id,status,effective_from,effective_to,granted_by,reason,policy_revision,created_at,revoked_at) VALUES (?,?,?,?,?,NULL,?,?,?,?,?) ON CONFLICT(actor_id,role,scope_id) DO UPDATE SET status=excluded.status,effective_from=excluded.effective_from,granted_by=excluded.granted_by,reason=excluded.reason,policy_revision=excluded.policy_revision,revoked_at=excluded.revoked_at WHERE app_role_grants.policy_revision=?").bind(body.actorId,body.role,scope,status,at,who,body.reason,n,at,status==="revoked"?at:null,prior?.revision??0);
  const updates=await db().batch([statement,db().prepare("INSERT INTO events (id,case_id,actor,type,detail,at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),"__app_roles__",who,"app_role.changed",JSON.stringify({actorId:body.actorId,role:body.role,scopeId:scope,beforePolicyRevision:prior?.revision??0,policyRevision:n,status,reason:body.reason}),at)]);
  if(!updates[0].meta.changes)throw new HttpError(409,"권한 정책이 변경되었습니다. 다시 불러오세요.");
  return {actorId:body.actorId,role:body.role,scopeId:scope,status,policyRevision:n};
}
