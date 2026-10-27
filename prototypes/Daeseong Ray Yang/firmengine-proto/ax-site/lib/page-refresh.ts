/** A refresh is an explicit new read, not a receipt upgrade or a case-wide retry. */
export type PageReadIntent = "retry" | "refresh";
export type PriorReadArchive = { key: string; sha256: string; cacheKey: string | null; archivedAt: string };

export function canStartFreshPageRead(status: string, leaseUntil: string | null, intent: PageReadIntent) {
  return !leaseUntil && (intent === "refresh"
    ? ["completed", "review_required", "error"].includes(status)
    : ["review_required", "error"].includes(status));
}

/** The entire old result is archived separately. Only one prior read is carried
 * in the active checkpoint so repeated refreshes cannot grow it recursively. */
export function freshPageCheckpoint(raw: string | null, cacheKey: string | null, archive?: PriorReadArchive) {
  let previous: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) previous = parsed as Record<string, unknown>;
    } catch { /* The immutable archive still preserves an unreadable prior result. */ }
  }
  const supersededResult = Object.fromEntries(Object.entries(previous).filter(([key]) =>
    !["commit", "supersededRead", "supersededResult", "supersededCacheKey", "priorReadArchive", "projectionClaim"].includes(key)));
  return {
    ...(archive ? { priorReadArchive: archive } : {}),
    supersededRead: previous.read ?? previous.extractionRead,
    supersededCacheKey: cacheKey,
    ...(Object.keys(supersededResult).length ? { supersededResult } : {}),
  };
}
