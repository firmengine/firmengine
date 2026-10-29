import { currentFacts,type CaseData } from "./domain.ts";
import { commandHash,CommandError,type CaseCommand,parseCaseCommand } from "./case-command-contract.ts";
/** Transitional HTTP adapter. Every edit still enters the same CAS/idempotency service. */
export async function legacyCaseCommand(body:Record<string,unknown>,data:CaseData):Promise<CaseCommand>{
  let type:CaseCommand["commandType"],target:Record<string,unknown>={},patch:Record<string,unknown>={},baseValueHash:string|undefined;
  switch(body.action){
    case "context":type="context.update";patch={context:body.context,...(body.household?{household:body.household}:{})};break;
    case "upsert_object":type="object.upsert";target={collection:body.collection};patch={item:body.item,source:body.source};break;
    case "delete_object":type="object.remove";target={collection:body.collection,objectId:body.objectId};break;
    case "review_object":type="object.review";target={collection:body.collection,objectId:body.objectId};patch={recognition:body.recognition};break;
    case "review_fact":{
      const fact=currentFacts(data).find(f=>f.id===body.factId);if(!fact)throw new CommandError("CASE_STATE_CONFLICT",409,"현재 사실을 다시 불러오세요.");
      const old={value:fact.value,sourceUnit:fact.sourceUnit??fact.numeric?.unit??null};
      const changed=(Object.hasOwn(body,"value")&&JSON.stringify(body.value)!==JSON.stringify(fact.value))||(Object.hasOwn(body,"sourceUnit")&&body.sourceUnit!==old.sourceUnit);
      type=changed?"fact.correct":"fact.review";target={factId:fact.id};
      if(changed){baseValueHash=await commandHash(old);patch={value:Object.hasOwn(body,"value")?body.value:fact.value,...(Object.hasOwn(body,"sourceUnit")?{sourceUnit:body.sourceUnit}:{})};}
      else patch={...(body.state!==undefined?{state:body.state}:{}),...(body.recognition!==undefined?{recognition:body.recognition}:{})};break;
    }
    case "retract_document":type="document.retract";target={documentId:body.documentId};break;
    case "set_page_role":type="document.role";target={documentId:body.documentId,page:body.page};patch={role:body.role};break;
    case "review_export":type="document.review";patch={role:body.role,fingerprint:body.fingerprint};break;
    case "archive_export":type="document.archive";target={fileId:body.fileId};break;
    default:throw new CommandError("INVALID_COMMAND",400,"지원하지 않는 변경 요청입니다.");
  }
  return parseCaseCommand({commandId:body.commandId,commandType:type,payloadVersion:1,expectedRevision:body.revision,expectedStateFingerprint:body.expectedStateFingerprint,target,patch,reason:body.reason??({retract_document:"자료 철회",set_page_role:"담당자의 페이지 역할 변경",review_export:"현재 생성물 검수",archive_export:"검토한 생성물 보관"} as Record<string,string>)[String(body.action)],...(baseValueHash?{baseValueHash}:{})});
}
