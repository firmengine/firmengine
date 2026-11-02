// A2 r87: native Node SQLite replay against the exact committed migration 0011.
// Synthetic only. SQLite is not staging Cloudflare D1 and does not prove Fact ownership.
import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {decodeStoredCalculationEvidence} from "../lib/calculation-form-evidence-decoder.ts";
const sql=readFileSync(new URL("../drizzle/0011_case_calculation_features.sql",import.meta.url),"utf8");
const cases=[
  ["valid ID",'["SYN-F1"]',"0",true],
  ["valid empty ID array","[]","0",true],
  ["explicit null","[]","null",true],
  ["literal unknown","[]",'"unknown"',true],
  ["bad numeric scalar","42","100",false],
  ["bad mixed Fact",'["SYN-F1",42]',"100",false],
  ["bad duplicate Fact",'["SYN-F1","SYN-F1"]',"100",false],
  ["bad JSON","{","100",false],
  ["bad null Fact","null","100",false],
  ["bad padded Fact",'[" SYN-F1 "]',"100",false],
];
for(const [name,facts,value,accepted] of cases)test("A2 r87 SQLite 0011 "+name,()=>{
  const db=new DatabaseSync(":memory:");try{
    db.exec("PRAGMA foreign_keys=ON;CREATE TABLE cases(id TEXT PRIMARY KEY);");
    db.exec(sql);
    db.prepare("INSERT INTO cases(id) VALUES (?)").run("SYN-C");
    db.prepare("INSERT INTO case_calculation_runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run("SYN-R","SYN-C",1,1,"sha","rule","ref",1,"refsha","contract","provisional","{}","{}","{}","sha","now");
    db.prepare("INSERT INTO case_calculation_features VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run("SYN-FEATURE","SYN-R","SYN-CALC","output","/output",null,null,value,"0","provisional",facts,"{}","synthetic");
    const row=db.prepare("SELECT value_json AS valueJson,source_fact_ids_json AS factIdsJson FROM case_calculation_features WHERE run_id=?").get("SYN-R");
    assert.ok(row);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
    if(accepted)assert.ok(decodeStoredCalculationEvidence(row));
    else assert.throws(()=>decodeStoredCalculationEvidence(row));
  }finally{db.close();}
});
