# FirmEngine A3 r63 — canonical OCR #541–560 소비처 심층 재감사 (2026-11-02 KST)

## 1. 판본·선행조사·운영 경계
- 감사 시작 당시 GitHub `main` HEAD: `4938da85df29b2b0a6b33547a4e57915737ed430` (GitHub compare 기준); 허용 수정 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. r62 #521–540 종료 후 **#541–560** 이어서 수행.
- 중앙 기준 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 A3 6역할 미완료 ID 124개를 확인. 이번 순환 **데이터→IT→서류→계산사무장→변호사**, 5개 체크만 부분 감사; AX는 다음 순환 대상으로 유지.
- 선행 동일 구간 최초 정적 조사 `20261031-r28-canonical-541-560-1630KST.md`를 재열람·대조: 기존 20 슬롯/2 source family/must_reconcile 2 확인 후 이번에는 **material 계산 게이트 원본 함수의 11개 합성 실행**을 추가.
- 최근 다른 축 커밋/PR과 Draft PR #149/#153 존재 확인; 다른 에이전트 코드/보드 변경 덮어쓰기 금지. 검수 결과 기록 이외 **제품 코드·운영 DB·배포·전자제출·법원 승인 변경 없음**.
- 고정 원본 blob: index `27ecdddd208de82a2f5c675e7482485e3a8838c2`, family `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`, docs `9decab974e0909ae24ad927bdfe241d75b71f3a9`, applicability `6076b26f782c4643a21a7b2f1a8f6261bb588b68`, material gate `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, projections `60ee5c7762d52b72a165b4f4f8214680eb98f148`. 계산 `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, risk `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`, legal `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`, exceptions `6e51197226bfd8320e1147d8df3f12c11e00927c`.

## 2. 정확한 수치 검증 (정적 기준정보/격리 코드, 실제 운영 영수증 아님)
- index **693/693 unique**, 문서 **85**, family **48**, route **141**, OCR 선언 슬롯 **1808**, 계산 모듈 **18** / 입력 **91**, 법률위험 **95** / 규칙 **50** / 예외 **46**.
- 본 회차 **20/20 canonical**, **20/20 문서×family 슬롯**, 두 문서 `creditor_request_copy`(12)와 `property_ownership_search`(8). 원문 locator anchor **20/20 선언**, 복수행 차용금지/source-only **20/20 선언**, 정확 sourceCondition **20/20 등록**. 실제 문서, 이미지 페이지, quote/bbox, source SHA, D1 Fact **미관찰**.
- 원본 `hasPeriod`/ `hasUnit` TS 술어 각각 20회 격리 실행: 10/20 및 5/20 true; 원본 `canonicalProjectionKey` 9 category ×20 = 180회 격리 호출 **직접 typed 0/20**. 원본 `reviewScope` 2회: private creditor = D5100/D5105/D5106/D5110, property_search = D5101/D5110. **family 기준 검토 후보이며 공식 토큰 아님**.
- `MATERIAL_CALCULATION_SOURCES` 정확 연결 **2/20**, `OCR_DECLARED_FORM_TARGETS` 정확 토큰 **0/20**, 정적 승인형 `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`; 이번 20개 OCR ID의 **정확 승인 법률 매핑 0/20**. 법률 승인·인가 합격률로 승격하지 않음. 운영 기준정보/승인 이력은 미조회.
- 독립 정적 기대/관찰 22/22 계약 불변식 일치(검증 키 index, unique, docs, families, routes, allSlots, calculations, inputs, risks, rules, exceptions, range, nonzero, slots, anchors, borrow, conditions, period, unit, material, exactForms, legalSeedChecks). 정적 선언값 일치율이지 운영 제품 정확도나 법률 적합성 아님.

## 3. #541–560 원본 순서별 원천·대상·기간·소비처
표의 P/U는 원본 기간/단위 술어 true 경로 개수. 원천 보존과 법원 인정·전자접수는 별도 경계.
| # | 정확 canonical ID | 선언 문서 | 타입/단위 | 주체/시간 역할 | P/U | 적용조건 | 계산 전용/대조 |
|---:|---|---|---|---|:---:|---|---|
| 541 | `procedure_private_creditor_request::procedure.creditor_info.as_of_date` | creditor_request_copy | date / not_applicable | creditor / balance_as_of_date | 1/0 | 등록 | 증거전용 |
| 542 | `procedure_private_creditor_request::procedure.creditor_info.claim_id` | creditor_request_copy | string / not_applicable | creditor / not_applicable | 0/0 | 등록 | 증거전용 |
| 543 | `procedure_private_creditor_request::procedure.creditor_info.claim_origin_date` | creditor_request_copy | date / not_applicable | creditor / event_date | 1/0 | 등록 | 증거전용 |
| 544 | `procedure_private_creditor_request::procedure.creditor_info.creditor` | creditor_request_copy | party_role / not_applicable | creditor / not_applicable | 0/0 | 등록 | 증거전용 |
| 545 | `procedure_private_creditor_request::procedure.creditor_info.debtor` | creditor_request_copy | party_role / not_applicable | applicant_debtor / not_applicable | 0/0 | 등록 | 증거전용 |
| 546 | `procedure_private_creditor_request::procedure.creditor_info.interest_balance` | creditor_request_copy | money / KRW | applicant_debtor / source_as_of_date | 1/1 | 등록 | `must_reconcile` → `debt.interest` |
| 547 | `procedure_private_creditor_request::procedure.creditor_info.interest_rate` | creditor_request_copy | decimal_or_text / % | applicant_debtor / source_as_of_date | 1/1 | 등록 | 증거전용 |
| 548 | `procedure_private_creditor_request::procedure.creditor_info.principal_balance` | creditor_request_copy | money / KRW | applicant_debtor / source_as_of_date | 1/1 | 등록 | `must_reconcile` → `debt.principal` |
| 549 | `procedure_private_creditor_request::procedure.creditor_info.principal_original` | creditor_request_copy | money / KRW | applicant_debtor / event_date | 1/1 | 등록 | 증거전용 |
| 550 | `procedure_private_creditor_request::procedure.creditor_info.request_copy` | creditor_request_copy | boolean_or_status / not_applicable | applicant_debtor / not_applicable | 0/0 | 등록 | 증거전용 |
| 551 | `procedure_private_creditor_request::procedure.creditor_info.request_date` | creditor_request_copy | date / not_applicable | applicant_debtor / event_date | 1/0 | 등록 | 증거전용 |
| 552 | `procedure_private_creditor_request::procedure.creditor_info.response_date` | creditor_request_copy | date / not_applicable | applicant_debtor / event_date | 1/0 | 등록 | 증거전용 |
| 553 | `property_search::issue_date` | property_ownership_search | date / source date format normalized to ISO without loss | applicant_debtor / document_issue_date | 1/0 | 등록 | 증거전용 |
| 554 | `property_search::jurisdiction_scope` | property_ownership_search | string / not_applicable | applicant_debtor / not_applicable | 0/0 | 등록 | 증거전용 |
| 555 | `property_search::ownership_share` | property_ownership_search | ratio / ratio/fraction as stated | applicant_debtor / not_applicable | 0/1 | 등록 | 증거전용 |
| 556 | `property_search::property_found` | property_ownership_search | category / not_applicable | applicant_debtor / not_applicable | 0/0 | 등록 | 증거전용 |
| 557 | `property_search::property_id` | property_ownership_search | identifier / not_applicable | applicant_debtor / not_applicable | 0/0 | 등록 | 증거전용 |
| 558 | `property_search::registered_owner` | property_ownership_search | party_role / not_applicable | applicant_debtor / not_applicable | 0/0 | 등록 | 증거전용 |
| 559 | `property_search::search_as_of` | property_ownership_search | date / source date format normalized to ISO without loss | applicant_debtor / search_as_of_date | 1/0 | 등록 | 증거전용 |
| 560 | `property_search::searched_subject` | property_ownership_search | party_role / not_applicable | applicant_debtor / not_applicable | 0/0 | 등록 | 증거전용 |

### 3.1 DB/typed/계산/법률/서식/대체·보정
- `shared-document-catalog.ts`의 base+extension+supplement 및 `extraction_records` / `extracted_features` / `extraction_field_coverage` 경로는 코드·계약 수준 확인. 실제 필드값/문서·페이지·행·표셀·대상자·source_hash·Fact link가 저장되고 재독됐는지는 **미검증**.
- `canonical-field-binding.ts`의 exact typed projection 없음(0/20). #546 이자잔액은 `debt.interest` must_reconcile, #548 현 원금잔액은 `debt.principal` must_reconcile. **두 계약은 계산 사용 승인이나 자동 합산이 아니라 누락 대조 게이트.** 18 모듈/91 선언 입력에서 이 범위 exact 직접 typed path 0/20; 실제 산식 입력·출력 계산 미실행.
- 위험95·법률규칙50·예외46의 `required_features`/family 검토 후보는 **정확 canonical ID의 승인 법률증거 계약과 구분**. seed checks=[]인 상태의 미등록·미승인 요건은 0% 승인, 사람이 법원·시행일·출처·입증력을 검토해야 함.
- `ocr-chain-matrix.ts` exact form token 0/20; 위 D5100/D5105/D5106/D5110/D5101은 `reviewScope` 후보. 공식 Word·e-form 출력·서식 토큰 검증, 전자제출, 법원 수리는 미인증.
- 사인채권 `creditor_request_copy`는 공개 문서 하나에서 `debt_certificate` 및 `procedure_private_creditor_request` **2 family 허용**. 발급 곤란/청구서 사본/회신/대체 B+C는 `reference-intake-catalog.json` 서류 요구와 `approve-document-substitution.ts` 인적 승인 경계가 존재하지만 실제 사건 승인·갈음·법원보정 E2E는 미관찰. 두 family가 같은 채권/원금이라고 자동 추정해 중복 산입하지 않음.
- #553~560 부동산 조회는 조회대상·관할·검색 범위·검색기준일·문서발급일·명의자·물건행·지분을 분리. #556 `property_found`의 범위 내 none/not clear와 전체 자산 부존재·청산가치 0원은 **동치가 아님**. `property_search::ownership_share`(ratio)는 분수 원문 단위 보존 후 법률상 소유권 검토 필요.

## 4. 실제 실행한 원본 material 게이트 분기 합성 시험 — 11/11
- 입력: GitHub main `material-calculation-source-gate.ts`의 `auditMaterialCalculatorSources` **원본 함수본문**, TS 타입주석 제거 후 V8 격리 실행. 29개 material 정의를 동일 원본 상수에서 추출. `currentFacts`/`createCaseReadIndex`·금액 파서·sourceRef 검사는 단순 합성 스텁으로 주입, 실제 CaseData 전체, D1·Node CI, 실용 숫자 파서는 실행하지 않았음.
| 인공 입력(모두 고객 데이터 아님) | 독립 기대 | 관찰 |
|---|---|---|
| #548 금액 100 / verified source / typed 채무행 없음 | UNCONNECTED_MATERIAL | `CALC_INPUT_UNCONNECTED_MATERIAL` |
| #546 이자 20 / verified source / typed 행 없음 | UNCONNECTED_MATERIAL | `CALC_INPUT_UNCONNECTED_MATERIAL` |
| #548 100, #546 20 / 각각 하나의 정확 debt typed 행 | 경고 없음 | 경고 없음 |
| #548 원천 Fact 한 건을 서로 다른 debt 행 2개에 재사용 | MULTIPLE_TYPED_MATCHES | `CALC_INPUT_MULTIPLE_TYPED_MATCHES` |
| #548 원천 100 / typed 원금 101 | AMOUNT_MISMATCH | `CALC_INPUT_AMOUNT_MISMATCH` |
| #548 원천 상태 not_seen, 숫자 null | AMOUNT_INVALID | `CALC_INPUT_AMOUNT_INVALID` |
| #548 원천 100, Fact state disputed | SOURCE_INVALID | `CALC_INPUT_SOURCE_INVALID` |
| #548 sourceState explicit_none | 조정 대상 제외(0원으로 추정 불가) | material issue 없음, observedIds 미포함 |
| #549 최초원금만 관찰(원천 보존) | material 미정의 → 경고 없음 | 경고 없음 |
| #556 부동산 조회 결과만 관찰 | material 미정의 → 경고 없음 | 경고 없음 |
| #548 원천 숫자 0 / debt typed 행 0, 정상 source | 비교 일치, 별도 법률승인 아님 | material issue 없음 |

**판정:** 독립 기대·관찰 **11/11 일치(격리 함수의 제어흐름 한정)**. 기본 계산 아키텍처의 `must_reconcile` 누락 및 중복 연결 게이트가 합성 입력에서 동작함을 확인했으나, source verifier/금액파서/DB/실제 법률 판본은 미인증. 특히 issue 없음은 `sourceState explicit_none` / 미등록 원천 / 법률승인을 의미하지 않음.

## 5. 위험과 미인증 갭 (모두 인수 [ ] 유지)
1. **P2 — 원천 대조 필수 2개와 직접 typed 자동 변환 0:** #546/#548이 실제 Fact로 관측되면 검증 채무행의 단일 factId 결속을 요구. 없을 때 격리 함수는 UNCONNECTED를 반환한다. 재현한 건 **미연결 차단 로직**, 실제 제품의 원금·이자 오류 확정은 아님. 회신자료가 아닌 요청서 사본만으로 잔액 자동확정·채권자 분류·합산 금지.
2. **P2 — 같은 공개 문서의 서로 다른 추출 family:** `creditor_request_copy`는 debt_certificate와 procedure_private_creditor_request를 동시에 허용. 서로 다른 정규화 ID/회신유무·계약번호·채권자·기준일을 대조하고 중복 채무행 여부 검산; 법원 규정상 갈음 요건, 대체 사유, 직원/변호사 인가·법원 제출은 인간 승인 전.
3. **P2 — 부동산 음성 조회 결과의 범위 밖 오해:** 조회 범위 내 '없음'은 신청인 모든 자산 없음이 아니다. 공유지분 `ratio`를 원화 금액으로 더하거나 0원으로 승격하지 않음. 대상자·물건·페이지·원문·기간을 역질문 대상으로 남김.
4. **미승인 0%:** 법률위험 95·규칙50·예외46 및 공식서식의 exact 승인 계약/실승인과 각 OCR source 검증은 미인증. 원문 상태 (미관찰/null/명시0/비해당/상충)와 source-only를 별도 보존, 자동 폐기 금지.

## 6. A3 역할별 중앙 보드 부분 검증, 모두 `[ ]`
- `A3-DATA-008`: 두 서류×20 슬롯의 채권자/채무자/계약 ID/문서SHA·페이지·행 및 부동산 owner/item/지분 격리 선언을 조회. 실제 SQL record 동형성·복수행 교차 차용 D1 E2E 미실행.
- `A3-IT-002`: 20 ID의 source/typed/material/legal/form/갈음/보정 exact 소비처 대조. 2 material 대조 외 direct typed/form/legal 승인 0; 코드 격리 및 정적 경계만 검증.
- `A3-DOC-004`: 사인채권 `creditor_request_copy` 12 source ID, 두 family, 발급곤란 자료/청구·회신·대체 B+C 승인경계 확인. 서류직원 승인·법원보정/제출 실제 건 미확인.
- `A3-CALC-005`: #546 이자, #548 현원금과 #549 최초원금, #547 이율의 다른 의미 보존. material gate 원본 함수 11/11 합성 일치, 실제 18개 계산 및 채권총액 미실행.
- `A3-LAW-004`: 사인채권 권리자·회신/요청서 갈음 증빙, 기간·관할·시행일·성실성 검토는 승인 계약 부재(0%); 실제 실무 변호사 승인 미인증.

## 7. 인수·다음 시작
- 정적 최초 전체 조사: 693/693. 심층 재감사 누적 **560/693 (80.8%)**, 잔여 **133개**. 전체 A3 체크 ID 124개, 최종 인수 `[x]` **0개**.
- 다음 canonical **#561 `real_estate_register::ownership_change_text`**부터 **#561–580**. 역할 **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터** 순환 권고. Draft PR 별도 검수, main 제품 로직 미수정.
- 정적 코드 확인 ≠ 이 격리 합성시험 ≠ 전체 Node CI ≠ staging D1/R2/Cron ≠ 공식 법원 Word/e-form ≠ 변호사 승인 ≠ 사이트 배포. 운영 배포, 운영 D1 마이그레이션, 실제 전자제출, 법원 인가확정 모두 수행하지 않음.
