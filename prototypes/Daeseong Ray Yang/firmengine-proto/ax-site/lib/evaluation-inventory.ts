/** Bounded synthetic-only inventory. The cursor is the last scanned ID, not an offset. */
export function parseEvaluationInventoryQuery(url: URL) {
  const prefix = url.searchParams.get("prefix") ?? "synthetic-";
  const after = url.searchParams.get("after") ?? "";
  const limitRaw = url.searchParams.get("limit") ?? "100";
  if (!/^synthetic-[a-z0-9-]*$/.test(prefix) || prefix.length > 121) throw new Error("평가 사건 접두사가 올바르지 않습니다.");
  if (after && (!/^synthetic-[a-z0-9-]+$/.test(after) || !after.startsWith(prefix) || after.length > 121)) throw new Error("평가 사건 커서가 올바르지 않습니다.");
  if (!/^\d+$/.test(limitRaw)) throw new Error("평가 사건 조회 개수가 올바르지 않습니다.");
  const limit = Number(limitRaw);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("평가 사건 조회 개수는 1~100입니다.");
  return { prefix, after, limit };
}
