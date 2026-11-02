import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// The original API handler is evaluated with only import and Request type syntax
// removed. D1's transactional batch is simulated; this is not a staging DB test.
const source=readFileSync(new URL("../app/api/cases/route.ts",import.meta.url),"utf8")
  .replace(/^import .*;$/gm,"")
  .replace("export async function POST","async function POST")
  .replace("request:Request","request");
const factory=new Function("createCase","actor","db","errorResponse","getCase","jsonBody","now","requireSameOrigin","CURRENT_RULESET","caseResponse","Response","crypto",source+"\nreturn POST;");

function syntheticRun(failAt="none"){
  const rows={cases:[],events:[]};let batches=0;
  const database={
    prepare(sql){return {bind(...args){return {sql,args};}};},
    async batch(statements){
      batches++;
      assert.equal(statements.length,2,"case and audit event must be in the same D1 batch");
      const staged=[];
      for(const statement of statements){
        if(failAt!=="none"&&statement.sql.startsWith(`INSERT INTO ${failAt} `))throw new Error("synthetic D1 write failure");
        staged.push(statement);
      }
      for(const statement of staged)rows[statement.sql.startsWith("INSERT INTO cases ")?"cases":"events"].push(statement.args);
      return staged.map(()=>({meta:{changes:1}}));
    },
  };
  const POST=factory(
    name=>({context:{id:"synthetic-case",caseName:name,revision:1}}),
    async()=>"synthetic-human",()=>database,error=>({status:500,error:error.message}),
    async id=>rows.cases.find(row=>row[0]===id),
    async()=>({name:"synthetic-input",courtId:"unknown"}),()=>"2026-11-01T12:00:00Z",()=>{},
    {id:"synthetic-rule"},async data=>data,
    {json:(payload,options)=>({status:options.status,payload})},{randomUUID:()=>"synthetic-event"},
  );
  return {POST,rows,get batches(){return batches;}};
}

test("case creation commits one case and exactly one audit event",async()=>{
  const ctx=syntheticRun();const res=await ctx.POST({});
  assert.equal(res.status,201);assert.equal(ctx.batches,1);
  assert.equal(ctx.rows.cases.length,1);assert.equal(ctx.rows.events.length,1);
  assert.equal(ctx.rows.events[0][1],ctx.rows.cases[0][0]);
  assert.equal(ctx.rows.events[0][3],"case.created");
});

test("audit event SQL failure rolls back the new case",async()=>{
  const ctx=syntheticRun("events"),res=await ctx.POST({});
  assert.equal(res.status,500);assert.equal(ctx.batches,1);
  assert.equal(ctx.rows.cases.length,0);assert.equal(ctx.rows.events.length,0);
});

test("case INSERT SQL failure leaves neither case nor audit event",async()=>{
  const ctx=syntheticRun("cases"),res=await ctx.POST({});
  assert.equal(res.status,500);assert.equal(ctx.batches,1);
  assert.equal(ctx.rows.cases.length,0);assert.equal(ctx.rows.events.length,0);
});
