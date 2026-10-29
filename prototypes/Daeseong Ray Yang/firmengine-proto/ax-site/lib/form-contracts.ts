import { PUBLIC_FORM_METADATA } from "./form-template-data.ts";
import tokenCatalog from "./template-token-catalog.json" with { type: "json" };

export const FORM_CONTRACT_VERSION = "document-form-contract/1.1";
export type FormValueKind = "source" | "derived" | "prose" | "layout";
export type Requiredness = "required" | "conditional" | "optional" | "unverified";
export interface FormFieldContract {
  token: string;
  kind: FormValueKind;
  requiredness: Requiredness;
  requiredReason?: string;
  requiredWhen?: string;
  source: string;
}
export interface RepeatGroupContract { id: string; fields: string[]; identitySource: string; }
export interface FormContract {
  code: string; title: string; templateVersion: string; templateHash: string;
  approvalStatus: string; reconstruction: boolean; limitations: string;
  fields: FormFieldContract[]; repeatGroups: RepeatGroupContract[];
}
const derived = new Set(["total_principal","total_interest","secured_debt_total","unsecured_debt_total","monthly_income","recognized_living_cost","monthly_disposable_income","ordinary_repayment_budget","monthly_payment","monthly_trustee_fee","repayment_months","total_repayment","liquidation_value","present_value","repayment_rate","debt_principal_total","debt_interest_total","assets_total","monthly_business_income","approved_monthly_income","form_pre_fee_disposable","form_available_after_trustee","form_total_available_after_trustee"]);
const prose = new Set(["statement","related_cases","assignment_order_details","disputed_claim_details","other_claim_details","secured_claim_details","family_details","career_history","enforcement_history","prior_proceedings","payment_schedule_details","trustee_payment_details","plan_other_details"]);
const layout = new Set(["creditor.number","disputed.number","secured.number","assignment.number","asset.number","month.number","family.number","career.number","enforcement.number","prior.number","attachment.number"]);
function valueKind(token: string): FormValueKind {
  if (layout.has(token)) return "layout";
  if (prose.has(token)) return "prose";
  if (derived.has(token.split(".").at(-1)!)) return "derived";
  return "source";
}
const appRequired: Record<string,{reason:string;when?:string}> = {
  client_name:{reason:"FirmEngine document usability contract: identify the applicant in every generated form; this is an application requirement, not an official e-form legal requirement."},
  "creditor.entity":{reason:"FirmEngine repeat-row integrity contract: every emitted creditor row must identify its party; it does not claim portal requiredness.",when:"For each emitted creditor row."},
  "creditor.principal":{reason:"FirmEngine repeat-row integrity contract: each emitted creditor row carries a principal amount or an explicit unresolved marker; zero is a valid value.",when:"For each emitted creditor row."},
};
type CatalogTemplate={id:string;path:string;sha256:string;tokens:string[];repeatGroups:Record<string,string[]>};
const catalog=(tokenCatalog as unknown as {templates:CatalogTemplate[]}).templates;
const officialMeta=PUBLIC_FORM_METADATA as unknown as Record<string,{code:string;title:string;template_version:string;template:{sha256:string};approval_status:string;reconstruction:boolean;limitations:string;mapped_tokens:string[]}>;
function createContract(template:CatalogTemplate,meta=officialMeta[template.id]):FormContract {
 const groups=new Map(Object.entries(template.repeatGroups));
 const fields=template.tokens.map((token):FormFieldContract=>{
  const required=appRequired[token];
  return {token,kind:valueKind(token),requiredness:required?(required.when?"conditional":"required"):"unverified",...(required?{requiredReason:required.reason,requiredWhen:required.when}:{}),source:"DOCX template token inventory + FirmEngine application contract; official portal status unverified"};
 });
 const identitySources:Record<string,string>={creditor:"CaseData debtId",secured:"CaseData debtId",disputed:"CaseData debtId",assignment:"CaseData debtId",asset:"CaseData assetId",month:"income entity ID + period",family:"household entity ID",attachment:"documentId",allocation:"debtId or assetId + allocation scope"};
 return {code:template.id,title:meta?.title??template.id,templateVersion:meta?.template_version??"public-editable-template",templateHash:template.sha256,approvalStatus:meta?.approval_status??"reviewer_pending",reconstruction:meta?.reconstruction??true,limitations:meta?.limitations??"Token inventory was read from the repository DOCX template. Official portal parity, field applicability, and legal requiredness have not been verified.",fields,repeatGroups:[...groups].map(([id,fields])=>({id,fields,identitySource:identitySources[id]??"stable source entity ID (never display row number)"}))};
}
/** Every token found in repository DOCX templates is registered. No official e-form parity is inferred. */
export function buildFormContractRegistry():Record<string,FormContract>{return Object.fromEntries(catalog.map(template=>[template.id,createContract(template)]));}
export const FORM_CONTRACTS=buildFormContractRegistry();
