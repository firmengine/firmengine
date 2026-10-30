/** Approved release-managed additions, independent of the historical 13,226
 * record seed and its immutable hash. Compiled safety invariants remain locked.
 */
import {SUBSTITUTION_POLICY_REFERENCE_ID,SUBSTITUTION_POLICY_SEED} from "./substitution-policy.ts";
import {LEGAL_EVIDENCE_POLICY_REFERENCE_ID,LEGAL_EVIDENCE_POLICY_SEED} from "./legal-evidence-criteria.ts";
export const MANAGED_REFERENCE_RECORDS=[{
 id:SUBSTITUTION_POLICY_REFERENCE_ID,kind:"parameter",category:"court_practice",
 title:"관할별 갈음서류 원본 증명요건·대체 조합",value:SUBSTITUTION_POLICY_SEED,unit:null,
 sourceIds:["SRC-INTAKE-SEOUL-402","SRC-INTAKE-BUSAN-402"],
 sourceUrls:["https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf","https://bsb.scourt.go.kr/bsb/info/info_01/practice_rule_bsb.pdf"],
 effectiveFrom:null,effectiveTo:null,courtIds:["seoul","busan"],
 verification:"code_seed_current_court_version_requires_review",
 runtimeMode:"approved_reference_snapshot",editable:true,
 consumers:[{path:"lib/document-substitution.ts",symbol:"allowedPublishedPath"}],
 condition:null,consequence:null,requiresHumanReview:true,
 sha256:"d3470de7f63304b2881a621b890ea7184e3052e2afa1f99c6cd7a899abc48a66",
 lockedSafetyInvariant:false
},{
 id:LEGAL_EVIDENCE_POLICY_REFERENCE_ID,kind:"parameter",category:"court_practice",
 title:"법률 위험 95항목의 법원·시행일·canonical 필수피처·계산 의존 계약",
 value:LEGAL_EVIDENCE_POLICY_SEED,unit:null,sourceIds:["SRC-INTAKE-OFFICE-POLICY"],
 sourceUrls:["https://www.law.go.kr/","https://slb.scourt.go.kr/"],
 effectiveFrom:null,effectiveTo:null,courtIds:[],
 verification:"empty_unmapped_seed_not_legal_authority",runtimeMode:"approved_reference_snapshot",
 editable:true,consumers:[{path:"lib/pipeline.ts",symbol:"reviewLegal"},{path:"lib/legal-review-packet.ts",symbol:"gateLegalReviewChecks"}],
 condition:null,consequence:null,requiresHumanReview:true,
 sha256:"61589e653f70565705f74433e5e673226fe7bcf20326166b3f893ca878347f1e",
 lockedSafetyInvariant:false
}];
