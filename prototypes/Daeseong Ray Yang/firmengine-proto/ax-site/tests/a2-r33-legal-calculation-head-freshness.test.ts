import test from "node:test";
import assert from "node:assert/strict";
import {isCurrentLegalCalculationHead,type LegalCalculationHeadSnapshot} from "../lib/legal-calculation-head-freshness.ts";
const A="a".repeat(64),B="b".repeat(64),I="1".repeat(64);
const current:LegalCalculationHeadSnapshot={caseRevision:7,dataVersion:4,headRevision:7,
  headDataVersion:4,headInputSha256:I,runId:"calculation-"+B,runRevision:7,
  runDataVersion:4,runInputSha256:I,runReferenceSha256:B};
const cases:[string,LegalCalculationHeadSnapshot|null,number,string,boolean][]=[
 ["same case/source/reference and input SHA",current,7,B,true],
 ["old reference A but unchanged case and source",{...current,runReferenceSha256:A},7,B,false],
 ["new active reference without source mutation",current,7,A,false],
 ["head source version differs",{...current,headDataVersion:3},7,B,false],
 ["run source version differs",{...current,runDataVersion:3},7,B,false],
 ["head case revision differs",{...current,headRevision:6},7,B,false],
 ["run case revision differs",{...current,runRevision:6},7,B,false],
 ["case source revision changes",current,8,B,false],
 ["run input SHA differs from head",{...current,runInputSha256:A},7,B,false],
 ["malformed head input SHA",{...current,headInputSha256:"invalid"},7,B,false],
 ["SQL NULL source version",{...current,dataVersion:null},7,B,false],
 ["missing calculation head",null,7,B,false],
 ["malformed calculation run identifier",{...current,runId:"invalid"},7,B,false],
 ["invalid active reference SHA",current,7,"",false],
 ["explicit source version zero is not SQL NULL",{...current,dataVersion:0,headDataVersion:0,runDataVersion:0},7,B,true],
 ["zero source version in head but current is four",{...current,headDataVersion:0},7,B,false],
 ["invalid noninteger case revision",current,7.5,B,false],
];
for(const [title,head,revision,referenceSha,expected] of cases){
  test(title,()=>assert.equal(isCurrentLegalCalculationHead(head,revision,referenceSha),expected));
}
