/** A refresh is an explicit new read, not a receipt upgrade or a case-wide retry. */
export type PageReadIntent = "retry" | "refresh";
export type ReverificationProvenance = {
  requestedAt: string;
  sourceHash: string;
  imageHash: string;
  imageKey: string;
  currentCacheKey: string;
  originalCacheKey: string | null;
  originalReadHash: string;
  originalExtractors: { model: string; promptVersion: string; promptHash: string; sourceHash: string; baseImageHash: string; verifiedAt: string }[];
  verificationPromptVersion: string;
  verificationAttempts: number;
  repairAttempts: number;
};
export type PriorReadArchive = { key: string; sha256: string; cacheKey: string | null; archivedAt: string };

/** Reverification invalidates only machine proof for this unchanged source page. */
export function clearAutomatedPageReceipts<T extends { facts: { reviewer?: unknown; sourceVerification?: { source: { documentId: string; page: number; sha256: string } }; state: string; validation?: { code: string }[] }[] }>(data: T, documentId: string, page: number, sourceHash: string): T {
  const next=structuredClone(data);
  for(const fact of next.facts){
    const proof=fact.sourceVerification;
    if(fact.reviewer||!proof||proof.source.documentId!==documentId||proof.source.page!==page||proof.source.sha256!==sourceHash)continue;
    delete fact.sourceVerification;
    if(fact.state==="verified")fact.state="extracted";
    fact.validation=(fact.validation??[]).filter(item=>item.code!=="MACHINE_SOURCE_VERIFIED");
  }
  return next;
}

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
