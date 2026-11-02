/**
 * Read-only summary of persisted calculation feature statuses. A matching
 * replay proves value/source consistency, not that every value is usable.
 * This gate never rewrites a Fact or infers human/court approval.
 */
export const PREAPPROVAL_STORED_STATUS_GATE_VERSION = "preapproval-stored-status-gate/1" as const;

const statuses = ["computed", "provisional", "blocked", "missing", "conflict", "not_applicable"] as const;
type KnownStatus = (typeof statuses)[number];
type CountKey = KnownStatus | "invalid";
export type StoredStatusRow = { readonly status: string };
export type StoredStatusGate = ReturnType<typeof auditStoredCalculationStatusGate>;

/** Never call an incomplete read, an empty run, or an unresolved row 'ready'. */
export function auditStoredCalculationStatusGate(input: {
  rows: readonly StoredStatusRow[] | null;
  readComplete: boolean;
}) {
  const counts: Record<CountKey, number> = {
    computed: 0, provisional: 0, blocked: 0, missing: 0,
    conflict: 0, not_applicable: 0, invalid: 0,
  };
  for (const row of input.rows ?? []) {
    const key: CountKey = (statuses as readonly string[]).includes(row.status)
      ? row.status as KnownStatus : "invalid";
    counts[key] += 1;
  }
  const observed = input.readComplete && input.rows !== null && input.rows.length > 0;
  const unresolvedCount = counts.provisional + counts.blocked + counts.missing + counts.conflict + counts.invalid;
  const reviewRequired = !observed || unresolvedCount > 0;
  return {
    schemaVersion: PREAPPROVAL_STORED_STATUS_GATE_VERSION,
    state: !observed ? "unobserved" as const : reviewRequired ? "stored_unresolved" as const
      : "no_unresolved_status_observed" as const,
    observedRows: input.rows?.length ?? null,
    readComplete: input.readComplete,
    counts,
    unresolvedCount: observed ? unresolvedCount : null,
    reviewRequired,
    legalAcceptanceInferred: false as const,
    courtApprovalInferred: false as const,
  };
}
