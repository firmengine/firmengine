import type { IntakeCatalog, IntakeRun } from "./intake-types.ts";
import { documentFieldContract, FIELD_CATALOG_RELEASE, FIELD_CATALOG_RELEASE_SHA256 } from "./document-agent-registry.ts";
import { isValidRequirementTarget, makeCaseRequirement, mergeRequirements, type CaseRequirement, type RequirementFieldTarget } from "./case-requirements.ts";
import { candidateSubjectLinks, type SubjectLink } from "./party-identity.ts";
import type { DocumentMatch } from "./document-fulfillment.ts";

export const INTAKE_CROSSWALK_SCHEMA = "intake-document-crosswalk/1" as const;
export interface IntakeCrosswalkEntry {
  crosswalkId: string; intakeDocumentTypeId: string; workflowDocumentType: string; familyId: string | null;
  requiredFieldGroups: string[][]; availableFieldIds: string[]; optionalFieldIds: string[]; typedTargets: RequirementFieldTarget[]; subjectScope: string;
  issuerScope: string; periodPolicy: string; coveragePolicy: "unreviewed" | "required_groups" | "no_required_fields"; version: string; sourceIds: string[];
  reviewState: "review_required" | "approved"; mappingState: "mapped" | "mapping_required";
}
export interface IntakeCaseWorkflow { schema: "case-workflow/1"; version: number; requirements: CaseRequirement[]; subjectLinks: SubjectLink[]; documentMatches: DocumentMatch[] }
export interface CrosswalkApproval { intakeDocumentTypeId: string; workflowDocumentType: string; requiredFieldGroups: string[][]; optionalFieldIds?: string[]; typedTargets: { fieldId: string; targetPath: string }[]; subjectScope: string; periodPolicy: string; noRequiredFields?: boolean; reason: string; reviewer: string }
export function buildIntakeCrosswalk(catalog: IntakeCatalog, approvals: readonly CrosswalkApproval[] = []): IntakeCrosswalkEntry[] {
  return catalog.documents.flatMap(doc => doc.workflowDocumentTypes.map(workflowDocumentType => {
    const family = documentFieldContract(workflowDocumentType);
    const approval = approvals.find(a => a.intakeDocumentTypeId === doc.id && a.workflowDocumentType === workflowDocumentType);
    const fieldIds = new Set(family?.fields.map(f => f.global_field_id) ?? []);
    const groups = approval?.requiredFieldGroups ?? [];
    const targetIds = new Set(approval?.typedTargets.map(target=>target.fieldId) ?? []);
    const requiredFieldIds = new Set(groups.flat());
    const validApproval = !!approval && !!approval.reviewer.trim() && !!approval.reason.trim() &&
      (!!groups.length || approval.noRequiredFields === true) && groups.every(g => g.length > 0 && g.every(id => fieldIds.has(id))) &&
      (approval.optionalFieldIds ?? []).every(id => fieldIds.has(id)) && approval.typedTargets.every(target=>fieldIds.has(target.fieldId)&&isValidRequirementTarget(target.targetPath)) &&
      [...requiredFieldIds].every(id=>targetIds.has(id)) && !!family;
    const coveragePolicy = !validApproval ? "unreviewed" : approval!.noRequiredFields ? "no_required_fields" : "required_groups";
    return { crosswalkId: `${INTAKE_CROSSWALK_SCHEMA}:${doc.id}:${workflowDocumentType}`, intakeDocumentTypeId: doc.id,
      workflowDocumentType, familyId: family?.family_id ?? null, requiredFieldGroups: validApproval ? groups.map(g=>[...g]) : [], availableFieldIds:family?.fields.map(f=>f.global_field_id)??[], optionalFieldIds: validApproval ? approval!.optionalFieldIds ?? family?.fields.map(f => f.global_field_id) ?? [] : family?.fields.map(f => f.global_field_id) ?? [],
      typedTargets: validApproval ? approval!.typedTargets.map(target=>({...target})) : [], subjectScope: validApproval ? approval!.subjectScope : "candidate", issuerScope: doc.issuer, periodPolicy: validApproval ? approval!.periodPolicy : "review_required", coveragePolicy,
      version: `${INTAKE_CROSSWALK_SCHEMA}:${FIELD_CATALOG_RELEASE}:${FIELD_CATALOG_RELEASE_SHA256}`, sourceIds: [...doc.sourceIds], reviewState: validApproval ? "approved" : "review_required",
      mappingState: validApproval ? "mapped" : "mapping_required" };
  }));
}
export function adoptIntakeRun(input: { workflow: IntakeCaseWorkflow; run: IntakeRun; crosswalk: readonly IntakeCrosswalkEntry[]; idFactory: () => string }): IntakeCaseWorkflow {
  const generated = candidateSubjectLinks(input.run, input.idFactory);
  const links = generated.map(link => {
    const prior = input.workflow.subjectLinks.filter(old => old.intakeSubjectId === link.intakeSubjectId && old.subjectScope === link.subjectScope && old.scopeKey === link.scopeKey);
    // Reuse an exact classifier-local lineage across reruns. Prefer confirmed
    // linkage; names or similar masked values are never considered here.
    return prior.find(old => old.status === "confirmed") ?? prior.find(old => old.status === "candidate") ?? prior.find(old => old.status === "rejected") ?? link;
  });
  const linkBySubject = new Map(links.map(link => [link.intakeSubjectId, link]));
  const requirements = input.run.result.requirements.map(source => {
    const xw = input.crosswalk.find(x => x.intakeDocumentTypeId === source.documentTypeId);
    const subjectLink = linkBySubject.get(source.subjectId);
    return makeCaseRequirement({ source, intakeRunId: input.run.id, subjectLinkId: subjectLink?.linkId ?? null,
      scopeKey: subjectLink?.scopeKey ?? `intake-subject:${source.subjectId}`, fieldGroups: xw?.requiredFieldGroups, mappingRequired: xw?.mappingState !== "mapped", crosswalk:xw, availableFieldIds:xw?.availableFieldIds, idFactory: input.idFactory });
  });
  return { schema: "case-workflow/1", version: input.workflow.version + 1,
    requirements: mergeRequirements(input.workflow.requirements, requirements),
    subjectLinks: [...input.workflow.subjectLinks, ...links.filter(link => !input.workflow.subjectLinks.some(old => old.linkId === link.linkId))], documentMatches: [...input.workflow.documentMatches] };
}
