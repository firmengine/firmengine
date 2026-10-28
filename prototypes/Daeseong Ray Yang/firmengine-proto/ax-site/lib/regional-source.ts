import type { PageRead } from "./extraction.ts";
import type { Check, ReviewPass } from "./source-verification.ts";

type NormalizedBBox = [number,number,number,number];
const validBBox=(value:unknown):value is NormalizedBBox=>Array.isArray(value)&&value.length===4&&value.every(point=>typeof point==="number"&&Number.isFinite(point)&&point>=0&&point<=1)&&value[0]<value[2]&&value[1]<value[3];

function toPageBBox(local:unknown,region:unknown):NormalizedBBox|null{
  if(!validBBox(local)||!validBBox(region))return null;
  const [x0,y0,x1,y1]=region;
  const mapped:[number,number,number,number]=[x0+local[0]*(x1-x0),y0+local[1]*(y1-y0),x0+local[2]*(x1-x0),y0+local[3]*(y1-y0)];
  return validBBox(mapped)?mapped:null;
}

/** Convert valid region-relative source boxes to page-normalized coordinates. */
export function pageCoordinateRead(read:PageRead,regionBBox:unknown):PageRead{
  return {...read,records:read.records.map(record=>({...record,fields:record.fields.map(field=>({...field,bbox:toPageBBox(field.bbox,regionBBox)}))}))};
}

/** Convert verifier locations into the same page coordinate frame as merged reads. */
export function pageCoordinateChecks<T extends readonly Check[]>(checks:T,regionBBox:unknown):T[number][]{
  return checks.map(check=>({...check,bbox:toPageBBox(check.bbox,regionBBox)}) as T[number]);
}

/** Keep originalChecks as the untouched local-frame response for audit. */
export function pageCoordinateReviewPass(pass:ReviewPass,regionBBox:unknown):ReviewPass{
  return {...pass,checks:pageCoordinateChecks(pass.checks,regionBBox),originalChecks:pass.originalChecks};
}
