import test from "node:test";
import assert from "node:assert/strict";
import { subjectLinkTargetKindAllowed, type SubjectLink } from "../lib/party-identity.ts";

// Synthetic typed-entity kinds only; no real persons, documents, or identifiers.
const fixtures: readonly [scope:string,kinds:string[],allowed:boolean][] = [
  ["income",["income"],true],["income",["debt"],false],
  ["debt",["debt"],true],["debt",["asset"],false],
  ["asset",["asset"],true],["asset",["income"],false],
  ["case",["case"],true],["case",["debt"],false],
  ["household",["case"],false],["household",["debt"],false],
  ["procedure",["case"],false],["event",["asset"],false],
  ["income",[],false],["debt",["debt","income"],false],
];
for (const [subjectScope,kinds,allowed] of fixtures) {
  test(`A1-DATA-005 subject scope=${subjectScope}, kinds=${kinds.join(",")||"none"}`,()=>{
    const link = {subjectScope} as Pick<SubjectLink,"subjectScope">;
    assert.equal(subjectLinkTargetKindAllowed(link,kinds),allowed);
  });
}
