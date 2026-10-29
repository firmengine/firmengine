import type { CaseRequirement, RequirementStaffDisposition } from "./case-requirements.ts";
import type { SubjectLink } from "./party-identity.ts";

export type MatchState = "proposed" | "accepted" | "rejected" | "unlinked" | "stale";
export type EngineFulfillment = "missing" | "partial" | "complete" | "conflict" | "mapping_required" | "stale";
export type StaffDisposition = "unreviewed" | "confirmed" | "rejected" | "waived" | "stale";
export type RequirementStatus = "retired" | "conflict" | "mapping_required" | "stale" | "legal_review" | "qualification_needed" | "not_applicable_confirmed" | "waived_by_review" | "missing" | "partial" | "eligible_for_confirmation" | "satisfied";
export interface DocumentMatch {
  matchId: string; requirementId: string; subjectLinkId: string; documentId: string; pageIds: string[];
  coveredPeriod: { start: string; end: string } | null; sourceDocumentHash: string; state: MatchState; version: number;
  reason: string; staffReviewer: string | null; dispositionFingerprint: string | null;
}
export interface ReceptionPage {
  documentId: string; page: number; role: string; status: string; imageReady: boolean;
}
export interface ReceptionFieldIssue {
  documentId: string; page: number; fieldId: string; required: boolean;
  state: "unreadable" | "conflict" | "masked" | "missing" | "unknown" | "readable";
  quote?: string | null; bbox?: readonly number[] | null; message?: string;
}
export interface DocumentReceptionInput {
  document: { id: string; status: "active" | "deleted"; originalReady: boolean; pagesReady: boolean };
  pages: readonly ReceptionPage[];
  requiredPages: readonly number[];
  fieldIssues?: readonly ReceptionFieldIssue[];
  sourceRevision: string | number;
  readNotRequired?: { policyVerified: boolean; reason: string };
}
export interface DocumentReceptionView {
  kind: "read_only_derived_projection_not_persisted_enum";
  primaryStatus: "withdrawn" | "upload_pending" | "attention_required" | "processing" | "queued" | "read_complete" | "not_required";
  uploadState: "withdrawn" | "upload_pending" | "ready";
  processingCountsByStatus: Record<string, number>;
  pageCountsByRole: Record<string, number>;
  readingIssues: { code: string; severity: "required" | "warning"; documentId: string; page: number | null; fieldId?: string; quote?: string | null; bbox?: readonly number[] | null; message?: string }[];
  requiredPageCoverage: { required: number[]; completed: number[]; missing: number[]; incomplete: number[] };
  sourceRevision: string | number;
}
/** Read-only reception aggregation. Unknown states never count as completed. */
export function aggregateDocumentReception(input: DocumentReceptionInput): DocumentReceptionView {
  const processingCountsByStatus: Record<string,number> = {}, pageCountsByRole: Record<string,number> = {}, readingIssues: DocumentReceptionView["readingIssues"] = [];
  for (const page of input.pages) {
    processingCountsByStatus[page.status] = (processingCountsByStatus[page.status] ?? 0) + 1;
    const role = ["evidence","filed_form","administrative","unknown"].includes(page.role) ? page.role : "unknown";
    pageCountsByRole[role] = (pageCountsByRole[role] ?? 0) + 1;
    if (role === "unknown") readingIssues.push({code:"page_role_unknown",severity:"required",documentId:page.documentId,page:page.page,message:`Unrecognized page role: ${page.role}`});
  }
  const byPage = new Map(input.pages.map(page => [page.page,page]));
  const required = [...new Set(input.requiredPages)].sort((a,b)=>a-b), completed:number[] = [], missing:number[] = [], incomplete:number[] = [];
  for (const pageNo of required) {
    const page = byPage.get(pageNo);
    if (!page) { missing.push(pageNo); readingIssues.push({code:"required_page_job_missing",severity:"required",documentId:input.document.id,page:pageNo,message:"Required evidence page has no processing record."}); continue; }
    if (page.role !== "evidence") readingIssues.push({code:"required_page_role_unconfirmed",severity:"required",documentId:page.documentId,page:pageNo,message:`Required evidence page role is ${page.role || "unknown"}.`});
    if (!page.imageReady) readingIssues.push({code:"required_page_image_missing",severity:"required",documentId:page.documentId,page:pageNo,message:"Required evidence page image is missing."});
    if (page.status === "completed" && page.role === "evidence" && page.imageReady) completed.push(pageNo);
    else {
      incomplete.push(pageNo);
      if (!["pending","awaiting_upload","processing","completed","review_required","failed"].includes(page.status)) readingIssues.push({code:"unknown_job_status",severity:"required",documentId:page.documentId,page:pageNo,message:`Unrecognized page job status: ${page.status}`});
      else if (page.status === "failed" || page.status === "review_required") readingIssues.push({code:`page_${page.status}`,severity:"required",documentId:page.documentId,page:pageNo});
    }
  }
  for (const issue of input.fieldIssues ?? []) {
    if (issue.state === "readable") continue;
    readingIssues.push({code:`field_${issue.state}`,severity:issue.required?"required":"warning",documentId:issue.documentId,page:issue.page,fieldId:issue.fieldId,quote:issue.quote,bbox:issue.bbox,message:issue.message});
  }
  const uploadState = input.document.status === "deleted" ? "withdrawn" : !input.document.originalReady || !input.document.pagesReady ? "upload_pending" : "ready";
  const hasRequiredIssue = readingIssues.some(issue => issue.severity === "required");
  const hasUnknownStatus = input.pages.some(page => !["pending","awaiting_upload","processing","completed","failed","review_required"].includes(page.status));
  const hasFailedOrReview = input.pages.some(page => page.status === "failed" || page.status === "review_required");
  const hasProcessing = input.pages.some(page => page.status === "processing");
  const hasQueued = input.pages.some(page => page.status === "pending" || page.status === "awaiting_upload");
  const policyNotRequired = input.readNotRequired?.policyVerified === true && !!input.readNotRequired.reason.trim();
  let primaryStatus: DocumentReceptionView["primaryStatus"];
  if (uploadState === "withdrawn") primaryStatus = "withdrawn";
  else if (uploadState === "upload_pending") primaryStatus = "upload_pending";
  else if (hasRequiredIssue || hasUnknownStatus || hasFailedOrReview) primaryStatus = "attention_required";
  else if (hasProcessing) primaryStatus = "processing";
  else if (hasQueued) primaryStatus = "queued";
  else if (policyNotRequired && !input.pages.length) primaryStatus = "not_required";
  else if (required.length && completed.length === required.length && !(input.fieldIssues ?? []).some(issue => issue.required && issue.state !== "readable")) primaryStatus = "read_complete";
  else if (!required.length && policyNotRequired) primaryStatus = "not_required";
  else primaryStatus = "attention_required";
  return {kind:"read_only_derived_projection_not_persisted_enum",primaryStatus,uploadState,processingCountsByStatus,pageCountsByRole,readingIssues,requiredPageCoverage:{required,completed,missing,incomplete},sourceRevision:input.sourceRevision};
}
export interface MatchContext { requirement: CaseRequirement; subjectLink: SubjectLink | undefined; document: { id: string; status: "active" | "deleted"; sha256: string } | undefined; expectedMatchVersion?: number }
export interface FulfillmentDependencyInput {
  requirement: CaseRequirement; matches: readonly DocumentMatch[]; subjectLink?: SubjectLink;
  currentDocumentHashes: Readonly<Record<string,string>>; requiredMonths?: number | null;
  sourceFactIds?: readonly string[];
  /** Opaque dependency material derived from current fact observations and values. */
  sourceFactFingerprints?: readonly string[];
  requiredFieldGroupsMet?: boolean; applicability: "confirmed" | "unknown" | "not_applicable";
  staffConfirmationRequired: boolean; legalReview: boolean;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function fulfillmentDependencyFingerprint(input: FulfillmentDependencyInput): Promise<string> {
  const documentIds=[...new Set(input.matches.filter(m=>m.requirementId===input.requirement.requirementId).map(m=>m.documentId))].sort();
  const matches=input.matches.filter(m=>m.requirementId===input.requirement.requirementId).map(m=>({matchId:m.matchId,state:m.state,version:m.version,subjectLinkId:m.subjectLinkId,documentId:m.documentId,pageIds:[...m.pageIds].sort(),coveredPeriod:m.coveredPeriod,sourceDocumentHash:m.sourceDocumentHash})).sort((a,b)=>a.matchId.localeCompare(b.matchId));
  const payload={schema:"requirement-review-dependencies/1",requirement:{id:input.requirement.requirementId,originKey:input.requirement.originKey,documentTypeId:input.requirement.intakeDocumentTypeId,obligation:input.requirement.requirement,alternativePolicy:input.requirement.alternativePolicy,alternatives:input.requirement.alternatives,selectedAlternativeId:input.requirement.selectedAlternativeId??null,sourceEvidenceFields:input.requirement.sourceEvidenceFields??[],substitutionReview:input.requirement.substitutionReview??null,intakeStatus:input.requirement.intakeStatus,period:input.requirement.requiredPeriod,groups:input.requirement.requiredFieldGroups,optionalFieldIds:input.requirement.optionalFieldIds,typedTargets:input.requirement.typedTargets,crosswalkId:input.requirement.crosswalkId,familyId:input.requirement.familyId,crosswalkVersion:input.requirement.crosswalkVersion,availableFieldIds:input.requirement.availableFieldIds,crosswalkReview:input.requirement.crosswalkReview??null,noRequiredFieldsApproved:input.requirement.noRequiredFieldsApproved,mappingRequired:input.requirement.mappingRequired,matchedRuleIds:input.requirement.matchedRuleIds,sourceClaimIds:input.requirement.sourceClaimIds,sourceIds:input.requirement.sourceIds},matches,documentHashes:Object.fromEntries(documentIds.map(id=>[id,input.currentDocumentHashes[id]??null])),sourceFactIds:[...(input.sourceFactIds??[])].sort(),sourceFactFingerprints:[...(input.sourceFactFingerprints??[])].sort(),subject:input.subjectLink?{linkId:input.subjectLink.linkId,status:input.subjectLink.status,version:input.subjectLink.version,typedEntityId:input.subjectLink.typedEntityId}:null,applicability:input.applicability,requiredMonths:input.requiredMonths??periodMonthCount(input.requirement.requiredPeriod),requiredFieldGroupsMet:input.requiredFieldGroupsMet??null,staffConfirmationRequired:input.staffConfirmationRequired,legalReview:input.legalReview};
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical(payload)));
  return `requirement-review-dependencies/1:${[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}`;
}
export async function createRequirementStaffDisposition(input: FulfillmentDependencyInput & {decision:"confirmed"|"rejected";expectedFingerprint:string;reviewer:string;role:"caseworker_review"|"lawyer_review";reason:string;basisRefs:readonly string[]}): Promise<RequirementStaffDisposition> {
  const current=await fulfillmentDependencyFingerprint(input);
  if(current!==input.expectedFingerprint)throw new Error("Requirement review is stale; reload current dependencies.");
  if(!input.reviewer.trim()||!input.reason.trim()||!input.basisRefs.length)throw new Error("Staff disposition requires reviewer, role, reason, and basis.");
  return {state:input.decision,dependencyFingerprint:current,reviewer:input.reviewer,role:input.role,reason:input.reason,basisRefs:[...new Set(input.basisRefs)]};
}
export function transitionDocumentMatch(input: { operation: "suggest" | "accept" | "reject" | "unlink" | "relink"; match?: DocumentMatch; context: MatchContext; proposal?: Omit<DocumentMatch,"state"|"version"|"staffReviewer"|"dispositionFingerprint">; reviewer?: string }): DocumentMatch {
  const { operation, context } = input;
  const current = input.match;
  if (operation === "suggest") {
    if (!input.proposal) throw new Error("A match proposal is required.");
    if (input.proposal.requirementId !== context.requirement.requirementId || input.proposal.documentId !== context.document?.id) throw new Error("Match ownership mismatch.");
    return { ...input.proposal, pageIds: [...new Set(input.proposal.pageIds)], state: "proposed", version: 1, staffReviewer: null, dispositionFingerprint: null };
  }
  if (!current || !input.reviewer?.trim() || current.version !== context.expectedMatchVersion) throw new Error("Human decision requires a current match version and reviewer.");
  if (current.requirementId !== context.requirement.requirementId) throw new Error("Match requirement ownership mismatch.");
  if (operation === "accept") {
    if (current.state !== "proposed" || context.subjectLink?.linkId !== current.subjectLinkId || context.subjectLink.status !== "confirmed") throw new Error("Accept requires a proposed match and confirmed subject link.");
    if (!context.document || context.document.id !== current.documentId || context.document.status !== "active" || context.document.sha256 !== current.sourceDocumentHash) throw new Error("Document is deleted, missing, or changed.");
    return { ...current, state: "accepted", version: current.version + 1, staffReviewer: input.reviewer, dispositionFingerprint: matchFingerprint(current) };
  }
  if (operation === "reject" && current.state === "proposed") return { ...current, state: "rejected", version: current.version + 1, staffReviewer: input.reviewer };
  if (operation === "unlink" && current.state === "accepted") return { ...current, state: "unlinked", version: current.version + 1, staffReviewer: input.reviewer };
  if (operation === "relink") {
    if (!input.proposal) throw new Error("Relink requires a new proposal version.");
    return { ...input.proposal, matchId: current.matchId, state: "proposed", version: current.version + 1, staffReviewer: null, dispositionFingerprint: null };
  }
  throw new Error(`Invalid match transition: ${current.state} -> ${operation}`);
}
export function matchFingerprint(match: DocumentMatch): string { return JSON.stringify([match.requirementId,match.subjectLinkId,match.documentId,match.sourceDocumentHash,[...match.pageIds].sort(),match.coveredPeriod]); }
export async function deriveRequirementStatus(input: FulfillmentDependencyInput & { staffDispositionReceipt?: RequirementStaffDisposition }): Promise<{ engineFulfillment: EngineFulfillment; staffDisposition: StaffDisposition; requirementStatus: RequirementStatus }> {
  const { requirement } = input;
  if (requirement.retired) return { engineFulfillment: "missing", staffDisposition: "unreviewed", requirementStatus: "retired" };
  if (requirement.waivedByReview) return { engineFulfillment: "missing", staffDisposition: "waived", requirementStatus: "waived_by_review" };
  if (requirement.notApplicableConfirmed) return { engineFulfillment: "missing", staffDisposition: "confirmed", requirementStatus: "not_applicable_confirmed" };
  const allRelevant = input.matches.filter(m => m.requirementId === requirement.requirementId);
  const relevant = allRelevant.filter(m => ["accepted","proposed"].includes(m.state));
  const hasStale = allRelevant.some(m => m.state === "stale") || relevant.some(m => m.state === "accepted" && input.currentDocumentHashes[m.documentId] !== m.sourceDocumentHash);
  const accepted = relevant.filter(m => m.state === "accepted" && input.currentDocumentHashes[m.documentId] === m.sourceDocumentHash);
  const mapping = requirement.mappingRequired || !requirement.requiredFieldGroups.length&&!requirement.noRequiredFieldsApproved || input.applicability === "unknown" || !input.subjectLink || input.subjectLink.status !== "confirmed";
  const requestedMonths=input.requiredMonths??periodMonthCount(requirement.requiredPeriod);
  const requiredMonths=requestedMonths===null||requestedMonths===undefined?null:Number.isSafeInteger(requestedMonths)&&requestedMonths>=1&&requestedMonths<=120?requestedMonths:121;
  const months = new Set(accepted.flatMap(m => m.coveredPeriod ? coveredMonths(m.coveredPeriod.start,m.coveredPeriod.end) : [])).size;
  const partialPeriod = requiredMonths != null && months < requiredMonths;
  const invalidCoverage=accepted.some(m=>m.coveredPeriod&&!validCoverageRange(m.coveredPeriod.start,m.coveredPeriod.end));
  let engineFulfillment: EngineFulfillment = hasStale ? "stale" : mapping ? "mapping_required" : invalidCoverage || accepted.length > 1 && duplicatePeriods(accepted) ? "conflict" : accepted.length === 0 ? "missing" : partialPeriod ? "partial" : input.requiredFieldGroupsMet === false ? "partial" : "complete";
  if (input.applicability === "not_applicable") engineFulfillment = "missing";
  const receipt=input.staffDispositionReceipt??requirement.staffDisposition;
  const currentReviewFingerprint=await fulfillmentDependencyFingerprint(input);
  const staffDisposition: StaffDisposition = requirement.waivedByReview ? "waived" : hasStale || (receipt && receipt.dependencyFingerprint!==currentReviewFingerprint) ? "stale" : receipt?.state ?? "unreviewed";
  let requirementStatus: RequirementStatus = engineFulfillment === "complete" ? "eligible_for_confirmation" : engineFulfillment;
  if (staffDisposition === "stale") requirementStatus = "stale";
  else if (input.legalReview) requirementStatus = "legal_review";
  else if (input.applicability === "unknown") requirementStatus = "qualification_needed";
  else if (engineFulfillment === "complete") requirementStatus = !input.staffConfirmationRequired || staffDisposition === "confirmed" ? "satisfied" : staffDisposition === "rejected" ? "legal_review" : "eligible_for_confirmation";
  return { engineFulfillment, staffDisposition, requirementStatus };
}
function periodMonthCount(value: string): number | null {
  const dateRange=/\b(\d{4}-(?:0[1-9]|1[0-2]))\D+(\d{4}-(?:0[1-9]|1[0-2]))\b/.exec(value);
  if(dateRange){const start=dateRange[1],end=dateRange[2];if(!validCoverageRange(start,end))return 121;return coveredMonths(start,end).length;}
  const match=/(?:^|\D)(\d{1,4})\s*(?:months?|개월)/i.exec(value);
  if(!match)return null;
  const months=Number(match[1]);
  // Cap automatic ranges. A wider requested period remains incomplete until a
  // narrower period is reviewed; it can never cause an unbounded allocation.
  return months>=1&&months<=120?months:121;
}
function validCoverageRange(start:string,end:string):boolean {
  const pattern=/^(\d{4})-(0[1-9]|1[0-2])(?:-(\d{2}))?$/;
  const a=pattern.exec(start),b=pattern.exec(end);if(!a||!b)return false;
  const validDay=(year:number,month:number,day:string|undefined)=>!day||Number(day)>=1&&Number(day)<=new Date(Date.UTC(year,month,0)).getUTCDate();
  if(!validDay(Number(a[1]),Number(a[2]),a[3])||!validDay(Number(b[1]),Number(b[2]),b[3]))return false;
  const from=Number(a[1])*12+Number(a[2]),to=Number(b[1])*12+Number(b[2]);
  return Number(a[1])>0&&Number(b[1])>0&&to>=from&&to-from<120;
}
function coveredMonths(start: string,end: string): string[] {
  if(!validCoverageRange(start,end))return [];
  const a = /^\d{4}-(?:0[1-9]|1[0-2])/.exec(start)?.[0], b = /^\d{4}-(?:0[1-9]|1[0-2])/.exec(end)?.[0];
  if (!a || !b) return [];
  const [ay,am] = a.split("-").map(Number), [by,bm] = b.split("-").map(Number);
  const from = ay * 12 + am - 1, to = by * 12 + bm - 1;
  return Array.from({length: to - from + 1}, (_,i) => String(from+i));
}
function duplicatePeriods(matches: DocumentMatch[]): boolean { return matches.some((a,i) => matches.slice(i+1).some(b => a.coveredPeriod && b.coveredPeriod && a.coveredPeriod.start === b.coveredPeriod.start && a.coveredPeriod.end === b.coveredPeriod.end)); }
