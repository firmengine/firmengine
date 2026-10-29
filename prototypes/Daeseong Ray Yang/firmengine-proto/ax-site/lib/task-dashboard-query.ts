export interface TaskDashboardFilters {ownerId?:string|null;status?:string|null;limit:number;offset:number}
/** List and total share this exact filtered relation. */
export function taskDashboardQuery(filters:TaskDashboardFilters):{sql:string;params:unknown[]} {
  const clauses:string[]=[],params:unknown[]=[];
  if(filters.ownerId&&filters.ownerId!=="all"){
    clauses.push(filters.ownerId==="unassigned"?"t.owner_id IS NULL":"t.owner_id = ?");
    if(filters.ownerId!=="unassigned")params.push(filters.ownerId);
  }
  if(filters.status&&filters.status!=="all"){clauses.push("t.status = ?");params.push(filters.status);}
  const where=clauses.length?`WHERE ${clauses.join(" AND ")}`:"";
  return {sql:`WITH filtered AS (
      SELECT t.id,t.case_id AS caseId,c.name AS caseName,t.type,
        json_extract(t.payload,'$.title') AS title,t.owner_id AS ownerId,t.due_at AS dueAt,
        t.waiting_on AS waitingOn,t.blocked_by AS blockedBy,t.status,
        t.dependency_fingerprint AS dependencyFingerprint,
        json_extract(t.payload,'$.reason') AS reason,t.created_at AS createdAt,t.updated_at AS updatedAt
      FROM case_tasks t JOIN cases c ON c.id=t.case_id ${where}
    ), paged AS (
      SELECT * FROM filtered ORDER BY (dueAt IS NULL),dueAt,createdAt,caseId,id LIMIT ? OFFSET ?
    )
    SELECT (SELECT COUNT(*) FROM filtered) AS total,
      COALESCE((SELECT json_group_array(json_object('id',id,'caseId',caseId,'caseName',caseName,'type',type,'title',title,'ownerId',ownerId,'dueAt',dueAt,'waitingOn',waitingOn,'blockedBy',blockedBy,'status',status,'dependencyFingerprint',dependencyFingerprint,'reason',reason,'createdAt',createdAt,'updatedAt',updatedAt)) FROM paged),'[]') AS items`,params:[...params,filters.limit,filters.offset]};
}
