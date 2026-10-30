/** A stored OCR page (or rescue crop) must contain real image bytes. */
export const MAX_EVIDENCE_PAGE_IMAGE_BYTES = 8_000_000;

export function validEvidencePageImageLength(length: number): boolean {
  return Number.isSafeInteger(length) && length > 0 && length <= MAX_EVIDENCE_PAGE_IMAGE_BYTES;
}
