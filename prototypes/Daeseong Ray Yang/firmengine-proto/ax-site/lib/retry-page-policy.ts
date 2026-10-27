/** Document types are routing hints; the evidence/holdout role is the access boundary. */
export function canRetryEvidencePage(
  job: { role: string; document_type?: string | null },
  page: { role: string; documentType?: string } | undefined,
  immutableRole: string,
): boolean {
  return job.role === "evidence" && page?.role === "evidence"
    && immutableRole !== "filed_form" && immutableRole !== "administrative";
}
