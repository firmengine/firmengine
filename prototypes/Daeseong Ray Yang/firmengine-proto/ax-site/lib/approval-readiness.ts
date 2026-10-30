/**
 * P0-09A: read-only pre-approval evidence / calculation / legal review workbench.
 * Reuses existing engines. Never grants recognition, edits evidence or predicts court approval.
 */
import type { CaseData, Fact } from "./domain.ts";
import type { Assessment } from "./assessment.ts";

export const APPROVAL_READINESS_VERSION = "pre-approval-readiness/1" as const;
export type ApprovalWorkKind = "consultation" | "document" | "source" | "calculation" | "legal" | "court_order";
export type ApprovalPriority = "urgent" | "high" | "normal";
export interface ApprovalTask {
  id: string;
  kind: ApprovalWorkKind;
  priority: ApprovalPriority;
  title: string;
  reason: string;
  nextAction: string;
  documentTypeId?: string;
  requiredPeriod?: string;
  relatedFactIds: string[];
  relatedCalculationTraceIds: string[];
  relatedRuleIds: string[];
  origin: "internal_candidate" | "recorded_court_event";
  isOfficialCourtCorrectionOrder: boolean;
}
export interface DocumentMonitorInput {
  consultationChecklistMaterialized: boolean;
  consultationStatus: string;
  workflowAdopted: boolean;
  workflowProjectionStatus: string;
  unclassifiedPageJobs: number;
  requirements: readonly {
    requirementId: string; documentTypeId: string; documentName: string;
    period: string; requirement: string; status: string; fieldPlanStatus: string;
    observed: { stage: string; candidatePageCount: number; committedOcrPageCount: number };
  }[];
  workflowRequests: readonly {
    requirementId: string; documentTypeId: string; requiredPeriod: string;
    activeRequest: boolean; requirementStatus: string; substitutionStatus: string;
    statusSource: string; sourceProofFields: readonly string[];
  }[];
}
export interface LegalReviewInput {
  runId: string | null; complete: boolean; headStale: boolean;
  caseRevision: number | null; currentDataVersion: number | null;
  dataVersion: number | null; calculationRunId: string | null;
  expectedCheckIds: string[];
  checks: readonly {
    id: string; status: string; reason: string;
    factIds: readonly string[]; ruleIds: readonly string[];
    missingDocuments: readonly string[]; nextAction: string;
  }[];
}
export interface ApprovalSourceHead {
  caseRevision: number;
  sourceDataVersion: number | null;
  calculationRunId: string | null;
  calculationCurrent: boolean;
  referenceSha256: string | null;
}
export interface ApprovalReadinessInput {
  data: CaseData;
  facts: readonly Fact[];
  assessment: Assessment;
  sourceHead: ApprovalSourceHead;
  monitor: DocumentMonitorInput | null;
  legalReview: LegalReviewInput | null;
  expectedRiskIds: readonly string[];
  riskTitles?: Readonly<Record<string, string>>;
}
const RESOLVED = new Set(["satisfied", "not_applicable_confirmed", "waived_by_review", "retired"]);
// Discontinuance may occur BEFORE approval. Never misclassify it as post-approval.
const AFTER_APPROVAL = new Set(["approved", "discharged"]);
const unique = (xs: readonly string[]) => [...new Set(xs.filter(Boolean))];
const priorityWeight = { urgent: 0, high: 1, normal: 2 } as const;

/** Source data and all source values are immutable. An incomplete monitor or stale receipt fails closed. */
export function buildPreApprovalReadiness(input: ApprovalReadinessInput) {
  const { data, facts, assessment, sourceHead, monitor, legalReview } = input;
  const tasks: ApprovalTask[] = [], seen = new Set<string>();
  const add = (task: ApprovalTask) => {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    tasks.push({ ...task, relatedFactIds: unique(task.relatedFactIds),
      relatedCalculationTraceIds: unique(task.relatedCalculationTraceIds), relatedRuleIds: unique(task.relatedRuleIds) });
  };
  const candidate = (task: Omit<ApprovalTask, "origin" | "isOfficialCourtCorrectionOrder">) =>
    add({ ...task, origin: "internal_candidate", isOfficialCourtCorrectionOrder: false });
  const procedural = data.workflowState?.procedureEvents ?? [];
  const outOfScope = procedural.some(row => AFTER_APPROVAL.has(row.state));
  const currentRevision = data.context.revision;
  const calcCurrent = sourceHead.caseRevision === currentRevision && sourceHead.sourceDataVersion !== null &&
    sourceHead.calculationCurrent && !!sourceHead.calculationRunId;
  const legalCurrent = calcCurrent && !!legalReview?.runId && legalReview.complete && !legalReview.headStale &&
    legalReview.caseRevision === currentRevision && legalReview.currentDataVersion === sourceHead.sourceDataVersion &&
    legalReview.dataVersion === sourceHead.sourceDataVersion && legalReview.calculationRunId === sourceHead.calculationRunId &&
    legalReview.expectedCheckIds.length === input.expectedRiskIds.length &&
    legalReview.checks.length === input.expectedRiskIds.length &&
    new Set(legalReview.expectedCheckIds).size === input.expectedRiskIds.length &&
    input.expectedRiskIds.every(id => legalReview.expectedCheckIds.includes(id)) &&
    new Set(legalReview.checks.map(c => c.id)).size === input.expectedRiskIds.length &&
    input.expectedRiskIds.every(id => legalReview.checks.some(check => check.id === id));
  const factsById = new Map(facts.map(fact => [fact.id, fact]));
  const featureInventory = facts.map(fact => ({
    id: fact.id, canonicalFieldId: fact.canonicalFieldId ?? fact.fieldObservation?.canonicalFieldId ?? null,
    key: fact.key, subjectId: fact.subjectId, periodStart: fact.periodStart ?? null,
    periodEnd: fact.periodEnd ?? null, asOf: fact.asOf ?? null,
    state: fact.state, recognition: fact.recognition,
    amountWon: fact.numeric?.normalizationStatus === "exact" ? fact.numeric.amountWon : null,
    value: typeof fact.value === "number" || typeof fact.value === "boolean" ? fact.value : null,
    sourcePages: fact.refs.map(ref => ({ documentId: ref.documentId, page: ref.page, sourceHash: ref.sourceHash ?? null })),
    hasStructuredSource: !!fact.structuredRefs?.length,
  }));
  const traces = assessment.calculation.traces.map(trace => ({
    id: trace.id, title: trace.title, formula: trace.formula, status: trace.status,
    resultWon: trace.resultWon, reasons: [...trace.reasons],
    inputs: trace.inputs.map(item => ({ label: item.label, value: item.value, factIds: [...item.factIds],
      factStates: item.factIds.map(id => ({ id, state: factsById.get(id)?.state ?? "missing_current_fact",
        recognition: factsById.get(id)?.recognition ?? "missing_current_fact" })) })),
  }));
  const courtCorrections = procedural.filter(row => row.state === "correction_requested")
    .map(row => ({ eventId: row.id, occurredAt: row.occurredAt, courtReference: row.courtReference,
      sourceDocumentIds: [...row.sourceDocumentIds], reason: row.reason }));

  // Court correction event is official only when it was recorded with the actual court source;
  // model-generated correction CANDIDATES are always a separate kind.
  if (!outOfScope) {
    if (!monitor || monitor.workflowProjectionStatus !== "current") {
      candidate({ id: "monitor:unavailable", kind: "source", priority: "urgent", title: "활성 서류요구 상태 재확인",
        reason: "상담/접수/갈음서류의 현재 자료·법원 기준 검증 조회가 불가능합니다.",
        nextAction: "현재 상담 분석과 접수 서류의 대상·기간·갈음·OCR 상태를 다시 대조하세요.",
        relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
    } else {
      if (!monitor.consultationChecklistMaterialized) candidate({ id: "consultation:pending", kind: "consultation", priority: "urgent",
        title: "상담 기반 요구서류 확정", reason: "현재 상담 분석 결과가 활성화되어 있지 않습니다 (" + monitor.consultationStatus + ").",
        nextAction: "상담 이력의 현재 판본을 분석하고 서류요구사항을 확인하세요.",
        relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
      if (!monitor.workflowAdopted) candidate({ id: "consultation:adoption", kind: "consultation", priority: "high",
        title: "상담 서류요구를 사건 업무에 연결", reason: "상담 목록의 문서 후보와 사건별 실제 충족 판단은 다릅니다.",
        nextAction: "상담 분석의 서류별 대상·기간을 확인한 뒤 사건 업무로 명시적으로 연결하세요.",
        relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
      if (monitor.workflowAdopted) {
        for (const row of monitor.workflowRequests) {
          if (RESOLVED.has(row.requirementStatus)) continue;
          candidate({ id: "workflow:" + row.requirementId, kind: "document",
            priority: row.requirementStatus === "conflict" || row.requirementStatus === "stale" ? "urgent" : "high",
            title: "사건 서류요구·원문 충족 재검토: " + row.documentTypeId,
            reason: "현재 상태 " + row.requirementStatus + "; 갈음 " + row.substitutionStatus +
              "; 확인 경로 " + row.statusSource + ". 서류 종류 후보가 실제 법적 충족을 증명하지 않습니다.",
            nextAction: "대상·기간·원문 필드(" + row.sourceProofFields.join(", ") + ")·직원 확인·갈음 근거를 검증하세요.",
            documentTypeId: row.documentTypeId, requiredPeriod: row.requiredPeriod,
            relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
        }
      } else {
        for (const row of monitor.requirements) {
          if (row.requirement === "recommended") continue;
          candidate({ id: "intake:" + row.requirementId, kind: "document", priority: "high",
            title: "상담 요청서류: " + row.documentName,
            reason: "요청상태 " + row.status + ", 현재 관측 " + row.observed.stage +
              ", OCR 완료 후보 " + row.observed.committedOcrPageCount + "쪽; 후보 관측만으로 충족 아님.",
            nextAction: row.period + " 기간의 " + row.documentName + "을/를 대상자와 연결하고 원문 필드를 확인하세요.",
            documentTypeId: row.documentTypeId, requiredPeriod: row.period,
            relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
        }
      }
      if (monitor.unclassifiedPageJobs > 0) candidate({ id: "source:unclassified-pages", kind: "source", priority: "high",
        title: "미분류 제출 페이지 점검", reason: "문서유형 미분류 작업 " + monitor.unclassifiedPageJobs + "건",
        nextAction: "페이지별 원문 역할·문서종류·귀속 사건을 확인하고 추출/매핑을 재검증하세요.",
        relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
    }
    if (!calcCurrent) candidate({ id: "calculation:head", kind: "calculation", priority: "urgent", title: "최신 사건 계산 결과 확정",
      reason: "계산 실행 ID·원본 버전·사건 revision의 일치가 확인되지 않았습니다.",
      nextAction: "현행 원본과 기준정보 판본으로 기존 계산 엔진을 재실행하고 결과 원장을 보존하세요.",
      relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
    for (const trace of traces) {
      if (trace.status === "calculated") continue;
      candidate({ id: "trace:" + trace.id, kind: "calculation", priority: trace.status === "blocked" ? "urgent" : "high",
        title: "계산 " + (trace.status === "blocked" ? "차단" : "조건부") + ": " + trace.title,
        reason: trace.reasons.join("; ") || "미확정/미인정 입력이 있습니다.",
        nextAction: "계산식 " + trace.formula + "의 입력 중 " + trace.inputs.filter(x => x.value === null).map(x => x.label).join(", ") +
          " 항목과 실제 원문·기간·법률상 인정 여부를 확인하세요.",
        relatedFactIds: unique(trace.inputs.flatMap(x => x.factIds)), relatedCalculationTraceIds: [trace.id], relatedRuleIds: [] });
    }
    for (const finding of assessment.findings) {
      if (finding.outcome === "pass" || finding.id.startsWith("trace_")) continue;
      candidate({ id: "finding:" + finding.id, kind: finding.category === "evidence" ? "source" : "legal",
        priority: finding.outcome === "fail" ? "urgent" : "normal",
        title: finding.title, reason: finding.detail,
        nextAction: finding.nextAction ?? "담당 변호사가 법적 요건과 근거를 검토하세요.",
        relatedFactIds: [...finding.factIds], relatedCalculationTraceIds: [], relatedRuleIds: [...finding.ruleSourceIds] });
    }
    if (!legalCurrent) candidate({ id: "legal:head", kind: "legal", priority: "urgent", title: "최신 판본의 법률 검토 완료",
      reason: "95개 위험 판단의 현재 원본/계산판본과 검토 실행 완료가 일치하지 않습니다.",
      nextAction: "현재 계산·원문·법령판본을 고정한 뒤 95개 위험 검토를 수행하고 변호사 검수로 연결하세요.",
      relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
    else {
      let lawyerReview = 0;
      for (const check of legalReview!.checks) {
        if (check.status === "legal_review") { lawyerReview++; continue; }
        if (["pass", "not_applicable"].includes(check.status)) continue;
        candidate({ id: "risk:" + check.id, kind: "legal", priority: check.status === "fail" || check.status === "conflict" ? "urgent" : "high",
          title: "법률 쟁점: " + (input.riskTitles?.[check.id] ?? check.id),
          reason: check.reason + " (" + check.status + ")",
          nextAction: (check.nextAction || "증빙·기준·계산 결과를 재확인하세요.") +
            (check.missingDocuments.length ? " / 필요한 자료: " + check.missingDocuments.join(", ") : ""),
          relatedFactIds: [...check.factIds], relatedCalculationTraceIds: [], relatedRuleIds: [...check.ruleIds] });
      }
      if (lawyerReview) candidate({ id: "legal:lawyer-review", kind: "legal", priority: "normal", title: "법률 쟁점 변호사 검토",
        reason: "법률상 인정 또는 재량 판단이 필요한 쟁점 " + lawyerReview + "건. 자동 통과 아님.",
        nextAction: "95개 법률 검토 원장 중 법률 검토 상태인 쟁점을 담당 변호사가 개별 확인하세요.",
        relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [] });
    }
    for (const event of courtCorrections) {
      add({ id: "court:" + event.eventId, kind: "court_order", priority: "urgent",
        title: "실제 법원 보정명령 후속 확인", reason: event.reason,
        nextAction: "원본 법원 문서·요구사항·기한·제출 결과를 확인하세요.",
        relatedFactIds: [], relatedCalculationTraceIds: [], relatedRuleIds: [],
        origin: "recorded_court_event", isOfficialCourtCorrectionOrder: true });
    }
  }
  tasks.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || a.id.localeCompare(b.id));
  const counts = { urgent: tasks.filter(x => x.priority === "urgent").length,
    high: tasks.filter(x => x.priority === "high").length, normal: tasks.filter(x => x.priority === "normal").length };
  const currentChecks = legalCurrent ? legalReview!.checks : [];
  const legalStatusCounts = Object.fromEntries(["pass", "fail", "missing", "conflict", "not_applicable", "legal_review"]
    .map(status => [status, currentChecks.filter(x => x.status === status).length]));
  const activeDocs = data.documents.filter(d => d.status === "active");
  const status = outOfScope ? "out_of_scope" :
    tasks.some(t => t.priority === "urgent" || t.kind === "document" || t.kind === "source" || t.kind === "consultation" || t.kind === "calculation")
      ? "supplement_or_recalculation_required" : !legalCurrent || currentChecks.some(x => !["pass", "not_applicable", "legal_review"].includes(x.status))
        ? "legal_review_incomplete" : "lawyer_approval_review_pending";
  const missingInputQuestions = traces.flatMap(trace => trace.inputs.filter(item => item.value === null)
    .map(item => ({ calculationTraceId: trace.id, inputLabel: item.label,
      linkedFactIds: [...item.factIds], currentFormula: trace.formula,
      proposedNextStep: "원문·대상·기간·인정 여부를 추가 확인하고 같은 계산기를 다시 실행",
      hypotheticalValueWon: null, simulationExecuted: false })));
  return {
    schemaVersion: APPROVAL_READINESS_VERSION,
    scope: "신청부터 인가결정 전까지. 인가 후 변제·면책 등은 제외",
    caseId: data.context.id, caseRevision: currentRevision,
    sourceDataVersion: sourceHead.sourceDataVersion, calculationRunId: sourceHead.calculationRunId,
    legalReviewRunId: legalCurrent ? legalReview!.runId : null,
    referenceSha256: sourceHead.referenceSha256,
    status, outOfScope, autoApproval: false as const, approvalProbability: null,
    courtDecision: "not_inferred" as const, readyForElectronicFiling: false as const,
    note: "내부 인가 준비도 및 예상 보완 쟁점만 진단. 실제 보정명령은 등록된 법원 문서 이벤트와 구별. 인가결정·확률을 예측하지 않음.",
    evidence: { activeDocuments: activeDocs.length, currentFacts: facts.length,
      verifiedFacts: facts.filter(f => f.state === "verified").length,
      legallyAcceptedFacts: facts.filter(f => f.state === "verified" && f.recognition === "accepted").length,
      rejectedOrDisputedFacts: facts.filter(f => f.recognition === "rejected" || f.state === "disputed").length,
      featureInventory },
    consultation: { status: monitor?.consultationStatus ?? "unavailable", workflowAdopted: monitor?.workflowAdopted === true,
      activeRequirementCount: monitor?.requirements.length ?? null,
      workflowRequestCount: monitor?.workflowRequests.length ?? null,
      projectionCurrent: monitor?.workflowProjectionStatus === "current" },
    calculation: { persistedCurrent: calcCurrent, issues: [...assessment.calculation.issues],
      traces, headline: {
        monthlyIncomeWon: assessment.calculation.monthlyIncomeWon,
        recognizedLivingCostWon: assessment.calculation.recognizedLivingCostWon,
        disposableIncomeWon: assessment.calculation.disposableIncomeWon,
        ordinaryRepaymentBudgetWon: assessment.calculation.ordinaryRepaymentBudgetWon,
        totalDebtWon: assessment.calculation.totalDebtWon,
        liquidationValueWon: assessment.calculation.liquidationValueWon,
        planTotalWon: assessment.calculation.planTotalWon,
        presentValueWon: assessment.calculation.presentValueWon,
        liquidationComparison: assessment.calculation.liquidationComparison,
      }, missingInputQuestions },
    legalReview: { current: legalCurrent, expected: input.expectedRiskIds.length,
      reviewed: currentChecks.length, statusCounts: legalStatusCounts,
      findings: currentChecks.map(check => ({ id: check.id, title: input.riskTitles?.[check.id] ?? check.id,
        status: check.status, reason: check.reason, factIds: [...check.factIds], ruleIds: [...check.ruleIds],
        missingDocuments: [...check.missingDocuments], nextAction: check.nextAction })) },
    courtCorrections, taskCounts: counts, tasks,
    nextStep: outOfScope ? "현재 범위 외: 인가결정 이후 사건은 기존 절차원장에만 보존" :
      status === "lawyer_approval_review_pending" ? "변호사가 법률상 판단·서류 제출/인가 준비를 개별 검토" :
      "우선순위대로 사실·서류·계산·법률 쟁점을 보완한 뒤 현행 판본으로 재평가",
  };
}
