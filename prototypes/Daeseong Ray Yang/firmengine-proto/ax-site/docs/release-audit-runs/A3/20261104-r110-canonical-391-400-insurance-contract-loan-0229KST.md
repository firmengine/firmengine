# FirmEngine A3 r110 — canonical OCR #391–400 보험 보장·대출·납입 소비처 감사 (2026-11-04 KST)

## 실행 기준
- `firmengine/firmengine` **main 시작 HEAD fe9695313165c1dc0ec9deee971fdf466afb3ab6**; 허용된 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만 읽기·기록. 직전 r109 #381–390, 선행 r20 #381–400, 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 원본 JSON/TS source, DB schema, 기존 `feature-lineage-audit.test.ts`/`ocr-calculator-input-integration.test.ts` 읽음. A2 r110/A1 r109/A3 r109 최근 커밋, Draft PR #225/#224/#223 등을 검토. PR/다른 agent 파일 수정 없음.
- 역할 순서 **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX** (동일 역할 고정 아님). 부분 조사 ID `A3-IT-002`, `A3-DOC-006`, `A3-CALC-008`, `A3-LAW-003`, `A3-DATA-008`; 체크박스 [ ] 유지. AX source-only 검토 참여, 별도 완료 없음.
- 원본 main의 canonical 693 ID와 A3 6담당자 체크 124 ID를 각각 **부록 A/B에 전체 원순서 열거**. 계약 등록 ≠ 실물 OCR 관찰 ≠ typed Fact ≠ 계산 검산 ≠ 법률 승인 ≠ 공식 서식 ≠ staging/배포.

## 실제 조회·정적 불변식 검증 24/24
문서 85종×패밀리48의 기본 field/문서 확장/supplement를 각각 읽고 doc/family/canonical 중복 제거. canonical index·calculator input·위험/법률/예외·적용조건·material·form 선언 비교.

| 항목 | 독립 기대 | 관찰(main) | 결과 |
|---|---:|---:|---|
| canonical | `693` | `693` | PASS |
| unique | `693` | `693` | PASS |
| sorted | `true` | `true` | PASS |
| documentTypes | `85` | `85` | PASS |
| families | `48` | `48` | PASS |
| sourceRoutes | `1808` | `1808` | PASS |
| sourceUnique | `693` | `693` | PASS |
| calculators | `18` | `18` | PASS |
| declaredInputs | `91` | `91` | PASS |
| uniqueInputs | `78` | `78` | PASS |
| riskChecks | `95` | `95` | PASS |
| legalRules | `50` | `50` | PASS |
| exceptions | `46` | `46` | PASS |
| boardIDs | `124` | `124` | PASS |
| boardCompleted | `0` | `0` | PASS |
| targets | `10` | `10` | PASS |
| targetRoutes | `20` | `20` | PASS |
| registered | `10` | `10` | PASS |
| typed | `0` | `0` | PASS |
| material | `0` | `0` | PASS |
| form | `0` | `0` | PASS |
| legal | `0` | `0` | PASS |
| anchors | `20` | `20` | PASS |
| separateRecords | `20` | `20` | PASS |

- canonical 정렬은 인덱스의 code-point 순서를 사용(`localeCompare` 문자열 collation과 다름). 20/20 원천 슬롯 `required_source_anchor`에 quote/bbox/page 및 원문 해시/행 표기, 20/20 `noCrossRecordBorrowing=true;sourceOnly=true` **선언** 확인. 실제 OCR page/복수행 locator 검사는 불실행.
- 전역 총량: 693 ID/1,808 route/85 docs/48 family/18 calculators·91 inputs(78 distinct)/법률위험95·규칙50·예외46. 이들은 **기존 계약 개수**로 실행 성공 수치가 아님.

## #391–400 — 개별 증거·계산·법률·서식 사용처/공백
보험 family 단일 계약의 10 canonical ID가 **보험 해약환급금 증명(`insurance_surrender_statement`) 및 보험대출 증명(`insurance_loan_statement`) 각각에 선언된 20 원천 슬롯**이다. 계약자·피보험자·보험회사·policy ID와 문서/페이지/row/시점이 확인되지 않으면 서로 결합 불가. 원천 quote+bbox+page/sourceHash는 **필요 앵커 선언일 뿐 실제 검증한 사실이 아님**.

| # | canonical ID | 2문서 슬롯 | datatype·원천 단위 | 대상·기간역할 | 개별 적용조건 | typed/material/form/법률 정확 계약 |
|---:|---|---|---|---|---|---|
| 391 | `insurance_policy_asset::coverage_amount` | 2 | money; currency and exact source unit if monetary | contract_holder; not_applicable | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 392 | `insurance_policy_asset::end_date` | 2 | date; source date format normalized to ISO without loss | contract_holder; effective_date | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 393 | `insurance_policy_asset::insured` | 2 | party_role; not_applicable | contract_holder; not_applicable | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 394 | `insurance_policy_asset::insurer` | 2 | party_role; not_applicable | contract_holder; not_applicable | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 395 | `insurance_policy_asset::issue_date` | 2 | date; source date format normalized to ISO without loss | contract_holder; document_issue_date | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 396 | `insurance_policy_asset::pledge` | 2 | category; not_applicable | contract_holder; not_applicable | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 397 | `insurance_policy_asset::policy_id` | 2 | identifier; not_applicable | contract_holder; not_applicable | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 398 | `insurance_policy_asset::policy_loan_balance` | 2 | money; currency and exact source unit if monetary | contract_holder; not_applicable | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 399 | `insurance_policy_asset::policy_status` | 2 | category; not_applicable | contract_holder; not_applicable | `source_conditional`/법률미승인 | source-only/0/0/0 |
| 400 | `insurance_policy_asset::premium_per_payment` | 2 | money; currency and exact source unit if monetary | contract_holder; not_applicable | `source_conditional`/법률미승인 | source-only/0/0/0 |

- **직접 typed 0/10, material 0/10, OCR→서식 정확 선언 0/10, 법률위험95/규칙50/예외46 exact canonical 0/10**. `feature-lineage-audit.ts` generic D5101/D5110 및 법령 review 후보는 공식 법원 token 승인/실제 에이전트 사용과 다름.
- `db/schema.ts`의 `extraction_records`, `extracted_features.canonical_field_id/raw_value_json/source_state/quote/bbox_json`, `extraction_field_coverage`; `feature-lineage-audit.ts`의 `document_id/page/record_ordinal/field_ordinal/source_sha256`는 구조 선언. **실제 source→D1 Fact→typed readback은 미실행**.
- 이전 #388 `insurance_policy_asset::as_of_date`는 `asset.as_of` typed 후보, #403 `insurance_policy_asset::surrender_value`만 `must_reconcile → asset.grossValue` material 정의. **#391 보장금액 ≠ #398 약관대출잔액 ≠ #400 회당 보험료 ≠ #403 환급가액**. 원본 기준일·원통화·대출차감 전후·담보상태 확인 전 합산/차감 금지.

## V8 원본 OCR 함수 격리 실행: 44/44 현재 반환 일치
`ocr-calculation-input.ts`의 원본 `calculationSourceCellIssues` 함수 본문과 날짜 판별 코드를 TypeScript 타입 문법 제거 후 실제 V8 함수로 평가. **금액 정규화 `normalizeMoney`만 합성 stub**(정수 KRW exact, USD 비exact) 사용. 모두 합성 값이며 실 고객 데이터/원본 OCR 값 아님. 이것은 **현행 코드 분기 재현**이지 업무·법률 안전성 통과가 아님.

| # | ID | synthetic 입력: state/value/unit/quote | 독립 코드분기 기대 | 실제 반환 | 판정 |
|---:|---|---|---|---|---|
| 1 | `insurance_policy_asset::coverage_amount` | normal: `present;"100";"KRW";"100"` | `[]` | `[]` | 일치 |
| 2 | `insurance_policy_asset::coverage_amount` | quote_missing: `present;"100";"KRW";""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 3 | `insurance_policy_asset::coverage_amount` | present_null: `present;null;"KRW";"100"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 4 | `insurance_policy_asset::coverage_amount` | unit_missing: `present;"100";null;"100"` | `SOURCE_MONETARY_UNIT_MISSING` | `SOURCE_MONETARY_UNIT_MISSING` | 일치 |
| 5 | `insurance_policy_asset::coverage_amount` | usd_unit_stub: `present;"100";"USD";"100"` | `SOURCE_MONEY_NOT_EXACT_KRW` | `SOURCE_MONEY_NOT_EXACT_KRW` | 일치 |
| 6 | `insurance_policy_asset::coverage_amount` | quote_USD_unit_KRW: `present;"100";"KRW";"100 USD"` | `[]` | `[]` | 일치 |
| 7 | `insurance_policy_asset::end_date` | normal: `present;"2026-04-14";null;"2026-04-14"` | `[]` | `[]` | 일치 |
| 8 | `insurance_policy_asset::end_date` | quote_missing: `present;"2026-04-14";null;""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 9 | `insurance_policy_asset::end_date` | present_null: `present;null;null;"2026-04-14"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 10 | `insurance_policy_asset::end_date` | invalid_date: `present;"2026-02-30";null;"2026-04-14"` | `SOURCE_DATE_INVALID` | `SOURCE_DATE_INVALID` | 일치 |
| 11 | `insurance_policy_asset::insured` | normal: `present;"SYNTHETIC_TEXT";null;"SYNTHETIC_TEXT"` | `[]` | `[]` | 일치 |
| 12 | `insurance_policy_asset::insured` | quote_missing: `present;"SYNTHETIC_TEXT";null;""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 13 | `insurance_policy_asset::insured` | present_null: `present;null;null;"SYNTHETIC_TEXT"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 14 | `insurance_policy_asset::insurer` | normal: `present;"SYNTHETIC_TEXT";null;"SYNTHETIC_TEXT"` | `[]` | `[]` | 일치 |
| 15 | `insurance_policy_asset::insurer` | quote_missing: `present;"SYNTHETIC_TEXT";null;""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 16 | `insurance_policy_asset::insurer` | present_null: `present;null;null;"SYNTHETIC_TEXT"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 17 | `insurance_policy_asset::issue_date` | normal: `present;"2026-04-14";null;"2026-04-14"` | `[]` | `[]` | 일치 |
| 18 | `insurance_policy_asset::issue_date` | quote_missing: `present;"2026-04-14";null;""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 19 | `insurance_policy_asset::issue_date` | present_null: `present;null;null;"2026-04-14"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 20 | `insurance_policy_asset::issue_date` | invalid_date: `present;"2026-02-30";null;"2026-04-14"` | `SOURCE_DATE_INVALID` | `SOURCE_DATE_INVALID` | 일치 |
| 21 | `insurance_policy_asset::pledge` | normal: `present;"SYNTHETIC_TEXT";null;"SYNTHETIC_TEXT"` | `[]` | `[]` | 일치 |
| 22 | `insurance_policy_asset::pledge` | quote_missing: `present;"SYNTHETIC_TEXT";null;""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 23 | `insurance_policy_asset::pledge` | present_null: `present;null;null;"SYNTHETIC_TEXT"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 24 | `insurance_policy_asset::pledge` | unknown_category: `present;"INVALID_CATEGORY";null;"SYNTHETIC_TEXT"` | `[]` | `[]` | 일치 |
| 25 | `insurance_policy_asset::policy_id` | normal: `present;"SYNTHETIC_TEXT";null;"SYNTHETIC_TEXT"` | `[]` | `[]` | 일치 |
| 26 | `insurance_policy_asset::policy_id` | quote_missing: `present;"SYNTHETIC_TEXT";null;""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 27 | `insurance_policy_asset::policy_id` | present_null: `present;null;null;"SYNTHETIC_TEXT"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 28 | `insurance_policy_asset::policy_loan_balance` | normal: `present;"100";"KRW";"100"` | `[]` | `[]` | 일치 |
| 29 | `insurance_policy_asset::policy_loan_balance` | quote_missing: `present;"100";"KRW";""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 30 | `insurance_policy_asset::policy_loan_balance` | present_null: `present;null;"KRW";"100"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 31 | `insurance_policy_asset::policy_loan_balance` | unit_missing: `present;"100";null;"100"` | `SOURCE_MONETARY_UNIT_MISSING` | `SOURCE_MONETARY_UNIT_MISSING` | 일치 |
| 32 | `insurance_policy_asset::policy_loan_balance` | usd_unit_stub: `present;"100";"USD";"100"` | `SOURCE_MONEY_NOT_EXACT_KRW` | `SOURCE_MONEY_NOT_EXACT_KRW` | 일치 |
| 33 | `insurance_policy_asset::policy_loan_balance` | quote_USD_unit_KRW: `present;"100";"KRW";"100 USD"` | `[]` | `[]` | 일치 |
| 34 | `insurance_policy_asset::policy_status` | normal: `present;"SYNTHETIC_TEXT";null;"SYNTHETIC_TEXT"` | `[]` | `[]` | 일치 |
| 35 | `insurance_policy_asset::policy_status` | quote_missing: `present;"SYNTHETIC_TEXT";null;""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 36 | `insurance_policy_asset::policy_status` | present_null: `present;null;null;"SYNTHETIC_TEXT"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 37 | `insurance_policy_asset::policy_status` | unknown_category: `present;"INVALID_CATEGORY";null;"SYNTHETIC_TEXT"` | `[]` | `[]` | 일치 |
| 38 | `insurance_policy_asset::premium_per_payment` | normal: `present;"100";"KRW";"100"` | `[]` | `[]` | 일치 |
| 39 | `insurance_policy_asset::premium_per_payment` | quote_missing: `present;"100";"KRW";""` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 일치 |
| 40 | `insurance_policy_asset::premium_per_payment` | present_null: `present;null;"KRW";"100"` | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 일치 |
| 41 | `insurance_policy_asset::premium_per_payment` | unit_missing: `present;"100";null;"100"` | `SOURCE_MONETARY_UNIT_MISSING` | `SOURCE_MONETARY_UNIT_MISSING` | 일치 |
| 42 | `insurance_policy_asset::premium_per_payment` | usd_unit_stub: `present;"100";"USD";"100"` | `SOURCE_MONEY_NOT_EXACT_KRW` | `SOURCE_MONEY_NOT_EXACT_KRW` | 일치 |
| 43 | `insurance_policy_asset::premium_per_payment` | quote_USD_unit_KRW: `present;"100";"KRW";"100 USD"` | `[]` | `[]` | 일치 |
| 44 | `insurance_policy_asset::coverage_amount` | unobserved_null: `unknown;null;null;""` | `[]` | `[]` | 일치 |

## P2 위험 후보·독립 안전기대 (상위 제품 결함 확정 아님)
1. **원문 통화 상충**: #391/#398/#400에서 값 `100`, `unit=KRW`, `quote=100 USD` 3/3이 field-local에서 `[]`; 독립 안전 기대는 보류/통화 확인. 실제 금액 정규화·상위 차단 경로는 미검증.
2. **담보·계약상태 category 검증**: #396 `pledge`와 #399 `policy_status`에 `INVALID_CATEGORY`를 넣어도 로컬 `[]`. 증권 등기/약정/우선·별제권 인정, 계약 효력은 변호사 검토 필요.
3. **서로 다른 날짜**: #392 만기일, #395 발급일, 이전 #388 가치평가 기준일은 역할이 다르다. 불가능 일자 `2026-02-30`는 로컬 2/2 검출. 다른 문서/계약/기간 날짜 혼합 불가.
4. **금액 중복**: 보장액은 현금자산이 아니고, 대출잔액은 환급전/후 포함관계에 따라 이중 차감 위험. 이미 납입 보험료는 현재 해약가치가 아님. 산식·환산·법원 인정값 변경을 수행하지 않음.
5. **증거 상태 보존**: `unobserved/null/0/not_applicable/conflict/explicit_none/source-only/승인전` 구분. source-only 0 소비처라도 증거/대조/역질문/갈음·보정 후보 보존. 해당 10개는 조건부 등록 10/10, 법률/공식양식/실무 승인 **0%**.

## 실제 소비 코드 및 현재 미인증
- `reference-decision-tables.json` 18계산/91입력과 `canonical-field-binding.ts` 보험 typed projection 확인; 이번 10개는 직접 계산 투영 없음.
- `ocr-chain-matrix.ts`: exact target token 0/10, generic 자산 서식 D5101/D5110은 후보. `material-calculation-source-gate.ts`: 이번 10 ID 직접0, #403만 must_reconcile.
- `legal-evidence-criteria.ts`: 승인형 정책 seed `checks:[]` 경계, 법률위험95/규칙50/예외46 정확 ID=0. 인가 규칙·시행일·법원 공식 양식·변호사 승인 미조회.
- `document-substitution.ts` 사람검토 갈음 경로, `preapproval-correction-item-store.ts` `requiredCanonicalFieldIds` 경로 **코드 존재만 확인**. 사건별 보험증명 갈음 승인/법원 보정명령/서식 생성 불실행.
- 합성 함수 V8 44회와 JSON 정적 24회는 **전체 Node CI, 실 OCR, staging D1/R2/Cron, 법원공식서식, 변호사 승인, 사이트 배포**와 각각 별개. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 없음.

## 중앙 인수 보드 5 ID 부분검증 (전부 [ ] 유지)
- `A3-IT-002`: 10 ID×2 원천, 0 직접 typed/form/legal, 검증 공백. 전수제품 소비처 도달·런타임 미인증.
- `A3-DOC-006`: 보험증권/해약환급·보험대출 및 계약자·피보험자·policy ID·담보·기간 증빙 경로. 실제 요구/보정/갈음 승인 미인증.
- `A3-CALC-008`: #391 보장액/#398 대출잔액/#400 납입액과 #403 환급가치 구분 및 순액 포함관계 검토, 계산 E2E 미인증.
- `A3-LAW-003`: pledge/status/loan 원천만으로 우선/별제권 법률 인정 금지. 실제 권원/관할/판본·변호사 승인 미인증.
- `A3-DATA-008`: 같은 보험 ID의 복수문서·대상자·시점·행 식별 계약. D1 원천·Fact/typed 재조회 미인증.
- AX: 의미 혼용/원문 통화 상충/비관찰 0 승격 금지 조사 참여, 별도 체크 완료 없음.

**누적 순차 심층 재감사 #400/693, 잔여 293, 최종 A3 제품 인수 0/124. 다음 시작 #401 `insurance_policy_asset::refund_net_basis` 범위 #401–410. 역할 시작 사용자·서류담당자.**

## 소스 blob SHA / 재현
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` `502c2f76cdd181f9836a00a71007b6e923e9d7ed`
- `lib/canonical-field-id-index.json` `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/shared-document-field-contracts.json` `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/document-agent-field-contracts.json` `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/ocr-field-supplements.json` `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json` `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json` `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/ocr-calculation-input.ts` `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/ocr-chain-matrix.ts` `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/material-calculation-source-gate.ts` `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/canonical-field-binding.ts` `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/feature-lineage-audit.ts` `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`
- `tests/feature-lineage-audit.test.ts` `4257434140eaa18efef88bc4fd1fc721048a4d00`
- `tests/ocr-calculator-input-integration.test.ts` `48fe6b3ddf3f162d55608b532af1102f765d0310`
- `lib/document-substitution.ts` `9fea9344b923c961fe333761df99ddde431ce1bc`
- `lib/preapproval-correction-item-store.ts` `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`
- `lib/legal-evidence-criteria.ts` `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`

## 부록 A — canonical OCR 693 전체 원본 순번
| # | canonical ID |
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

## 부록 B — A3 담당 체크 124 ID 전체 원본 순번
| # | ID | 상태 |
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
