/** Read-only replay of every persisted calculation feature against a current execution.
 * The original calculator and case state are never changed. */
export const PREAPPROVAL_CALCULATION_REPLAY_VERSION = "preapproval-calculation-replay/1" as const;
export interface StoredCalculationAuditRow {
  id?: string;
  calculationId: string;
  outputName: string;
  outputPath: string;
  valueJson: string;
  valueWon?: string | null;
  status: string;
  sourceFactIdsJson?: string;
  formula?: string;
}
export interface ReplayIssue {
  code: "INVALID_POINTER" | "RUNTIME_OUTPUT_MISSING" | "STORED_JSON_INVALID" |
    "OUTPUT_VALUE_MISMATCH" | "STORED_STATUS_INVALID" | "STORED_FACT_IDS_INVALID" |
    "SOURCE_FACT_NOT_CURRENT" | "DUPLICATE_OUTPUT_PATH" | "STORED_WON_MISMATCH" |
    "EMPTY_STORED_OUTPUTS" | "EXPECTED_OUTPUT_NOT_PERSISTED" | "STORED_STATUS_VALUE_CONFLICT";
  calculationId: string;
  outputPath: string;
  rowId: string | null;
}
const legalStatus = new Set(["computed", "provisional", "blocked", "missing", "conflict", "not_applicable"]);
const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object";
function atPointer(execution: unknown, path: string): {found: boolean; value: unknown} {
  if (!path.startsWith("/") || path.length > 400 || path.length < 2) return {found: false, value: undefined};
  let cur: unknown = execution;
  for (const chunk of path.slice(1).split("/")) {
    if (/~(?![01])/.test(chunk)) return {found: false, value: undefined};
    const key = chunk.replace(/~1/g, "/").replace(/~0/g, "~");
    if (["__proto__", "prototype", "constructor"].includes(key) || !isRecord(cur) || !Object.hasOwn(cur, key))
      return {found: false, value: undefined};
    cur = cur[key];
  }
  return {found: true, value: cur};
}
export function auditStoredCalculationReplay(input: {
  execution: unknown;
  rows: readonly StoredCalculationAuditRow[];
  currentFactIds: ReadonlySet<string>;
  maxReportedIssues?: number;
  /** Exact expected persistence rows from the same engine execution, not heterogeneous catalog resultPaths. */
  expectedOutputs?: readonly Pick<StoredCalculationAuditRow, "calculationId" | "outputPath">[];
}) {
  const limit = input.maxReportedIssues ?? 60;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw Error("INVALID_REPLAY_REPORT_LIMIT");
  const issues: ReplayIssue[] = [], counts: Record<string, number> = {};
  const push = (code: ReplayIssue["code"], row: Pick<StoredCalculationAuditRow,"calculationId"|"outputPath"> & {id?: string}) => {
    counts[code] = (counts[code] ?? 0) + 1;
    if (issues.length < limit) issues.push({code, calculationId: row.calculationId,
      outputPath: row.outputPath, rowId: row.id ?? null});
  };
  const seen = new Set<string>();
  for (const row of input.rows) {
    const key = row.calculationId + "\u0000" + row.outputPath;
    if (seen.has(key)) push("DUPLICATE_OUTPUT_PATH", row);
    seen.add(key);
    if (!legalStatus.has(row.status)) push("STORED_STATUS_INVALID", row);
    const pointer = atPointer(input.execution, row.outputPath);
    if (!pointer.found) {
      push(row.outputPath.startsWith("/") ? "RUNTIME_OUTPUT_MISSING" : "INVALID_POINTER", row);
    }
    let parsed: unknown, parsedOk = true;
    try { parsed = JSON.parse(row.valueJson); }
    catch { parsedOk = false; push("STORED_JSON_INVALID", row); }
    if (pointer.found && parsedOk && JSON.stringify(pointer.value) !== JSON.stringify(parsed))
      push("OUTPUT_VALUE_MISMATCH", row);
    // A stored status cannot contradict whether the producer observed a value.
    // This does not change or infer legal recognition of any financial amount.
    if (parsedOk) {
      const unobserved = parsed === null || parsed === "unknown";
      if (unobserved ? row.status === "computed" || row.status === "provisional"
                     : row.status === "missing" || row.status === "blocked")
        push("STORED_STATUS_VALUE_CONFLICT", row);
    }
    // Mirror case-calculation-feature-store.won() for exact integer text and safe integer numbers.
    // SQL NULL stays distinct from an observed 0; a nonmoney/missing value has no Won column.
    const endName = row.outputPath.split("/").at(-1) ?? "";
    const canonicalWon = /Won$/.test(endName) && parsedOk
      ? typeof parsed === "string" && /^-?\d+$/.test(parsed) ? parsed
        : typeof parsed === "number" && Number.isSafeInteger(parsed) ? String(parsed)
        : null
      : null;
    if (parsedOk && row.valueWon !== undefined && row.valueWon !== canonicalWon)
      push("STORED_WON_MISMATCH", row);
    if (row.sourceFactIdsJson !== undefined) {
      try {
        const ids: unknown = JSON.parse(row.sourceFactIdsJson);
        if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) push("STORED_FACT_IDS_INVALID", row);
        else if (ids.some(id => !input.currentFactIds.has(id))) push("SOURCE_FACT_NOT_CURRENT", row);
      } catch { push("STORED_FACT_IDS_INVALID", row); }
    }
  }
  // A silent success on an empty or truncated SQL feature set is misleading.
  // Do not require all 42 heterogeneous catalog outputs here; compare exact
  // feature rows that calculationFeatureRows would serialize for this execution.
  if (input.rows.length === 0) push("EMPTY_STORED_OUTPUTS", {calculationId:"calculation_store",outputPath:"/"});
  if (input.expectedOutputs) {
    const checked = new Set<string>();
    for (const expected of input.expectedOutputs) {
      const key = expected.calculationId + "\u0000" + expected.outputPath;
      if (checked.has(key)) continue;
      checked.add(key);
      if (!seen.has(key)) push("EXPECTED_OUTPUT_NOT_PERSISTED", expected);
    }
  }
  return {schemaVersion: PREAPPROVAL_CALCULATION_REPLAY_VERSION,
    storedRows: input.rows.length, replayedPaths: seen.size,
    valid: Object.keys(counts).length === 0, issueCount: Object.values(counts).reduce((n, x) => n + x, 0),
    issueCountByCode: counts, issues, issuesTruncated: Object.values(counts).reduce((n, x) => n + x, 0) > limit,
    courtApprovalInferred: false as const, sourceFactsModified: false as const};
}
