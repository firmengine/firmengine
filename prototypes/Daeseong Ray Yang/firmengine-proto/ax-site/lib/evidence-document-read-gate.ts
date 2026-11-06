/** Read-only identity gate: does not confer legal acceptance or a commit lock. */
export function matchesSingleActiveCaseDocument(
  documents: readonly { id: string; status: string; sha256: string }[],
  documentId: string,
  sqlSha256: unknown,
): boolean {
  if (typeof sqlSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sqlSha256)) return false;
  const matches = documents.filter((d) => d.id === documentId && d.status === 'active');
  return matches.length === 1 && matches[0].sha256 === sqlSha256;
}
