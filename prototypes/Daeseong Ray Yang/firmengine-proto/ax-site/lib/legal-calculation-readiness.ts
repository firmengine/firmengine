/** Deterministic checks on current form bindings, not an LLM legal decision.
 * The assessment engine retains source IDs, unit normalization and formulas.
 * In particular an undiscounted sum cannot replace present value.
 */
export const LEGAL_CALCULATION_READINESS_VERSION="legal-calculation-readiness/1" as const;
export interface LegalCalculationIssue {code:string;severity:"blocker"|"warning";message:string;statute:string;}
export interface LegalCalculationReview {version:typeof LEGAL_CALCULATION_READINESS_VERSION;issues:LegalCalculationIssue[];automaticLegalApproval:false;}
const won=(value:unknown):bigint|null=>{
 if(typeof value!=="string")return null;
 const normalized=value.normalize("NFKC").replace(/[\s,₩원]/g,"");
 return /^-?\d+$/.test(normalized)?BigInt(normalized):null;
};
export function reviewLegalPlanArithmetic(formCode:string,input:{scalars:Record<string,string>}):LegalCalculationReview{
 const issues:LegalCalculationIssue[]=[];
 if(!["D5110","D5111"].includes(formCode))return {version:LEGAL_CALCULATION_READINESS_VERSION,issues,automaticLegalApproval:false};
 const v=(key:string)=>won(input.scalars[key]);
 const add=(code:string,severity:LegalCalculationIssue["severity"],message:string,statute:string)=>issues.push({code,severity,message,statute});
 const income=v("approved_monthly_income"),living=v("recognized_living_cost"),available=v("monthly_disposable_income");
 if(income!==null&&living!==null&&available!==null&&income-living!==available)
   add("PLAN_DISPOSABLE_FORMULA_MISMATCH","blocker","월 인정소득−생계비와 월 가용소득의 산식이 불일치합니다.","KR-REHAB-611");
 const months=v("repayment_months");
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
