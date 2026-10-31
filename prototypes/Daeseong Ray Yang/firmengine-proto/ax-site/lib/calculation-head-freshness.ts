/** Read-side advisory freshness only; it does not prevent concurrent head writes or certify legal recognition. */
export function isCalculationHeadStale(
  head: {data_version:number;case_revision:number;reference_sha256:string}|null|undefined,
  current: {data_version:number|null;revision:number},
  activeReferenceSha256:string,
):boolean {
  return !!head && (
    head.data_version !== current.data_version ||
    head.case_revision !== current.revision ||
    head.reference_sha256 !== activeReferenceSha256
  );
}
