# 원문 대조·표적 재판독 프롬프트

`source_verifier`와 `targeted_rereader`는 같은 조합 코드에서 stage별 지시를 선택합니다. `repair`는 지정 좌표만, `region_verify`는 현재 영역의 좌표만 검증합니다. 포함되는 공통 지시문은 [shared-instructions.md](shared-instructions.md)에 있습니다.

원본: `lib/pipeline.ts:291`

```ts
    const verifiedRead=saved.read!;
    const repairTargets=j.stage==="repair"?getRepairTargets(verifiedRead,saved.review?.checks):[];
    const verifierContract=documentFieldContract(j.document_type);
    const sourceNatureDiagnostics=sourceNatureDiagnosticContext(saved.classification,saved.classificationRecovery?.read);
    const verifierInstructions=renderPromptPolicy("prompt.pipeline.verifier_instructions")+RECORD_CATEGORY_POLICY_INSTRUCTIONS+""+(j.stage==="repair"?renderPromptPolicy("prompt.pipeline.verifier_instructions.part_2"):renderPromptPolicy("prompt.pipeline.verifier_instructions.part_3"))+renderPromptPolicy("prompt.pipeline.verifier_instructions.part_4")+SOURCE_BBOX_INSTRUCTIONS+"\n"+STATEMENT_SCOPE_RELATION_VERIFY_INSTRUCTIONS+"\n"+PAGE_COMPLETENESS_INSTRUCTIONS+"\n"+(j.stage==="repair"?renderPromptPolicy("prompt.pipeline.verifier_instructions.part_5"):MISSING_FIELD_REVIEW_INSTRUCTIONS)+renderPromptPolicy("prompt.pipeline.verifier_instructions.part_6")+SOURCE_NATURE_HANDOFF_INSTRUCTIONS+"\n"+JSON.stringify(verifierContract?{familyId:verifierContract.family_id,canonicalType:verifierContract.canonical_type,fields:compactFamilyFieldContract(verifierContract),specialFindings:verifierContract.special_findings}:{familyId:null,route:renderPromptPolicy("prompt.pipeline.verifier_instructions.route")});
    const verifierRead=indexedVerificationRead(verifiedRead);
    const indexedRepairTargets=j.stage==="repair"?repairTargets.map((target,targetIndex)=>({...target,targetIndex})):undefined;
    const verifierInputText=JSON.stringify({read:verifierRead,sourceNatureDiagnostics,...(j.stage==="repair"?{repairTargets:indexedRepairTargets,earlierReview:saved.review}:{}),rescueProvenance:rescueImages.map(({hash,variant,bbox,transform})=>({hash,variant,bbox,transform}))});
    const verifierPromptText=verifierInputText+(rescueImages.length?renderPromptPolicy("prompt.pipeline.verifier_prompt_text"):"")+(j.stage==="repair"?renderPromptPolicy("prompt.pipeline.verifier_prompt_text.part_2"):"")+(j.stage==="region_verify"?renderPromptPolicy("prompt.pipeline.verifier_prompt_text.part_3", {value1: regionIndex+1, value2: saved.regionBbox}) : "");
```

## 호출

원본: `lib/pipeline.ts:310`

```ts
    const {value:reviewResult,usage}=await callLuna<VerifyResult>({agent:j.stage==="repair"?"targeted_rereader":"source_verifier",instructions:verifierInstructions,input:[{role:"user",content:[{type:"input_text",text:verifierPromptText},...(j.stage==="region_verify"?rescueImages.map(x=>x.content):[img!,...rescueImages.map(x=>x.content)])]}],schema:VERIFY_SCHEMA,maxOutput:j.stage==="region_verify"?8000:20000});
```
