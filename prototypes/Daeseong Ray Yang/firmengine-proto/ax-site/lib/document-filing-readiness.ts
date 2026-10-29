/**
 * Narrow filing-readiness report for bytes already rendered into Office files.
 * A correct calculation does not establish that a reconstructed document matches
 * the current official e-form. This module does not make legal or reviewer findings.
 */

export type FilingFormulaStatus =
  | "not_applicable"
  | "unknown"
  | "consistent"
  | "consistent_negative_shortfall"
  | "inconsistent";

export interface FilingReadinessTable {
  title?: string;
  headers?: readonly string[];
  rows?: readonly (readonly string[])[];
}

export interface FilingReadinessDocument {
  kind: string;
  name?: string;
  sha256?: string;
  title?: string;
  paragraphs?: readonly string[];
  tables?: readonly FilingReadinessTable[];
  form?: {
    code?: string;
    reconstruction?: boolean;
    approvalStatus?: string;
    unresolvedTokens?: readonly string[];
  };
}

export interface DocumentFilingReadiness {
  kind: string;
  name: string;
  artifactSha256: string | null;
  eformCode: string | null;
  officialParity: "not_verified";
  readyForElectronicFiling: false;
  formulaStatus: FilingFormulaStatus;
  reasons: string[];
}

export interface FilingReadinessReport {
  schemaVersion: "firmengine-filing-readiness-v1";
  mode: "draft" | "final";
  officialParity: "not_verified";
  readyForElectronicFiling: false;
  reasons: string[];
  documents: DocumentFilingReadiness[];
}

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦"] as const;

function allVisibleText(document: FilingReadinessDocument): string {
  return [
    document.title ?? "",
    ...(document.paragraphs ?? []),
    ...(document.tables ?? []).flatMap((table) => [
      table.title ?? "",
      ...(table.headers ?? []),
      ...(table.rows ?? []).flatMap((row) => [...row]),
    ]),
  ].join("\n");
}

function hasUnresolvedMarker(document: FilingReadinessDocument): boolean {
  if ((document.form?.unresolvedTokens?.length ?? 0) > 0) return true;
  return /\[[^\]]*(?:확인 필요|불일치|상충|검토 필요|선택 필요|입력 필요)[^\]]*\]|\b(?:EXPLICIT_[A-Z0-9_]+|[A-Z]+_[A-Z0-9_]+_REQUIRED|[A-Z]+_[A-Z0-9_]+_MISMATCH)\b|검토 전/iu.test(allVisibleText(document));
}

function hasInternalReviewAppendix(document: FilingReadinessDocument): boolean {
  return /계산 및 원문 근거 검토 부록|변제계획안 및 채권별 배분 검토 초안|서식 출처 및 매핑 검토|FIRM ENGINE\s*\/\s*검토용 초안|출처 기반 원문 관측|증빙 색인 및 보완·검토 목록|자동 계산·승인 전/iu.test(allVisibleText(document));
}

function parseWon(value: string | undefined): bigint | null {
  if (value === undefined) return null;
  const normalized = value
    .trim()
    .replace(/[\s,\u00a0]/gu, "")
    .replace(/[₩원]/gu, "")
    .replace(/[−﹣－]/gu, "-");
  if (!/^-?\d+$/u.test(normalized)) return null;
  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}

function isD5110SevenCellTable(table: FilingReadinessTable): boolean {
  const headers = table.headers ?? [];
  return headers.length >= CIRCLED_NUMBERS.length && CIRCLED_NUMBERS.every(
    (marker, index) => headers[index]?.trim().startsWith(marker),
  );
}

function formulaStatus(document: FilingReadinessDocument): FilingFormulaStatus {
  if (document.kind !== "repayment_plan" && document.form?.code !== "D5110") {
    return "not_applicable";
  }

  const formulaTable = (document.tables ?? []).find(isD5110SevenCellTable);
  const values = formulaTable?.rows?.[0];
  if (!values || values.length < CIRCLED_NUMBERS.length) return "unknown";
  const numbers = values.slice(0, CIRCLED_NUMBERS.length).map(parseWon);
  if (numbers.some((value) => value === null)) return "unknown";

  const [income, living, available, fee, actualAvailable, months, total] = numbers as bigint[];
  const equalitiesHold = available === income - living
    && actualAvailable === available - fee
    && total === actualAvailable * months;
  if (!equalitiesHold) return "inconsistent";
  return available < 0n || actualAvailable < 0n || total < 0n
    ? "consistent_negative_shortfall"
    : "consistent";
}

function documentReasons(document: FilingReadinessDocument): string[] {
  const reasons: string[] = [];
  if (!document.form?.code) reasons.push("official_form_mapping_missing");
  else if (!/^D\d{4}$/.test(document.form.code)) reasons.push("not_an_official_court_form");
  if (document.form?.reconstruction === true) reasons.push("official_layout_reconstructed_unverified");
  else reasons.push("official_layout_verification_missing");
  if (document.form?.approvalStatus === "reviewer_pending") reasons.push("form_mapping_review_pending");
  if (hasUnresolvedMarker(document)) reasons.push("unresolved_markers_present");
  if (hasInternalReviewAppendix(document)) reasons.push("internal_review_content_present");
  if (document.kind === "repayment_schedule" && !document.form?.code) {
    reasons.push("generated_schedule_without_official_template");
  }
  return [...new Set(reasons)];
}

/**
 * Report only observable e-form parity and content blockers. `mode: "final"`
 * means a final review copy was generated; it does not verify layout or approve filing.
 */
export function assessDocumentFilingReadiness(input: {
  mode: "draft" | "final";
  documents: readonly FilingReadinessDocument[];
}): FilingReadinessReport {
  const documents = input.documents.map((document): DocumentFilingReadiness => ({
    kind: document.kind,
    name: document.name ?? document.title ?? document.kind,
    artifactSha256: document.sha256 ?? null,
    eformCode: /^D\d{4}$/.test(document.form?.code ?? "") ? document.form!.code! : null,
    officialParity: "not_verified",
    readyForElectronicFiling: false,
    formulaStatus: formulaStatus(document),
    reasons: documentReasons(document),
  }));
  const reasons = ["official_layout_parity_not_verified"];
  if (documents.some((document) => document.reasons.includes("unresolved_markers_present"))) {
    reasons.push("unresolved_markers_present");
  }
  if (documents.some((document) => document.reasons.includes("internal_review_content_present"))) {
    reasons.push("internal_review_content_present");
  }
  return {
    schemaVersion: "firmengine-filing-readiness-v1",
    mode: input.mode,
    officialParity: "not_verified",
    readyForElectronicFiling: false,
    reasons,
    documents,
  };
}
