/** Validate a source OCR cell BEFORE exposing it as a calculation input.
 * This is a format check, not an OCR truth test or legal recognition.
 * Amounts must have a declared unit and convert exactly into integer KRW.
 * Unknown/foreign monetary quantities remain source observations.
 */
import {normalizeMoney} from "./domain.ts";

export interface CalculationSourceCell {
 value:string|null;
 unit:string|null;
 quote?:string|null;
 confidence?:"clear"|"uncertain"|"unreadable";
 sourceState?:string|null;
}
export interface CalculationSourceDefinition {
 datatype:string;
 local_id?:string;
}
const validDate=(value:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00.000Z");
 return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
};
const validTime=(value:string)=>{
 const match=/^(\d{4}-\d{2}-\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?$/.exec(value);
 return !!match&&validDate(match[1]);
};
/** Returns deterministic, field-local non-legal reasons. Does not change raw OCR values. */
export function calculationSourceCellIssues(cell:CalculationSourceCell,definition:CalculationSourceDefinition|null|undefined):string[]{
 if(!definition)return [];
 const state=cell.sourceState??(cell.value===null?"unknown":"present");
 if(state!=="present")return [];
 const issues:string[]=[];
 if(cell.value===null||cell.value.trim()===""){issues.push("SOURCE_PRESENT_VALUE_MISSING");return issues;}
 if(typeof cell.quote!=="string"||!cell.quote.trim())issues.push("SOURCE_QUOTE_MISSING");
 const raw=cell.value.trim(),datatype=definition.datatype;
 if(datatype==="money"||datatype==="money_or_itemized"||datatype==="money_or_unknown"){
  if(!cell.unit?.trim())issues.push("SOURCE_MONETARY_UNIT_MISSING");
  else if(normalizeMoney(raw,cell.unit.trim()).normalizationStatus!=="exact")issues.push("SOURCE_MONEY_NOT_EXACT_KRW");
  // Commas in OCR monetary text are thousands separators, never disposable noise.
  // Keep the source string intact and require review of malformed grouping.
  const grouped=raw.normalize("NFKC").replace(/\s*(?:원|KRW)\s*$/i,"").trim();
  if(grouped.includes(",")&&!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(grouped))issues.push("SOURCE_MONEY_GROUPING_INVALID");
 }
 if(datatype==="date"&&!validDate(raw))issues.push("SOURCE_DATE_INVALID");
 if(datatype==="datetime"&&!validTime(raw))issues.push("SOURCE_DATETIME_INVALID");
 if(datatype==="integer"){
  // Match the typed projector: ungrouped, non-negative, safe base-10 integers only.
  // Do not alter raw evidence or silently strip OCR punctuation.
  if(!/^\d+$/.test(cell.value))issues.push("SOURCE_INTEGER_FORMAT_REVIEW");
  else if(!Number.isSafeInteger(Number(cell.value)))issues.push("SOURCE_INTEGER_UNSAFE_RANGE");
 }
 if(cell.confidence&&cell.confidence!=="clear")issues.push("SOURCE_READ_UNCERTAIN");
 return [...new Set(issues)];
}
