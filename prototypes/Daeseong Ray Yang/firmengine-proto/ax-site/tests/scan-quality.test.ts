import { strict as assert } from "node:assert";
import { test } from "node:test";
import { expandBox,rescueSpecs,validBox,MAX_RESCUE_VARIANTS } from "../lib/scan-quality.ts";

test("field rescue crops stay bounded, expand context, and bind to both source hashes",()=>{
  const boxes=[[.4,.4,.5,.5],[.1,.1,.2,.2],[.2,.2,.3,.3],[.3,.3,.4,.4],[.5,.5,.6,.6]];
  const specs=rescueSpecs({reason:"field_disagreement",boxes,sourceHash:"a".repeat(64),baseImageHash:"b".repeat(64)});
  assert.equal(specs.length,MAX_RESCUE_VARIANTS);assert.deepEqual(specs[0].bbox,expandBox(boxes[0] as [number,number,number,number]));
  assert.equal(specs[0].sourceHash,"a".repeat(64));assert.equal(specs[0].baseImageHash,"b".repeat(64));assert.equal(specs[0].rotation,0);
});
test("omission rescue uses one broad table-context crop and never infers readability",()=>{
  const specs=rescueSpecs({reason:"omitted_rows",boxes:[[.3,.3,.4,.4]],sourceHash:"s",baseImageHash:"i"});
  assert.equal(specs.length,1);assert.deepEqual(specs[0].bbox,[0,.045,1,.995]);assert.equal(specs[0].reason,"omitted_rows");
});
test("incomplete extraction creates four overlapping full-width bands for high-resolution source rendering",()=>{
  const specs=rescueSpecs({reason:"incomplete_extraction",boxes:[[0,0,1,1]],sourceHash:"s",baseImageHash:"i"});
  assert.equal(specs.length,4);assert.deepEqual(specs.map(x=>x.bbox),[[0,0,1,.275],[0,.25,1,.525],[0,.5,1,.775],[0,.75,1,1]]);
});
test("invalid, reversed, and out-of-range boxes are rejected",()=>{
  assert.equal(validBox([0,0,1,1]),true);assert.equal(validBox([.8,.2,.1,.9]),false);assert.equal(validBox([-1,0,1,1]),false);assert.equal(validBox([0,0,1]),false);
  const specs=rescueSpecs({reason:"unreadable",boxes:[[.7,.5,.2,.1]],sourceHash:"s",baseImageHash:"i"});assert.equal(specs.length,4);assert.ok(Math.abs(specs[0].bbox[1]-.085)<1e-12);assert.ok(Math.abs(specs[0].bbox[3]-.935)<1e-12);
});
test("right-angle rotation choices are explicit and do not synthesize content",()=>{
	const specs=rescueSpecs({reason:"unreadable",boxes:[[.2,.2,.8,.8]],sourceHash:"s",baseImageHash:"i"});assert.deepEqual(specs.map(x=>x.rotation),[0,90,180,-90]);assert.ok(specs.every(x=>Math.abs(x.rotation)<=180));assert.equal(specs.length,4);
});
