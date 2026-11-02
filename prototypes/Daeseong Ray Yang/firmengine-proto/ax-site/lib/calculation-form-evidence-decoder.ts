/** Fail closed on malformed persisted calculation evidence before legal-form projection.
 * This checks serialized shape, NOT Fact existence, same-case ownership, recognition,
 * calculation revision, approval or court-form compliance.
 */
export function decodeStoredCalculationEvidence(input:{valueJson:string;factIdsJson:string}):{
  value:unknown;sourceFactIds:string[];
}{
  let value:unknown,rawIds:unknown;
  try{
    value=JSON.parse(input.valueJson);
    rawIds=JSON.parse(input.factIdsJson);
  }catch{
    throw new Error("CALCULATION_FORM_EVIDENCE_JSON_INVALID");
  }
  if(!Array.isArray(rawIds)||rawIds.some(id=>typeof id!=="string"||!id||id!==id.trim())
    ||new Set(rawIds).size!==rawIds.length){
    throw new Error("CALCULATION_FORM_FACT_IDS_INVALID");
  }
  return {value,sourceFactIds:rawIds as string[]};
}
