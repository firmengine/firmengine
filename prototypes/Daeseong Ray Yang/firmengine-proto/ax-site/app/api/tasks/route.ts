import { requireAppRole } from "../../../lib/app-roles.ts";
import { db, errorResponse, HttpError, requireSameOrigin } from "../../../lib/server-store.ts";
import { taskDashboardQuery } from "../../../lib/task-dashboard-query.ts";

const STATUSES=["open","in_progress","waiting","resolved","dismissed"] as const;
const MAX_PAGE=100;
export async function GET(request:Request){
  try{
    requireSameOrigin(request);
    await requireAppRole("case_editor","*");
    const url=new URL(request.url),owner=url.searchParams.get("ownerId"),status=url.searchParams.get("status");
    const limit=Number(url.searchParams.get("limit")??"25"),offset=Number(url.searchParams.get("offset")??"0");
    if(owner!==null&&(owner.length>128||owner.trim()!==owner))throw new HttpError(400,"담당자 필터를 확인하세요.");
    if(status!==null&&status!=="all"&&!STATUSES.includes(status as typeof STATUSES[number]))throw new HttpError(400,"작업 상태를 확인하세요.");
    if(!Number.isSafeInteger(limit)||limit<1||limit>MAX_PAGE||!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new HttpError(400,"페이지 범위를 확인하세요.");
    // List and total are derived from one filtered CTE, so the displayed count
    // always describes the exact universe used by the visible rows.
    const query=taskDashboardQuery({ownerId:owner,status,limit,offset});
    const row=await db().prepare(query.sql).bind(...query.params).first<{total:number;items:string}>();
    let items:unknown[]=[];try{const parsed=JSON.parse(row?.items??"[]");if(Array.isArray(parsed))items=parsed;}catch{throw new HttpError(500,"작업 목록을 읽을 수 없습니다.");}
    return Response.json({items,total:Number(row?.total??0),limit,offset,hasMore:offset+items.length<Number(row?.total??0),filters:{ownerId:owner??"all",status:status??"all"}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return errorResponse(error);}
}
