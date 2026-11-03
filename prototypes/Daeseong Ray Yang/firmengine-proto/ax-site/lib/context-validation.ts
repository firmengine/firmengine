import { maximumPlanMonths, ordinaryPlanMonths } from "./reference-parameters.ts";
import { z } from "zod";
import { currentFacts,normalizeMoney,type CaseData,type CaseContext,type Household } from "./domain.ts";
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,"유효한 날짜가 필요합니다.");
const tri=z.enum(["yes","no","unknown"]);
const money=z.object({rawValue:z.union([z.string(),z.number(),z.null()]),amountWon:z.string().regex(/^-?\d+$/).nullable(),unit:z.string(),currency:z.string(),normalizationStatus:z.enum(["exact","missing","invalid","review_required"])}).strict().superRefine((v,ctx)=>{
  const normalized=normalizeMoney(v.rawValue,v.unit,v.currency);
  if(normalized.amountWon!==v.amountWon||normalized.normalizationStatus!==v.normalizationStatus)ctx.addIssue({code:z.ZodIssueCode.custom,message:"원문 값·단위와 정규화 금액이 일치해야 합니다."});
});
const nullableMoney=money.nullable().optional();
const scheduleMoney=z.string().regex(/^\d{1,30}$/,"0 이상의 정수 원 금액이 필요합니다.");
const installmentNumber=()=>z.number().int().min(1).refine(value=>value<=maximumPlanMonths(),"변제 회차가 현재 기준정보의 허용 상한을 초과합니다.");
const schedulePhase=z.object({id:z.string().trim().min(1).max(80),firstInstallment:installmentNumber(),lastInstallment:installmentNumber(),firstPaymentDate:date.optional(),monthlyAvailableWon:scheduleMoney,allocations:z.array(z.object({creditorId:z.string().trim().min(1).max(200),principalWon:scheduleMoney,interestWon:scheduleMoney}).strict()).min(1).max(200)}).strict().superRefine((phase,ctx)=>{
  if(phase.lastInstallment<phase.firstInstallment)ctx.addIssue({code:z.ZodIssueCode.custom,message:"단계의 마지막 회차는 시작 회차 이후여야 합니다."});
  if(new Set(phase.allocations.map(a=>a.creditorId)).size!==phase.allocations.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:"단계 안에서 채권자를 중복 입력할 수 없습니다."});
  const allocated=phase.allocations.reduce((sum,a)=>sum+BigInt(a.principalWon)+BigInt(a.interestWon),0n);
  if(allocated>BigInt(phase.monthlyAvailableWon))ctx.addIssue({code:z.ZodIssueCode.custom,message:"채권자별 월 배분 합계가 단계 월 가용액을 초과합니다."});
});
const paymentSchedule=z.object({reviewed:z.boolean(),reviewReason:z.string().max(2000).optional(),expectedInstallments:installmentNumber().nullable().optional(),phases:z.array(schedulePhase).refine(phases=>phases.length<=maximumPlanMonths(),"변제 단계 수가 현재 기준정보의 허용 상한을 초과합니다.")}).strict().superRefine((schedule,ctx)=>{
  if(schedule.reviewed&&!schedule.reviewReason?.trim())ctx.addIssue({code:z.ZodIssueCode.custom,message:"변제 일정 검토 완료에는 새로운 검토 이유가 필요합니다."});
  if(schedule.reviewed&&(!schedule.phases.length||schedule.phases.some(p=>!p.firstPaymentDate)))ctx.addIssue({code:z.ZodIssueCode.custom,message:"완전한 단계와 변제일이 확인되기 전에는 일정을 검토 완료로 표시할 수 없습니다."});
  const ids=new Set<string>();for(const p of schedule.phases){if(ids.has(p.id))ctx.addIssue({code:z.ZodIssueCode.custom,message:"단계 ID는 각각 달라야 합니다."});ids.add(p.id);}
  const phases=[...schedule.phases].sort((a,b)=>a.firstInstallment-b.firstInstallment);let next=1;
  for(const p of phases){if(p.firstInstallment!==next)ctx.addIssue({code:z.ZodIssueCode.custom,message:"단계 회차는 1회부터 중복·누락 없이 연결되어야 합니다."});next=p.lastInstallment+1;}
  if(phases.at(-1)&&phases.at(-1)!.lastInstallment>maximumPlanMonths())ctx.addIssue({code:z.ZodIssueCode.custom,message:`변제 회차는 최대 ${maximumPlanMonths()}회까지 입력할 수 있습니다.`});
  if(schedule.expectedInstallments!=null&&phases.at(-1)?.lastInstallment!==schedule.expectedInstallments)ctx.addIssue({code:z.ZodIssueCode.custom,message:"예상 회차와 단계 마지막 회차가 일치해야 합니다."});
  for(let i=1;i<phases.length;i++){const previous=phases[i-1],current=phases[i];if(!previous.firstPaymentDate||!current.firstPaymentDate)continue;
    const planAnchor=phases[0]?.firstPaymentDate;if(!planAnchor)continue;const [y,m,d]=planAnchor.split("-").map(Number);const months=current.firstInstallment-1;const first=new Date(Date.UTC(y,m-1+months,1));const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();const expected=String(first.getUTCFullYear()).padStart(4,"0")+"-"+String(first.getUTCMonth()+1).padStart(2,"0")+"-"+String(Math.min(d,last)).padStart(2,"0");
    if(current.firstPaymentDate!==expected)ctx.addIssue({code:z.ZodIssueCode.custom,message:"다음 단계의 첫 변제일은 회차에 맞게 월 단위로 연속되어야 합니다."});
  }
});
export const CONTEXT_PATCH_SCHEMA=z.object({
  caseName:z.string().trim().min(1).max(100).optional(),applicationDate:date.optional(),asOf:date.optional(),courtId:z.string().min(1).max(60).optional(),
  referenceApplicationRequired:z.boolean().optional(),referenceBundleId:z.string().trim().min(1).max(180).nullable().optional(),referenceArtifactIds:z.array(z.string().trim().min(1).max(180)).min(1).max(500).refine(ids=>new Set(ids).size===ids.length,"기준 항목 ID를 중복 선택할 수 없습니다.").nullable().optional(),referenceDateBasis:z.enum(["applicationDate","asOf"]).nullable().optional(),referenceEffectiveDate:date.nullable().optional(),
  filingPeriod:z.object({start:date,end:date}).strict().refine(v=>v.start<=v.end,"기간 종료일이 시작일보다 앞섭니다.").nullable().optional(),incomePeriodReviewed:z.boolean().optional(),evidence_cutoff:date.optional(),
  inventoryComplete:z.object({income:tri,debt:tri,asset:tri}).strict().optional(),ruleApplicationReviewed:z.boolean().optional(),
  planMonths:installmentNumber().nullable().optional(),exceptionalTermReviewed:z.boolean().optional(),
  shortenedTermReview:z.object({months:z.number().int().min(1).refine(value=>value<ordinaryPlanMonths(),"단축 검토기간은 원칙 기간보다 짧아야 합니다."),ruleReleaseId:z.string().trim().min(1).max(120),reason:z.string().trim().min(1).max(2000),basisFingerprint:z.string().min(2).max(50000)}).strict().nullable().optional(),
  disposalApplicabilityReview:z.object({disposition:z.literal("not_applicable"),status:z.enum(["candidate","confirmed"]),reason:z.string().trim().min(1).max(2000),basisFingerprint:z.string().min(2).max(50000),factIds:z.array(z.string().trim().min(1).max(180)).max(500),reviewedBy:z.string().trim().max(200).optional(),reviewedAt:z.string().datetime().optional()}).strict().nullable().optional(),
  monthlyTrusteeFee:nullableMoney,monthlyPriorityPayment:nullableMoney,monthlyEstatePayment:nullableMoney,approvedMonthlyPayment:nullableMoney,approvedPresentValue:nullableMoney,
  presentValueBasis:z.string().max(2000).optional(),presentValueReviewed:z.boolean().optional(),assetValuationBasisReviewed:z.boolean().optional(),courtObjection:tri.optional(),
  allocationBasis:z.enum(["principal_then_interest_pro_rata","principal_only_pro_rata"]).optional(),allocationBasisReviewed:z.boolean().optional(),
  eligibility:z.object({naturalPerson:tri.optional(),insolventOrRisk:tri.optional(),priorProceedingsReviewed:tri.optional()}).strict().optional(),
  applicant:z.object({name:z.string().max(200).optional(),address:z.string().max(1000).optional(),residentIdMasked:z.string().max(100).optional(),statement:z.string().max(20000).optional()}).strict().optional(),paymentSchedule:paymentSchedule.optional(),
}).strict();
const HOUSEHOLD_SCHEMA=z.object({reportedMembers:z.number().int().min(1).max(30).nullable().optional(),recognizedMembers:z.number().int().min(1).max(30).nullable().optional(),recognizedLivingCost:nullableMoney,additionalLivingCost:nullableMoney,livingCostIncludesAdditional:z.boolean().optional(),recognition:z.enum(["unreviewed","accepted","rejected"]).optional(),factIds:z.array(z.string()).max(100).optional()}).strict();
export function parseContextPatch(raw:unknown,previous?:CaseContext):Partial<CaseContext>{
  const parsed=CONTEXT_PATCH_SCHEMA.parse(raw??{});
  if(parsed.paymentSchedule&&previous?.paymentSchedule&&JSON.stringify(parsed.paymentSchedule)!==JSON.stringify(previous.paymentSchedule)&&parsed.paymentSchedule.reviewed&&parsed.paymentSchedule.reviewReason===previous.paymentSchedule.reviewReason)throw new Error("변경한 변제 일정에는 기존과 다른 새 검토 이유가 필요합니다.");
  // Selecting/clearing a period never inherits an earlier review implicitly.
  if(Object.hasOwn(parsed,"filingPeriod")&&parsed.incomePeriodReviewed===undefined)parsed.incomePeriodReviewed=false;
  if(parsed.filingPeriod===null&&parsed.incomePeriodReviewed===true)throw new Error("대표기간을 선택한 후 해당 기간의 검토를 기록하세요.");
  if(parsed.referenceApplicationRequired&&(!parsed.referenceBundleId||!parsed.referenceArtifactIds?.length||!parsed.referenceDateBasis||!parsed.referenceEffectiveDate))throw new Error("기준 적용을 확정하려면 승인된 판본, 적용 항목, 날짜 기준과 적용일을 모두 명시하세요.");
  if(parsed.referenceApplicationRequired&&previous&&parsed.referenceDateBasis){const declaredDate=parsed.referenceDateBasis==="applicationDate"?parsed.applicationDate??previous.applicationDate:parsed.asOf??previous.asOf;if(declaredDate!==parsed.referenceEffectiveDate)throw new Error("선택한 사건 날짜 기준과 기준 적용일이 일치해야 합니다.");}
  if(parsed.referenceBundleId&&previous?.referenceBundleId&&parsed.referenceBundleId!==previous.referenceBundleId&&parsed.referenceApplicationRequired===undefined)throw new Error("기준 판본을 바꾸려면 적용 검토를 다시 선언하세요.");
  return parsed as Partial<CaseContext>;
}
export function parseHouseholdPatch(raw:unknown,data:CaseData):Partial<Household>{
  const result=HOUSEHOLD_SCHEMA.parse(raw),facts=new Set(currentFacts(data).map(f=>f.id));
  if(result.factIds?.some(id=>!facts.has(id)))throw new Error("가구·생계비 판단의 현재 사실 근거를 선택하세요.");
  return result as Partial<Household>;
}
