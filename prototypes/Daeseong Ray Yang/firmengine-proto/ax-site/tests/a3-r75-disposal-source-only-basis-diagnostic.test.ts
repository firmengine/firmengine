/** A3-r75: deliberately RED diagnostic, not an approved disposal rule.
 * Uses only synthetic fixture values. Source-only OCR may be stored outside
 * CaseData.facts in production; integration tests must establish that route.
 * Do not merge without stakeholder review and actual Node/CI/D1 validation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {createCase,normalizeMoney} from "../lib/domain.ts";
import {
 disposalApplicabilityBasisFactIds,
 disposalApplicabilityBasisFingerprint,
 evaluateDisposalApplicability
} from "../lib/disposal-applicability.ts";

function syntheticReviewedCase() {
 const d=createCase("Synthetic disposal review","synthetic-a3-r75","2026-11-02");
 d.context.inventoryComplete={income:"yes",debt:"yes",asset:"yes"};
 const sha="a".repeat(64);
 d.documents.push({id:"synthetic-asset-doc",name:"synthetic-asset.pdf",sha256:sha,status:"active",pages:[1]});
 d.pages.push({documentId:"synthetic-asset-doc",page:1,role:"evidence",text:"SYNTHETIC ASSET"});
 d.assets.push({
  id:"synthetic-asset",kind:"deposit",label:"synthetic asset",
  grossValue:normalizeMoney("120000"),securedPayoff:normalizeMoney("0"),
  disposalCosts:normalizeMoney("0"),protectedValue:normalizeMoney("0"),
  ownershipBps:10000,asOf:d.context.asOf,valuationBasis:"synthetic",
  recognition:"unreviewed",factIds:["synthetic-asset-fact"]
 });
 d.facts.push({
  id:"synthetic-asset-fact",logicalId:"synthetic-asset-fact",version:1,
  subjectId:"synthetic-asset",key:"asset.gross_value",
  value:"120000",rawValue:"120000",numeric:normalizeMoney("120000"),sourceUnit:"KRW",
  state:"extracted",recognition:"unreviewed",validation:[],
  refs:[{documentId:"synthetic-asset-doc",page:1,quote:"SYNTHETIC ASSET",sourceHash:sha}]
 });
 d.context.disposalApplicabilityReview={
  disposition:"not_applicable",status:"confirmed",
  reason:"Synthetic prior review; not a real legal determination",
  basisFingerprint:disposalApplicabilityBasisFingerprint(d),
  factIds:disposalApplicabilityBasisFactIds(d),
  reviewedBy:"synthetic-unit-reviewer",reviewedAt:"2026-11-02T09:00:00.000Z"
 };
 return d;
}

test("A3-r75 control: linked typed asset fact change stales no-disposal review",()=>{
 const data=syntheticReviewedCase();
 assert.equal(evaluateDisposalApplicability(data).status,"confirmed");
 data.facts.find(fact=>fact.id==="synthetic-asset-fact")!.value="130000";
 assert.equal(evaluateDisposalApplicability(data).status,"stale");
});

test("A3-r75 RED diagnostic: new source-only disposal observation should trigger re-review",()=>{
 const data=syntheticReviewedCase();
 const before=disposalApplicabilityBasisFingerprint(data);
 assert.equal(evaluateDisposalApplicability(data).status,"confirmed");
 const sha="b".repeat(64);
 data.documents.push({id:"synthetic-disposal-doc",name:"synthetic-disposal.pdf",sha256:sha,status:"active",pages:[1]});
 data.pages.push({documentId:"synthetic-disposal-doc",page:1,role:"evidence",text:"SYNTHETIC DISPOSAL PROCEEDS"});
 data.facts.push({
  id:"synthetic-source-only",logicalId:"synthetic-source-only",version:1,
  subjectId:"synthetic-asset",key:"asset_transfer_disposition::proceeds_received",
  value:"99000",rawValue:"99000",numeric:normalizeMoney("99000"),sourceUnit:"KRW",
  state:"extracted",recognition:"unreviewed",validation:[],
  refs:[{documentId:"synthetic-disposal-doc",page:1,quote:"SYNTHETIC DISPOSAL PROCEEDS",sourceHash:sha}]
 });
 // Current helper's asset.* key filter ignores this source-only fact and
 // excludes its document from the fingerprint. Expected RED until policy review.
 assert.notEqual(disposalApplicabilityBasisFingerprint(data),before,
  "new disposal source observation should alter the applicability evidence basis");
 assert.equal(evaluateDisposalApplicability(data).status,"stale",
  "previous no-disposal finding must not be treated as a fresh legal recognition");
});
