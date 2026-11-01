/** Deterministic checks on current form bindings, not an LLM legal decision.
 * The assessment engine retains source IDs, unit normalization and formulas.
 * In particular an undiscounted sum cannot replace present value.
 */
export const LEGAL_CALCULATION_READINESS_VERSION="legal-calculation-readiness/1" as const;
export interface LegalCalculationIssue {code:string;severity:"blocker"|"warning";message:string;statute:string;}
export interface LegalCalculationReview {version:typeof LEGAL_CALCULATION_READINESS_VERSION;issues:LegalCalculationIssue[];automaticLegalApproval:false;}
// Strict display parsing: malformed separators must not alter arithmetic silently.
const won=(value:unknown):bigint|null=>{
 if(typeof value!=="string")return null;
 const normalized=value.normalize("NFKC").trim().replace(/^₩\s*/u,"").replace(/\s*원$/u,"").trim();
 return /^-?(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)$/.test(normalized)?BigInt(normalized.replaceAll(",","")):null;
};
export function reviewLegalPlanArithmetic(formCode:string,input:{scalars:Record<string,string>}):LegalCalculationReview{
 const issues:LegalCalculationIssue[]=[];
 if(!["D5110","D5111"].includes(formCode))return {version:LEGAL_CALCULATION_READINESS_VERSION,issues,automaticLegalApproval:false};
 // This is a display-integrity gate, not a finding that a term is legally approved.
 const unresolved=(raw:unknown):boolean=>{
   if(raw===null||raw===undefined||raw==="")return true;
   if(typeof raw!=="string")return false;
   const s=raw.normalize("NFKC").trim();
   return s==="source-only" || /^\[(?:확인 필요|상충|불일치|누락|오인식|판독(?: 불가)?|검토(?: 필요)?|배분(?: 기준 검토 필요)?|미확정|미관찰|미상|승인전|원문만|원천만|해당없음|source-only)(?::[^\]]+)?\]$/.test(s);
 };
 // Repayment duration is a month count, not a monetary amount.
 const validDisplay=(key:string,raw:unknown):boolean=>
   key==="repayment_months"
     ? typeof raw==="string" && /^\d+$/.test(raw.normalize("NFKC").trim())
     : won(raw)!==null;
 const v=(key:string)=>key==="repayment_months"&&!validDisplay(key,input.scalars[key])
   ? null : won(input.scalars[key]);
 const add=(code:string,severity:LegalCalculationIssue["severity"],message:string,statute:string)=>issues.push({code,severity,message,statute});
 // Internal format validation only. No missing value or source-only observation
 // becomes legal approval, and explicit observed string "0" remains valid.
 for(const key of ["approved_monthly_income","recognized_living_cost","monthly_disposable_income",
   "repayment_months","present_value","liquidation_value","monthly_payment","total_repayment"]){
   const raw=(input.scalars as Record<string,unknown>)[key];
   if(unresolved(raw))continue;
   if(!validDisplay(key,raw)) add("PLAN_SCALAR_FORMAT_UNRESOLVED","blocker",
     key+": 금액 또는 회차의 표시 형식이 유효하지 않아 독립 산술 검증을 할 수 없습니다.",
     "FIRMENGINE-INTERNAL-DATA-INTEGRITY");
 }

 const income=v("approved_monthly_income"),living=v("recognized_living_cost"),available=v("monthly_disposable_income");
 if(income!==null&&living!==null&&available!==null&&income-living!==available)
   add("PLAN_DISPOSABLE_FORMULA_MISMATCH","blocker","월 인정소득−생계비와 월 가용소득의 산식이 불일치합니다.","KR-REHAB-611");
 const months=v("repayment_months");
 if(months!==null&&months>36n&&months<=60n)
   add("PLAN_OVER_THREE_YEARS_REQUIRES_SPECIAL_REVIEW","blocker","변제기간은 원칙적으로 3년 이하입니다. 3년 초과 시 제611조 제5항의 특별한 사정 및 법원 검토 근거가 필요합니다.","KR-REHAB-611");
 if(months!==null&&(months<=0n||months>60n))
   add("PLAN_DURATION_OUTSIDE_STATUTORY_LIMIT","blocker","변제기간은 양수이고 법 제611조 제5항의 5년을 초과하지 않아야 합니다.","KR-REHAB-611");
 const pv=v("present_value"),liquidation=v("liquidation_value");
 if(pv!==null&&liquidation!==null&&pv<liquidation)
   add("PLAN_LIQUIDATION_EXCEPTION_REQUIRES_REVIEW","blocker","변제액 현재가치가 청산가치 미만입니다. 채권자 동의 등 법 제614조상 예외 검토가 필요합니다.","KR-REHAB-614");
 if((pv!==null&&pv<0n)||(liquidation!==null&&liquidation<0n))
   add("PLAN_NEGATIVE_PRESENT_OR_LIQUIDATION_VALUE","blocker","현재가치·청산가치가 음수입니다.","KR-REHAB-614");
 const payment=v("monthly_payment");
 if(payment!==null&&available!==null&&payment>available)
   add("PLAN_PAYMENT_EXCEEDS_DISPOSABLE_REVIEW","warning","월 변제액이 가용소득 초과: 재산처분 등 별도 재원·비용 근거를 검토하세요.","KR-REHAB-611");
 const total=v("total_repayment");
 if(payment!==null&&months!==null&&months>0n&&total!==null&&payment*months!==total)
   add("PLAN_VARIABLE_SCHEDULE_OR_TOTAL_REVIEW","warning","정액 월변제액×기간과 총액이 다릅니다. 변동구간·재산처분·변제배분표를 대조하세요.","KR-REHAB-611");
 return {version:LEGAL_CALCULATION_READINESS_VERSION,issues,automaticLegalApproval:false};
}
