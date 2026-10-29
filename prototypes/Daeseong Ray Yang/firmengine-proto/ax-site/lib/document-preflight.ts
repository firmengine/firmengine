import { FORM_CONTRACTS, FORM_CONTRACT_VERSION, type FormContract } from "./form-contracts.ts";
import type { FormBindings } from "./form-mapping.ts";
export type DocumentMode = "draft" | "final";
export interface DocumentPreflightIdentity { evaluationId:string; evaluationResultHash:string; referenceBundleHash:string; templateHash:string; documentEditsHash:string; }
export interface PreflightIssue { code:string; token?:string; message:string; severity:"blocker"|"warning"; }
export interface DocumentPreflightResult { status:"ready"|"draft_with_unresolved"|"blocked"; blockers:PreflightIssue[]; warnings:PreflightIssue[]; unresolved:string[]; contractHash:string; }
const MISSING = new Set(["","[확인 필요]","[불일치·확인 필요]","[미확정]","[검토 필요]"]);
const absent=(x:unknown)=>x===undefined||x===null||MISSING.has(String(x).trim());
export async function evaluateDocumentPreflight(input:{formCode:string;bindings:FormBindings;identity:DocumentPreflightIdentity;mode:DocumentMode;contract?:FormContract}):Promise<DocumentPreflightResult> {
  const contract=input.contract ?? FORM_CONTRACTS[input.formCode];
  const blockers:PreflightIssue[]=[],warnings:PreflightIssue[]=[],unresolved:string[]=[];
  if(!contract){blockers.push({code:"UNKNOWN_FORM",message:`No form contract for ${input.formCode}.`,severity:"blocker"});return {status:"blocked",blockers,warnings,unresolved,contractHash:"unavailable"};}
  if(input.identity.templateHash!==contract.templateHash) blockers.push({code:"TEMPLATE_HASH_MISMATCH",message:"Template fingerprint does not match the form contract.",severity:"blocker"});
  const systemTokens=new Set(["review_status","revision","monthly_income","ordinary_repayment_budget","form_pre_fee_disposable","form_available_after_trustee","form_total_available_after_trustee"]);
  // buildFormBindings is shared across form kinds, so a valid global binding may be unused by this specific template.
  // A binding unknown to the entire registered template inventory still blocks.
  const registeredTokens=new Set(Object.values(FORM_CONTRACTS).flatMap(form=>form.fields.map(f=>f.token)));
  const known=new Set([...registeredTokens,...systemTokens]);
  for(const token of Object.keys(input.bindings.scalars)) if(!known.has(token)) blockers.push({code:"UNKNOWN_TOKEN",token,message:"Scalar token is not registered in the form contract.",severity:"blocker"});
  for(const [group,rows] of Object.entries(input.bindings.rows)) {
    const fields=[...new Set(Object.values(FORM_CONTRACTS).flatMap(form=>form.repeatGroups.find(g=>g.id===group)?.fields??[]))];
    if(!fields.length){blockers.push({code:"UNKNOWN_REPEAT_GROUP",token:group,message:"Repeat group is not registered.",severity:"blocker"});continue;}
    rows.forEach((row,index)=>{for(const field of Object.keys(row)) if(!fields.includes(field)) blockers.push({code:"UNKNOWN_ROW_TOKEN",token:`${group}.${field}[${index}]`,message:"Repeat-row field is not registered.",severity:"blocker"});});
  }
  for(const field of contract.fields) {
    if(field.kind==="layout") continue;
    const [group,leaf,...rest]=field.token.split(".");
    const values=rest.length||field.token.includes(".") ? (input.bindings.rows[group]??[]).map(row=>row[rest.length?`${leaf}.${rest.join(".")}`:leaf]) : [input.bindings.scalars[field.token]];
    const applies=field.requiredness!=="conditional"||values.length>0;
    if(!applies) continue;
    const missing=values.length===0 || values.some(absent);
    if(!missing) continue;
    const reason=`${field.token}: ${field.requiredness === "unverified" ? "requiredness/applicability unverified" : "value unresolved"}`;
    unresolved.push(reason);
    const needsValue=field.requiredness==="required"||field.requiredness==="conditional";
    const issue={code:"FIELD_UNRESOLVED",token:field.token,message:reason,severity:(input.mode==="final"&&needsValue?"blocker":"warning") as "blocker"|"warning"};
    if(input.mode==="final"&&needsValue) blockers.push(issue); else warnings.push(issue);
  }
  const numeric = (value:unknown):bigint|null => { const text=String(value??"").replace(/[\s,₩원]/g,""); return /^-?\d+$/.test(text)?BigInt(text):null; };
  const creditorRows=input.bindings.rows.creditor??[];
  for(const [rowField,totalField] of [["principal","total_principal"],["interest","total_interest"]] as const) {
    const rowValues=creditorRows.map(row=>numeric(row[rowField])); const total=numeric(input.bindings.scalars[totalField]);
    if(rowValues.length&&total!==null&&rowValues.every(value=>value!==null)) {
      const sum=rowValues.reduce((acc,value)=>acc+value!,0n);
      if(sum!==total) blockers.push({code:"REPEAT_ROW_TOTAL_MISMATCH",token:`creditor.${rowField}`,message:`Creditor row ${rowField} sum does not match ${totalField}.`,severity:"blocker"});
    }
  }
  if(input.mode==="final"&&unresolved.length) warnings.push({code:"UNVERIFIED_FORM_APPLICABILITY",message:"Some field applicability and official e-form behavior remain unverified; this is separate from the FirmEngine application required-field gate.",severity:"warning"});
  const canonical=JSON.stringify({version:FORM_CONTRACT_VERSION,code:contract.code,templateHash:contract.templateHash,fields:contract.fields,repeatGroups:contract.repeatGroups,identity:input.identity});
  const digest=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical));
  const contractHash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  return {status:blockers.length?"blocked":unresolved.length&&input.mode==="draft"?"draft_with_unresolved":"ready",blockers,warnings,unresolved,contractHash};
}
