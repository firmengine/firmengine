/** A3: a numbered register is an audit checkpoint, not a substitute for canonical field identity.
 * Fail closed if a regenerated register reorders IDs and makes a sequential audit skip a field.
 * Read-only; no personal case data or legal eligibility assumptions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const registry=fileURLToPath(new URL("../docs/ocr-693-field-register.md",import.meta.url));
const index=fileURLToPath(new URL("../lib/canonical-field-id-index.json",import.meta.url));

function registerRows(markdown){
  return markdown.split(/\r?\n/).flatMap(line=>{
    const match=/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|/.exec(line);
    return match?[{ordinal:Number(match[1]),id:match[2]}]:[];
  });
}
function mismatchedOrdinals(ids,rows){
  return rows.flatMap((row,i)=>row.ordinal!==i+1||row.id!==ids[i]?[i+1]:[]);
}

test("all registered canonical OCR rows have the same ID and ordinal as the authoritative index",()=>{
  const ids=JSON.parse(readFileSync(index,"utf8")).ids;
  const rows=registerRows(readFileSync(registry,"utf8"));
  assert.ok(Array.isArray(ids)&&ids.length>=693);
  assert.equal(rows.length,ids.length,"one row for every canonical ID");
  assert.equal(new Set(ids).size,ids.length,"canonical index has no duplicates");
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,"register IDs unique");
  assert.deepEqual(mismatchedOrdinals(ids,rows),[],"no numbered row may refer to the wrong ID");
  assert.equal(rows[30].id,"application_identity_venue::procedure.application.accepted_at");
  assert.equal(rows[44].id,"application_identity_venue::procedure.application_date");
});

test("a swapped register row is detected even when all IDs are present",()=>{
  const ids=["family::a","family::b","family::c"];
  assert.deepEqual(mismatchedOrdinals(ids,[{ordinal:1,id:ids[1]},{ordinal:2,id:ids[0]},{ordinal:3,id:ids[2]}]),[1,2]);
  assert.deepEqual(mismatchedOrdinals(ids,[{ordinal:1,id:ids[0]},{ordinal:2,id:ids[1]},{ordinal:3,id:ids[2]}]),[]);
});
