# FirmEngine A3 r64 — canonical OCR #561–580 소비처 심층 재감사 (2026-11-02 KST)

## 1. 판본·회차 인수·검증의 한계
- 검증 직후 커밋 직전 확인한 `main` HEAD: `a3cd40accd3aeafdf2c6d24fc242d7eae03680e8`. 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 외 작업 없음. 직전 r63 #541–560/누적 560을 계승. 회차 역할 순환 **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터**; AX는 다음 회차 시작.
- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` A3 6역할 총 **124 체크 ID**(IT20/DOC20/CALC20/LAW22/DATA22/AX20), 모두 `[ ]`. 선택 미완료 ID: `A3-IT-003`, `A3-DOC-006`, `A3-CALC-007`, `A3-LAW-014`, `A3-DATA-008`. r29 동일 구간 최초 정적 영수증 및 r63 직전 영수증·기존 `tests/feature-lineage-audit.test.ts`, `tests/material-calculation-source-gate.test.ts` 원문 확인.
- 원본 blob: canonical `27ecdddd208de82a2f5c675e7482485e3a8838c2`, family `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`, shared `9decab974e0909ae24ad927bdfe241d75b71f3a9`, supplements `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`, applicability `6076b26f782c4643a21a7b2f1a8f6261bb588b68`, calculation reference `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, material gate `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, projection `60ee5c7762d52b72a165b4f4f8214680eb98f148`, feature lineage `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`, legal seed `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`.
- 사전 최신 커밋/PR 읽음: r64 A2/A1 갱신 및 Draft PR #149 (A3 법원 보정 ID 상충) 포함. 제품 코드/고객 데이터/DB/사이트/운영 환경 변경 없음.
- **정적 join과 V8 격리 합성실행만** 수행. 실제 OCR 이미지/원문 페이지, Fact D1 저장/재독, 실제 sourceHash 증빙, 전체 Node 테스트/CI, 실제 18 계산, staging D1/R2/Cron, 공식 법원 Word/e-form, 변호사 승인, 운영 배포/전자제출은 전부 미관찰·미인증.

## 2. 최신 실제 원본 join — 독립 기대 vs 관찰
- `canonical-field-id-index.json`에서 **693/693 고유**, 85개 공개 문서/48 family, 141 문서×family route, 1,808 선언 원천 슬롯. 인덱스 고아/미등록 원천 ID 0, 동일 route 내 중복 canonical 0.
- 계산 모듈 18개/선언 input 91개, `asset_liquidation` 9 input, 법률위험95/법률규칙50/예외46 및 `LEGAL_EVIDENCE_POLICY_SEED.checks=[]` 확인. 전체 29 material 정의(19 must_reconcile/10 context_only).
- #561–580 **20개, 53 슬롯, 실제 공개서류 5종**, family 2개. 주의: 이전 r29 영수증은 동일 53 슬롯을 **6개 문서**라고 기재했으나 최신/기존 원본 route를 직접 재집계한 문서 종류는 `security_register`, `real_estate_register`, `spouse_asset_evidence`, `inheritance_records`, `real_estate_valuation` **5개**다. 이는 **과거 감사 집계 오류 정정**이며 제품 데이터 삭제/변경이 아니다.
- 각 원천 anchor(원문 필드/문서 SHA·page·quote/bbox) 선언 **53/53**, `recordPolicy.sourceOnly` 및 `noCrossRecordBorrowing` **53/53**. 선언을 확인했을 뿐 실제 원문·페이지·SQL의 링크를 검증한 것이 아니다.
- 정확 source applicability 등록 **18/20**. **#561/#562 정확 적용조건 누락 2건**(source-only 유지, 미승인 0% 합격). 미등록·미승인이라고 0원/비해당/무용으로 변경하지 않음.
- 원본 `hasPeriod` 술어 53회(참 17), `hasUnit` 53회(참 16) V8 실행. 원본 `reviewScope` 두 family 검토 후보 **D5101/D5110**; 이것은 공식 서식 token이 아니다.
- 직접 typed projection **0/20**, 정확 form token **0/20**, 정확 정적 승인 법률 증거 계약 **0/20**(운영 동적 기준정보 미조회). material **#576 한 개**, `must_reconcile → asset.grossValue`; 18/91의 직접 입력에 원천 OCR가 자동 주입된다는 뜻이 아니다.
- 위 33개 정적 구조 불변식 중 실제 기대가 원문과 일치한 것은 **32/33**; 1개 불일치는 구 r29의 공개 문서 수 **6(구 기록) 대 5(원본 실제)**. 기대 문서 수를 최신 독립 route 재집계로 정정하면 **33/33**. 이는 구조/메타데이터 검사일 뿐 제품 정확도 합격률이 아니다.

## 3. #561–580 전체 ID별 소비처/공백 누적표
P/U는 원본 period/unit 술어 true인 **선언 슬롯 개수**이며 OCR 인식 합격을 뜻하지 않는다. 0 direct typed/token/approved 법률 mapping이라도 원문 보존·검산·역질문·법적 근거 검토를 위해 보관한다.

| # | 정확 canonical ID | 소스 공개문서(원천 슬롯) | datatype / canonical unit | subject / temporal role | P/U | source applicability | 현재 정확 소비 선언 |
|---:|---|---|---|---|---:|---|---|
| 561 | `real_estate_register::ownership_change_text` | real_estate_register (1) | text / not_applicable | document_subject / not_applicable | 0/0 | **미등록** | source-only |
| 562 | `real_estate_register::property_address` | real_estate_register (1) | address / not_applicable | document_subject / not_applicable | 0/0 | **미등록** | source-only |
| 563 | `real_property_register::acquisition_date` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | date / source date format normalized to ISO without loss | owner_registered / effective_date | 4/0 | 등록 | source-only |
| 564 | `real_property_register::issue_date` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | date / source date format normalized to ISO without loss | owner_registered / document_issue_date | 4/0 | 등록 | source-only |
| 565 | `real_property_register::maximum_claim` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | money / currency and exact source unit if monetary | owner_registered / not_applicable | 0/4 | 등록 | source-only |
| 566 | `real_property_register::mortgage_holder` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | party_role / not_applicable | owner_registered / not_applicable | 0/0 | 등록 | source-only |
| 567 | `real_property_register::ownership_share` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | ratio / ratio/fraction as stated | owner_registered / not_applicable | 0/4 | 등록 | source-only |
| 568 | `real_property_register::property_id` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | identifier / not_applicable | owner_registered / not_applicable | 0/0 | 등록 | source-only |
| 569 | `real_property_register::property_type` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | category / not_applicable | owner_registered / not_applicable | 0/0 | 등록 | source-only |
| 570 | `real_property_register::registered_owner` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | party_role / not_applicable | owner_registered / not_applicable | 0/0 | 등록 | source-only |
| 571 | `real_property_register::registered_value` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | money / currency and exact source unit if monetary | owner_registered / not_applicable | 0/4 | 등록 | source-only |
| 572 | `real_property_register::registration_date` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | date / source date format normalized to ISO without loss | owner_registered / registration_effective_date | 4/0 | 등록 | source-only |
| 573 | `real_property_register::release_date` | security_register, real_estate_register, spouse_asset_evidence, inheritance_records (4) | date / source date format normalized to ISO without loss | owner_registered / discharge_effective_date | 4/0 | 등록 | source-only |
| 574 | `real_property_valuation::actual_payoff` | real_estate_valuation (1) | money / currency and exact source unit if monetary | owner_legal / not_applicable | 0/1 | 등록 | source-only |
| 575 | `real_property_valuation::disposal_cost` | real_estate_valuation (1) | money / currency and exact source unit if monetary | owner_legal / not_applicable | 0/1 | 등록 | source-only |
| 576 | `real_property_valuation::market_value` | real_estate_valuation (1) | money / currency and exact source unit if monetary | owner_legal / not_applicable | 0/1 | 등록 | must_reconcile → asset.grossValue |
| 577 | `real_property_valuation::owner` | real_estate_valuation (1) | party_role / not_applicable | owner_legal / not_applicable | 0/0 | 등록 | source-only |
| 578 | `real_property_valuation::ownership_share` | real_estate_valuation (1) | ratio / ratio/fraction as stated | owner_legal / not_applicable | 0/1 | 등록 | source-only |
| 579 | `real_property_valuation::property_id` | real_estate_valuation (1) | identifier / not_applicable | owner_legal / not_applicable | 0/0 | 등록 | source-only |
| 580 | `real_property_valuation::valuation_date` | real_estate_valuation (1) | date / source date format normalized to ISO without loss | owner_legal / valuation_as_of_date | 1/0 | 등록 | source-only |

## 4. 실제 격리 합성시험: #576 material 게이트 18개 반례
- 입력: `lib/material-calculation-source-gate.ts`의 **원본 `auditMaterialCalculatorSources` 함수본문**에서 TS 타입주석만 격리 제거해 V8 `Function`으로 실행, 원본 material 선언 29개(19 must/10 context)를 그대로 사용. `currentFacts`, `createCaseReadIndex`, `moneyValue`, `validSourceRef`는 명시적 합성 스텁. 실 CaseData, 진짜 sourceHash/서명, SQL, `assessment.calculateCase` 및 Node CI를 실행한 것은 아니다.
- 가상 입력은 전부 비고객 데이터. 대표 `F`는 `canonicalFieldId=real_property_valuation::market_value`, `numeric=100`, `sourceState=present`, `subjectId=ASSET-A`, `refs=[valid]`; typed 자산의 `grossValue=100`과 `factIds=[F]`.
- 독립 기대 ↔ 관찰: 미연결 → `CALC_INPUT_UNCONNECTED_MATERIAL`; 정확 1행/동액 → issue 없음; 101원 typed 불일치 → `CALC_INPUT_AMOUNT_MISMATCH`; 같은 F를 자산 두 행에 재사용 → `CALC_INPUT_MULTIPLE_TYPED_MATCHES`; null/not_seen/conflict → `CALC_INPUT_AMOUNT_INVALID`; disputed/rejected/refs 없음/무효 ref → `CALC_INPUT_SOURCE_INVALID`; explicit_none → 관측 목록 제외(issue 없음은 법률상 0 아님); 명시 0 ↔ 0 → issue 없음(법률 승인 아님); context_only `secured_claim_security::actual_payoff`는 context 표시, 미정의 처분비용은 원문 보존 대상. 위 **16/16 분기 독립 기대 일치**.
- **독립 기대 실패 2/18 (P1 조사 후보, 통합 결함 확정 아님):** F의 `subjectId=ASSET-A`인데 같은 `factIds=[F]`·금액100을 가진 typed 자산의 `id=ASSET-B`이면, *증거 대상 불일치 차단 또는 명시 보류*가 안전 기대였다. **실제 격리 material 함수는 `issues=[]`를 반환**했다. `auditMaterialCalculatorSources`는 factId+금액+category를 검사하며 Fact.subjectId ↔ asset.id 대응을 검사하지 않는다. 동일 증거가 서로 다른 **자산 한 행**에 오귀속되는 두 변형 입력의 기대/실제 2건 불일치. 그러나 `asset-resolution.ts`/`assessment.ts` 포함 전체 계산·법률 승인 경로 미실행이므로 제품 최종 청산가치가 잘못 통과했다고 주장하지 않는다. **임의 수정 금지**, 정합성 있는 물건 식별자·권리자·기준일 바인딩 규칙 및 실무자 합의 후 별도 Draft PR/Node 회귀가 필요하다.
- 이와 별개 기존 `tests/material-calculation-source-gate.test.ts`는 금액 누락·중복·상이값의 기본 사례를 담고 있지만, 이번 **부동산 서로 다른 대상의 동일 금액 Fact**를 통한 최종 계산 E2E는 여기서 실행하지 않았다.

## 5. 소비처별 정확 경계 / 후속 조치
1. **증거·SQL/Fact:** `shared-document-catalog.ts` base+supplement, `extraction-row-store.ts`의 `extraction_records/extracted_features/extraction_field_coverage` 및 `domain.ts` Fact 구조를 읽었다. 53 원천 route에 locator/서로 다른 문서·페이지·복수행/당사자/물건/기간 분리 **계약**만 있다. 각 원문 값, 페이지 bbox, 실제 sourceHash 동일성과 typed 링크는 미관찰. #561/#562 미등록 적용조건은 sourceCondition null로 취급하고 증거 삭제/자동 비해당 금지.
2. **계산/검산:** `reference-decision-tables.json`의 asset_liquidation input 9는 `asset.grossValue`, `asset.ownershipBps`, `asset.securedPayoff`, `asset.securedPayoffScope`, `asset.disposalCosts`, `asset.protectedValue`, `asset.asOf`, `asset.valuationBasis`, `context.inventoryComplete.asset`. #576 시가 자료의 1개 must_reconcile 밖에는 direct typed 0. #565 채권최고액 ≠ 실제 상환액 #574; #571 등기기재액 ≠ 평가시가 #576; #575 처분비용, #567/#578 소유지분, #580 평가일도 원천·대상·기간 일치/법률상 인정 전 합산/원화 환산 금지.
3. **법률/서식:** 위험95/규칙50/예외46은 **후보 기준정보 수량**이다. 정확 canonical ID 법률 승인 seed 0, 운영 승인 정책·공식 법원 적용판본/관할/변호사 인정 **미확인**. `reviewScope`의 D5101/D5110은 가족·자산 검토 후보, `OCR_DECLARED_FORM_TARGETS`에는 이번 20 ID exact token 없음. 공식 서식 렌더·법원 보정·갈음 B+C는 실제 등록/수기 승인 결과를 읽지 못함.
4. **자료 요청/갈음·법원 보정:** 원본 `reference-intake-catalog.json`의 등기/담보/배우자/상속/감정 문서 항목과 `approve-document-substitution.ts` 경계는 코드/선언 확인 수준. 실제 직원 요청→원문 회신→갈음 승인→보정명령 서식·접수 E2E 미검증. 누락·conflict/기준일 불일치는 역질문 및 법률 검토용 큐 대상이다.
5. **보존 상태:** unobserved / null / 0 / not_applicable / conflict / source-only / 승인 전은 상호 대체 불가. 고객 개인정보/실제 OCR 사실값/키/.env/비공개 정답 기록 안 함.

## 6. 선택한 보드 A3 5 ID — 모두 `[ ]` 유지
- `A3-IT-003`(IT): 20 canonical, 53 source, 18 계산/91 입력, direct typed 0 / must #576 1, 대상 불일치 material P1 검토 후보 정적/격리 확인; 계산 E2E 미실행.
- `A3-DOC-006`(사용자·서류): 등기·담보·배우자·상속·감정 5종/53슬롯, #561/562 적용조건 미등록, 정확 source-only 보존; 갈음/보정 실건 확인 없음.
- `A3-CALC-007`(계산사무장): 시가/지분/담보채권최고액/실상환/처분비용/평가기준일 독립 의미 및 9입력 계약. material gate V8 16/18, 자산 대상 불일치 반례 2개; 실제 청산가치 수치 계산/법률 인정 미인증.
- `A3-LAW-014`(변호사): 소유권 변경 원문·지분·담보/시가의 인정·청산가치·관할/판본/변호사 검토 0% 승인. source-only 신원·물건 정보 자동 법률 확정 금지.
- `A3-DATA-008`(데이터): 5종 53슬롯의 doc/page/row/subject/property/period anchor 및 noCrossRecordBorrowing 선언 확인, 실제 D1/R2·Fact subject ↔ typed asset 결합 미인증.

## 7. 인수·다음 범위
- 최초 canonical **정적 인덱스 조사 693/693**. 심층 재감사 누적 **580/693 (83.7%)**, 잔여 **113개**. A3 총 124 인수 ID 최종 완료 **0**.
- **다음 시작 #581 `real_property_valuation::valuation_method`**, 다음 범위 **#581–600**, 다음 역할은 **AX담당자**부터 시작한다.
- 원본 함수 격리 합성시험 ≠ 전체 Node 테스트/CI ≠ staging D1·R2/Cron ≠ 법원 공식서식 ≠ 변호사 승인 ≠ 사이트 배포. 미등록·미승인 요건 0% 합격, 0개 소비처 증거 보존·검산·역질문·법률근거 검토. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가확정 수행하지 않음.
