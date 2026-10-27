import type { FieldReviewCheck, PageRead } from "./extraction.ts";

export interface VerificationBindingResult {
  checks: FieldReviewCheck[];
  bindingIssues: string[];
}

/** Adds stable, explicit zero-based coordinates without changing the source read. */
export function indexedVerificationRead(read: PageRead) {
  return {
    documentType: read.documentType,
    complete: read.complete,
    warnings: read.warnings,
    records: read.records.map((record, recordIndex) => ({
      recordIndex,
      category: record.category,
      label: record.label,
      fields: record.fields.map((field, fieldIndex) => ({ fieldIndex, ...field })),
    })),
  };
}

/**
 * A pass is all-or-nothing for coordinate binding. A single invalid, duplicate,
 * or out-of-scope repair check makes every returned check unbound so a shifted
 * subset cannot accidentally validate neighboring source fields.
 */
export function bindVerificationChecks(
  read: PageRead,
  rawChecks: unknown,
  allowedTargets?: readonly Pick<FieldReviewCheck, "recordIndex" | "fieldIndex">[],
): VerificationBindingResult {
  if (!Array.isArray(rawChecks)) return { checks: [], bindingIssues: ["CHECKS_NOT_ARRAY"] };

  const issues = new Set<string>();
  const seen = new Set<string>();
  const allowed = allowedTargets
    ? new Set(allowedTargets.map(target => `${target.recordIndex}:${target.fieldIndex}`))
    : undefined;

  for (const [checkIndex, value] of rawChecks.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.add(`CHECK_NOT_OBJECT:${checkIndex}`);
      continue;
    }
    const check = value as Partial<FieldReviewCheck>;
    const ri = check.recordIndex, fi = check.fieldIndex;
    if (!Number.isSafeInteger(ri) || !Number.isSafeInteger(fi) || (ri as number) < 0 || (fi as number) < 0) {
      issues.add(`CHECK_COORDINATE_INVALID:${checkIndex}`);
      continue;
    }
    if ((ri as number) >= read.records.length || (fi as number) >= (read.records[ri as number]?.fields.length ?? 0)) {
      issues.add(`CHECK_COORDINATE_OUT_OF_RANGE:${checkIndex}`);
      continue;
    }
    const coordinate = `${ri}:${fi}`;
    if (seen.has(coordinate)) issues.add(`DUPLICATE_CHECK_COORDINATE:${coordinate}`);
    seen.add(coordinate);
    if (allowed && !allowed.has(coordinate)) issues.add(`CHECK_OUTSIDE_REPAIR_TARGETS:${coordinate}`);
  }

  if (issues.size) return { checks: [], bindingIssues: [...issues].sort() };

  // Rebuild each object so downstream code receives only schema-supported
  // verification fields, while original payloads remain available for audit.
  const checks = rawChecks.map((value) => {
    const check = value as FieldReviewCheck;
    return {
      recordIndex: check.recordIndex,
      fieldIndex: check.fieldIndex,
      ...(check.meaningStatus === undefined ? {} : { meaningStatus: check.meaningStatus }),
      status: check.status,
      value: check.value,
      unit: check.unit,
      quote: check.quote,
      ...(check.bbox === undefined ? {} : { bbox: check.bbox }),
      reason: check.reason,
    };
  });
  return { checks, bindingIssues: [] };
}
