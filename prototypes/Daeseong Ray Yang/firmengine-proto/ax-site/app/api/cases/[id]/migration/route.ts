import { requireAppRole } from "../../../../../lib/app-roles";
import { caseStateFingerprint,errorResponse,getCase,HttpError } from "../../../../../lib/server-store";
import { assertMutableCase } from "../../../../../lib/case-commands.ts";
import { prepareCaseSchemaMigration,CASE_SCHEMA_MIGRATION_VERSION,type MigrationMode } from "../../../../../lib/case-schema-migration.ts";
import { canonicalSha256 } from "../../../../../lib/structured-case-import.ts";
/** Read-only preview for one explicitly selected case. Applying uses the common command CAS. */
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;await requireAppRole("case_editor",id);
  const data=await getCase(id);assertMutableCase(data);
  const mode=new URL(request.url).searchParams.get("mode")??"deterministic";
  if(!["deterministic","document","propagation"].includes(mode))throw new HttpError(400,"전환 검증 모드를 확인하세요.");
  const plan=await prepareCaseSchemaMigration(data,{caseId:id,expectedRevision:data.context.revision,expectedInputSha256:await canonicalSha256(data),migrationVersion:CASE_SCHEMA_MIGRATION_VERSION,mode:mode as MigrationMode},[id]);
  return Response.json({caseId:id,revision:data.context.revision,stateFingerprint:await caseStateFingerprint(data),planId:plan.planId,sourceSha256:plan.sourceSha256,resultStateSha256:plan.resultStateSha256,migrationVersion:plan.migrationVersion,mode:plan.mode,changedFields:plan.changedFields,semanticDiff:plan.semanticDiff},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
