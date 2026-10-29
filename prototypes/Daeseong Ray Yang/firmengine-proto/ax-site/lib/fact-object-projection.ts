import { currentFacts, type CaseData, type Fact, type NumericInput } from "./domain.ts";

export type FactObjectTarget = { collection: "incomes" | "debts" | "assets" | "transactions" | "household"; subjectId: string; field: string };
export type ProjectionBlocker = { code: "AMBIGUOUS_TARGET" | "MANUAL_OVERRIDE" | "UNKNOWN_UNIT_OR_PERIOD" | "NO_TYPED_TARGET" | "AMBIGUOUS_FACT" | "SURVIVING_SUPPORT_REVIEW"; oldFactId: string; candidateFactIds: string[]; task: string; preservesHistory: true };
export type FactProjection = { updates: { oldFactId: string; newFactId: string; target: FactObjectTarget; numeric?: NumericInput; value: Fact["value"] }[]; blockers: ProjectionBlocker[]; invalidates: string[] };

const FIELD: Record<string,string> = { "income.gross":"gross", "income.monthly_gross":"gross", "income.expenses":"expenses", "income.net":"net", "income.monthly_net":"net", "income.period_start":"periodStart", "income.period_end":"periodEnd", "debt.principal":"principal", "debt.principal_balance":"principal", "debt.outstanding_principal":"principal", "debt.interest":"interest", "asset.gross_value":"grossValue", "asset.market_value":"grossValue", "asset.value":"grossValue", "asset.refund_value":"grossValue", "asset.secured_payoff":"securedPayoff", "asset.disposal_costs":"disposalCosts", "asset.protected_value":"protectedValue", "transaction.amount":"amount", "household.recognized_living_cost":"recognizedLivingCost", "household.additional_living_cost":"additionalLivingCost" };
const NUMERIC_FIELDS = new Set(["gross","expenses","net","principal","interest","grossValue","securedPayoff","disposalCosts","protectedValue","amount","recognizedLivingCost","additionalLivingCost"]);
const period = (f: Fact) => JSON.stringify([f.periodStart ?? null, f.periodEnd ?? null, f.asOf ?? null]);
const unit = (f: Fact) => f.sourceUnit ?? f.numeric?.unit ?? null;
function targets(data: CaseData, id: string): FactObjectTarget[] {
  const result: FactObjectTarget[] = [];
  for (const collection of ["incomes","debts","assets","transactions"] as const) for (const row of data[collection]) if (row.factIds.includes(id)) {
    const fact = currentFacts(data).find(f => f.id === id); const field = fact && FIELD[fact.key];
    if (field) result.push({ collection, subjectId: row.id, field });
  }
  if (data.household.factIds.includes(id)) { const fact=currentFacts(data).find(f=>f.id===id), field=fact&&FIELD[fact.key]; if(field) result.push({collection:"household",subjectId:"household",field}); }
  return result;
}
function targetHasManualAmountOverride(data:CaseData,target:FactObjectTarget,fact:Fact):boolean{
  if(!fact.numeric?.amountWon)return false;
  const row=target.collection==="household"?data.household as unknown as Record<string,unknown>:(data[target.collection] as unknown as Record<string,unknown>[]).find(item=>item.id===target.subjectId);
  const value=row?.[target.field] as NumericInput|undefined;
  return !!value&&typeof value==="object"&&typeof value.amountWon==="string"&&value.amountWon!==fact.numeric.amountWon;
}
function rowFor(data:CaseData,target:FactObjectTarget):Record<string,unknown>|undefined{return target.collection==="household"?data.household as unknown as Record<string,unknown>:(data[target.collection] as unknown as Record<string,unknown>[]).find(item=>item.id===target.subjectId);}
function sameTargetIdentity(before:CaseData,after:CaseData,target:FactObjectTarget):boolean{
  if(target.collection!=="incomes")return true;
  const old=rowFor(before,target),next=rowFor(after,target);if(!old||!next)return false;
  return ["employer","payerIdentityId"].every(key=>(old[key]??null)===(next[key]??null));
}
function currentFieldSupport(data:CaseData,target:FactObjectTarget,excludingId?:string):Fact[]{const current=new Map(currentFacts(data).map(fact=>[fact.id,fact]));const row=rowFor(data,target);return (Array.isArray(row?.factIds)?row.factIds as string[]:[]).map(id=>current.get(id)).filter((fact):fact is Fact=>!!fact&&fact.id!==excludingId&&FIELD[fact.key]===target.field);}
/** Pure proposal for carrying a corrected fact into a typed object. It never mutates either case. */
export function projectFactCorrections(input: { before: CaseData; after: CaseData; oldFactIds: string[]; newFactIds: string[] }): FactProjection {
  const result: FactProjection = { updates: [], blockers: [], invalidates: [] };
  const before = new Map(currentFacts(input.before).map(f=>[f.id,f])), after = new Map(currentFacts(input.after).map(f=>[f.id,f]));
  for (const oldId of input.oldFactIds) {
    const old=before.get(oldId), oldTargets=targets(input.before,oldId);
    const candidates=input.newFactIds.map(id=>after.get(id)).filter((f):f is Fact=>!!f&&!!old&&f.subjectId===old.subjectId&&f.key===old.key&&period(f)===period(old));
    const make=(code:ProjectionBlocker["code"],task:string,ids=candidates.map(f=>f.id))=>result.blockers.push({code,oldFactId:oldId,candidateFactIds:ids,task,preservesHistory:true});
    if (!old || oldTargets.length!==1) { make(oldTargets.length>1?"AMBIGUOUS_TARGET":"NO_TYPED_TARGET","검토자가 사실과 객체 연결을 직접 선택하세요."); continue; }
    if (old.recognition!=="unreviewed" || old.state==="reported" && old.reviewer || oldTargets.some(target=>targetHasManualAmountOverride(input.before,target,old))) { make("MANUAL_OVERRIDE","기존 수동 검토 여부와 새 원문을 대조해 연결을 확인하세요."); continue; }
    if (candidates.length!==1) { make(candidates.length?"AMBIGUOUS_FACT":"NO_TYPED_TARGET","새 사실 버전을 명시적으로 대응시키세요."); continue; }
    const next=candidates[0], nextTargets=targets(input.after,next.id), oldUnit=unit(old), nextUnit=unit(next);
    if (nextTargets.length>1 || nextTargets.length===1 && JSON.stringify(nextTargets[0])!==JSON.stringify(oldTargets[0])) { make("AMBIGUOUS_TARGET","검토자가 새 사실의 객체 대상을 확인하세요."); continue; }
    if(!sameTargetIdentity(input.before,input.after,oldTargets[0])){make("AMBIGUOUS_TARGET","정정 전후의 지급자·고용주가 다릅니다. 정확한 소득원을 직접 다시 연결하세요.",[next.id]);continue;}
    const field=oldTargets[0].field;
    const surviving=currentFieldSupport(input.before,oldTargets[0],old.id);
    if(surviving.length){make("SURVIVING_SUPPORT_REVIEW","동일 계산 항목을 뒷받침하는 사실이 여러 개입니다. 남은 원문과 기간·고용주 관계를 확인해 대상 금액을 다시 검토하세요.",[next.id,...surviving.map(fact=>fact.id)]);continue;}
    if (NUMERIC_FIELDS.has(field) && (!oldUnit || !nextUnit || oldUnit!==nextUnit || ![old.periodStart,old.periodEnd,old.asOf].some(v=>typeof v==="string"&&v.length>0) || period(old)!==period(next))) { make("UNKNOWN_UNIT_OR_PERIOD","원문 단위와 적용 기간/기준일을 확인한 뒤 금액을 다시 연결하세요."); continue; }
    if (NUMERIC_FIELDS.has(field) && (!next.numeric || next.numeric.normalizationStatus!=="exact" || next.numeric.amountWon===null)) { make("UNKNOWN_UNIT_OR_PERIOD","새 금액의 정규화 상태와 원문 단위를 해결하세요."); continue; }
    if (!NUMERIC_FIELDS.has(field) && typeof next.value!=="string") { make("UNKNOWN_UNIT_OR_PERIOD","새 사실의 기간 값을 확인하세요."); continue; }
    result.updates.push({oldFactId:old.id,newFactId:next.id,target:oldTargets[0],...(next.numeric?{numeric:next.numeric}:{}),value:next.value});
  }
  if (result.updates.length || result.blockers.length) result.invalidates=["schedule","allowance","reference_review","artifacts"];
  return result;
}

export type ProjectionAudit = { changedTargets: FactObjectTarget[]; resetReviews: { key: string; prior: unknown }[]; invalidatedArtifacts: string[] };
export type AppliedFactProjection = { data: CaseData; projection: FactProjection; audit: ProjectionAudit };

/** Apply only unambiguous projections to a fresh copy. History remains in the fact ledger. */
export function applyFactProjection(before: CaseData, after: CaseData, oldFactIds: string[], newFactIds: string[]): AppliedFactProjection {
  const projection=projectFactCorrections({before,after,oldFactIds,newFactIds}), data=structuredClone(after);
  const affectedTargets=[...new Map(oldFactIds.flatMap(id=>targets(before,id)).map(target=>[`${target.collection}:${target.subjectId}:${target.field}`,target])).values()];
  const changedTargets:FactObjectTarget[]=[];
  for(const update of projection.updates){
    const target=update.target; let row:Record<string,unknown>|undefined;
    if(target.collection==="household") row=data.household as unknown as Record<string,unknown>;
    else row=(data[target.collection] as unknown as Record<string,unknown>[]).find(item=>item.id===target.subjectId);
    if(!row)continue;
    if(Array.isArray(row.factIds)) row.factIds=[...new Set((row.factIds as string[]).map(id=>id===update.oldFactId?update.newFactId:id))];
    row[target.field]=update.numeric??update.value;
    if(!changedTargets.some(existing=>existing.collection===target.collection&&existing.subjectId===target.subjectId&&existing.field===target.field))changedTargets.push(target);
  }
  const audit:ProjectionAudit={changedTargets,resetReviews:[],invalidatedArtifacts:[]};
  if(affectedTargets.length){
    // A changed source invalidates the typed object's prior acceptance even when projection
    // is blocked. Preserve the old decision in the audit for explicit re-review.
    for(const target of affectedTargets){const row=rowFor(data,target);if(!row)continue;const resetObjectDecision=(key:string)=>{if(row[key]==="accepted"){audit.resetReviews.push({key:`${target.collection}.${target.subjectId}.${key}`,prior:row[key]});row[key]="unreviewed";}};
      if(target.collection==="household"){if(data.household.recognition==="accepted"){audit.resetReviews.push({key:"household.recognition",prior:data.household.recognition});data.household.recognition="unreviewed";}}
      else if(target.collection==="debts"){resetObjectDecision("recognition");resetObjectDecision("legalReview");}
      else if(target.collection==="incomes"||target.collection==="assets")resetObjectDecision("recognition");
    }
    const categories=new Set(affectedTargets.map(x=>x.collection));
    const reset=(key:string)=>{const ctx=data.context as unknown as Record<string,unknown>;audit.resetReviews.push({key,prior:ctx[key]});ctx[key]=false;};
    if(categories.has("incomes")) reset("incomePeriodReviewed");
    if(categories.has("assets")){reset("assetValuationBasisReviewed");reset("presentValueReviewed");}
    if(categories.has("debts")) reset("allocationBasisReviewed");
    if(categories.has("household")&&data.household.recognition!=="unreviewed"){audit.resetReviews.push({key:"household.recognition",prior:data.household.recognition});data.household.recognition="unreviewed";}
    for(const key of ["paymentSchedule"]){const ctx=data.context as unknown as Record<string,unknown>,prior=ctx[key] as {reviewed?:boolean}|undefined;if(prior?.reviewed){audit.resetReviews.push({key,prior:structuredClone(prior)});ctx[key]={...prior,reviewed:false};}}
    const ctx=data.context as unknown as Record<string,unknown>;
    if(ctx.referenceReviewSha256!==undefined){audit.resetReviews.push({key:"referenceReviewSha256",prior:ctx.referenceReviewSha256});delete ctx.referenceReviewSha256;}
    if(ctx.ruleApplicationReviewed===true){audit.resetReviews.push({key:"ruleApplicationReviewed",prior:true});ctx.ruleApplicationReviewed=false;}
    if(data.exportManifest){for(const file of data.exportManifest.files)if(file.status==="current"){file.status="invalidated";audit.invalidatedArtifacts.push(file.id);}if(audit.invalidatedArtifacts.length)data.exportManifest.reviews={caseworker:null,lawyer:null};}
  }
  return {data,projection,audit};
}

/** Withdrawn or disputed evidence cannot leave an accepted typed value silently authoritative. */
export function invalidateFactSupport(before:CaseData,after:CaseData,oldFactId:string,newFactId:string):AppliedFactProjection{
  const data=structuredClone(after),old=currentFacts(before).find(fact=>fact.id===oldFactId),next=data.facts.find(fact=>fact.id===newFactId),targetsBefore=targets(before,oldFactId),changedTargets:FactObjectTarget[]=[],blockers:ProjectionBlocker[]=[];
  if(!old||!next)return {data,projection:{updates:[],blockers:[{code:"NO_TYPED_TARGET",oldFactId,candidateFactIds:[],task:"사실 버전 이력을 확인하고 객체 연결을 직접 검토하세요.",preservesHistory:true}],invalidates:[]},audit:{changedTargets,resetReviews:[],invalidatedArtifacts:[]}};
  for(const target of targetsBefore){const row=rowFor(data,target);if(!row)continue;
    if(Array.isArray(row.factIds)){const ids=(row.factIds as string[]).map(id=>id===oldFactId?newFactId:id);row.factIds=[...new Set(next.state==="retracted"?ids.filter(id=>id!==newFactId):ids)];}
    if(target.collection!=="household"){
      row.recognition="unreviewed";
      if(target.collection==="debts")row.legalReview="unreviewed";
    }else data.household.recognition="unreviewed";
    const surviving=currentFieldSupport(data,target,newFactId);
    blockers.push({code:"SURVIVING_SUPPORT_REVIEW",oldFactId,candidateFactIds:[newFactId,...surviving.map(fact=>fact.id)],task:surviving.length?"남은 원문 사실들의 값·기간·고용주 관계를 확인하고 계산 객체를 다시 검토하세요.":"철회된 근거를 대체할 원문 사실을 지정하거나 계산 객체 값을 확인하세요.",preservesHistory:true});
    changedTargets.push(target);
  }
  const projection:FactProjection={updates:[],blockers,invalidates:changedTargets.length?["schedule","allowance","reference_review","artifacts"]:[]},audit:ProjectionAudit={changedTargets,resetReviews:[],invalidatedArtifacts:[]};
  if(changedTargets.length){
    const ctx=data.context as unknown as Record<string,unknown>;
    for(const key of ["incomePeriodReviewed","assetValuationBasisReviewed","presentValueReviewed","allocationBasisReviewed","ruleApplicationReviewed"])if(ctx[key]===true){audit.resetReviews.push({key,prior:ctx[key]});ctx[key]=false;}
    const schedule=ctx.paymentSchedule as {reviewed?:boolean}|undefined;if(schedule?.reviewed){audit.resetReviews.push({key:"paymentSchedule",prior:structuredClone(schedule)});ctx.paymentSchedule={...schedule,reviewed:false};}
    if(ctx.referenceReviewSha256!==undefined){audit.resetReviews.push({key:"referenceReviewSha256",prior:ctx.referenceReviewSha256});delete ctx.referenceReviewSha256;}
    if(data.exportManifest){for(const file of data.exportManifest.files)if(file.status==="current"){file.status="invalidated";audit.invalidatedArtifacts.push(file.id);}if(audit.invalidatedArtifacts.length)data.exportManifest.reviews={caseworker:null,lawyer:null};}
  }
  return {data,projection,audit};
}
