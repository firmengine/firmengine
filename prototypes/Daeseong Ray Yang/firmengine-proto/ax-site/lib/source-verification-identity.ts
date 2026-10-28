/** Exact page-normalized source-field location helpers shared by receipt and lineage checks. */
// Keep the public type compatible with the parser's `number[] | null`; the
// runtime guard below enforces four normalized endpoints before use.
export type SourceBBox = number[];

/** True only when two quotes identify overlapping literal source text after Unicode/whitespace normalization. */
export function sourceQuotesOverlap(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = a.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const right = b.normalize("NFKC").replace(/\s+/gu, " ").trim();
  return !!left && !!right && (left === right || left.includes(right) || right.includes(left));
}

export interface BBoxReceiptLocator {
  version: "bbox_v1";
  bbox: SourceBBox;
}

export function isValidSourceBBox(value: unknown): value is SourceBBox {
  return Array.isArray(value) && value.length === 4 && value.every(point => typeof point === "number" && Number.isFinite(point) && point >= 0 && point <= 1) && value[0] < value[2] && value[1] < value[3];
}

export function sameSourceBBox(a: unknown, b: unknown): boolean {
  return isValidSourceBBox(a) && isValidSourceBBox(b) && a.every((point, index) => point === b[index]);
}

export function sourceBBoxesAreDistinctAndDisjoint(boxes: readonly unknown[]): boolean {
  if (boxes.length < 2 || boxes.some(box => !isValidSourceBBox(box))) return false;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i] as SourceBBox, b = boxes[j] as SourceBBox;
    const overlap = a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    if (overlap) return false;
  }
  return true;
}

export function bboxLocatorFingerprintSegment(input: {
  locator: BBoxReceiptLocator;
  extractionBBox: SourceBBox;
  proofBBoxes: SourceBBox[];
}) {
  return {
    locatorVersion: input.locator.version,
    bbox: [...input.locator.bbox] as SourceBBox,
    extractionBBox: [...input.extractionBBox] as SourceBBox,
    proofBBoxes: input.proofBBoxes.map(box => [...box] as SourceBBox),
  };
}

export function fingerprintHasBBoxLocator(
  fingerprint: string,
  expected: ReturnType<typeof bboxLocatorFingerprintSegment>,
): boolean {
  try {
    const parsed: unknown = JSON.parse(fingerprint);
    if (!Array.isArray(parsed)) return false;
    return parsed.some((item,index)=>parsed[index-1]==="field_meaning_v1"&&JSON.stringify(item)===JSON.stringify(expected));
  } catch {
    return false;
  }
}
