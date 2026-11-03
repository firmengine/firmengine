import { FORM_CONTRACTS, FORM_CONTRACT_VERSION, type FormContract } from "./form-contracts.ts";
import { reviewLegalPlanArithmetic } from "./legal-calculation-readiness.ts";
import type { FormBindings } from "./form-mapping.ts";
export type DocumentMode = "draft" | "final";
export interface DocumentPreflightIdentity { evaluationId:string; evaluationResultHash:string; referenceBundleHash:string; templateHash:string; documentEditsHash:string; }
export interface PreflightIssue { code:string; token?:string; message:string; severity:"blocker"|"warning"; }
export interface DocumentPreflightResult { status:"ready"|"draft_with_unresolved"|"blocked"; blockers:PreflightIssue[]; warnings:PreflightIssue[]; unresolved:string[]; contractHash:string; }
const MISSING = new Set(["","[확인 필요]","[불일치·확인 필요]","[미확정]","[검토 필요]"]);
// Internal amount-sign integrity only; legal debt and income recognition remain human-reviewed.
const NON_NEGATIVE_PLAN_SCALARS = new Set(["monthly_payment","monthly_trustee_fee","total_repayment"]);
const absent=(x:unknown)=>x===undefined||x===null||MISSING.has(String(x).trim())||/^\[(?:상충|누락|오인식|판독|검토|배분|미확정)/.test(String(x).trim());
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
    const missing=values.length===0 || values.some(absent) || field.token==="resident_id"&&values.some(value=>/[Xx*●•]/.test(String(value??"")));
    if(!missing) continue;
    const reason=`${field.token}: ${field.requiredness === "unverified" ? "requiredness/applicability unverified" : "value unresolved"}`;
    unresolved.push(reason);
    const needsValue=field.requiredness==="required"||field.requiredness==="conditional";
    const issue={code:"FIELD_UNRESOLVED",token:field.token,message:reason,severity:(input.mode==="final"&&needsValue?"blocker":"warning") as "blocker"|"warning"};
    if(input.mode==="final"&&needsValue) blockers.push(issue); else warnings.push(issue);
  }
  // Preserve grouping boundaries: punctuation embedded inside amount is not a valid integer.
  const numeric = (value:unknown):bigint|null => {
    if(typeof value!=="string")return null;
    const s=value.normalize("NFKC").trim().replace(/^₩\s*/,"").replace(/\s*원$/,"").trim();
    if(!/^-?(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)$/.test(s))return null;
    return BigInt(s.replaceAll(",",""));
  };
  // D5103 is a month-by-month form view; rendering an annual total in one
  // month row is a monetary misstatement even when the total is numerically valid.
  // This is FirmEngine's own final-review integrity gate, not official portal certification.
  if(input.formCode==="D5103"){
    const monthRows=input.bindings.rows.month??[];
    // A supported monthly income with no corresponding source month rows
    // cannot be presented as a complete month-by-month income statement.
    // Internal data-integrity gate only: not certification of official e-form.
    if(monthRows.length===0&&(numeric(input.bindings.scalars.approved_monthly_income)!==null||numeric(input.bindings.scalars.monthly_income)!==null)){
      const issue:PreflightIssue={code:"D5103_MONTH_ROWS_MISSING",token:"month",message:"월소득 값은 있으나 월별 원천 행이 없습니다. 서류담당자의 확인이 필요합니다.",severity:input.mode==="final"?"blocker":"warning"};
      if(input.mode==="final")blockers.push(issue);else warnings.push(issue);
    }
    // Internal document-integrity check, not a statutory 12-month rule.
    // If approved monthly income is shown, an interior source-month gap needs
    // human review; missing months are never silently converted into zero.
    if(numeric(input.bindings.scalars.approved_monthly_income)!==null){
      const months=[...new Set(monthRows.map(row=>String(row.period??"")).filter(month=>/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)))].sort();
      const ordinal=(month:string)=>Number(month.slice(0,4))*12+Number(month.slice(5,7));
      if(months.some((month,index)=>index>0&&ordinal(month)>ordinal(months[index-1]!)+1)){
        const issue:PreflightIssue={code:"D5103_MONTH_COVERAGE_GAP",token:"month",message:"승인 월소득과 월별 표 사이에 귀속월 공백이 있습니다. 실제 무소득·휴직·증빙누락을 구분해 검토해야 합니다.",severity:input.mode==="final"?"blocker":"warning"};
        if(input.mode==="final")blockers.push(issue);else warnings.push(issue);
      }
    }
    for(const [index,row]of monthRows.entries()){
      const month=String(row.period??""),amount=String(row.net_income??"");
      if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)||numeric(amount)===null){
        const issue:PreflightIssue={code:"D5103_MONTH_EVIDENCE_UNRESOLVED",token:`month[${index}]`,message:"월별 귀속기간이나 검증된 순소득이 없습니다. 연간합계를 1개월 소득으로 기재할 수 없습니다.",severity:input.mode==="final"?"blocker":"warning"};
        if(input.mode==="final")blockers.push(issue);else warnings.push(issue);
      }
    }
  }
  // Internal form numeric integrity only; legal recognition and official form parity remain separate.
  // Unlike an unresolved marker, a present but malformed value must not bypass arithmetic checks.
  if(input.formCode==="D5110"||input.formCode==="D5111"){
    for(const token of ["approved_monthly_income","recognized_living_cost",
      "monthly_disposable_income","monthly_payment","monthly_trustee_fee",
      "repayment_months","total_repayment","liquidation_value","present_value",
      "disposal_payment_total","disposal_present_value"]){
      const raw=input.bindings.scalars[token];
      if(absent(raw))continue; // Existing requiredness gate handles missing/unknown separately.
      const parsed=numeric(raw);
      if(parsed===null||parsed<0n&&NON_NEGATIVE_PLAN_SCALARS.has(token)){
        const negative=parsed!==null;
        const issue:PreflightIssue={code:negative?"PLAN_SCALAR_NEGATIVE_INVALID":"PLAN_SCALAR_NUMERIC_INVALID",token,
          message:negative?"월변제액·회생위원 보수·총변제액에 음수 금액이 있어 확인이 필요합니다.":"금액·회차 토큰에 원단위 정수가 아닌 값이 있어 독립 검토가 필요합니다.",
          severity:input.mode==="final"?"blocker":"warning"};
        if(input.mode==="final")blockers.push(issue);else warnings.push(issue);
      }
    }
  }
  const creditorRows=input.bindings.rows.creditor??[];
  // Validate explicit creditor-row money before any totals or legal-review projection.
  if(input.formCode==="D5110"||input.formCode==="D5111"){
    for(const [index,row]of creditorRows.entries()){
      for(const field of ["principal","monthly_payment","total_payment"]){
        const raw=row[field];
        if(raw===undefined||raw===null||absent(raw))continue;
        const parsed=numeric(raw);
        if(parsed!==null&&parsed>=0n)continue;
        const negative=parsed!==null;
        const issue:PreflightIssue={code:negative?"PLAN_CREDITOR_ROW_NEGATIVE_INVALID":"PLAN_CREDITOR_ROW_NUMERIC_INVALID",token:`creditor.${field}[${index}]`,message:negative?"채권자 원금·월변제액·총변제액에 음수 금액이 있어 확인이 필요합니다.":"채권자 원금·월변제액·총변제액에 정수원으로 해석할 수 없는 표시가 있습니다.",severity:input.mode==="final"?"blocker":"warning"};
        if(input.mode==="final")blockers.push(issue);else warnings.push(issue);
      }
    }
  }

  for(const [rowField,totalField] of [["principal","total_principal"],["interest","total_interest"]] as const) {
    const rowValues=creditorRows.map(row=>numeric(row[rowField])); const total=numeric(input.bindings.scalars[totalField]);
    if(rowValues.length&&total!==null&&rowValues.every(value=>value!==null)) {
      const sum=rowValues.reduce((acc,value)=>acc+value!,0n);
      if(sum!==total) blockers.push({code:"REPEAT_ROW_TOTAL_MISMATCH",token:`creditor.${rowField}`,message:`Creditor row ${rowField} sum does not match ${totalField}.`,severity:"blocker"});
    }
  }
  for(const issue of reviewLegalPlanArithmetic(input.formCode,input.bindings).issues){
    const result={code:issue.code,message:issue.message+" ("+issue.statute+")",severity:(issue.severity==="blocker"&&input.mode==="final"?"blocker":"warning") as "blocker"|"warning"};
    if(result.severity==="blocker")blockers.push(result);else warnings.push(result);
  }
  if(input.mode==="final"&&unresolved.length) warnings.push({code:"UNVERIFIED_FORM_APPLICABILITY",message:"Some field applicability and official e-form behavior remain unverified; this is separate from the FirmEngine application required-field gate.",severity:"warning"});
  const canonical=JSON.stringify({version:FORM_CONTRACT_VERSION,code:contract.code,templateHash:contract.templateHash,fields:contract.fields,repeatGroups:contract.repeatGroups,identity:input.identity});
  const digest=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical));
  const contractHash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  return {status:blockers.length?"blocked":unresolved.length&&input.mode==="draft"?"draft_with_unresolved":"ready",blockers,warnings,unresolved,contractHash};
}
