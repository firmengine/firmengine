# FirmEngine A3 r112 — canonical OCR #411–420 임대차·소송 원천/소비처 독립감사 (2026-11-04 04:25 KST)

## 범위, 권한, 증거
- 시작 main HEAD `ea86a3ed14ea7078077d23027e506ae324949209`; 이전 r111 #401–410 영수증과 중앙 보드(A3 체크목록 124개)를 확인하고 최신 인덱스 #411–420 10개/65 슬롯/9서류를 직접 재조인. `ea86a3ed14ea7078077d23027e506ae324949209`는 초기 조회와 다름: 원천은 고정 SHA af1e582ad406e7e056586a94d525ef99ef4675af에서 읽음.
- 이전 확인 PR #227(최근 A2, Draft), #51(기간 false blocker, Draft), #131(건보 자산 후보 false positive, Draft), #169(OCR 형식검사 확장, Draft) 분리; 기능 의미 변경과 중복 PR 임의 병합 금지.
- 이번 역할 순환: **계산사무장 → 변호사 → 데이터담당자 → IT담당자 → 사용자·서류담당자 → AX담당자**; 중앙 보드 관련 5개 `A3-CALC-008`, `A3-LAW-003`, `A3-DATA-008`, `A3-IT-007`, `A3-DOC-011`만 부분 갱신, 모두 [ ] 유지. AX담당자 관점의 자유값·미승인 자동승격은 종합점검으로 기록하되 별도 체크 완료 처리 없음.
- 검증수준: **원본 JSON 계약의 실제 85×48 라우트 조인**, **원본 TS 함수 본문을 TypeScript 표기만 제거해 V8 동기 실행**, 독립 기대 반환값 대조. `normalizeMoney`는 KRW 정수만 exact 처리하는 **합성 stub**이며 Node 네이티브 프로젝트 런/전체 CI 아님.
- 개인정보·실제 OCR 원문·R2 파일·D1 운영 data/Fact/typed·공식 서식 파일·법률 실무자 승인/법원 결정 미열람, 미인증. 운영 배포·D1 운영 마이그레이션·전자제출은 하지 않음.

## 정적 계약 및 스키마 검증 — 실제 기대/관찰
26개 비교. 선언된 source anchors는 문서·페이지·bbox·quote·hash **필요조건의 코드 존재**이지 원문 진실성이나 실저장 검증 아님.

| 검증 항목 | 독립 기대 | 관찰 | 판정 |
|---|---:|---:|---|
| canonical | 693 | 693 | PASS |
| uniqueCanonical | 693 | 693 | PASS |
| sorted | true | true | PASS |
| docs | 85 | 85 | PASS |
| families | 48 | 48 | PASS |
| sourceSlots | 1808 | 1808 | PASS |
| routedUnique | 693 | 693 | PASS |
| collisions | 0 | 0 | PASS |
| orphan | 0 | 0 | PASS |
| missing | 0 | 0 | PASS |
| calculators | 18 | 18 | PASS |
| inputDeclarations | 91 | 91 | PASS |
| uniqueInputs | 78 | 78 | PASS |
| risk | 95 | 95 | PASS |
| legalRules | 50 | 50 | PASS |
| exceptions | 46 | 46 | PASS |
| a3Checklist | 124 | 124 | PASS |
| a3Checked | 0 | 0 | PASS |
| targetIds | 10 | 10 | PASS |
| targetSlots | 65 | 65 | PASS |
| distinctDocTypes | 9 | 9 | PASS |
| anchorDeclarations | 65 | 65 | PASS |
| recordNoBorrow | 65 | 65 | PASS |
| applicability | 10 | 10 | PASS |
| tests | 53 | 53 | PASS |
| matching | 53 | 53 | PASS |

- `canonical-field-id-index.json`: 693 ID, 실제 인덱스 원본의 순서 그대로 하단 **693개 전체 열거**.
- `document-agent-field-contracts.json` 48개 패밀리 + `shared-document-field-contracts.json` 85개 서류별 라우트 + `ocr-field-supplements.json` join. `lease_housing` 9×7=63 슬롯, `litigation_enforcement::case_id` 2 슬롯, 총 **65 슬롯/9 서류**.
- `field-applicability-contracts.json`: 이번 10개 모두 개별 계약 `source_conditional`. **등록≠법률상 적용승인**; 승인 0건/미인증.
- `module-contracts.generated.json`: 18계산·91 선언(78 고유). 본 10개는 `canonical-field-binding.ts`에서 직접 typed 경로 0개, `material-calculation-source-gate.ts`에 exact material 0개, `ocr-chain-matrix.ts` 내부 정확 form/calc 0개. **소비처 0 = 무용/삭제 아님**.
- `risk-catalog.json` 95, `legal-catalog.json` rules 50, `legal-exceptions.json` 46에서 10개 exact canonical ID 문자열 조인 0. `legal-evidence-criteria.ts` seed checks=[] 확인. 운영 editable 정책 미조회→**법률상 증거승인 0건 확인이 아니라 미인증**. 규칙·예외의 의미상 후보와 정확 소비처 구별.
- `db/schema.ts` `extracted_features`에 `canonical_field_id/raw_value_json/source_state/quote/bbox_json/projection_key`; `feature-lineage-audit.ts`의 document_id/page/record_ordinal/field_ordinal/source_sha256 선언은 존재. SQL 실제 저장·재읽기 없음.
- `document-substitution.ts`의 사실·기간·지문/원본해시 B+C 갈음 검증, `preapproval-correction-item-store.ts`의 requiredCanonicalFieldIds 경로는 코드 존재 수준; 이번 10개로 실제 갈음·법원보정·서식토큰 도달은 확인 안 됨.
- `tests/feature-lineage-audit.test.ts`, `tests/ocr-calculator-input-integration.test.ts`, `tests/material-calculation-source-gate.test.ts`, `tests/ocr-chain-matrix.test.ts`의 존재·시험 범위 읽음. 테스트 코드 존재 ≠ 본 회차 전체 Node 실행.

## #411–420 개별 증거/DB/계산/법률/서식 소비처·공백 (65 슬롯)
- 임대차 가족 공유 7문서: `operating_expenses`, `rental_income_contract`, `vehicle_lease_contract`, `lease_contract`, `deposit_rights`, `free_residence_confirmation`, `housing_expense_evidence`.
- 소송·집행 #420 2문서: `litigation_record`, `receivable_collectability`. 모든 개별 원천은 document/page/row/unit/period/subject 필요계약; **실제 문서/페이지/복수행은 0건 관찰**.
- source-only = 원문 증거·중복 검산·누락 역질문·법률근거 대기 경로. 0, null, 미관찰, explicit_none, 상충, 비해당, 승인전 별도 기록; 자동 원화 합산/자산·채무 승격 금지.

| # | 정확 canonical ID | 문서(슬롯) | 값 유형 / 단위 | 원천 대상 / 기간역할 | 적용조건 | 정적 직접 소비처 | 검산/역질문/미인증 |
|---:|---|---|---|---|---|---|---|
| 411 | `lease_housing::monthly_rent` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | money / currency and exact source unit if monetary | tenant / not_applicable | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 월세액은 임차인의 지급의무와 임대인의 임대수입이 다를 수 있다. vehicle_lease_contract도 포함하므로 자산·영업비 혼동 금지. 지급자·수취인·계약기간·원통화 확인. |
| 412 | `lease_housing::period_end` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | date / source date format normalized to ISO without loss | tenant / statement_period_end | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 임대차 종료일. #413 시작일 및 갱신·해지의 기간과 쌍검증, 증빙 발급일과 구별. |
| 413 | `lease_housing::period_start` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | date / source date format normalized to ISO without loss | tenant / statement_period_start | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 임대차 시작일. 종료일 #412보다 늦은 합성 반례를 local 검사에서 차단하지 않음. |
| 414 | `lease_housing::property_id` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | identifier / not_applicable | tenant / not_applicable | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 부동산/차량 등 계약 물건식별자를 신청인 소유 재산 ID로 승격하지 않음. 세대/호수·문서 복수행 분리. |
| 415 | `lease_housing::renewal_status` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | category / not_applicable | tenant / not_applicable | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 갱신/연장 상태 category, 유효시점·갱신계약·해지 원문 확인. 임의 enum local 허용. |
| 416 | `lease_housing::secured_balance` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | money / currency and exact source unit if monetary | tenant / not_applicable | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 담보잔액은 채권최고액·현재 상환액·보증금 공제액과 다름. #408 보증금에서 자동차감/중복회계 금지. |
| 417 | `lease_housing::security_assignment` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | category / not_applicable | tenant / not_applicable | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 반환채권 양도·질권설정 등 권리관계 category. 계약서·통지·등록/승인효력 및 권리자/시점 확인; 임의 enum local 허용. |
| 418 | `lease_housing::tenant` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | party_role / not_applicable | tenant / not_applicable | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 임차인 인명·법인/피성년 등 당사자 식별. 신청인 본인과 동일하다고 가정하지 않음. |
| 419 | `lease_housing::use` | 7, operating_expenses, rental_income_contract, vehicle_lease_contract, lease_contract, deposit_rights, free_residence_confirmation, housing_expense_evidence | category / not_applicable | tenant / not_applicable | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 사용목적 category: 주거/영업/차량 임차 구분; 차량/사업경비와 임차보증금 법률영역 혼용 경계. 임의 enum local 허용. |
| 420 | `litigation_enforcement::case_id` | 2, litigation_record, receivable_collectability | identifier / not_applicable | applicant_debtor / not_applicable | source_conditional | source-only; direct typed 0, material 0, OCR form 0, exact 법률 0 | 소송·집행 사건번호. 회생 사건 ID/채권자 ID와 분리; 법원/당사자/집행금·결정일·확정상태 등 다른 사실로 증명 필요. |

## 원본 `calculationSourceCellIssues()` V8 동기 격리 — 53/53 기존 반환 재현
- 원본 `lib/ocr-calculation-input.ts` blob `8f7f51bf41f7c944b76419d7cc894e49ac771473`의 실제 `validDate`/`validTime`/`calculationSourceCellIssues`를 함수형 실행. 손댄 것은 타입 구문 및 외부 정규화 stub뿐. 기준은 독립 작성된 **기존 코드 분기 예상 반환**이므로 제품 안전성 PASS가 아니다.
- 외부 업무상 기대 차이: (1) #413 시작 2026-12-01 > #412 종료 2026-01-01은 같은 계약이라면 기간 상충 **HOLD 필요**, 실제 로컬 두 검사 모두 []. (2) #411·#416 quote USD / unit KRW는 출처/정규화 불일치 **검토 필요**, 로컬 []; (3) #415/#417/#419 UNKNOWN_CATEGORY_VALUE도 로컬 []; (4) #411/#416 음수 KRW는 로컬 통과하나 마이너스 경비/환급 등 맥락 분리 필요. 다른 상위 게이트가 차단하는지는 **미관찰**.
- `sourceState=unknown`+null은 오류 []로 반환하는 현행 함수 동작을 관찰. 이를 실제 값=0이나 적용 불필요로 간주 금지.

| 번호 | canonical ID | 합성 시나리오 | 입력 JSON | 기존 코드 독립 기대 | 실제 반환 | 판정 |
|---:|---|---|---|---|---|---|
| 1 | `lease_housing::monthly_rent` | baseline | `{"value":"100","unit":"KRW","quote":"100","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 2 | `lease_housing::monthly_rent` | quote_missing | `{"value":"100","unit":"KRW","quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 3 | `lease_housing::monthly_rent` | present_null | `{"value":null,"unit":"KRW","quote":"100","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 4 | `lease_housing::monthly_rent` | unobserved_null | `{"value":null,"unit":"KRW","quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 5 | `lease_housing::monthly_rent` | unit_missing | `{"value":"100","unit":null,"quote":"100","sourceState":"present"}` | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | reproduced |
| 6 | `lease_housing::monthly_rent` | quote_USD_vs_unit_KRW | `{"value":"100","unit":"KRW","quote":"100 USD","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 7 | `lease_housing::monthly_rent` | negative_exact_amount | `{"value":"-100","unit":"KRW","quote":"-100 KRW","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 8 | `lease_housing::period_end` | baseline | `{"value":"2026-05-04","unit":null,"quote":"2026-05-04","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 9 | `lease_housing::period_end` | quote_missing | `{"value":"2026-05-04","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 10 | `lease_housing::period_end` | present_null | `{"value":null,"unit":null,"quote":"2026-05-04","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 11 | `lease_housing::period_end` | unobserved_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 12 | `lease_housing::period_end` | impossible_date | `{"value":"2026-02-30","unit":null,"quote":"2026-02-30","sourceState":"present"}` | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | reproduced |
| 13 | `lease_housing::period_start` | baseline | `{"value":"2026-05-04","unit":null,"quote":"2026-05-04","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 14 | `lease_housing::period_start` | quote_missing | `{"value":"2026-05-04","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 15 | `lease_housing::period_start` | present_null | `{"value":null,"unit":null,"quote":"2026-05-04","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 16 | `lease_housing::period_start` | unobserved_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 17 | `lease_housing::period_start` | impossible_date | `{"value":"2026-02-30","unit":null,"quote":"2026-02-30","sourceState":"present"}` | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | reproduced |
| 18 | `lease_housing::property_id` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 19 | `lease_housing::property_id` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 20 | `lease_housing::property_id` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 21 | `lease_housing::property_id` | unobserved_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 22 | `lease_housing::renewal_status` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 23 | `lease_housing::renewal_status` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 24 | `lease_housing::renewal_status` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 25 | `lease_housing::renewal_status` | unobserved_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 26 | `lease_housing::renewal_status` | unregistered_category | `{"value":"UNKNOWN_CATEGORY_VALUE","unit":null,"quote":"UNKNOWN_CATEGORY_VALUE","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 27 | `lease_housing::secured_balance` | baseline | `{"value":"100","unit":"KRW","quote":"100","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 28 | `lease_housing::secured_balance` | quote_missing | `{"value":"100","unit":"KRW","quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 29 | `lease_housing::secured_balance` | present_null | `{"value":null,"unit":"KRW","quote":"100","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 30 | `lease_housing::secured_balance` | unobserved_null | `{"value":null,"unit":"KRW","quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 31 | `lease_housing::secured_balance` | unit_missing | `{"value":"100","unit":null,"quote":"100","sourceState":"present"}` | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | reproduced |
| 32 | `lease_housing::secured_balance` | quote_USD_vs_unit_KRW | `{"value":"100","unit":"KRW","quote":"100 USD","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 33 | `lease_housing::secured_balance` | negative_exact_amount | `{"value":"-100","unit":"KRW","quote":"-100 KRW","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 34 | `lease_housing::security_assignment` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 35 | `lease_housing::security_assignment` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 36 | `lease_housing::security_assignment` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 37 | `lease_housing::security_assignment` | unobserved_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 38 | `lease_housing::security_assignment` | unregistered_category | `{"value":"UNKNOWN_CATEGORY_VALUE","unit":null,"quote":"UNKNOWN_CATEGORY_VALUE","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 39 | `lease_housing::tenant` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 40 | `lease_housing::tenant` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 41 | `lease_housing::tenant` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 42 | `lease_housing::tenant` | unobserved_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 43 | `lease_housing::use` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 44 | `lease_housing::use` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 45 | `lease_housing::use` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 46 | `lease_housing::use` | unobserved_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 47 | `lease_housing::use` | unregistered_category | `{"value":"UNKNOWN_CATEGORY_VALUE","unit":null,"quote":"UNKNOWN_CATEGORY_VALUE","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 48 | `litigation_enforcement::case_id` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 49 | `litigation_enforcement::case_id` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | reproduced |
| 50 | `litigation_enforcement::case_id` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | reproduced |
| 51 | `litigation_enforcement::case_id` | unobserved_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | reproduced |
| 52 | `lease_housing::period_start` | reversed_start | `{"value":"2026-12-01","unit":null,"quote":"2026-12-01","sourceState":"present"}` | `[]` | `[]` | reproduced |
| 53 | `lease_housing::period_end` | reversed_end | `{"value":"2026-01-01","unit":null,"quote":"2026-01-01","sourceState":"present"}` | `[]` | `[]` | reproduced |

## A3 6역할 체크 ID — 최신 보드 순서 그대로 (124개)
- A3-CALC-008; A3-LAW-003; A3-DATA-008; A3-IT-007; A3-DOC-011 5개 부분 관찰. 체크박스 완료 **0/124**, 모든 법률/서식 승인 전 0% 인수. 각 ID의 완료 기준은 전체 사건 실증·정책/법률 검토가 남아 있으므로 [ ] 유지.

| 순번 | 체크 ID | 보드 현재 상태 |
|---:|---|---|
| 1 | `A3-IT-001` | [ ] |
| 2 | `A3-IT-002` | [ ] |
| 3 | `A3-IT-003` | [ ] |
| 4 | `A3-IT-004` | [ ] |
| 5 | `A3-IT-005` | [ ] |
| 6 | `A3-IT-006` | [ ] |
| 7 | `A3-IT-007` | [ ] |
| 8 | `A3-IT-008` | [ ] |
| 9 | `A3-IT-009` | [ ] |
| 10 | `A3-IT-010` | [ ] |
| 11 | `A3-IT-011` | [ ] |
| 12 | `A3-IT-012` | [ ] |
| 13 | `A3-IT-013` | [ ] |
| 14 | `A3-IT-014` | [ ] |
| 15 | `A3-IT-015` | [ ] |
| 16 | `A3-IT-016` | [ ] |
| 17 | `A3-IT-017` | [ ] |
| 18 | `A3-IT-018` | [ ] |
| 19 | `A3-IT-019` | [ ] |
| 20 | `A3-IT-020` | [ ] |
| 21 | `A3-DOC-001` | [ ] |
| 22 | `A3-DOC-002` | [ ] |
| 23 | `A3-DOC-003` | [ ] |
| 24 | `A3-DOC-004` | [ ] |
| 25 | `A3-DOC-005` | [ ] |
| 26 | `A3-DOC-006` | [ ] |
| 27 | `A3-DOC-007` | [ ] |
| 28 | `A3-DOC-008` | [ ] |
| 29 | `A3-DOC-009` | [ ] |
| 30 | `A3-DOC-010` | [ ] |
| 31 | `A3-DOC-011` | [ ] |
| 32 | `A3-DOC-012` | [ ] |
| 33 | `A3-DOC-013` | [ ] |
| 34 | `A3-DOC-014` | [ ] |
| 35 | `A3-DOC-015` | [ ] |
| 36 | `A3-DOC-016` | [ ] |
| 37 | `A3-DOC-017` | [ ] |
| 38 | `A3-DOC-018` | [ ] |
| 39 | `A3-DOC-019` | [ ] |
| 40 | `A3-DOC-020` | [ ] |
| 41 | `A3-CALC-001` | [ ] |
| 42 | `A3-CALC-002` | [ ] |
| 43 | `A3-CALC-003` | [ ] |
| 44 | `A3-CALC-004` | [ ] |
| 45 | `A3-CALC-005` | [ ] |
| 46 | `A3-CALC-006` | [ ] |
| 47 | `A3-CALC-007` | [ ] |
| 48 | `A3-CALC-008` | [ ] |
| 49 | `A3-CALC-009` | [ ] |
| 50 | `A3-CALC-010` | [ ] |
| 51 | `A3-CALC-011` | [ ] |
| 52 | `A3-CALC-012` | [ ] |
| 53 | `A3-CALC-013` | [ ] |
| 54 | `A3-CALC-014` | [ ] |
| 55 | `A3-CALC-015` | [ ] |
| 56 | `A3-CALC-016` | [ ] |
| 57 | `A3-CALC-017` | [ ] |
| 58 | `A3-CALC-018` | [ ] |
| 59 | `A3-CALC-019` | [ ] |
| 60 | `A3-CALC-020` | [ ] |
| 61 | `A3-LAW-001` | [ ] |
| 62 | `A3-LAW-002` | [ ] |
| 63 | `A3-LAW-003` | [ ] |
| 64 | `A3-LAW-004` | [ ] |
| 65 | `A3-LAW-005` | [ ] |
| 66 | `A3-LAW-006` | [ ] |
| 67 | `A3-LAW-007` | [ ] |
| 68 | `A3-LAW-008` | [ ] |
| 69 | `A3-LAW-009` | [ ] |
| 70 | `A3-LAW-010` | [ ] |
| 71 | `A3-LAW-011` | [ ] |
| 72 | `A3-LAW-012` | [ ] |
| 73 | `A3-LAW-013` | [ ] |
| 74 | `A3-LAW-014` | [ ] |
| 75 | `A3-LAW-015` | [ ] |
| 76 | `A3-LAW-016` | [ ] |
| 77 | `A3-LAW-017` | [ ] |
| 78 | `A3-LAW-018` | [ ] |
| 79 | `A3-LAW-019` | [ ] |
| 80 | `A3-LAW-020` | [ ] |
| 81 | `A3-LAW-021` | [ ] |
| 82 | `A3-LAW-022` | [ ] |
| 83 | `A3-DATA-001` | [ ] |
| 84 | `A3-DATA-002` | [ ] |
| 85 | `A3-DATA-003` | [ ] |
| 86 | `A3-DATA-004` | [ ] |
| 87 | `A3-DATA-005` | [ ] |
| 88 | `A3-DATA-006` | [ ] |
| 89 | `A3-DATA-007` | [ ] |
| 90 | `A3-DATA-008` | [ ] |
| 91 | `A3-DATA-009` | [ ] |
| 92 | `A3-DATA-010` | [ ] |
| 93 | `A3-DATA-011` | [ ] |
| 94 | `A3-DATA-012` | [ ] |
| 95 | `A3-DATA-013` | [ ] |
| 96 | `A3-DATA-014` | [ ] |
| 97 | `A3-DATA-015` | [ ] |
| 98 | `A3-DATA-016` | [ ] |
| 99 | `A3-DATA-017` | [ ] |
| 100 | `A3-DATA-018` | [ ] |
| 101 | `A3-DATA-019` | [ ] |
| 102 | `A3-DATA-020` | [ ] |
| 103 | `A3-DATA-021` | [ ] |
| 104 | `A3-DATA-022` | [ ] |
| 105 | `A3-AX-001` | [ ] |
| 106 | `A3-AX-002` | [ ] |
| 107 | `A3-AX-003` | [ ] |
| 108 | `A3-AX-004` | [ ] |
| 109 | `A3-AX-005` | [ ] |
| 110 | `A3-AX-006` | [ ] |
| 111 | `A3-AX-007` | [ ] |
| 112 | `A3-AX-008` | [ ] |
| 113 | `A3-AX-009` | [ ] |
| 114 | `A3-AX-010` | [ ] |
| 115 | `A3-AX-011` | [ ] |
| 116 | `A3-AX-012` | [ ] |
| 117 | `A3-AX-013` | [ ] |
| 118 | `A3-AX-014` | [ ] |
| 119 | `A3-AX-015` | [ ] |
| 120 | `A3-AX-016` | [ ] |
| 121 | `A3-AX-017` | [ ] |
| 122 | `A3-AX-018` | [ ] |
| 123 | `A3-AX-019` | [ ] |
| 124 | `A3-AX-020` | [ ] |

## Canonical OCR 전체 등록 ID — 최신 index 원본 순서 (693개)
| 순번 | canonical ID |
|---:|---|
| 1 | `account_garnishment::account_holder` |
| 2 | `account_garnishment::account_id` |
| 3 | `account_garnishment::court_or_authority` |
| 4 | `account_garnishment::creditor` |
| 5 | `account_garnishment::effective_date` |
| 6 | `account_garnishment::garnishment_amount` |
| 7 | `account_garnishment::issue_date` |
| 8 | `account_garnishment::released_amount` |
| 9 | `account_garnishment::seized_amount` |
| 10 | `account_garnishment::status` |
| 11 | `accounting_source::account_name` |
| 12 | `accounting_source::closing_balance` |
| 13 | `accounting_source::credits` |
| 14 | `accounting_source::debits` |
| 15 | `accounting_source::entity` |
| 16 | `accounting_source::issue_date` |
| 17 | `accounting_source::opening_balance` |
| 18 | `accounting_source::period_end` |
| 19 | `accounting_source::period_start` |
| 20 | `accounting_source::source_total` |
| 21 | `applicant_narrative_statement::identity.statement.admission_or_correction` |
| 22 | `applicant_narrative_statement::identity.statement.author` |
| 23 | `applicant_narrative_statement::identity.statement.event_end` |
| 24 | `applicant_narrative_statement::identity.statement.event_start` |
| 25 | `applicant_narrative_statement::identity.statement.narrative_text` |
| 26 | `applicant_narrative_statement::identity.statement.signature_status` |
| 27 | `applicant_narrative_statement::identity.statement.signed_at` |
| 28 | `applicant_narrative_statement::identity.statement.source_references` |
| 29 | `applicant_narrative_statement::identity.statement.statement_version` |
| 30 | `applicant_narrative_statement::identity.statement.topic` |
| 31 | `application_identity_venue::procedure.application.accepted_at` |
| 32 | `application_identity_venue::procedure.application.address` |
| 33 | `application_identity_venue::procedure.application.applicant_name` |
| 34 | `application_identity_venue::procedure.application.case_number` |
| 35 | `application_identity_venue::procedure.application.court` |
| 36 | `application_identity_venue::procedure.application.jurisdiction_exception` |
| 37 | `application_identity_venue::procedure.application.ordinary_venue_basis` |
| 38 | `application_identity_venue::procedure.application.phone_home` |
| 39 | `application_identity_venue::procedure.application.phone_mobile` |
| 40 | `application_identity_venue::procedure.application.phone_work` |
| 41 | `application_identity_venue::procedure.application.resident_id` |
| 42 | `application_identity_venue::procedure.application.ruleset_id` |
| 43 | `application_identity_venue::procedure.application.submitted_at` |
| 44 | `application_identity_venue::procedure.application.transition_rule` |
| 45 | `application_identity_venue::procedure.application_date` |
| 46 | `application_identity_venue::procedure.venue` |
| 47 | `asset_transfer_disposition::asset_id` |
| 48 | `asset_transfer_disposition::consideration` |
| 49 | `asset_transfer_disposition::market_value` |
| 50 | `asset_transfer_disposition::proceeds_received` |
| 51 | `asset_transfer_disposition::registration_date` |
| 52 | `asset_transfer_disposition::relationship` |
| 53 | `asset_transfer_disposition::review_status` |
| 54 | `asset_transfer_disposition::transaction_date` |
| 55 | `asset_transfer_disposition::transferee` |
| 56 | `asset_transfer_disposition::transferor` |
| 57 | `asset_transfer_disposition::use_of_proceeds` |
| 58 | `bank_account_balance::account_holder` |
| 59 | `bank_account_balance::account_id` |
| 60 | `bank_account_balance::account_status` |
| 61 | `bank_account_balance::balance` |
| 62 | `bank_account_balance::balance_as_of` |
| 63 | `bank_account_balance::currency` |
| 64 | `bank_account_balance::institution` |
| 65 | `bank_account_balance::issue_date` |
| 66 | `bank_transactions::account_id` |
| 67 | `bank_transactions::amount` |
| 68 | `bank_transactions::counterparty` |
| 69 | `bank_transactions::direction` |
| 70 | `bank_transactions::issue_date` |
| 71 | `bank_transactions::memo` |
| 72 | `bank_transactions::period_end` |
| 73 | `bank_transactions::period_start` |
| 74 | `bank_transactions::post_balance` |
| 75 | `bank_transactions::transaction_datetime` |
| 76 | `bank_transactions::transaction_id` |
| 77 | `bank_transactions::transaction_nature` |
| 78 | `business_asset_inventory::acquisition_date` |
| 79 | `business_asset_inventory::book_value` |
| 80 | `business_asset_inventory::condition` |
| 81 | `business_asset_inventory::disposal_restriction` |
| 82 | `business_asset_inventory::goodwill_contract` |
| 83 | `business_asset_inventory::market_value` |
| 84 | `business_asset_inventory::quantity` |
| 85 | `business_asset_inventory::quantity_unit` |
| 86 | `business_assets_liabilities::as_of_date` |
| 87 | `business_assets_liabilities::asset_or_claim_id` |
| 88 | `business_assets_liabilities::business_entity` |
| 89 | `business_assets_liabilities::gross_value` |
| 90 | `business_assets_liabilities::item_kind` |
| 91 | `business_assets_liabilities::ownership_interest` |
| 92 | `business_assets_liabilities::payable_amount` |
| 93 | `business_assets_liabilities::period_end` |
| 94 | `business_assets_liabilities::period_start` |
| 95 | `business_assets_liabilities::receivable_amount` |
| 96 | `business_assets_liabilities::secured_payoff` |
| 97 | `business_costs_and_ledgers::income.business_cost.accounting_basis` |
| 98 | `business_costs_and_ledgers::income.business_cost.business_continuity_flag` |
| 99 | `business_costs_and_ledgers::income.business_cost.business_entity` |
| 100 | `business_costs_and_ledgers::income.business_cost.expense_category` |
| 101 | `business_costs_and_ledgers::income.business_cost.gross_amount` |
| 102 | `business_costs_and_ledgers::income.business_cost.payment_date` |
| 103 | `business_costs_and_ledgers::income.business_cost.payment_status` |
| 104 | `business_costs_and_ledgers::income.business_cost.period_end` |
| 105 | `business_costs_and_ledgers::income.business_cost.period_start` |
| 106 | `business_costs_and_ledgers::income.business_cost.supplier` |
| 107 | `business_costs_and_ledgers::income.business_cost.tax_component` |
| 108 | `business_current_income_summary::income.self_employment.business_costs` |
| 109 | `business_current_income_summary::income.self_employment.contract_end` |
| 110 | `business_current_income_summary::income.self_employment.contract_id` |
| 111 | `business_current_income_summary::income.self_employment.gross_receivable` |
| 112 | `business_current_income_summary::income.self_employment.invoice_date` |
| 113 | `business_current_income_summary::income.self_employment.net_receipt` |
| 114 | `business_current_income_summary::income.self_employment.operator` |
| 115 | `business_current_income_summary::income.self_employment.payer_customer` |
| 116 | `business_current_income_summary::income.self_employment.service_period_end` |
| 117 | `business_current_income_summary::income.self_employment.service_period_start` |
| 118 | `business_current_income_summary::income.self_employment.withheld_tax` |
| 119 | `business_registration::business_entity` |
| 120 | `business_registration::business_id` |
| 121 | `business_registration::business_items` |
| 122 | `business_registration::business_type` |
| 123 | `business_registration::issue_date` |
| 124 | `business_registration::joint_operators` |
| 125 | `business_registration::opening_date` |
| 126 | `business_registration::registration_date` |
| 127 | `business_registration::representative` |
| 128 | `business_registration::status` |
| 129 | `business_sales_vat::income.sales.business_entity` |
| 130 | `business_sales_vat::income.sales.exempt_sales` |
| 131 | `business_sales_vat::income.sales.filing_date` |
| 132 | `business_sales_vat::income.sales.gross_sales` |
| 133 | `business_sales_vat::income.sales.issue_date` |
| 134 | `business_sales_vat::income.sales.reporting_period_end` |
| 135 | `business_sales_vat::income.sales.reporting_period_start` |
| 136 | `business_sales_vat::income.sales.returns_refunds` |
| 137 | `business_sales_vat::income.sales.sales_count` |
| 138 | `business_sales_vat::income.sales.taxable_sales` |
| 139 | `business_sales_vat::income.sales.vat_collected` |
| 140 | `card_statement::billed_amount` |
| 141 | `card_statement::billing_period` |
| 142 | `card_statement::card_product_kind` |
| 143 | `card_statement::installment_count` |
| 144 | `card_statement::merchant` |
| 145 | `card_statement::purchase_amount` |
| 146 | `card_statement::remaining_installments` |
| 147 | `cash_deposit_asset::actual_payoff` |
| 148 | `cash_deposit_asset::as_of_date` |
| 149 | `cash_deposit_asset::asset_id` |
| 150 | `cash_deposit_asset::asset_kind` |
| 151 | `cash_deposit_asset::encumbrance` |
| 152 | `cash_deposit_asset::gross_value` |
| 153 | `cash_deposit_asset::owner` |
| 154 | `cash_deposit_asset::ownership_share` |
| 155 | `cash_deposit_asset::protected_or_excluded_claim` |
| 156 | `cash_deposit_asset::valuation_basis` |
| 157 | `cash_holding_statement::acquisition_source` |
| 158 | `cash_holding_statement::cash_currency` |
| 159 | `cash_holding_statement::declaration_author` |
| 160 | `cash_holding_statement::declaration_date` |
| 161 | `cash_holding_statement::storage_location` |
| 162 | `conditional_case_specific_request::conditional.court_request.case_number` |
| 163 | `conditional_case_specific_request::conditional.court_request.court` |
| 164 | `conditional_case_specific_request::conditional.court_request.item_due` |
| 165 | `conditional_case_specific_request::conditional.court_request.legal_citation` |
| 166 | `conditional_case_specific_request::conditional.court_request.operative_text` |
| 167 | `conditional_case_specific_request::conditional.court_request.request_type` |
| 168 | `conditional_case_specific_request::conditional.court_request.response_deadline` |
| 169 | `conditional_case_specific_request::conditional.court_request.response_filed_at` |
| 170 | `conditional_case_specific_request::conditional.court_request.service_date` |
| 171 | `conditional_case_specific_request::conditional.court_request.status_change` |
| 172 | `conditional_education_childcare::conditional.education.billed_amount` |
| 173 | `conditional_education_childcare::conditional.education.enrollment_end` |
| 174 | `conditional_education_childcare::conditional.education.enrollment_start` |
| 175 | `conditional_education_childcare::conditional.education.fee_type` |
| 176 | `conditional_education_childcare::conditional.education.frequency` |
| 177 | `conditional_education_childcare::conditional.education.paid_amount` |
| 178 | `conditional_education_childcare::conditional.education.payer` |
| 179 | `conditional_education_childcare::conditional.education.provider` |
| 180 | `conditional_education_childcare::conditional.education.recipient` |
| 181 | `conditional_education_childcare::conditional.education.relation` |
| 182 | `conditional_education_childcare::conditional.education.subsidy` |
| 183 | `conditional_medical_expense::conditional.medical.applicant_relation` |
| 184 | `conditional_medical_expense::conditional.medical.billed_cost` |
| 185 | `conditional_medical_expense::conditional.medical.care_period_end` |
| 186 | `conditional_medical_expense::conditional.medical.care_period_start` |
| 187 | `conditional_medical_expense::conditional.medical.expected_recurring_cost` |
| 188 | `conditional_medical_expense::conditional.medical.medical_opinion_period` |
| 189 | `conditional_medical_expense::conditional.medical.paid_cost` |
| 190 | `conditional_medical_expense::conditional.medical.patient` |
| 191 | `conditional_medical_expense::conditional.medical.provider` |
| 192 | `conditional_medical_expense::conditional.medical.reimbursement` |
| 193 | `conditional_medical_expense::conditional.medical.service_date` |
| 194 | `conditional_medical_expense::conditional.medical.service_kind` |
| 195 | `conditional_nonstandard_income_or_household_event::conditional.change.affected_person` |
| 196 | `conditional_nonstandard_income_or_household_event::conditional.change.duration_end` |
| 197 | `conditional_nonstandard_income_or_household_event::conditional.change.effective_date` |
| 198 | `conditional_nonstandard_income_or_household_event::conditional.change.event_date` |
| 199 | `conditional_nonstandard_income_or_household_event::conditional.change.event_kind` |
| 200 | `conditional_nonstandard_income_or_household_event::conditional.change.expense_delta` |
| 201 | `conditional_nonstandard_income_or_household_event::conditional.change.income_delta` |
| 202 | `conditional_nonstandard_income_or_household_event::conditional.change.issuer` |
| 203 | `conditional_nonstandard_income_or_household_event::conditional.change.new_status` |
| 204 | `conditional_nonstandard_income_or_household_event::conditional.change.old_status` |
| 205 | `conditional_plan_funding_source::applicability.form.current_official_version` |
| 206 | `conditional_plan_funding_source::applicability.form.disposition_asset_ids` |
| 207 | `conditional_plan_funding_source::applicability.form.disposition_date` |
| 208 | `conditional_plan_funding_source::applicability.form.disposition_proceeds` |
| 209 | `conditional_plan_funding_source::applicability.form.income_source_evidence_ids` |
| 210 | `conditional_plan_funding_source::applicability.form.plan_source` |
| 211 | `conditional_plan_funding_source::applicability.form.proceeds_to_plan` |
| 212 | `conditional_plan_funding_source::applicability.form.review_status` |
| 213 | `conditional_plan_funding_source::applicability.form.selected_form_code` |
| 214 | `credit_information_report::assignment_event_date` |
| 215 | `credit_information_report::current_reported_creditor` |
| 216 | `credit_information_report::event_record_id` |
| 217 | `credit_information_report::issue_date` |
| 218 | `credit_information_report::previous_creditor` |
| 219 | `credit_information_report::report_as_of` |
| 220 | `credit_information_report::report_subject` |
| 221 | `credit_report::currency_unit` |
| 222 | `credit_report::event_date` |
| 223 | `credit_report::event_kind` |
| 224 | `credit_report::institution` |
| 225 | `credit_report::product_code` |
| 226 | `credit_report::reported_amount` |
| 227 | `credit_report::status` |
| 228 | `creditor_assignment_dispute::assignment_date` |
| 229 | `creditor_assignment_dispute::claim_id` |
| 230 | `creditor_assignment_dispute::claim_status` |
| 231 | `creditor_assignment_dispute::current_claimant` |
| 232 | `creditor_assignment_dispute::dispute_basis` |
| 233 | `creditor_assignment_dispute::disputed_amount` |
| 234 | `creditor_assignment_dispute::notice_date` |
| 235 | `creditor_assignment_dispute::prior_creditor` |
| 236 | `creditor_assignment_dispute::supporting_record` |
| 237 | `crypto_balance::account_owner` |
| 238 | `crypto_balance::asset_symbol` |
| 239 | `crypto_balance::available_quantity` |
| 240 | `crypto_balance::average_acquisition_price` |
| 241 | `crypto_balance::displayed_valuation` |
| 242 | `crypto_balance::exchange_or_wallet` |
| 243 | `crypto_balance::locked_quantity` |
| 244 | `crypto_balance::network` |
| 245 | `crypto_balance::total_quantity` |
| 246 | `crypto_balance::valuation_currency` |
| 247 | `crypto_balance::valuation_datetime` |
| 248 | `crypto_balance::valuation_unit_price` |
| 249 | `crypto_balance::wallet_address` |
| 250 | `crypto_transactions::asset_symbol` |
| 251 | `crypto_transactions::completed_at` |
| 252 | `crypto_transactions::counterparty_account_identity` |
| 253 | `crypto_transactions::crypto_event_kind` |
| 254 | `crypto_transactions::destination_address` |
| 255 | `crypto_transactions::fee_asset` |
| 256 | `crypto_transactions::fee_quantity` |
| 257 | `crypto_transactions::gross_trade_amount` |
| 258 | `crypto_transactions::network` |
| 259 | `crypto_transactions::quantity` |
| 260 | `crypto_transactions::quote_currency` |
| 261 | `crypto_transactions::requested_at` |
| 262 | `crypto_transactions::source_address` |
| 263 | `crypto_transactions::transfer_status` |
| 264 | `crypto_transactions::txid` |
| 265 | `crypto_transactions::unit_price` |
| 266 | `current_nonwage_income::income.other.contract_end` |
| 267 | `current_nonwage_income::income.other.deductions` |
| 268 | `current_nonwage_income::income.other.earning_period_end` |
| 269 | `current_nonwage_income::income.other.earning_period_start` |
| 270 | `current_nonwage_income::income.other.frequency` |
| 271 | `current_nonwage_income::income.other.gross_amount` |
| 272 | `current_nonwage_income::income.other.income_kind` |
| 273 | `current_nonwage_income::income.other.net_received` |
| 274 | `current_nonwage_income::income.other.payer` |
| 275 | `current_nonwage_income::income.other.payment_date` |
| 276 | `current_nonwage_income::income.other.recipient` |
| 277 | `debt_certificate::as_of_date` |
| 278 | `debt_certificate::claim_cause` |
| 279 | `debt_certificate::contract_id` |
| 280 | `debt_certificate::contract_interest_rate` |
| 281 | `debt_certificate::creditor` |
| 282 | `debt_certificate::creditor_address` |
| 283 | `debt_certificate::debtor` |
| 284 | `debt_certificate::fees` |
| 285 | `debt_certificate::interest_balance` |
| 286 | `debt_certificate::issue_date` |
| 287 | `debt_certificate::issuer` |
| 288 | `debt_certificate::original_principal` |
| 289 | `debt_certificate::origination_date` |
| 290 | `debt_certificate::overdue_interest` |
| 291 | `debt_certificate::principal_balance` |
| 292 | `debt_certificate::total_claim` |
| 293 | `divorce_records::actual_support_paid` |
| 294 | `divorce_records::agreement_or_order_date` |
| 295 | `divorce_records::divorce_date` |
| 296 | `divorce_records::former_spouse` |
| 297 | `divorce_records::marriage_date` |
| 298 | `divorce_records::partition_amount` |
| 299 | `divorce_records::partition_asset` |
| 300 | `divorce_records::support_child` |
| 301 | `divorce_records::support_payer` |
| 302 | `divorce_records::support_period` |
| 303 | `divorce_records::support_periodic_amount` |
| 304 | `divorce_records::support_recipient` |
| 305 | `employment_contract::employer_signature_date` |
| 306 | `employment_contract::employer_signature_status` |
| 307 | `employment_history::insurance_scheme` |
| 308 | `employment_history::qualification_acquired` |
| 309 | `employment_history::qualification_lost` |
| 310 | `employment_history::qualification_record_scope` |
| 311 | `employment_history::qualification_type` |
| 312 | `employment_history::qualification_workplace` |
| 313 | `employment_relationship::income.employment.allowance_terms` |
| 314 | `employment_relationship::income.employment.base_wage` |
| 315 | `employment_relationship::income.employment.contract_term` |
| 316 | `employment_relationship::income.employment.employee` |
| 317 | `employment_relationship::income.employment.employer` |
| 318 | `employment_relationship::income.employment.employment_type` |
| 319 | `employment_relationship::income.employment.end_date` |
| 320 | `employment_relationship::income.employment.hours` |
| 321 | `employment_relationship::income.employment.issue_date` |
| 322 | `employment_relationship::income.employment.start_date` |
| 323 | `guarantee_joint_claim::applicant_role` |
| 324 | `guarantee_joint_claim::creditor` |
| 325 | `guarantee_joint_claim::dispute_status` |
| 326 | `guarantee_joint_claim::guarantee_claimed` |
| 327 | `guarantee_joint_claim::guarantee_limit` |
| 328 | `guarantee_joint_claim::principal_debtor` |
| 329 | `guarantee_joint_claim::recourse_status` |
| 330 | `guarantee_joint_claim::underlying_claim_id` |
| 331 | `health_insurance_arrears::as_of_date` |
| 332 | `health_insurance_arrears::authority` |
| 333 | `health_insurance_arrears::disposal_cost` |
| 334 | `health_insurance_arrears::issue_date` |
| 335 | `health_insurance_arrears::late_charge` |
| 336 | `health_insurance_arrears::period_end` |
| 337 | `health_insurance_arrears::period_start` |
| 338 | `health_insurance_arrears::subscriber` |
| 339 | `health_insurance_arrears::total_arrear` |
| 340 | `health_insurance_arrears::unpaid_contribution` |
| 341 | `household_composition_support::household.support.member` |
| 342 | `household_composition_support::household.support.other_income` |
| 343 | `household_composition_support::household.support.relationship` |
| 344 | `household_composition_support::household.support.residence_end` |
| 345 | `household_composition_support::household.support.residence_start` |
| 346 | `household_composition_support::household.support.support_amount` |
| 347 | `household_composition_support::household.support.support_frequency` |
| 348 | `household_composition_support::household.support.support_period_end` |
| 349 | `household_composition_support::household.support.support_period_start` |
| 350 | `household_composition_support::household.support.support_provider` |
| 351 | `household_composition_support::household.support.support_recipient` |
| 352 | `household_living_expense::household.expense.arrears` |
| 353 | `household_living_expense::household.expense.beneficiary` |
| 354 | `household_living_expense::household.expense.billed_amount` |
| 355 | `household_living_expense::household.expense.billing_period_end` |
| 356 | `household_living_expense::household.expense.billing_period_start` |
| 357 | `household_living_expense::household.expense.expense_kind` |
| 358 | `household_living_expense::household.expense.issue_date` |
| 359 | `household_living_expense::household.expense.paid_amount` |
| 360 | `household_living_expense::household.expense.payer` |
| 361 | `household_living_expense::household.expense.provider` |
| 362 | `household_living_expense::household.expense.shared_allocation` |
| 363 | `identity_residence_record::identity.address` |
| 364 | `identity_residence_record::identity.household_members` |
| 365 | `identity_residence_record::identity.issue_date` |
| 366 | `identity_residence_record::identity.marital_status` |
| 367 | `identity_residence_record::identity.name` |
| 368 | `identity_residence_record::identity.record_number` |
| 369 | `identity_residence_record::identity.registration_id` |
| 370 | `identity_residence_record::identity.relationship` |
| 371 | `income_source_inventory::amount_basis` |
| 372 | `income_source_inventory::income_source_id` |
| 373 | `income_source_inventory::reported_expenses` |
| 374 | `income_source_inventory::reported_gross` |
| 375 | `income_source_inventory::reported_net` |
| 376 | `income_source_inventory::source_document_reference` |
| 377 | `income_source_inventory::source_kind` |
| 378 | `inheritance_records::attributed_amount` |
| 379 | `inheritance_records::decedent` |
| 380 | `inheritance_records::disclaimer_or_limited_acceptance` |
| 381 | `inheritance_records::filing_or_order_reference` |
| 382 | `inheritance_records::heir` |
| 383 | `inheritance_records::heir_relationship` |
| 384 | `inheritance_records::inherited_asset_id` |
| 385 | `inheritance_records::partition_agreement_date` |
| 386 | `inheritance_records::stated_share` |
| 387 | `inheritance_records::succession_opened_at` |
| 388 | `insurance_policy_asset::as_of_date` |
| 389 | `insurance_policy_asset::beneficiary` |
| 390 | `insurance_policy_asset::contract_holder` |
| 391 | `insurance_policy_asset::coverage_amount` |
| 392 | `insurance_policy_asset::end_date` |
| 393 | `insurance_policy_asset::insured` |
| 394 | `insurance_policy_asset::insurer` |
| 395 | `insurance_policy_asset::issue_date` |
| 396 | `insurance_policy_asset::pledge` |
| 397 | `insurance_policy_asset::policy_id` |
| 398 | `insurance_policy_asset::policy_loan_balance` |
| 399 | `insurance_policy_asset::policy_status` |
| 400 | `insurance_policy_asset::premium_per_payment` |
| 401 | `insurance_policy_asset::refund_net_basis` |
| 402 | `insurance_policy_asset::start_date` |
| 403 | `insurance_policy_asset::surrender_value` |
| 404 | `insurance_policy_asset::total_premium` |
| 405 | `lease_contract::fixed_date` |
| 406 | `lease_housing::applicant_relation` |
| 407 | `lease_housing::arrears_deduction` |
| 408 | `lease_housing::deposit` |
| 409 | `lease_housing::issue_date` |
| 410 | `lease_housing::landlord` |
| 411 | `lease_housing::monthly_rent` |
| 412 | `lease_housing::period_end` |
| 413 | `lease_housing::period_start` |
| 414 | `lease_housing::property_id` |
| 415 | `lease_housing::renewal_status` |
| 416 | `lease_housing::secured_balance` |
| 417 | `lease_housing::security_assignment` |
| 418 | `lease_housing::tenant` |
| 419 | `lease_housing::use` |
| 420 | `litigation_enforcement::case_id` |
| 421 | `litigation_enforcement::claim_type` |
| 422 | `litigation_enforcement::claimed_amount` |
| 423 | `litigation_enforcement::court_or_authority` |
| 424 | `litigation_enforcement::enforced_amount` |
| 425 | `litigation_enforcement::event_date` |
| 426 | `litigation_enforcement::issue_date` |
| 427 | `litigation_enforcement::judgment_amount` |
| 428 | `litigation_enforcement::parties` |
| 429 | `litigation_enforcement::security_or_attachment` |
| 430 | `litigation_enforcement::status` |
| 431 | `loan_contract::contract_interest_rate` |
| 432 | `loan_contract::maturity_date` |
| 433 | `loan_contract::repayment_installments` |
| 434 | `loan_contract::repayment_method` |
| 435 | `loan_contract::scheduled_payment` |
| 436 | `local_tax::arrears` |
| 437 | `local_tax::as_of_date` |
| 438 | `local_tax::assessed_amount` |
| 439 | `local_tax::authority` |
| 440 | `local_tax::collection_cost` |
| 441 | `local_tax::issue_date` |
| 442 | `local_tax::paid_amount` |
| 443 | `local_tax::surcharge` |
| 444 | `local_tax::tax_base` |
| 445 | `local_tax::tax_period` |
| 446 | `local_tax::tax_type` |
| 447 | `local_tax::taxpayer` |
| 448 | `local_tax_assessment::jurisdiction_scope` |
| 449 | `local_tax_assessment::no_assessment_text` |
| 450 | `local_tax_assessment::row_or_subtotal_kind` |
| 451 | `local_tax_assessment::tax_assessment_year` |
| 452 | `local_tax_assessment::tax_notice_status` |
| 453 | `local_tax_assessment::tax_object` |
| 454 | `payroll_payslip::income.payroll.allowances` |
| 455 | `payroll_payslip::income.payroll.bonus` |
| 456 | `payroll_payslip::income.payroll.employee` |
| 457 | `payroll_payslip::income.payroll.employer` |
| 458 | `payroll_payslip::income.payroll.gross_base` |
| 459 | `payroll_payslip::income.payroll.hours_days` |
| 460 | `payroll_payslip::income.payroll.issue_date` |
| 461 | `payroll_payslip::income.payroll.net_pay` |
| 462 | `payroll_payslip::income.payroll.other_deductions` |
| 463 | `payroll_payslip::income.payroll.overtime` |
| 464 | `payroll_payslip::income.payroll.pay_date` |
| 465 | `payroll_payslip::income.payroll.pay_period_end` |
| 466 | `payroll_payslip::income.payroll.pay_period_start` |
| 467 | `payroll_payslip::income.payroll.social_contributions` |
| 468 | `payroll_payslip::income.payroll.tax_withheld` |
| 469 | `pension_benefit_income::income.benefit.beneficiary` |
| 470 | `pension_benefit_income::income.benefit.benefit_type` |
| 471 | `pension_benefit_income::income.benefit.decision_date` |
| 472 | `pension_benefit_income::income.benefit.deductions` |
| 473 | `pension_benefit_income::income.benefit.monthly_gross` |
| 474 | `pension_benefit_income::income.benefit.net_payment` |
| 475 | `pension_benefit_income::income.benefit.payment_date` |
| 476 | `pension_benefit_income::income.benefit.payment_end` |
| 477 | `pension_benefit_income::income.benefit.payment_start` |
| 478 | `pension_benefit_income::income.benefit.provider` |
| 479 | `pension_benefit_income::income.benefit.review_status` |
| 480 | `pension_contribution_benefit::as_of_date` |
| 481 | `pension_contribution_benefit::benefit_amount` |
| 482 | `pension_contribution_benefit::benefit_type` |
| 483 | `pension_contribution_benefit::contribution` |
| 484 | `pension_contribution_benefit::encumbrance` |
| 485 | `pension_contribution_benefit::issue_date` |
| 486 | `pension_contribution_benefit::member` |
| 487 | `pension_contribution_benefit::payment_start` |
| 488 | `pension_contribution_benefit::period_end` |
| 489 | `pension_contribution_benefit::period_start` |
| 490 | `pension_contribution_benefit::plan_id` |
| 491 | `pension_contribution_benefit::provider` |
| 492 | `pension_contribution_benefit::vested_balance` |
| 493 | `pension_contribution_benefit::withdrawal_value` |
| 494 | `pension_contribution_statement::contribution_record_kind` |
| 495 | `pension_contribution_statement::paid_amount` |
| 496 | `pension_contribution_statement::paid_months` |
| 497 | `pension_contribution_statement::payable_amount` |
| 498 | `pension_contribution_statement::payable_months` |
| 499 | `pension_contribution_statement::standard_monthly_income` |
| 500 | `pension_contribution_statement::subscriber_type` |
| 501 | `pension_contribution_statement::unpaid_amount` |
| 502 | `pension_contribution_statement::unpaid_months` |
| 503 | `pension_contribution_statement::unpayable_amount` |
| 504 | `pension_contribution_statement::unpayable_months` |
| 505 | `procedure_court_orders::procedure.order.case_number` |
| 506 | `procedure_court_orders::procedure.order.court` |
| 507 | `procedure_court_orders::procedure.order.deadline` |
| 508 | `procedure_court_orders::procedure.order.debtor` |
| 509 | `procedure_court_orders::procedure.order.effective_date` |
| 510 | `procedure_court_orders::procedure.order.finality` |
| 511 | `procedure_court_orders::procedure.order.operative_text` |
| 512 | `procedure_court_orders::procedure.order.order_date` |
| 513 | `procedure_court_orders::procedure.order.order_type` |
| 514 | `procedure_court_orders::procedure.order.scope` |
| 515 | `procedure_court_orders::procedure.order.service_date` |
| 516 | `procedure_court_orders::procedure.order.status_change` |
| 517 | `procedure_enforcement_garnishment::procedure.enforcement.asset_or_income` |
| 518 | `procedure_enforcement_garnishment::procedure.enforcement.attached_amount` |
| 519 | `procedure_enforcement_garnishment::procedure.enforcement.authority` |
| 520 | `procedure_enforcement_garnishment::procedure.enforcement.case_number` |
| 521 | `procedure_enforcement_garnishment::procedure.enforcement.claimed_amount` |
| 522 | `procedure_enforcement_garnishment::procedure.enforcement.creditor` |
| 523 | `procedure_enforcement_garnishment::procedure.enforcement.debtor` |
| 524 | `procedure_enforcement_garnishment::procedure.enforcement.effective_date` |
| 525 | `procedure_enforcement_garnishment::procedure.enforcement.order_date` |
| 526 | `procedure_enforcement_garnishment::procedure.enforcement.order_type` |
| 527 | `procedure_enforcement_garnishment::procedure.enforcement.released_amount` |
| 528 | `procedure_enforcement_garnishment::procedure.enforcement.service_date` |
| 529 | `procedure_enforcement_garnishment::procedure.enforcement.status` |
| 530 | `procedure_prior_insolvency::procedure.history.case_number` |
| 531 | `procedure_prior_insolvency::procedure.history.case_type` |
| 532 | `procedure_prior_insolvency::procedure.history.court_authority` |
| 533 | `procedure_prior_insolvency::procedure.history.debtor` |
| 534 | `procedure_prior_insolvency::procedure.history.discharge_date` |
| 535 | `procedure_prior_insolvency::procedure.history.filing_date` |
| 536 | `procedure_prior_insolvency::procedure.history.finality_date` |
| 537 | `procedure_prior_insolvency::procedure.history.order_date` |
| 538 | `procedure_prior_insolvency::procedure.history.order_kind` |
| 539 | `procedure_prior_insolvency::procedure.history.private_adjustment_attempt` |
| 540 | `procedure_prior_insolvency::procedure.history.record_issue_date` |
| 541 | `procedure_private_creditor_request::procedure.creditor_info.as_of_date` |
| 542 | `procedure_private_creditor_request::procedure.creditor_info.claim_id` |
| 543 | `procedure_private_creditor_request::procedure.creditor_info.claim_origin_date` |
| 544 | `procedure_private_creditor_request::procedure.creditor_info.creditor` |
| 545 | `procedure_private_creditor_request::procedure.creditor_info.debtor` |
| 546 | `procedure_private_creditor_request::procedure.creditor_info.interest_balance` |
| 547 | `procedure_private_creditor_request::procedure.creditor_info.interest_rate` |
| 548 | `procedure_private_creditor_request::procedure.creditor_info.principal_balance` |
| 549 | `procedure_private_creditor_request::procedure.creditor_info.principal_original` |
| 550 | `procedure_private_creditor_request::procedure.creditor_info.request_copy` |
| 551 | `procedure_private_creditor_request::procedure.creditor_info.request_date` |
| 552 | `procedure_private_creditor_request::procedure.creditor_info.response_date` |
| 553 | `property_search::issue_date` |
| 554 | `property_search::jurisdiction_scope` |
| 555 | `property_search::ownership_share` |
| 556 | `property_search::property_found` |
| 557 | `property_search::property_id` |
| 558 | `property_search::registered_owner` |
| 559 | `property_search::search_as_of` |
| 560 | `property_search::searched_subject` |
| 561 | `real_estate_register::ownership_change_text` |
| 562 | `real_estate_register::property_address` |
| 563 | `real_property_register::acquisition_date` |
| 564 | `real_property_register::issue_date` |
| 565 | `real_property_register::maximum_claim` |
| 566 | `real_property_register::mortgage_holder` |
| 567 | `real_property_register::ownership_share` |
| 568 | `real_property_register::property_id` |
| 569 | `real_property_register::property_type` |
| 570 | `real_property_register::registered_owner` |
| 571 | `real_property_register::registered_value` |
| 572 | `real_property_register::registration_date` |
| 573 | `real_property_register::release_date` |
| 574 | `real_property_valuation::actual_payoff` |
| 575 | `real_property_valuation::disposal_cost` |
| 576 | `real_property_valuation::market_value` |
| 577 | `real_property_valuation::owner` |
| 578 | `real_property_valuation::ownership_share` |
| 579 | `real_property_valuation::property_id` |
| 580 | `real_property_valuation::valuation_date` |
| 581 | `real_property_valuation::valuation_method` |
| 582 | `receivable_collectability::collected_amount` |
| 583 | `receivable_collectability::collection_status` |
| 584 | `receivable_collectability::counterparty_status` |
| 585 | `receivable_collectability::demand_date` |
| 586 | `receivable_collectability::receivable_id` |
| 587 | `receivable_collectability::security_reference` |
| 588 | `receivable_collectability::uncollected_reason` |
| 589 | `resident_registration::address_change_date` |
| 590 | `resident_registration::historical_address` |
| 591 | `resident_registration::residence_history_period` |
| 592 | `retirement_estimate::estimated_retirement_date` |
| 593 | `retirement_estimate::payout_condition` |
| 594 | `retirement_estimate::retirement_scheme` |
| 595 | `retirement_estimate::service_period` |
| 596 | `retirement_estimate::transfer_history` |
| 597 | `salary_statement::employer_confirmation_status` |
| 598 | `salary_statement::employer_signature_date` |
| 599 | `salary_statement::gross_total` |
| 600 | `salary_statement::total_deductions` |
| 601 | `secured_claim_security::actual_payoff` |
| 602 | `secured_claim_security::collateral_id` |
| 603 | `secured_claim_security::discharge_date` |
| 604 | `secured_claim_security::grantor` |
| 605 | `secured_claim_security::priority` |
| 606 | `secured_claim_security::registered_maximum` |
| 607 | `secured_claim_security::registration_date` |
| 608 | `secured_claim_security::secured_party` |
| 609 | `secured_claim_security::security_type` |
| 610 | `securities_balance::account_coverage` |
| 611 | `securities_balance::asset_class` |
| 612 | `securities_balance::cash_balance` |
| 613 | `securities_balance::quantity` |
| 614 | `securities_balance::quantity_unit` |
| 615 | `securities_balance::security_id` |
| 616 | `securities_balance::security_name` |
| 617 | `securities_balance::settlement_basis` |
| 618 | `securities_balance::unsettled_liability` |
| 619 | `securities_balance::valuation_currency` |
| 620 | `securities_balance::valuation_datetime` |
| 621 | `securities_balance::valuation_method` |
| 622 | `securities_balance::valuation_unit_price` |
| 623 | `securities_transactions::counter_account` |
| 624 | `securities_transactions::fee` |
| 625 | `securities_transactions::quantity` |
| 626 | `securities_transactions::quantity_unit` |
| 627 | `securities_transactions::security_event_kind` |
| 628 | `securities_transactions::security_id` |
| 629 | `securities_transactions::security_name` |
| 630 | `securities_transactions::settled_amount` |
| 631 | `securities_transactions::settlement_date` |
| 632 | `securities_transactions::tax` |
| 633 | `securities_transactions::trade_gross` |
| 634 | `securities_transactions::trade_unit_price` |
| 635 | `tax_income::arrears` |
| 636 | `tax_income::gross_receipts` |
| 637 | `tax_income::income_after_expenses` |
| 638 | `tax_income::income_kind` |
| 639 | `tax_income::issue_date` |
| 640 | `tax_income::necessary_expenses` |
| 641 | `tax_income::period_end` |
| 642 | `tax_income::period_start` |
| 643 | `tax_income::tax_assessed` |
| 644 | `tax_income::tax_paid` |
| 645 | `tax_income::tax_year` |
| 646 | `tax_income::taxpayer` |
| 647 | `tax_public_arrear::as_of_date` |
| 648 | `tax_public_arrear::assessment_date` |
| 649 | `tax_public_arrear::authority` |
| 650 | `tax_public_arrear::costs` |
| 651 | `tax_public_arrear::debtor` |
| 652 | `tax_public_arrear::due_date` |
| 653 | `tax_public_arrear::issue_date` |
| 654 | `tax_public_arrear::principal_arrear` |
| 655 | `tax_public_arrear::surcharge_interest` |
| 656 | `tax_public_arrear::tax_period` |
| 657 | `tax_public_arrear::tax_type` |
| 658 | `tax_public_arrear::total_due` |
| 659 | `vehicle_registration::model_year` |
| 660 | `vehicle_registration::plate_number` |
| 661 | `vehicle_registration::record_issue_date` |
| 662 | `vehicle_registration::vin` |
| 663 | `vehicle_registry::acquisition_date` |
| 664 | `vehicle_registry::co_owners` |
| 665 | `vehicle_registry::lien_date` |
| 666 | `vehicle_registry::lien_holder` |
| 667 | `vehicle_registry::ownership_share` |
| 668 | `vehicle_registry::registered_lien_amount` |
| 669 | `vehicle_registry::registered_owner` |
| 670 | `vehicle_registry::registration_status` |
| 671 | `vehicle_registry::release_date` |
| 672 | `vehicle_registry::transfer_date` |
| 673 | `vehicle_registry::vehicle_id` |
| 674 | `vehicle_valuation::actual_payoff` |
| 675 | `vehicle_valuation::market_value` |
| 676 | `vehicle_valuation::mileage` |
| 677 | `vehicle_valuation::model_year` |
| 678 | `vehicle_valuation::owner` |
| 679 | `vehicle_valuation::registered_lien_amount` |
| 680 | `vehicle_valuation::valuation_date` |
| 681 | `vehicle_valuation::valuation_method` |
| 682 | `vehicle_valuation::vehicle_id` |
| 683 | `wage_withholding_tax::income.tax.employment_start_end` |
| 684 | `wage_withholding_tax::income.tax.gross_wages` |
| 685 | `wage_withholding_tax::income.tax.issue_date` |
| 686 | `wage_withholding_tax::income.tax.resident_tax` |
| 687 | `wage_withholding_tax::income.tax.tax_exempt_allowances` |
| 688 | `wage_withholding_tax::income.tax.tax_year` |
| 689 | `wage_withholding_tax::income.tax.taxable_allowances` |
| 690 | `wage_withholding_tax::income.tax.taxpayer` |
| 691 | `wage_withholding_tax::income.tax.withheld_income_tax` |
| 692 | `wage_withholding_tax::income.tax.withholding_agent` |
| 693 | `wage_withholding_tax::income.tax.year_end_adjustment` |

## 스냅샷 원본 blob SHA (출처별 참조)
| 파일 | 조회 blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/module-contracts.generated.json` | `46a395a763ac17ab8e66c492c26c8e20fc037f56` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/ocr-calculation-input.ts` | `8f7f51bf41f7c944b76419d7cc894e49ac771473` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |
| `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` | `c3130de5f8335f1608c40660b36793472f019548` |

## 검증 한계 및 다음 회차
- 정적 계약 검사 **26/26 기대 일치**, V8 로컬 반환 **53/53 현행 동작 일치**. 이는 계산값 승인·전체 CI 통과·실제 D1/R2/Cron·공식 법원 양식·변호사 승인·운영 배포가 아님.
- 위험/보완(P2 후보): 월세·임대수입/차량리스 혼용, 임대차 쌍기간 역전, 임대차 보증금(#408)-담보잔액(#416)-임차권양도(#417) 중복 차감, 미등록 category, 원문 통화 상충; 법률 실효성·신원·전입/확정일자·순위 입증 승인 대기.
- 기존 Draft PR #51(기간), #169(OCR 형식), 기타 코드 중첩 영향 검토 후 안전 변경만 독립 브랜치+PR로 처리. 실제 사건자료 없이 계산·법률 의미/자동 분류 변경 금지.
- **다음 시작 canonical #421 `litigation_enforcement::claim_type` — #421–430**: 소송/집행 사건·당사자·청구/집행/판결액의 금액 의미·중복계상·법원 주문과 법적 효력, 보정 및 채권 등재 경로 조사. 다음 역할 **변호사→데이터→IT→사용자·서류→계산→AX**.
