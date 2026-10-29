import type { IntakeRequirement } from "./intake-types.ts";

export type RequirementOverride = "automatic" | "add_manual" | "change_period" | "change_subject" | "select_alternative" | "review_mapping" | "waive_with_reason" | "declare_not_applicable" | "reopen" | "retire";
export interface RequirementFieldTarget { fieldId: string; targetPath: string }
export interface RequirementCrosswalkReview {
  crosswalkId: string; familyId: string; version: string; requiredFieldGroups: string[][]; optionalFieldIds: string[];
  typedTargets: RequirementFieldTarget[]; subjectScope: string; periodPolicy: string; noRequiredFields: boolean;
  reviewer: string; reviewedAt: string; reason: string;
}
export interface RequirementStaffDisposition {
  state: "confirmed" | "rejected"; dependencyFingerprint: string; reviewer: string;
  role: "caseworker_review" | "lawyer_review"; reason: string; basisRefs: string[];
}
export interface CaseRequirement {
  requirementId: string; originKey: string; intakeRunId: string; intakeDocumentTypeId: string;
  subjectLinkId: string | null; scopeKey: string; requiredPeriod: string; purposeCode: string;
  requirement: IntakeRequirement["requirement"]; alternativePolicy: IntakeRequirement["alternativePolicy"];
  intakeStatus: IntakeRequirement["status"];
  requiredFieldGroups: string[][]; optionalFieldIds: string[]; matchedRuleIds: string[]; sourceClaimIds: string[]; sourceIds: string[];
  mappingRequired: boolean;
  crosswalkId: string | null; familyId: string | null; crosswalkVersion: string | null; availableFieldIds: string[];
  noRequiredFieldsApproved: boolean;
  typedTargets: RequirementFieldTarget[]; crosswalkReview?: RequirementCrosswalkReview;
  workflowIds: string[]; alternatives: IntakeRequirement["alternatives"]; override: RequirementOverride;
  overrideReason: string | null; waivedByReview: boolean; notApplicableConfirmed: boolean; retired: boolean;
  overrideReviewer: string | null; overrideBasisRefs: string[];
  staffDisposition?: RequirementStaffDisposition;
  supersedesId?: string; splitFrom?: string;
}
export interface RequirementOrigin {
  intakeDocumentTypeId: string; subjectLinkId: string | null; scopeKey: string; requiredPeriod: string;
  purposeCode: string; requiredFieldGroups: readonly (readonly string[])[];
}
const norm = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ");
const targetFields: Record<string, ReadonlySet<string>> = {
  incomes:new Set(["kind","label","employer","payerIdentityId","gross","expenses","net","periodStart","periodEnd","periodMonths","amountBasis","recurring","recognition","factIds"]),
  debts:new Set(["contractId","creditor","principal","interest","secured","classification","asOf","dueDate","priority","legalReview","factIds"]),
  assets:new Set(["kind","label","grossValue","securedPayoff","securedPayoffScope","disposalCosts","protectedValue","ownershipBps","asOf","valuationBasis","recognition","factIds"]),
  transactions:new Set(["date","accountId","counterparty","kind","direction","amount","relatedObjectId","factIds"]),
  household:new Set(["reportedMembers","recognizedMembers","recognizedLivingCost","additionalLivingCost","livingCostIncludesAdditional","recognition","factIds"]),
};
export function isValidRequirementTarget(path:string):boolean {
  if(path==="source_only")return true;
  const match=/^(incomes|debts|assets|transactions|household)\[\]\.(\w+)$/.exec(path);
  return !!match&&!!targetFields[match[1]]?.has(match[2]);
}
export function requirementOriginKey(origin: RequirementOrigin): string {
  const groups = origin.requiredFieldGroups.map(g => [...g].sort()).sort((a,b) => a.join("\0").localeCompare(b.join("\0")));
  return [origin.intakeDocumentTypeId, origin.subjectLinkId ?? "unlinked", norm(origin.scopeKey), norm(origin.requiredPeriod), norm(origin.purposeCode), JSON.stringify(groups)].join("|");
}
export function makeCaseRequirement(input: { source: IntakeRequirement; intakeRunId: string; subjectLinkId?: string | null; scopeKey?: string; fieldGroups?: string[][]; mappingRequired?: boolean; crosswalk?: {crosswalkId:string;familyId:string|null;version:string;requiredFieldGroups:string[][];optionalFieldIds:string[];typedTargets:RequirementFieldTarget[];reviewState:"review_required"|"approved";coveragePolicy?:"unreviewed"|"required_groups"|"no_required_fields"}; availableFieldIds?:string[]; idFactory: () => string }): CaseRequirement {
  const subjectLinkId = input.subjectLinkId ?? null, scopeKey = input.scopeKey ?? `subject:${input.source.subjectId}`;
  // Intake candidate fields are not automatically approved required fields.
  // Only an explicit, reviewed crosswalk may provide required groups.
  const groups = input.fieldGroups ?? [];
  const origin = { intakeDocumentTypeId: input.source.documentTypeId, subjectLinkId, scopeKey, requiredPeriod: input.source.period, purposeCode: input.source.documentTypeId, requiredFieldGroups: groups };
  return { requirementId: input.idFactory(), originKey: requirementOriginKey(origin), intakeRunId: input.intakeRunId,
    intakeDocumentTypeId: input.source.documentTypeId, subjectLinkId, scopeKey, requiredPeriod: input.source.period,
    purposeCode: input.source.documentTypeId, requirement: input.source.requirement, alternativePolicy: input.source.alternativePolicy, intakeStatus: input.source.status,
    requiredFieldGroups: groups.map(g => [...g]), optionalFieldIds: [], matchedRuleIds: [...input.source.matchedRuleIds],
    mappingRequired: input.mappingRequired ?? (input.crosswalk ? input.crosswalk.reviewState!=="approved" || groups.length === 0 && input.crosswalk.coveragePolicy!=="no_required_fields" : groups.length===0),
    crosswalkId:input.crosswalk?.crosswalkId??null,familyId:input.crosswalk?.familyId??null,crosswalkVersion:input.crosswalk?.version??null,
    noRequiredFieldsApproved:input.crosswalk?.coveragePolicy==="no_required_fields",
    availableFieldIds:[...(input.availableFieldIds??[])],typedTargets:(input.crosswalk?.typedTargets??[]).map(t=>({...t})),
    sourceClaimIds: [...input.source.sourceClaimIds], sourceIds: [...input.source.sourceIds], workflowIds: [...input.source.workflowIds],
    alternatives: input.source.alternatives.map(a => ({ ...a })), override: "automatic", overrideReason: null,
    waivedByReview: false, notApplicableConfirmed: false, retired: false, overrideReviewer: null, overrideBasisRefs: [] };
}
export function applyRequirementMappingReview(requirement:CaseRequirement,input:{expectedId:string;expectedCrosswalkId:string;expectedCrosswalkVersion:string;requiredFieldGroups:string[][];optionalFieldIds:string[];typedTargets:RequirementFieldTarget[];noRequiredFields:boolean;subjectScope:string;periodPolicy:string;reviewer:string;reviewedAt:string;reason:string}):CaseRequirement {
  if(input.expectedId!==requirement.requirementId||requirement.retired||!requirement.crosswalkId||!requirement.familyId||!requirement.crosswalkVersion)throw new Error("Requirement crosswalk is missing or stale.");
  if(input.expectedCrosswalkId!==requirement.crosswalkId||input.expectedCrosswalkVersion!==requirement.crosswalkVersion)throw new Error("Crosswalk contract changed; reload before mapping.");
  if(!input.reviewer.trim()||!input.reason.trim()||!Number.isFinite(Date.parse(input.reviewedAt)))throw new Error("Mapping review requires a reviewer, timestamp, and reason.");
  const available=new Set(requirement.availableFieldIds),groups=input.requiredFieldGroups;
  if(groups.some(group=>!group.length)||(!groups.length&&!input.noRequiredFields)||input.noRequiredFields&&groups.length)throw new Error("Choose required field groups or explicitly confirm no required fields.");
  const requiredIds=new Set(groups.flat());
  if([...requiredIds].some(id=>!available.has(id)))throw new Error("Required field group contains a field outside this family.");
  const optional=new Set(input.optionalFieldIds);
  if([...optional].some(id=>!available.has(id)||requiredIds.has(id)))throw new Error("Optional fields must be available and distinct from required fields.");
  const targetMap=new Map<string,string>();
  for(const target of input.typedTargets){if(!available.has(target.fieldId)||!isValidRequirementTarget(target.targetPath)||targetMap.has(target.fieldId))throw new Error("Typed target is invalid or duplicated.");targetMap.set(target.fieldId,target.targetPath);}
  if([...requiredIds].some(id=>!targetMap.has(id)))throw new Error("Every required field needs an explicit typed target or source_only mapping.");
  return {...requirement,requiredFieldGroups:groups.map(g=>[...g]),optionalFieldIds:[...optional],typedTargets:input.typedTargets.map(t=>({...t})),mappingRequired:false,noRequiredFieldsApproved:input.noRequiredFields,override:"review_mapping",overrideReason:input.reason.trim(),overrideReviewer:input.reviewer.trim(),overrideBasisRefs:[],crosswalkReview:{crosswalkId:requirement.crosswalkId,familyId:requirement.familyId,version:requirement.crosswalkVersion,requiredFieldGroups:groups.map(g=>[...g]),optionalFieldIds:[...optional],typedTargets:input.typedTargets.map(t=>({...t})),subjectScope:input.subjectScope,periodPolicy:input.periodPolicy,noRequiredFields:input.noRequiredFields,reviewer:input.reviewer.trim(),reviewedAt:input.reviewedAt,reason:input.reason.trim()},originKey:requirementOriginKey({intakeDocumentTypeId:requirement.intakeDocumentTypeId,subjectLinkId:requirement.subjectLinkId,scopeKey:requirement.scopeKey,requiredPeriod:requirement.requiredPeriod,purposeCode:requirement.purposeCode,requiredFieldGroups:groups})};
}
/** Merge only same-origin requirements with compatible obligation and alternative policy. */
export function mergeRequirements(existing: readonly CaseRequirement[], incoming: readonly CaseRequirement[]): CaseRequirement[] {
  const result = existing.map(r => ({ ...r }));
  for (const candidate of incoming) {
    const prior = result.find(r => r.originKey === candidate.originKey && r.requirement === candidate.requirement && r.alternativePolicy === candidate.alternativePolicy);
    if (!prior) { result.push({ ...candidate }); continue; }
    prior.matchedRuleIds = [...new Set([...prior.matchedRuleIds, ...candidate.matchedRuleIds])];
    prior.sourceClaimIds = [...new Set([...prior.sourceClaimIds, ...candidate.sourceClaimIds])];
    prior.sourceIds = [...new Set([...prior.sourceIds, ...candidate.sourceIds])];
  }
  return result;
}
export function applyRequirementOverride(requirement: CaseRequirement, command: { operation: RequirementOverride; expectedId: string; reason?: string; period?: string; subjectLinkId?: string | null; alternativeId?: string; idFactory?: () => string; reviewer?: string; reviewedAt?: string; basisRefs?: string[]; waiverAllowed?: boolean; mappingReview?: {expectedCrosswalkId:string;expectedCrosswalkVersion:string;requiredFieldGroups:string[][];optionalFieldIds:string[];typedTargets:RequirementFieldTarget[];noRequiredFields:boolean;subjectScope:string;periodPolicy:string} }): CaseRequirement {
  if (command.expectedId !== requirement.requirementId || requirement.retired) throw new Error("Requirement identity is stale or retired.");
  const needsReason = ["waive_with_reason", "declare_not_applicable", "retire", "change_period", "change_subject", "select_alternative","review_mapping"].includes(command.operation);
  if (needsReason && !command.reason?.trim()) throw new Error("A reason is required for this requirement override.");
  if (["waive_with_reason", "declare_not_applicable"].includes(command.operation) && (!command.reviewer?.trim() || !command.basisRefs?.length)) throw new Error("A reviewed override requires reviewer and evidence basis.");
  if (command.operation === "waive_with_reason" && command.waiverAllowed !== true) throw new Error("The requirement contract does not permit waiver.");
  if(command.operation==="review_mapping"){
    if(!command.mappingReview||!command.reviewer||!command.reviewedAt)throw new Error("Mapping review details are required.");
    return applyRequirementMappingReview(requirement,{...command.mappingReview,expectedId:command.expectedId,reviewer:command.reviewer,reviewedAt:command.reviewedAt,reason:command.reason??""});
  }
  const base = { ...requirement, override: command.operation, overrideReason: command.reason?.trim() ?? null,
    overrideReviewer: command.reviewer?.trim() ?? null, overrideBasisRefs: [...(command.basisRefs ?? [])] };
  if (command.operation === "change_period") {
    if (!command.period?.trim()) throw new Error("A period is required.");
    base.requiredPeriod = command.period.trim();
  } else if (command.operation === "change_subject") {
    base.subjectLinkId = command.subjectLinkId ?? null;
  } else if (command.operation === "select_alternative") {
    if (!command.alternativeId || !requirement.alternatives.some(a => a.id === command.alternativeId)) throw new Error("Alternative is not in the requirement catalog.");
    base.intakeDocumentTypeId = command.alternativeId;
  } else if (command.operation === "waive_with_reason") base.waivedByReview = true;
  else if (command.operation === "declare_not_applicable") base.notApplicableConfirmed = true;
  else if (command.operation === "reopen") { base.waivedByReview = false; base.notApplicableConfirmed = false; }
  else if (command.operation === "retire") base.retired = true;
  else if (command.operation === "add_manual") base.overrideReason = command.reason?.trim() ?? "Manually added";
  // Requirement ID is intentionally stable across period/subject overrides. A true split
  // must be represented as an explicit separate command that creates child requirements.
  base.originKey = requirementOriginKey({ intakeDocumentTypeId: base.intakeDocumentTypeId, subjectLinkId: base.subjectLinkId, scopeKey: base.scopeKey, requiredPeriod: base.requiredPeriod, purposeCode: base.purposeCode, requiredFieldGroups: base.requiredFieldGroups });
  return base;
}
