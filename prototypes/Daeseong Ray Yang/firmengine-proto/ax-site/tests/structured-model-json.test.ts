import test from "node:test";
import assert from "node:assert/strict";
import { structuredModelJsonMatchesSchema as valid } from "../lib/structured-model-json.ts";
const scalar={type:"object",additionalProperties:false,required:["ok","amount"],properties:{ok:{type:"boolean"},amount:{type:["number","null"]}}};
test("required keys and top-level types fail closed",()=>{
  assert.equal(valid({ok:true,amount:0},scalar),true);
  assert.equal(valid({ok:true,amount:null},scalar),true);
  assert.equal(valid({ok:true},scalar),false);
  assert.equal(valid({ok:true,amount:0,unexpected:true},scalar),false);
  assert.equal(valid([],scalar),false);
  assert.equal(valid(null,scalar),false);
  assert.equal(valid({ok:"true",amount:0},scalar),false);
});
test("nested array, enums, anyOf and nullable bbox match extraction output contract",()=>{
  const bbox={anyOf:[{type:"array",items:{type:"number"},minItems:4,maxItems:4},{type:"null"}]};
  const rule={type:"object",additionalProperties:false,required:["records","complete"],properties:{records:{type:"array",items:{type:"object",additionalProperties:false,required:["sourceState","bbox"],properties:{sourceState:{type:"string",enum:["present","blank","unknown"]},bbox}}},complete:{type:"boolean"}}};
  assert.equal(valid({records:[{sourceState:"present",bbox:[0.1,0.1,0.9,0.9]}],complete:true},rule),true);
  assert.equal(valid({records:[{sourceState:"unknown",bbox:null}],complete:false},rule),true);
  assert.equal(valid({records:[{sourceState:"approved",bbox:null}],complete:true},rule),false);
  assert.equal(valid({records:[{sourceState:"present",bbox:[0,0,1]}],complete:true},rule),false);
});
test("local refs, positive integers, allowed patterns and malformed schema fail closed",()=>{
  const rule={type:"object",required:["id"],properties:{id:{$ref:"#/$defs/id"}},$defs:{id:{type:"string",pattern:"^[A-Z][0-9]+$"}}};
  assert.equal(valid({id:"A12"},rule),true);
  assert.equal(valid({id:"a12"},rule),false);
  assert.equal(valid({id:"A12"},{type:"object",properties:{id:{$ref:"#/missing"}}}),false);
  assert.equal(valid({id:"A12"},null),false);
});
