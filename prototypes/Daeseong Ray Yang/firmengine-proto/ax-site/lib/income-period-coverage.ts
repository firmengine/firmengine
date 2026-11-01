/**
 * Application-only D5103 source-month coverage check.
 * This is NOT a court-mandated 12-month rule or approval of recognized income.
 */
export interface SelectedIncomePeriodCoverageInput {
  selectedPeriod?: { start: string; end: string } | null;
  monthRows: ReadonlyArray<Readonly<Record<string, string>>>;
  evidenceCutoff?: string | null;
  /** Internal source-stream provenance check; never automatic legal recognition. */
  inspectSourceStreams?: boolean;
}
export interface SelectedIncomePeriodCoverageResult {
  status: "not_applicable" | "complete" | "review_required";
  codes: string[];
  missingMonths: string[];
  outsideMonths: string[];
  invalidRowIndices: number[];
  futureMonths: string[];
  sourceMissingMonths: { streamId: string; missingMonths: string[] }[];
  sharedFactIds: string[];
}

const dateParts = (value: string | undefined | null): {year:number;month:number;day:number}|null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value+"T00:00:00.000Z");
  if (!Number.isFinite(d.valueOf()) || d.toISOString().slice(0, 10) !== value) return null;
  return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};
};
const monthIndex = (year:number, month:number) => year*12+month-1;
const monthKey = (index:number) => String(Math.floor(index/12)).padStart(4,"0")+"-"+String(index%12+1).padStart(2,"0");
const validWon = (value:unknown):boolean => typeof value === "string" && /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(value.trim());

/** Dynamic coverage of a *selected*, reviewed period; no fixed 12-month requirement. */
export function checkSelectedIncomePeriodCoverage(input:SelectedIncomePeriodCoverageInput):SelectedIncomePeriodCoverageResult {
  const result:SelectedIncomePeriodCoverageResult={status:"complete",codes:[],missingMonths:[],outsideMonths:[],invalidRowIndices:[],futureMonths:[],sourceMissingMonths:[],sharedFactIds:[]};
  const code=(x:string)=>{if(!result.codes.includes(x))result.codes.push(x);};
  if (!input.selectedPeriod) {
    if (!input.monthRows.length) result.status="not_applicable";
    else {result.status="review_required";code("D5103_SELECTED_PERIOD_MISSING");}
    return result;
  }
  const start=dateParts(input.selectedPeriod.start), end=dateParts(input.selectedPeriod.end);
  const startIndex=start?monthIndex(start.year,start.month):null;
  const endIndex=end?monthIndex(end.year,end.month):null;
  const lastCalendarDay=end?new Date(Date.UTC(end.year,end.month,0)).getUTCDate():null;
  if (!start||!end||start.day!==1||end.day!==lastCalendarDay||startIndex===null||endIndex===null||startIndex>endIndex||endIndex-startIndex>239){
    result.status="review_required";code("D5103_SELECTED_PERIOD_INVALID");return result;
  }
  const covered=new Set<number>();
  const coveredByStream=new Map<string,Set<number>>();
  const factOwnerStream=new Map<string,string>();
  for(let i=0;i<input.monthRows.length;i++){
    const row=input.monthRows[i];
    // Persisted or external bindings can violate static TypeScript row shapes.
    // Treat malformed input as unresolved evidence, never an unhandled exception.
    if (!row || typeof row !== "object") {
      result.invalidRowIndices.push(i);code("D5103_MONTH_EVIDENCE_UNRESOLVED");continue;
    }
    const ym=row.period;
    const parsed=typeof ym==="string"&&/^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym);
    if(!parsed || !validWon(row.net_income)){
      result.invalidRowIndices.push(i);code("D5103_MONTH_EVIDENCE_UNRESOLVED");continue;
    }
    const month=monthIndex(Number(parsed[1]),Number(parsed[2]));
    if(input.inspectSourceStreams){
      // A display label or a per-month row ID is not a stable payer/stream ID.
      if(!row.source_id?.trim() || !row.source_stream_id?.trim() || !row.source_fact_ids?.trim()){
        result.invalidRowIndices.push(i);code("D5103_SOURCE_LINEAGE_UNRESOLVED");continue;
      }
      if(row.source_review_status!=="accepted" || row.source_calc_role==="gross_turnover_only"){
        result.invalidRowIndices.push(i);code("D5103_SOURCE_REVIEW_REQUIRED");continue;
      }
      // Two income streams may cite one immutable Fact for the same transaction.
      // Never treat repeated cross-stream evidence as two independently approved incomes.
      for(const factId of row.source_fact_ids.split(",").map(x=>x.trim()).filter(Boolean)){
        const owner=factOwnerStream.get(factId);
        if(owner && owner!==row.source_stream_id){
          if(!result.sharedFactIds.includes(factId))result.sharedFactIds.push(factId);
          code("D5103_CROSS_STREAM_FACT_REVIEW_REQUIRED");
        }else if(!owner)factOwnerStream.set(factId,row.source_stream_id);
      }
    }
    if(month<startIndex || month>endIndex) {result.outsideMonths.push(ym);code("D5103_MONTH_OUTSIDE_SELECTED_PERIOD");}
    else {
      covered.add(month);
      if(input.inspectSourceStreams){
        const streamId=row.source_stream_id;
        const streamMonths=coveredByStream.get(streamId)??new Set<number>();
        streamMonths.add(month);coveredByStream.set(streamId,streamMonths);
      }
    }
  }
  for(let month=startIndex;month<=endIndex;month++){
    if(!covered.has(month))result.missingMonths.push(monthKey(month));
  }
  if(result.missingMonths.length)code("D5103_SELECTED_PERIOD_COVERAGE_GAP");
  // A complete union of months can hide one incomplete independent income
  // stream. This only requests explicit human source-period review; it never
  // assumes a statutory period or recognizes/disallows an income amount.
  if(input.inspectSourceStreams && coveredByStream.size>1){
    for(const [streamId,streamMonths] of coveredByStream){
      const missingMonths:string[]=[];
      for(let month=startIndex;month<=endIndex;month++)if(!streamMonths.has(month))missingMonths.push(monthKey(month));
      if(missingMonths.length)result.sourceMissingMonths.push({streamId,missingMonths});
    }
    if(result.sourceMissingMonths.length)code("D5103_SOURCE_STREAM_COVERAGE_REVIEW_REQUIRED");
  }
  // A missing observation cutoff is unknown, not a verified through-date.
  // Drafts may warn; final reviewed D5103 needs an explicit evidence date.
  if(input.evidenceCutoff===undefined||input.evidenceCutoff===null){
    code("D5103_EVIDENCE_CUTOFF_UNOBSERVED");
  } else {
    const cutoff=dateParts(input.evidenceCutoff);
    if(!cutoff)code("D5103_EVIDENCE_CUTOFF_INVALID");
    else {
      // A dated cutoff inside a calendar month cannot substantiate that whole
      // month, even if a future-dated month row was already materialized.
      const cutoffMonthLastDay=new Date(Date.UTC(cutoff.year,cutoff.month,0)).getUTCDate();
      const lastObserved=monthIndex(cutoff.year,cutoff.month)-(cutoff.day<cutoffMonthLastDay?1:0);
      for(let month=startIndex;month<=endIndex;month++)if(month>lastObserved)result.futureMonths.push(monthKey(month));
      if(result.futureMonths.length)code("D5103_SELECTED_PERIOD_AFTER_EVIDENCE_CUTOFF");
    }
  }
  if(result.codes.length)result.status="review_required";
  return result;
}
