export const MAX_PROCESS_JOB_IDS=256;
const MAX_PROCESS_JOB_ID_LENGTH=160;
export class ProcessJobScopeError extends Error { readonly status=400; }

/** A missing value means ordinary unscoped processing; a present value must be a strict allowlist. */
export function parseProcessJobIds(value:unknown):string[]|undefined{
  if(value===undefined)return undefined;
  if(!Array.isArray(value)||value.length===0||value.length>MAX_PROCESS_JOB_IDS)throw new ProcessJobScopeError("페이지 처리 범위가 비어 있거나 허용된 크기를 벗어났습니다.");
  const ids:string[]=[];
  for(const item of value){
    if(typeof item!=="string"||!item.trim()||item.length>MAX_PROCESS_JOB_ID_LENGTH||item!==item.trim()||/[,\u0000-\u001f\u007f]/u.test(item))throw new ProcessJobScopeError("페이지 처리 범위에 잘못된 작업 ID가 있습니다.");
    ids.push(item);
  }
  if(new Set(ids).size!==ids.length)throw new ProcessJobScopeError("페이지 처리 범위에 중복 작업 ID가 있습니다.");
  return ids;
}

export function parseProcessJobIdsQuery(value:string|null):string[]|undefined{
  if(value===null)return undefined;
  if(!value||value.length>MAX_PROCESS_JOB_IDS*(MAX_PROCESS_JOB_ID_LENGTH+1))throw new ProcessJobScopeError("페이지 처리 범위가 비어 있거나 허용된 크기를 벗어났습니다.");
  return parseProcessJobIds(value.split(","));
}

export function processJobScopeSql(ids:string[]|undefined,column="p.id"){
  if(!ids)return {sql:"",params:[] as string[]};
  // The column is an internal SQL identifier at call sites; all external values bind.
  return {sql:` AND ${column} IN (${ids.map(()=>"?").join(",")})`,params:ids};
}

export function buildProcessJobSelect(caseId:string,ids:string[]|undefined,now:string,apiKeyConfigured:boolean){
  const scope=processJobScopeSql(ids,"p.id");
  return {
    sql:`SELECT p.*,d.ready,d.original_key,d.sha256 AS source_sha256 FROM page_jobs p JOIN documents d ON d.id=p.document_id AND d.case_id=p.case_id WHERE p.case_id = ?${scope.sql} AND d.ready = 1 AND p.image_key IS NOT NULL AND p.role NOT IN ('filed_form','administrative') AND (p.status = 'pending' OR (p.status = 'processing' AND p.lease_until < ?)) AND (? = 1 OR p.stage = 'commit') ORDER BY CASE WHEN p.stage = 'commit' THEN 0 ELSE 1 END,p.document_id,p.page LIMIT 1`,
    params:[caseId,...scope.params,now,apiKeyConfigured?1:0] as Array<string|number>,
  };
}

export function isCurrentEvidenceJob(row:{document_id:string;page:number},data:{documents:{id:string;status:string;sha256:string;pages:number[]}[];pages:{documentId:string;page:number;role:string}[]},immutableRole:(hash:string,page:number)=>string):boolean{
  const document=data.documents.find(doc=>doc.id===row.document_id&&doc.status==="active");
  return !!document&&document.pages.includes(row.page)&&data.pages.some(page=>page.documentId===row.document_id&&page.page===row.page&&page.role==="evidence")&&!['filed_form','administrative'].includes(immutableRole(document.sha256,row.page));
}

export function rescuePlanInScope(plan:{documentId?:string;page?:number}|undefined,rows:Array<{id:string;documentId:string;page:number}>,ids:string[]|undefined){
  if(!plan)return false;
  if(!ids)return true;
  return rows.some(row=>ids.includes(row.id)&&row.documentId===plan.documentId&&row.page===plan.page);
}

export function assertProcessJobRows(ids:string[],rows:Array<{id:string;document_id:string;page:number;role:string}>,isEvidence:(row:{id:string;document_id:string;page:number;role:string})=>boolean){
  if(rows.length!==ids.length||new Set(rows.map(row=>row.id)).size!==ids.length||rows.some(row=>!ids.includes(row.id)))throw new ProcessJobScopeError("페이지 처리 범위에 현재 사건의 작업이 아닌 ID가 포함되어 있습니다.");
  if(rows.some(row=>row.role!=="evidence"||!isEvidence(row)))throw new ProcessJobScopeError("페이지 처리 범위에는 현재 증거 역할의 페이지만 포함할 수 있습니다.");
}
