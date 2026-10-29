/** Synthetic local workflow only. Arithmetic is illustrative, not validated law. */
export type Role = "client" | "staff" | "lawyer";
export type Scenario = "normal" | "missing" | "conflict";
export type FieldKey = "income" | "expenses" | "livingCost" | "debt" | "assets";
export type EvidenceStatus = "candidate" | "confirmed" | "conflict" | "missing";
export type DocumentKind = "identity" | "income" | "debt" | "business" | "asset";
export type RepaymentMonths = 36 | 48 | 60;
export interface EvidenceSource { documentId: string; page: number; excerpt: string }
export interface EvidenceField {
  key: FieldKey; label: string; value: number | null; status: EvidenceStatus;
  source: EvidenceSource | null; reason: string;
  alternatives?: { value: number | null; source: EvidenceSource }[];
}
export interface DocumentRecord {
  id: string; name: string; kind: DocumentKind; status: "uploaded" | "confirmed" | "withdrawn"; pages: number;
  synthetic?: boolean;
}
export interface RequirementLink { id: string; kind: DocumentKind; documentId: string; subject: string; period: string; reason: string }
export interface RequirementExemption { kind: DocumentKind; reason: string }
export interface DemoCalculation {
  income: number; expenses: number; livingCost: number; debt: number; assets: number;
  months: RepaymentMonths; disposableIncome: number; monthlyPayment: number;
  totalRepayment: number; remainingDebt: number; shortfall: boolean;
}
export interface SnapshotPayload {
  title: string; consultation: string; fields: readonly EvidenceField[]; documents: readonly DocumentRecord[];
  months: RepaymentMonths; calculation: Readonly<DemoCalculation>; narrative?: string;
  requirementLinks?: readonly RequirementLink[]; requirementExemptions?: readonly RequirementExemption[];
}
export interface GeneratedSnapshot {
  id: string; caseId: string; revision: number; payload: Readonly<SnapshotPayload>;
  staffReviewed: boolean; lawyerReviewed: boolean; invalidated: boolean;
}
export interface TaskRecord { id: string; label: string; owner: Role; status: "open" | "done" }
export interface HistoryEntry { id: string; action: string; role: Role; revision: number; detail: string }
export interface CaseRecord {
  id: string; title: string; scenario: Scenario; revision: number; consultation: string;
  incomeType: "salary" | "business"; months: RepaymentMonths; fields: EvidenceField[];
  documents: DocumentRecord[]; generated: GeneratedSnapshot[]; tasks: TaskRecord[]; history: HistoryEntry[];
  requirementLinks?: RequirementLink[]; requirementExemptions?: RequirementExemption[];
}
export interface LabState { role: Role; activeCaseId: string; cases: CaseRecord[]; notice: string | null }
export interface RequirementStatus {
  kind: DocumentKind; label: string; required: boolean; reason: string; status: "missing" | "uploaded" | "confirmed";
}
export interface Readiness {
  canCalculate: boolean; canGenerate: boolean; missingDocuments: string[]; fieldIssues: string[];
  calculation: DemoCalculation | null; currentSnapshot: GeneratedSnapshot | null;
  stage: "intake" | "evidence" | "draft" | "staff_reviewed" | "lawyer_reviewed";
}
type CaseAction = { caseId: string };
export type LabAction =
  | { type: "SET_ROLE"; role: Role }
  | { type: "SELECT_CASE"; caseId: string }
  | { type: "CREATE_CASE"; scenario: Scenario; title?: string; text?: string; incomeType?: "salary" | "business" }
  | { type: "RESET_DEMO" }
  | { type: "CLEAR_NOTICE" }
  | (CaseAction & { type: "UPDATE_CONSULTATION"; text: string })
  | (CaseAction & { type: "SET_INCOME_TYPE"; incomeType: "salary" | "business" })
  | (CaseAction & { type: "SET_MONTHS"; months: RepaymentMonths })
  | (CaseAction & { type: "ADD_DOCUMENT"; name: string; kind: DocumentKind; pages: number })
  | (CaseAction & { type: "CONFIRM_DOCUMENT" | "WITHDRAW_DOCUMENT"; documentId: string })
  | (CaseAction & { type: "RUN_DEMO_EXTRACTION" })
  | (CaseAction & { type: "BULK_CONFIRM_SAFE"; reason: string })
  | (CaseAction & { type: "LINK_REQUIREMENT"; kind: DocumentKind; documentId: string; subject: string; period: string; reason: string })
  | (CaseAction & { type: "UNLINK_REQUIREMENT"; linkId: string; reason: string })
  | (CaseAction & { type: "SET_REQUIREMENT_EXEMPT" | "CLEAR_REQUIREMENT_EXEMPT"; kind: DocumentKind; reason: string })
  | (CaseAction & { type: "EXTERNAL_CHANGE"; reason: string })
  | (CaseAction & { type: "SELECT_FIELD_SOURCE"; key: FieldKey; documentId: string; page: number; excerpt: string; reason: string })
  | (CaseAction & { type: "EDIT_FIELD"; key: FieldKey; value: number | null; reason: string })
  | (CaseAction & { type: "CONFIRM_FIELD" | "WITHDRAW_FIELD"; key: FieldKey; reason: string })
  | (CaseAction & { type: "GENERATE_DRAFT" })
  | (CaseAction & { type: "EDIT_DRAFT_TEXT"; snapshotId: string; text: string; reason: string })
  | (CaseAction & { type: "REVIEW_STAFF" | "REVIEW_LAWYER"; snapshotId: string });
export type Action = LabAction;

const fieldDefinitions: { key: FieldKey; label: string; value: number; kind: DocumentKind; page: number }[] = [
  { key: "income", label: "월 수입", value: 4_500_000, kind: "income", page: 1 },
  { key: "expenses", label: "월 인정경비 예시", value: 300_000, kind: "income", page: 2 },
  { key: "livingCost", label: "월 생계비 예시", value: 1_800_000, kind: "identity", page: 1 },
  { key: "debt", label: "채무 합계", value: 72_000_000, kind: "debt", page: 1 },
  { key: "assets", label: "재산 합계", value: 3_000_000, kind: "asset", page: 1 },
];
const documentLabels: Record<DocumentKind, string> = {
  identity: "상담·기본정보 확인서", income: "수입·경비 자료", debt: "채무 잔액자료", business: "사업 운영자료", asset: "재산 목록",
};
const documentKinds = Object.keys(documentLabels) as DocumentKind[];
const validMoney = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const validMonths = (months: unknown): months is RepaymentMonths => months === 36 || months === 48 || months === 60;
const copyField = (field: EvidenceField): EvidenceField => ({ ...field, source: field.source ? { ...field.source } : null,
  ...(field.alternatives ? { alternatives: field.alternatives.map(item => ({ ...item, source: { ...item.source } })) } : {}) });
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function hasSource(data: CaseRecord, field: EvidenceField): boolean {
  const source = field.source;
  return !!source && !!source.excerpt.trim() && Number.isInteger(source.page) && source.page > 0 &&
    data.documents.some(document => document.id === source.documentId && document.status !== "withdrawn" && source.page <= document.pages);
}

export function requirementsFor(data: CaseRecord): RequirementStatus[] {
  return documentKinds.map(kind => {
    const assetValue = data.fields.find(field => field.key === "assets")?.value;
    const exemption = (kind === "business" || kind === "asset" && validMoney(assetValue)) ? data.requirementExemptions?.find(item => item.kind === kind && item.reason.trim()) : undefined;
    const required = !exemption && (kind === "business" ? data.incomeType === "business" : kind === "asset" ? assetValue !== 0 : true);
    const links = data.requirementLinks?.filter(link => link.kind === kind) ?? [];
    const groups = new Map<string, DocumentRecord[]>();
    for (const link of links) {
      const group = `${link.subject}\u0000${link.period}`;
      const documents = groups.get(group) ?? [];
      const document = data.documents.find(item => item.id === link.documentId && item.status !== "withdrawn");
      if (document) documents.push(document);
      groups.set(group, documents);
    }
    const defaultDocuments = data.documents.filter(document => document.kind === kind && document.status !== "withdrawn");
    const documentGroups = groups.size ? [...groups.values()] : [defaultDocuments];
    const status = documentGroups.every(group => group.some(document => document.status === "confirmed")) ? "confirmed" : documentGroups.every(group => group.length > 0) ? "uploaded" : "missing";
    return { kind, label: documentLabels[kind], required,
      reason: exemption ? `담당자 해당 없음 기록: ${exemption.reason}` : kind === "business" ? "사업소득을 선택한 합성 시나리오" : kind === "asset" ? "재산 유무가 미확인되었거나 재산 금액이 있는 합성 시나리오" : "데모의 기본 확인자료", status };
  });
}

export function calculateDemo(data: CaseRecord): DemoCalculation | null {
  if (!validMonths(data.months)) return null;
  const values: Partial<Record<FieldKey, number>> = {};
  for (const definition of fieldDefinitions) {
    const field = data.fields.find(item => item.key === definition.key);
    if (!field || field.status !== "confirmed" || !validMoney(field.value) || !hasSource(data, field)) return null;
    values[field.key] = field.value;
  }
  const { income, expenses, livingCost, debt, assets } = values as Record<FieldKey, number>;
  const disposableIncome = income - expenses - livingCost;
  if (!Number.isSafeInteger(disposableIncome)) return null;
  const monthlyPayment = Math.min(Math.max(0, disposableIncome), Math.ceil(debt / data.months));
  const totalRepayment = Math.min(debt, monthlyPayment * data.months);
  if (!Number.isSafeInteger(totalRepayment)) return null;
  return { income, expenses, livingCost, debt, assets, months: data.months, disposableIncome, monthlyPayment,
    totalRepayment, remainingDebt: debt - totalRepayment, shortfall: totalRepayment < debt };
}

export function deriveReadiness(data: CaseRecord): Readiness {
  const fieldIssues = fieldDefinitions.flatMap(definition => {
    const field = data.fields.find(item => item.key === definition.key);
    if (!field || !validMoney(field.value) || field.status === "missing") return [`${definition.label}: 값 확인 필요`];
    if (field.status === "conflict") return [`${definition.label}: 원문 상충 해결 필요`];
    if (field.status !== "confirmed") return [`${definition.label}: 담당자 확인 필요`];
    return hasSource(data, field) ? [] : [`${definition.label}: 유효한 출처 필요`];
  });
  const missingDocuments = requirementsFor(data).filter(item => item.required && item.status !== "confirmed").map(item => item.label);
  const calculation = calculateDemo(data);
  const currentSnapshot = [...data.generated].reverse().find(snapshot => !snapshot.invalidated && snapshot.revision === data.revision) ?? null;
  const stage = currentSnapshot?.lawyerReviewed ? "lawyer_reviewed" : currentSnapshot?.staffReviewed ? "staff_reviewed" : currentSnapshot ? "draft" : data.consultation.trim() ? "evidence" : "intake";
  return { canCalculate: calculation !== null, canGenerate: calculation !== null && missingDocuments.length === 0 && !!data.consultation.trim(),
    missingDocuments, fieldIssues, calculation, currentSnapshot, stage };
}

function refreshTasks(data: CaseRecord): CaseRecord {
  const readiness = deriveReadiness(data);
  const task = (id: string, label: string, owner: Role, done: boolean): TaskRecord => ({ id, label, owner, status: done ? "done" : "open" });
  data.tasks = [task("consultation", "상담내용 작성", "client", !!data.consultation.trim()),
    ...requirementsFor(data).filter(item => item.required).map(item => task(`document-${item.kind}`, `${item.label} 제출·확인`, "client", item.status === "confirmed")),
    ...data.fields.map(field => task(`field-${field.key}`, `${field.label} 원문 대조`, "staff", field.status === "confirmed" && validMoney(field.value) && hasSource(data, field))),
    task("draft", "검토용 합성 초안 생성", "staff", !!readiness.currentSnapshot),
    task("staff-review", "담당자 모의 검토", "staff", !!readiness.currentSnapshot?.staffReviewed),
    task("lawyer-review", "변호사 모의 검토", "lawyer", !!readiness.currentSnapshot?.lawyerReviewed)];
  return data;
}

function fixtureFields(data: Pick<CaseRecord, "id" | "scenario" | "documents">): EvidenceField[] {
  return fieldDefinitions.map(definition => {
    const document = data.documents.find(item => item.kind === definition.kind && item.status !== "withdrawn" && item.pages >= definition.page);
    const source = document ? { documentId: document.id, page: definition.page, excerpt: `[합성 고정 예시] ${definition.label} ${definition.value.toLocaleString("ko-KR")}원` } : null;
    const field: EvidenceField = { key: definition.key, label: definition.label, value: source ? definition.value : null,
      status: source ? "candidate" : "missing", source, reason: source ? "합성 고정값입니다. 실제 파일 판독 결과가 아니며 담당자 확인이 필요합니다." : "해당 데모 자료가 없습니다. 누락은 0원이 아닙니다." };
    if (data.scenario === "conflict" && definition.key === "debt" && source) {
      const other = data.documents.find(item => item.id === `${data.id}-debt-alt` && item.status !== "withdrawn");
      if (other) { field.status = "conflict"; field.reason = "합성 잔액자료의 72,000,000원과 84,000,000원이 다릅니다. 근거와 선택 이유를 확인하세요.";
        field.alternatives = [{ value: definition.value, source: { ...source } }, { value: 84_000_000, source: { documentId: other.id, page: 1, excerpt: "[합성 고정 예시] 채무 합계 84,000,000원" } }]; }
    }
    return field;
  });
}

export function createScenarioCase(scenario: Scenario, id = `case-${scenario}`): CaseRecord {
  const incomeType = scenario === "missing" ? "business" : "salary";
  const documents: DocumentRecord[] = (["identity", "income", "debt", "asset"] as DocumentKind[])
    .filter(kind => scenario !== "missing" || kind !== "income")
    .map(kind => ({ id: `${id}-${kind}`, name: `[합성] ${documentLabels[kind]}.pdf`, kind, status: "uploaded", pages: kind === "income" ? 2 : 1, synthetic: true }));
  if (scenario === "conflict") documents.push({ id: `${id}-debt-alt`, name: "[합성] 다른 기준의 잔액자료.pdf", kind: "debt", status: "uploaded", pages: 1, synthetic: true });
  const data: CaseRecord = { id, title: scenario === "normal" ? "[합성] 급여소득 준비 사건" : scenario === "missing" ? "[합성] 사업소득 자료 보완 사건" : "[합성] 채무 잔액 상충 사건",
    scenario, revision: 1, consultation: scenario === "missing" ? "[합성 상담] 사업을 운영하며 수입자료와 사업자료를 보완할 예정입니다." : "[합성 상담] 급여소득과 채무·재산을 구분해 확인하고 검토용 초안을 준비합니다.",
    incomeType, months: 36, fields: [], documents, generated: [], tasks: [], history: [{ id: `${id}-history-1`, action: "CREATE_CASE", role: "staff", revision: 1, detail: "합성 시나리오 생성. 실제 사건·원문·법적 승인과 무관합니다." }] };
  data.fields = fixtureFields(data);
  return refreshTasks(data);
}

export function createInitialState(): LabState {
  return { role: "staff", activeCaseId: "case-conflict", cases: ["normal", "missing", "conflict"].map(scenario => createScenarioCase(scenario as Scenario)), notice: null };
}

const deny = (state: LabState, notice: string): LabState => ({ ...state, notice });
const invalidate = (data: CaseRecord) => { data.generated = data.generated.map(snapshot => ({ ...snapshot, invalidated: true, staffReviewed: false, lawyerReviewed: false })); };
function log(data: CaseRecord, role: Role, action: string, detail: string) {
  data.history.push({ id: `${data.id}-history-${data.history.length + 1}`, role, action, revision: data.revision, detail });
}

export function labReducer(state: LabState, action: LabAction): LabState {
  if (action.type === "RESET_DEMO") return createInitialState();
  if (action.type === "CLEAR_NOTICE") return { ...state, notice: null };
  if (action.type === "SET_ROLE") return ["client", "staff", "lawyer"].includes(action.role) ? { ...state, role: action.role, notice: null } : deny(state, "역할을 확인하세요.");
  if (action.type === "SELECT_CASE") return state.cases.some(data => data.id === action.caseId) ? { ...state, activeCaseId: action.caseId, notice: null } : deny(state, "사건을 찾을 수 없습니다.");
  if (action.type === "CREATE_CASE") {
    if (!["normal", "missing", "conflict"].includes(action.scenario)) return deny(state, "합성 시나리오를 선택하세요.");
    let index = state.cases.length + 1; while (state.cases.some(data => data.id === `case-${index}`)) index++;
    const data = createScenarioCase(action.scenario, `case-${index}`);
    if (action.title?.trim()) data.title = action.title.trim().slice(0, 120);
    if (action.text !== undefined) data.consultation = action.text.slice(0, 10_000);
    if (action.incomeType) { if (!["salary", "business"].includes(action.incomeType)) return deny(state, "소득유형을 확인하세요."); data.incomeType = action.incomeType; }
    data.history[0] = { ...data.history[0], role: state.role };
    return { ...state, activeCaseId: data.id, cases: [...state.cases, refreshTasks(data)], notice: "새 합성 사건을 만들었습니다." };
  }
  const original = state.cases.find(data => data.id === action.caseId);
  if (!original) return deny(state, "사건을 찾을 수 없습니다.");
  const staffActions = ["SET_MONTHS", "CONFIRM_DOCUMENT", "WITHDRAW_DOCUMENT", "EDIT_FIELD", "SELECT_FIELD_SOURCE", "CONFIRM_FIELD", "WITHDRAW_FIELD", "GENERATE_DRAFT", "REVIEW_STAFF", "BULK_CONFIRM_SAFE", "UNLINK_REQUIREMENT", "SET_REQUIREMENT_EXEMPT", "CLEAR_REQUIREMENT_EXEMPT"];
  if (staffActions.includes(action.type) && state.role !== "staff") return deny(state, "담당자 역할에서 처리하는 모의 업무입니다.");
  if ((action.type === "EXTERNAL_CHANGE" || action.type === "EDIT_DRAFT_TEXT") && state.role === "client") return deny(state, "담당자 또는 변호사 역할에서 처리하는 모의 업무입니다.");
  if (action.type === "REVIEW_LAWYER" && state.role !== "lawyer") return deny(state, "변호사 역할에서 모의 검토를 완료하세요.");
  const data: CaseRecord = { ...original, fields: original.fields.map(copyField), documents: original.documents.map(document => ({ ...document })), generated: original.generated.map(snapshot => ({ ...snapshot })), history: [...original.history], tasks: [...original.tasks], requirementLinks: original.requirementLinks?.map(link => ({ ...link })), requirementExemptions: original.requirementExemptions?.map(item => ({ ...item })) };
  let changesEvidence = true, message = "변경사항을 저장했습니다. 이전 생성본과 검토는 과거본으로 보존됩니다.";
  switch (action.type) {
    case "UPDATE_CONSULTATION": {
      if (action.text.length > 10_000) return deny(state, "상담내용은 10,000자 이내로 입력하세요.");
      if (action.text === original.consultation) return { ...state, notice: null };
      data.consultation = action.text; break;
    }
    case "SET_INCOME_TYPE": {
      if (!["salary", "business"].includes(action.incomeType)) return deny(state, "소득유형을 확인하세요.");
      if (data.incomeType === action.incomeType) return { ...state, notice: null };
      data.incomeType = action.incomeType; break;
    }
    case "SET_MONTHS": {
      if (!validMonths(action.months)) return deny(state, "데모 기간은 36·48·60개월 중 선택하세요.");
      if (data.months === action.months) return { ...state, notice: null };
      data.months = action.months; break;
    }
    case "ADD_DOCUMENT": {
      if (!action.name.trim() || !documentKinds.includes(action.kind) || !Number.isInteger(action.pages) || action.pages < 1 || action.pages > 200) return deny(state, "자료 이름·종류와 1~200쪽의 페이지 수를 확인하세요.");
      const name = action.name.trim().slice(0, 180);
      if (data.documents.some(document => document.status !== "withdrawn" && document.name.trim() === name)) return deny(state, "같은 이름의 현재 자료가 이미 있습니다. 기존 자료를 확인하거나 다른 이름을 사용하세요.");
      data.documents.push({ id: `${data.id}-document-${data.documents.length + 1}`, name, kind: action.kind, pages: action.pages, status: "uploaded" });
      message = "자료 메타데이터만 추가했습니다. 실제 파일 판독은 하지 않습니다."; break;
    }
    case "CONFIRM_DOCUMENT":
    case "WITHDRAW_DOCUMENT": {
      const document = data.documents.find(item => item.id === action.documentId);
      if (!document || document.status === "withdrawn") return deny(state, "현재 자료를 찾을 수 없습니다.");
      if (action.type === "CONFIRM_DOCUMENT" && document.status === "confirmed") return { ...state, notice: null };
      document.status = action.type === "CONFIRM_DOCUMENT" ? "confirmed" : "withdrawn";
      if (document.status === "withdrawn") for (const field of data.fields) if (field.source?.documentId === document.id) {
        field.status = "missing"; field.value = null; field.source = null; field.reason = "연결된 자료를 제외했습니다. 새 근거를 확인하세요."; delete field.alternatives;
      }
      break;
    }
    case "RUN_DEMO_EXTRACTION": {
      for (const requirement of requirementsFor(data).filter(item => item.required && item.status === "missing")) {
        const index = data.documents.length + 1;
        const baseName = `[합성] ${documentLabels[requirement.kind]}.pdf`;
        const name = data.documents.some(document => document.status !== "withdrawn" && document.name.trim() === baseName) ? `[합성 ${index}] ${documentLabels[requirement.kind]}.pdf` : baseName;
        data.documents.push({ id: `${data.id}-document-${index}`, name, kind: requirement.kind, pages: requirement.kind === "income" ? 2 : 1, status: "uploaded", synthetic: true });
      }
      const fixture = fixtureFields(data);
      data.fields = data.fields.map(field => field.status === "confirmed" ? field : fixture.find(item => item.key === field.key)!);
      message = "합성 고정 예시를 불러왔습니다. 업로드 파일의 실제 OCR 결과가 아닙니다."; break;
    }
    case "BULK_CONFIRM_SAFE": {
      if (!action.reason.trim()) return deny(state, "일괄 대조 확인 이유를 입력하세요.");
      let confirmed = 0;
      for (const document of data.documents) if (document.status === "uploaded" && document.synthetic === true && document.name.startsWith("[합성")) { document.status = "confirmed"; confirmed++; }
      for (const field of data.fields) {
        const document = data.documents.find(item => item.id === field.source?.documentId);
        const fixture = fieldDefinitions.find(definition => definition.key === field.key);
        const expectedExcerpt = fixture ? `[합성 고정 예시] ${fixture.label} ${fixture.value.toLocaleString("ko-KR")}원` : "";
        if (field.status === "candidate" && validMoney(field.value) && field.value === fixture?.value && hasSource(data, field) && document?.synthetic === true && field.source?.excerpt === expectedExcerpt) {
          field.status = "confirmed"; field.reason = action.reason.trim().slice(0, 1_000); confirmed++;
        }
      }
      if (!confirmed) return deny(state, "일괄 확인할 합성 정상 후보가 없습니다. 상충·누락·사용자 자료는 개별 확인하세요.");
      message = `명시적으로 대조한 합성 정상 후보 ${confirmed}개를 일괄 확인했습니다. 상충·누락은 그대로 보류합니다.`; break;
    }
    case "LINK_REQUIREMENT": {
      if (!documentKinds.includes(action.kind) || !data.documents.some(document => document.id === action.documentId && document.status !== "withdrawn") || !action.subject.trim() || !action.period.trim() || !action.reason.trim()) return deny(state, "현재 자료·요건 종류·대상·기간·연결 이유를 확인하세요.");
      const links = data.requirementLinks ?? [];
      if (links.some(link => link.kind === action.kind && link.documentId === action.documentId && link.subject === action.subject.trim() && link.period === action.period.trim())) return deny(state, "같은 자료·요건·대상·기간의 연결이 이미 있습니다.");
      let index = links.length + 1; while (links.some(link => link.id === `${data.id}-link-${index}`)) index++;
      data.requirementLinks = [...links, { id: `${data.id}-link-${index}`, kind: action.kind, documentId: action.documentId, subject: action.subject.trim().slice(0, 160), period: action.period.trim().slice(0, 160), reason: action.reason.trim().slice(0, 1_000) }];
      message = "요건의 대상·기간에 자료를 연결했습니다. 사실·금액은 복제하지 않습니다."; break;
    }
    case "UNLINK_REQUIREMENT": {
      if (!action.reason.trim() || !data.requirementLinks?.some(link => link.id === action.linkId)) return deny(state, "현재 연결과 철회 이유를 확인하세요.");
      data.requirementLinks = data.requirementLinks.filter(link => link.id !== action.linkId); message = `요건 연결을 철회했습니다: ${action.reason.trim().slice(0, 1_000)}`; break;
    }
    case "SET_REQUIREMENT_EXEMPT":
    case "CLEAR_REQUIREMENT_EXEMPT": {
      if (!["business", "asset"].includes(action.kind) || !action.reason.trim()) return deny(state, "사업·재산 조건부 요건에만 담당자의 구체적인 이유를 기록하세요. 기본 신원·소득·채무 요건은 우회할 수 없습니다.");
      if (action.type === "SET_REQUIREMENT_EXEMPT" && action.kind === "asset" && !validMoney(data.fields.find(field => field.key === "assets")?.value)) return deny(state, "재산금액 미확인은 해당 없음으로 처리할 수 없습니다.");
      data.requirementExemptions = (data.requirementExemptions ?? []).filter(item => item.kind !== action.kind);
      if (action.type === "SET_REQUIREMENT_EXEMPT") data.requirementExemptions.push({ kind: action.kind, reason: action.reason.trim().slice(0, 1_000) });
      message = `${action.type === "SET_REQUIREMENT_EXEMPT" ? "조건부 해당 없음" : "조건부 예외 철회"} 기록: ${action.reason.trim().slice(0, 1_000)}`; break;
    }
    case "EXTERNAL_CHANGE": {
      if (!action.reason.trim()) return deny(state, "외부 변경 사유를 입력하세요.");
      message = `외부 변경을 기록했습니다. 기존 생성본을 다시 검토하세요: ${action.reason.trim().slice(0, 1_000)}`; break;
    }
    case "SELECT_FIELD_SOURCE": {
      const field = data.fields.find(item => item.key === action.key);
      const document = data.documents.find(item => item.id === action.documentId && item.status !== "withdrawn");
      if (!field || !document || !Number.isInteger(action.page) || action.page < 1 || action.page > document.pages || !action.excerpt.trim() || !action.reason.trim()) return deny(state, "현재 자료의 유효한 페이지·인용과 출처 변경 사유를 입력하세요.");
      field.source = { documentId: document.id, page: action.page, excerpt: action.excerpt.trim().slice(0, 4_000) };
      field.status = field.value === null ? "missing" : "candidate";
      field.reason = action.reason.trim().slice(0, 1_000); break;
    }
    case "EDIT_FIELD":
    case "CONFIRM_FIELD":
    case "WITHDRAW_FIELD": {
      const field = data.fields.find(item => item.key === action.key);
      if (!field || !action.reason.trim()) return deny(state, "대상 항목과 변경·확인 이유를 입력하세요.");
      if (action.type === "EDIT_FIELD") {
        if (action.value !== null && !validMoney(action.value)) return deny(state, "금액은 0 이상의 안전한 정수 원 단위로 입력하세요.");
        field.value = action.value; field.status = action.value === null ? "missing" : "candidate";
      } else if (action.type === "CONFIRM_FIELD") {
        if (field.status === "conflict") return deny(state, "상충 금액은 원문을 대조하고 선택 이유와 금액을 먼저 정정하세요.");
        if (!validMoney(field.value) || !hasSource(data, field)) return deny(state, "값과 유효한 자료·페이지·인용을 먼저 확인하세요. 누락은 0원이 아닙니다.");
        field.status = "confirmed";
      } else { field.value = null; field.status = "missing"; }
      field.reason = action.reason.trim().slice(0, 1_000); break;
    }
    case "GENERATE_DRAFT": {
      const readiness = deriveReadiness(data);
      if (!readiness.canGenerate || !readiness.calculation) return deny(state, "상담내용, 필수 자료, 모든 금액과 출처를 먼저 확인하세요.");
      invalidate(data);
      const payload = freeze({ title: data.title, consultation: data.consultation, fields: data.fields.map(copyField), documents: data.documents.filter(document => document.status !== "withdrawn").map(document => ({ ...document })), months: data.months, calculation: { ...readiness.calculation }, requirementLinks: (data.requirementLinks ?? []).map(link => ({ ...link })), requirementExemptions: (data.requirementExemptions ?? []).map(item => ({ ...item })) });
      data.generated.push({ id: `${data.id}-snapshot-${data.generated.length + 1}`, caseId: data.id, revision: data.revision, payload, staffReviewed: false, lawyerReviewed: false, invalidated: false });
      changesEvidence = false; message = "검토용 합성 초안을 생성했습니다. 담당자와 변호사의 모의 검토가 필요합니다."; break;
    }
    case "EDIT_DRAFT_TEXT": {
      const snapshot = data.generated.find(item => item.id === action.snapshotId);
      const readiness = deriveReadiness(data);
      if (!snapshot || snapshot.invalidated || snapshot.revision !== data.revision || readiness.currentSnapshot?.id !== snapshot.id || !readiness.canGenerate) return deny(state, "현재 자료와 일치하는 최신 초안만 수정할 수 있습니다.");
      if (!action.text.trim() || !action.reason.trim()) return deny(state, "수정할 초안 내용과 변경 사유를 입력하세요.");
      const payload = freeze({ ...snapshot.payload, narrative: action.text.trim(), fields: snapshot.payload.fields.map(copyField), documents: snapshot.payload.documents.map(document => ({ ...document })), calculation: { ...snapshot.payload.calculation } });
      invalidate(data);
      data.generated.push({ id: `${data.id}-snapshot-${data.generated.length + 1}`, caseId: data.id, revision: data.revision, payload, staffReviewed: false, lawyerReviewed: false, invalidated: false });
      changesEvidence = false; message = "초안 수정본을 새 판본으로 보존했습니다. 담당자와 변호사의 모의 검토를 다시 진행하세요."; break;
    }
    case "REVIEW_STAFF":
    case "REVIEW_LAWYER": {
      const snapshot = data.generated.find(item => item.id === action.snapshotId);
      if (!snapshot || snapshot.invalidated || snapshot.revision !== data.revision || deriveReadiness(data).currentSnapshot?.id !== snapshot.id || !deriveReadiness(data).canGenerate) return deny(state, "현재 자료와 일치하는 최신 생성본만 모의 검토할 수 있습니다.");
      if (action.type === "REVIEW_STAFF") { snapshot.staffReviewed = true; snapshot.lawyerReviewed = false; message = "담당자 모의 검토완료. 변호사 모의 검토를 진행하세요."; }
      else { if (!snapshot.staffReviewed) return deny(state, "담당자 모의 검토를 먼저 완료하세요."); snapshot.lawyerReviewed = true; message = "변호사 모의 검토완료. 법적 승인이나 법원 제출을 뜻하지 않습니다."; }
      changesEvidence = false; break;
    }
    default: return deny(state, "지원하지 않는 작업입니다.");
  }
  if (changesEvidence) { data.revision++; invalidate(data); }
  log(data, state.role, action.type, "reason" in action ? action.reason.trim().slice(0, 1_000) : message);
  return { ...state, cases: state.cases.map(item => item.id === data.id ? refreshTasks(data) : item), notice: message };
}

export interface DemoIncomeRow { id: string; label: string; gross: number | null; expenses: number | null; from: string; to: string; source: string; confirmed: boolean }
export interface DemoDebtRow { id: string; label: string; principal: number | null; interest: number | null; secured: boolean; priority: "ordinary" | "priority" | "tax" | "disputed"; asOf: string; source: string; confirmed: boolean }
export interface DemoAssetRow { id: string; label: string; marketValue: number | null; securedBalance: number | null; costs: number | null; exemption: number | null; ownershipBps: number; disposal: boolean; salePrice: number | null; asOf: string; source: string; confirmed: boolean }
export interface FinancialDemo {
  incomes: DemoIncomeRow[]; debts: DemoDebtRow[]; assets: DemoAssetRow[];
  livingCost: number | null; fees: number | null; priorityPayment: number | null; months: RepaymentMonths;
}
export interface FinancialDemoResult {
  incomeGross: number | null; incomeExpenses: number | null; debtTotal: number | null; assetValue: number | null;
  disposalProceeds: number | null; remainingAssets: number | null; disposableIncome: number | null;
  ordinaryBudget: number | null; repaymentPool: number | null; ordinaryDebt: number | null;
  allocations: { id: string; label: string; amount: number }[]; unallocated: number | null; shortfall: number | null;
  issues: string[]; duplicates: string[]; warnings: string[]; ready: boolean;
}
export function createFinancialDemo(data: CaseRecord): FinancialDemo {
  const value = (key: FieldKey) => data.fields.find(field => field.key === key)?.value ?? null;
  return {
    incomes: [{ id: "income-1", label: "합성 소득원", gross: value("income"), expenses: value("expenses"), from: "2026-01-01", to: "2026-09-30", source: "합성 수입·경비 자료", confirmed: false }],
    debts: [{ id: "debt-1", label: "합성 채권 계약", principal: value("debt"), interest: 0, secured: false, priority: "ordinary", asOf: "2026-10-01", source: "합성 채무 잔액자료", confirmed: false }],
    assets: [{ id: "asset-1", label: "합성 보유재산", marketValue: value("assets"), securedBalance: 0, costs: 0, exemption: 0, ownershipBps: 10000, disposal: false, salePrice: null, asOf: "2026-10-01", source: "합성 재산 목록", confirmed: false }],
    livingCost: value("livingCost"), fees: 0, priorityPayment: 0, months: data.months,
  };
}
/** Explicit user-reviewed DEMO rows; no tax, exemption, priority or court rule is inferred. */
export function deriveFinancialDemo(data: FinancialDemo): FinancialDemoResult {
  const issues: string[] = [], duplicates: string[] = [], warnings: string[] = [];
  const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const amounts = (values: (number | null)[]) => values.every(validMoney);
  const total = (values: number[]): number | null => { const sum = values.reduce((a, b) => a + b, 0); return validMoney(sum) ? sum : null; };
  const keys = new Set<string>();
  const duplicate = (key: string, label: string) => { if (keys.has(key)) duplicates.push(label); keys.add(key); };
  if (!data.incomes.length) issues.push("소득원을 입력하거나 0원인 소득원을 명시하세요.");
  if (!data.debts.length) issues.push("채권 계약을 입력하거나 채무 0원을 명시하세요.");
  if (!data.assets.length) issues.push("재산 목록을 입력하거나 무재산 0원을 명시하세요.");
  for (const row of data.incomes) {
    if (!row.label.trim() || !row.source.trim() || !amounts([row.gross, row.expenses]) || !dateValid(row.from) || !dateValid(row.to) || row.from > row.to) issues.push(`${row.label || "소득원"}: 금액·대상기간·출처 확인`);
    if (!row.confirmed) issues.push(`${row.label || "소득원"}: 행 검토 필요`);
    duplicate(`income:${row.label.trim().toLowerCase()}:${row.from}:${row.to}`, `${row.label}: 같은 소득원·기간 중복`);
  }
  for (let i = 0; i < data.incomes.length; i++) for (let j = i + 1; j < data.incomes.length; j++) {
    const a = data.incomes[i], b = data.incomes[j];
    if (a.label.trim().toLowerCase() === b.label.trim().toLowerCase() && a.from <= b.to && b.from <= a.to && (a.from !== b.from || a.to !== b.to)) duplicates.push(`${a.label}: 소득 대상기간 겹침`);
  }
  for (const row of data.debts) {
    if (!row.label.trim() || !row.source.trim() || !amounts([row.principal, row.interest]) || !dateValid(row.asOf) || !["ordinary", "priority", "tax", "disputed"].includes(row.priority)) issues.push(`${row.label || "채권"}: 계약·금액·기준일·출처 확인`);
    if (!row.confirmed) issues.push(`${row.label || "채권"}: 행 검토 필요`);
    duplicate(`debt:${row.label.trim().toLowerCase()}:${row.asOf}`, `${row.label}: 같은 채권 계약·기준일 중복`);
    if (row.secured || row.priority !== "ordinary") warnings.push(`${row.label}: 담보·우선·조세·다툼 분류는 일반채권 배분 예시에서 제외되며 별도 검토가 필요합니다.`);
  }
  for (const row of data.assets) {
    if (!row.label.trim() || !row.source.trim() || !amounts([row.marketValue, row.securedBalance, row.costs, row.exemption]) || !Number.isInteger(row.ownershipBps) || row.ownershipBps < 0 || row.ownershipBps > 10000 || !dateValid(row.asOf) || (row.disposal && !validMoney(row.salePrice))) issues.push(`${row.label || "재산"}: 평가·공제·지분·처분대금·출처 확인`);
    if (!row.confirmed) issues.push(`${row.label || "재산"}: 행 검토 필요`);
    duplicate(`asset:${row.label.trim().toLowerCase()}:${row.asOf}`, `${row.label}: 같은 재산·평가기준일 중복`);
  }
  if (!amounts([data.livingCost, data.fees, data.priorityPayment]) || !validMonths(data.months)) issues.push("생계비·비용·우선변제액·기간 확인");
  const gross = total(data.incomes.filter(row => validMoney(row.gross)).map(row => row.gross!));
  const expenses = total(data.incomes.filter(row => validMoney(row.expenses)).map(row => row.expenses!));
  const debtTotal = total(data.debts.flatMap(row => [row.principal, row.interest]).filter(validMoney));
  const empty: FinancialDemoResult = { incomeGross: null, incomeExpenses: null, debtTotal: null, assetValue: null, disposalProceeds: null, remainingAssets: null, disposableIncome: null, ordinaryBudget: null, repaymentPool: null, ordinaryDebt: null, allocations: [], unallocated: null, shortfall: null, issues, duplicates, warnings, ready: false };
  if (issues.length || duplicates.length || gross === null || expenses === null || debtTotal === null) return empty;
  const netAsset = (row: DemoAssetRow, disposal: boolean) => {
    const base = Math.max(0, (disposal ? row.salePrice! : row.marketValue!) - row.securedBalance! - row.costs! - (disposal ? 0 : row.exemption!));
    return Number(BigInt(base) * BigInt(row.ownershipBps) / 10000n);
  };
  const disposalProceeds = total(data.assets.filter(row => row.disposal).map(row => netAsset(row, true)));
  const remainingAssets = total(data.assets.filter(row => !row.disposal).map(row => netAsset(row, false)));
  const ordinaryRows = data.debts.filter(row => !row.secured && row.priority === "ordinary");
  const ordinaryDebt = total(ordinaryRows.map(row => row.principal! + row.interest!));
  const disposableIncome = gross - expenses - data.livingCost!;
  const ordinaryBudget = Math.max(0, disposableIncome - data.fees! - data.priorityPayment!);
  const budgetTotal = ordinaryBudget * data.months;
  if (disposalProceeds === null || remainingAssets === null || ordinaryDebt === null || !Number.isSafeInteger(disposableIncome) || !validMoney(budgetTotal) || !validMoney(disposalProceeds + remainingAssets)) {
    issues.push("금액 합계가 안전한 정수 계산 범위를 벗어났습니다."); return empty;
  }
  const repaymentPool = Math.min(ordinaryDebt, budgetTotal);
  const allocations = ordinaryRows.map(row => ({ id: row.id, label: row.label, amount: ordinaryDebt === 0 ? 0 : Number(BigInt(repaymentPool) * BigInt(row.principal! + row.interest!) / BigInt(ordinaryDebt)) }));
  return { incomeGross: gross, incomeExpenses: expenses, debtTotal, assetValue: disposalProceeds + remainingAssets, disposalProceeds, remainingAssets, disposableIncome, ordinaryBudget, repaymentPool, ordinaryDebt, allocations,
    unallocated: repaymentPool - allocations.reduce((sum, row) => sum + row.amount, 0), shortfall: ordinaryDebt - repaymentPool, issues, duplicates, warnings, ready: true };
}
