import { factSourceLineageIssues, factHasValidStructuredRefs, moneyValue, normalizeMoney, structuredSourceRowKeys, validSourceRef } from "./domain.ts";
import type { CaseData, CaseReadIndex, Debt, Fact } from "./domain.ts";
import { DEBT_TOTAL_KEYS, DEBT_COST_KEYS } from "./source-quantity.ts";

const key=(value:string)=>value.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
const principalKeys=new Set(["debt.principal","debt.principal_balance","debt.outstanding_principal"]);
const interestKeys=new Set(["debt.interest","debt.overdue_interest"]);
const totalKeys=new Set(DEBT_TOTAL_KEYS.map(key=>"debt."+key));
const costKeys=new Set(DEBT_COST_KEYS.map(key=>"debt."+key));
const canonicalFactKey=(fact:Fact)=>key(fact.key);
const refKey=(ref:{documentId:string;page:number})=>`${ref.documentId}\0${ref.page}`;

export interface DebtSourceIntegrity {
  factIds:string[];
  totalFactIds:string[];
  costFactIds:string[];
  totalWon:bigint|null;
  sourceTotalWon:bigint|null;
  costObservation:string|null;
  blockers:string[];
  hasSourceTotal:boolean;
  hasCostSlot:boolean;
}

function quoteLabeledAmountMatches(fact:Fact,amount:bigint,kind:"total"|"cost"):boolean{
  const sourceUnit=Object.hasOwn(fact,"sourceUnit")?fact.sourceUnit:fact.numeric?.unit;
  const label=kind==="total"
    ? /(?:총\s*(?:채무|청구|원리금|상환)?(?:액|금액)?|(?:채무|청구|원리금)\s*(?:총액|합계|계)|(?:총액|합계|계)|total\s+(?:claim|balance|amount)|claim\s+total)/giu
    : /(?:법률\s*비용|법률비|추심\s*비용|집행\s*비용|기타\s*비용|별도\s*비용|비용|수수료|cost|fee|expense)/giu;
  const amountPattern=/^\s*[:：=]?\s*(?:\(\s*(?:단위\s*[:：]\s*)?(백만원|천원|만원|억원|원|KRW|won)\s*\)\s*|(?:단위\s*[:：]\s*)?(백만원|천원|만원|억원|원|KRW|won)\s*[:：=]?\s*)?([+-]?\d[\d,]*(?:\.\d+)?)\s*(백만원|천원|만원|억원|원|KRW|won)?/iu;
  for(const ref of fact.refs){
    const quote=ref.quote.normalize("NFKC");
    for(const match of quote.matchAll(label)){
      // Only inspect the amount immediately after the matched label, never another
      // principal/interest/total column elsewhere in the same source quote.
      const adjacent=amountPattern.exec(quote.slice((match.index??0)+match[0].length));
      if(!adjacent)continue;
      const labeledUnit=adjacent[1]??adjacent[2]??null,suffixedUnit=adjacent[4]??null;
      if(labeledUnit&&suffixedUnit&&labeledUnit.normalize("NFKC").toLowerCase()!==suffixedUnit.normalize("NFKC").toLowerCase())continue;
      const quoted=normalizeMoney(adjacent[3],suffixedUnit??labeledUnit??sourceUnit??"unknown");
      if(quoted.normalizationStatus==="exact"&&quoted.amountWon===amount.toString())return true;
    }
  }
  return false;
}

function slotCandidates(data:CaseData,bySubject:Map<string,Map<string,Fact[]>>,subjectId:string,keys:Set<string>,anchorScopes:Set<string>):Fact[]{
  const slots=bySubject.get(subjectId);
  if(!slots)return [];
  return [...keys].flatMap(slotKey=>(slots.get(slotKey)??[]).filter(fact=>{
    // A same-subject slot with no usable page is explicit but unresolved; keep it
    // so it cannot disappear merely because the typed projection omitted it.
    if(!fact.refs.length){const rows=structuredSourceRowKeys(data,fact);return !rows.length||rows.some(row=>anchorScopes.has(`structured:${row}`));}
    // A field from another page cannot complete the current amount row. If any
    // reference touches this row's page, include the fact and validate all refs.
    return fact.refs.some(ref=>anchorScopes.has(refKey(ref)));
  }));
}

function observations(data:CaseData,facts:Fact[],index:CaseReadIndex,anchorScope:string|null):{values:bigint[];valid:boolean}{
  if(!facts.length)return {values:[],valid:true};
  const values:bigint[]=[];
  let valid=true;
  for(const fact of facts){
    const lineage=factSourceLineageIssues(data,[fact.id],index);
    const refScope=fact.refs.length>0?fact.refs.every(ref=>validSourceRef(data,ref,index)&&(!anchorScope||refKey(ref)===anchorScope)):factHasValidStructuredRefs(data,fact)&&structuredSourceRowKeys(data,fact).length===1&&(!anchorScope||`structured:${structuredSourceRowKeys(data,fact)[0]}`===anchorScope);
    const parsed=moneyValue(fact.numeric);
    const sourceCurrent=fact.state==="verified"&&fact.recognition!=="rejected";
    const clear=fact.validation.every(item=>item.severity!=="error"&&!(["UNCERTAIN_READING","NORMALIZATION_REVIEW"].includes(item.code)))
      &&lineage.length===0&&refScope&&sourceCurrent&&parsed!==null&&parsed>=0n;
    if(!clear){valid=false;continue;}
    values.push(parsed);
  }
  if(values.length!==facts.length)valid=false;
  for(const keyName of new Set(facts.map(canonicalFactKey))){
    const sameKeyValues=facts.filter(fact=>canonicalFactKey(fact)===keyName).map(fact=>moneyValue(fact.numeric)).filter((value):value is bigint=>value!==null);
    if(sameKeyValues.length>1&&new Set(sameKeyValues.map(value=>value.toString())).size>1)valid=false;
  }
  return {values,valid};
}

/** Build once per calculation; read only current linked source facts and their row-local aliases. */
export function createDebtSourceIntegrityResolver(data:CaseData,index:CaseReadIndex){
  const bySubject=new Map<string,Map<string,Fact[]>>(),versions=new Map<string,Fact[]>();
  for(const fact of data.facts){
    const factKey=canonicalFactKey(fact);
    if(!totalKeys.has(factKey)&&!costKeys.has(factKey))continue;
    versions.set(fact.logicalId,[...(versions.get(fact.logicalId)??[]),fact]);
  }
  for(const group of versions.values()){
    const latestVersion=Math.max(...group.map(fact=>fact.version));
    for(const fact of group.filter(item=>item.version===latestVersion)){
      const localKey=canonicalFactKey(fact),slots=bySubject.get(fact.subjectId)??new Map<string,Fact[]>();
      slots.set(localKey,[...(slots.get(localKey)??[]),fact]);bySubject.set(fact.subjectId,slots);
    }
  }

  return (debt:Debt,principal:bigint|null,interest:bigint|null):DebtSourceIntegrity=>{
    const unresolvedKeys=debt.sourceComponentIssues??[];
    const unresolvedTotal=unresolvedKeys.some(key=>totalKeys.has("debt."+key));
    const unresolvedCost=unresolvedKeys.some(key=>costKeys.has("debt."+key));
    const unresolvedBlockers=[...(unresolvedTotal?["DEBT_SOURCE_TOTAL_INVALID"]:[]),...(unresolvedCost?["DEBT_SEPARATE_COST_INVALID"]:[])];
    const linkedFacts=debt.factIds.map(id=>index.byId.get(id)).filter((fact):fact is Fact=>!!fact);
    const amountFacts=linkedFacts.filter(fact=>principalKeys.has(canonicalFactKey(fact))||interestKeys.has(canonicalFactKey(fact)));
    const amountSubjects=[...new Set(amountFacts.map(fact=>fact.subjectId))];
    const linkedSubjects=[...new Set(linkedFacts.map(fact=>fact.subjectId))];
    if(amountSubjects.length>1||amountSubjects.length===0&&linkedSubjects.length>1){
      return {factIds:[],totalFactIds:[],costFactIds:[],totalWon:null,sourceTotalWon:null,costObservation:null,blockers:["DEBT_SOURCE_ROW_IDENTITY_AMBIGUOUS"],hasSourceTotal:false,hasCostSlot:false};
    }
    const subjectId=amountSubjects[0]??linkedSubjects[0];
    if(!subjectId)return {factIds:[],totalFactIds:[],costFactIds:[],totalWon:unresolvedBlockers.length||principal===null||interest===null?null:principal+interest,sourceTotalWon:null,costObservation:null,blockers:unresolvedBlockers,hasSourceTotal:unresolvedTotal,hasCostSlot:unresolvedCost};
    const rowFacts=amountFacts.length?amountFacts:linkedFacts.filter(fact=>fact.subjectId===subjectId);
    const scopesByFact=rowFacts.map(fact=>new Set(fact.refs.map(ref=>refKey(ref)).concat(structuredSourceRowKeys(data,fact).map(row=>`structured:${row}`))));
    const anchorScopes=new Set(scopesByFact.length?scopesByFact[0]:[]);
    for(const scope of anchorScopes)if(scopesByFact.some(scopes=>!scopes.has(scope)))anchorScopes.delete(scope);
    const allScopes=new Set(rowFacts.flatMap(fact=>fact.refs.map(ref=>refKey(ref)).concat(structuredSourceRowKeys(data,fact).map(row=>`structured:${row}`))));
    const candidatesForDetection=slotCandidates(data,bySubject,subjectId,new Set([...totalKeys,...costKeys]),allScopes);
    const rowPageAmbiguous=candidatesForDetection.length>0&&anchorScopes.size!==1;
    const anchorScope=anchorScopes.size===1?[...anchorScopes][0]:null;
    const totals=rowPageAmbiguous?candidatesForDetection.filter(fact=>totalKeys.has(canonicalFactKey(fact))):slotCandidates(data,bySubject,subjectId,totalKeys,anchorScopes);
    const costs=rowPageAmbiguous?candidatesForDetection.filter(fact=>costKeys.has(canonicalFactKey(fact))):slotCandidates(data,bySubject,subjectId,costKeys,anchorScopes);
    const totalRead=observations(data,totals,index,anchorScope),costRead=observations(data,costs,index,anchorScope),blockers:string[]=[...unresolvedBlockers];
    if(rowPageAmbiguous)blockers.push("DEBT_SOURCE_ROW_IDENTITY_AMBIGUOUS");
    if(totals.some(fact=>!quoteLabeledAmountMatches(fact,moneyValue(fact.numeric)??-1n,"total")))totalRead.valid=false;
    if(costs.some(fact=>!quoteLabeledAmountMatches(fact,moneyValue(fact.numeric)??-1n,"cost")))costRead.valid=false;
    const totalValues=totalRead.values,costValues=costRead.values;
    let totalWon:bigint|null=unresolvedBlockers.length||principal===null||interest===null?null:principal+interest;
    let sourceTotalWon:bigint|null=null,costObservation:string|null=null;
    if(totals.length){
      if(!totalRead.valid){blockers.push("DEBT_SOURCE_TOTAL_INVALID");totalWon=null;}
      else {sourceTotalWon=totalValues[0]??null;if(principal===null||interest===null){blockers.push("DEBT_SOURCE_TOTAL_RECONCILIATION_UNAVAILABLE");totalWon=null;}else if(!totalValues.length||new Set(totalValues.map(value=>value.toString())).size!==1||totalValues[0]!==principal+interest){blockers.push("DEBT_SOURCE_TOTAL_CONFLICT");totalWon=null;}}
    }
    if(costs.length){
      if(!costRead.valid){blockers.push("DEBT_SEPARATE_COST_INVALID");costObservation="미확인·상충";totalWon=null;}
      else {costObservation=costValues.length&&new Set(costValues.map(value=>value.toString())).size===1?costValues[0].toString():"상충";if(costValues.some(value=>value!==0n)){blockers.push("DEBT_SEPARATE_COST_REQUIRES_REVIEW");totalWon=null;}}
    }
    if((totals.length||costs.length)&&anchorScopes.size!==1){if(!rowPageAmbiguous)blockers.push("DEBT_SOURCE_ROW_IDENTITY_UNRESOLVED");totalWon=null;}
    return {factIds:[...new Set([...totals,...costs].map(fact=>fact.id))],totalFactIds:[...new Set(totals.map(fact=>fact.id))],costFactIds:[...new Set(costs.map(fact=>fact.id))],totalWon,sourceTotalWon,costObservation,blockers:[...new Set(blockers)],hasSourceTotal:totals.length>0||unresolvedTotal,hasCostSlot:costs.length>0||unresolvedCost};
  };
}
