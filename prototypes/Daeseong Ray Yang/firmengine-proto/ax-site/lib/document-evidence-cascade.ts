/** Withdrawn source facts may no longer authorize typed amounts.
 * Do not delete historical fact rows or change monetary inputs: keep values
 * visible for an explicit human re-review, but remove withdrawn fact links.
 * This is a source-integrity transition, never an automatic legal decision.
 */
import type {CaseData} from "./domain.ts";

export interface WithdrawnDocumentTarget {
  collection:"incomes"|"debts"|"assets"|"transactions"|"household";
  objectId:string;
  withdrawnFactIds:string[];
  remainingFactIds:string[];
  previousRecognition:string|null;
  previousLegalReview:string|null;
}

export function invalidateWithdrawnDocumentEvidence(data:CaseData,withdrawnFactIds:readonly string[]):WithdrawnDocumentTarget[]{
  const withdrawn=new Set(withdrawnFactIds);
  if(!withdrawn.size)return [];
  const targets:WithdrawnDocumentTarget[]=[];
  for(const collection of ["incomes","debts","assets","transactions"] as const){
    for(const entry of data[collection]){
      const row=entry as {id:string;factIds:string[];recognition?:string;legalReview?:string};
      const removed=row.factIds.filter(id=>withdrawn.has(id));
      if(!removed.length)continue;
      const previousRecognition=row.recognition??null,previousLegalReview=row.legalReview??null;
      row.factIds=row.factIds.filter(id=>!withdrawn.has(id));
      if(collection==="debts")row.legalReview="unreviewed";
      else if(collection==="incomes"||collection==="assets")row.recognition="unreviewed";
      targets.push({collection,objectId:row.id,withdrawnFactIds:[...new Set(removed)],remainingFactIds:[...row.factIds],previousRecognition,previousLegalReview});
    }
  }
  const removedHousehold=data.household.factIds.filter(id=>withdrawn.has(id));
  if(removedHousehold.length){
    const previousRecognition=data.household.recognition??null;
    data.household.factIds=data.household.factIds.filter(id=>!withdrawn.has(id));
    data.household.recognition="unreviewed";
    targets.push({collection:"household",objectId:"household",withdrawnFactIds:[...new Set(removedHousehold)],remainingFactIds:[...data.household.factIds],previousRecognition,previousLegalReview:null});
  }
  // A document/page withdrawal makes inventory completeness unknown even when
  // the affected facts were only supporting or source-only evidence.
  data.context.inventoryComplete={income:"unknown",debt:"unknown",asset:"unknown"};
  return targets;
}
