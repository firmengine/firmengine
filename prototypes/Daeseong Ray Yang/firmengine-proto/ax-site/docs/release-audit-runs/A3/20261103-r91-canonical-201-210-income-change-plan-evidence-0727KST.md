# FirmEngine A3 r91 — #201–210 소득변동 및 변제계획 자금원 소비처 재감사

2026-11-03 KST | 시작 최신 GitHub `main` SHA `822c39c33cd24ea0bf8e5f7a4629eb444992f6db` | 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`에 한정. 직전 [r90 #191–200](20261103-r90-canonical-191-200-medical-household-consumers-0627KST.md), 이전 r11/r46 #201–220 인계. **역할 순환:** 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자. 대상 보드 체크 **A3-CALC-020 / A3-LAW-018 / A3-DATA-013 / A3-AX-020 / A3-DOC-017** (전부 [ ]).

## 1. 실제 조회, 실험 수준 및 선언 검증

- 최신 main **693 canonical ID 전부 순서대로 열거**, **85문서/48패밀리**, 문서 계약 base `1582` + 확장 `207` + 보충 `19` = **1808 문서×family×field 선언 슬롯**, 중복 라우트 0, 고아 0. 이번 #201–210 **10개, 26 슬롯, 6 서류**. 각각 1개 base definition, 정확 적용조건 **10/10 등록(모두 `source_conditional`, 사람 승인 없음)**.
- 이미 조회한 reference-decision-tables에서 **18개 계산 / 91개 입력 선언(78 고유)**, risk 95 / legal rule 50 / exception 46. 최신 source 정적 텍스트 대조: 이번 ID의 `canonical-field-binding.ts`/ `reference-case-projection.ts` **직접 typed 0**, `material-calculation-source-gate.ts` **직접 계산 0**, `ocr-chain-matrix.ts` **정확 내부 form token 0**, `risk-catalog.json` / `legal-catalog.json` / `legal-exceptions.json` **정확 canonical literal 0**. 후보/간접 사용 가능성과 직접 확정 사용을 구분한다.
- `feature-lineage-audit.ts::hasPeriod` 실제 표현식 V8 격리 **10회**, field temporal role 기준 **3개(#202/#203/#204) 과잉 플래그 재현**. `ocr-calculation-input.ts::calculationSourceCellIssues` 실제 함수 본문 타입 표기만 제거해 V8 격리 **22개 합성 테스트 22/22 현행 분기 일치**. 외부 `normalizeMoney`는 KRW 정수일 때만 exact로 응답하는 **합성 stub**, 실제 domain 함수/Node CI는 미검증이다.
- 최신 관련 Draft PR **#51** (기간 분류), **#54** (동일 페이지 다른 사람 Fact), **#203** (ledger 부정확한 재원) 미병합으로 확인. 겹치는 영역을 main에 재수정·병합하지 않았다.
- 실제 고객 OCR 페이지·원문/행/quote/bbox, D1 Fact 저장·재조회, 실 사건 typed, 18계산 E2E, staging D1/R2/Cron, 실제 공식 양식 bytes·변호사 법률 승인, 전자제출/배포는 **실행·인증하지 않음**. `unobserved`·`null`·진짜 `0`·`not_applicable`·`conflicting`·`source_only`·`approval_pending`은 서로 별개다.

## 2. 정확 ID별 원천·소비처/공백 누적 표

아래 원천슬롯 수는 **등록 추출 경로 수**이지 실제 문서/Fact/데이터 행 수가 아니다. 각 필드는 문서 hash, page, record ordinal, field ordinal, raw unit, 주체/대상, 적용기간, 원문 quote/bbox를 독립 확보해야 한다. D1 `extraction_records` / `extracted_features` / `extraction_field_coverage`는 저장구조의 선언이지 실 데이터 재독 결과는 아니다.

| # | canonical ID | 문서 유형/슬롯 | 타입 / 단위 / 기간 / 대상 | 적용조건 | 정확 직접 소비처 | 누락/역질문 |
|---:|---|---|---|---|---|---|
| 201 | `conditional_nonstandard_income_or_household_event::conditional.change.income_delta` | employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence (5) | money / KRW / period_scope / applicant_debtor | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 신고 소득 증감(음수/양수·0) 주장의 기준금액·효력기간·중복 입금 및 해당 사람 증빙 대조 |
| 202 | `conditional_nonstandard_income_or_household_event::conditional.change.issuer` | employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence (5) | party_role / not_applicable / not_applicable / issuer | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 발행기관·담당 기관 실제 동일성 검토; 필드 자체 기간 비해당인데 family 기간 플래그 true |
| 203 | `conditional_nonstandard_income_or_household_event::conditional.change.new_status` | employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence (5) | text_or_enum / not_applicable / not_applicable / applicant_debtor | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 변경 후 상태의 날짜·주체·원본행 검증; 필드 기간 플래그 true |
| 204 | `conditional_nonstandard_income_or_household_event::conditional.change.old_status` | employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence (5) | text_or_enum / not_applicable / not_applicable / applicant_debtor | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 변경 전 상태와 변경 후 상태가 서로 상충하는지 검산; 필드 기간 플래그 true |
| 205 | `conditional_plan_funding_source::applicability.form.current_official_version` | plan_funding_statement (1) | version_record / not_applicable / not_applicable / authority | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 공식 파일 URL·배포자·시행일·hash 검증 전 최신 법원 양식 버전으로 인정 금지 |
| 206 | `conditional_plan_funding_source::applicability.form.disposition_asset_ids` | plan_funding_statement (1) | id_list / not_applicable / proposed_plan_period_scope / owner_legal | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 계획상 매각 대상 자산 ID 목록과 소유권·담보·사건 자산 테이블 참조 대조 |
| 207 | `conditional_plan_funding_source::applicability.form.disposition_date` | plan_funding_statement (1) | date / not_applicable / proposed_event_date / applicant_debtor | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 매각 예정일은 실제 매각/수령일과 분리; 승인 전 계획예정 |
| 208 | `conditional_plan_funding_source::applicability.form.disposition_proceeds` | plan_funding_statement (1) | money / KRW / proposed_plan_period_scope / applicant_debtor | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 처분 예상액은 실제 수령액·변제 투입액과 다름; 수입/자산/계획액 중복 합산 금지 |
| 209 | `conditional_plan_funding_source::applicability.form.income_source_evidence_ids` | plan_funding_statement (1) | id_list / not_applicable / proposed_plan_period_scope / applicant_debtor | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 계획상 수입증거 ID와 실제 검증된 동일인·동일기간 Fact 참조 대조 |
| 210 | `conditional_plan_funding_source::applicability.form.plan_source` | plan_funding_statement (1) | enum / not_applicable / proposed_plan_period_scope / applicant_debtor | source_conditional 등록·법적 미승인 | 정확 typed 0; 18계산 0; legal 0; form 0 | 계획 재원 enum은 임의 문자열 수용되는 local 검사; 허용값·사람승인 별도 요구 |

#201–204의 5개 문서 라우트는 **동일인의 소득 변화 5건**이 아니며, 원천 금액을 기존 급여·사업소득에 자동 차감하거나 합산하지 않는다. #205 `current_official_version`은 **원천 기재 주장**이고 법원이 공포한 최신 효력 판본 검증과 다르다. #206 참조 자산, #207 예정일, #208 처분예상금, #209 수입증거 ID, #210 계획 재원은 제안 상태이며 법적 승인/확정 금액이 아니다. #208은 #211 `proceeds_to_plan` (다음 회차)와 경제적 의미가 다르다.

## 3. 실제 함수 격리 호출 — 합성 입력 / 코드 분기 기대 / 관찰

아래 '일치'는 **현재 코드 동작을 재현**했다는 뜻이지 업무·법률상 합격이 아니다. 특히 `[]`는 field-local 형식검사 오류가 없다는 뜻이고, source 진위·상위 타입스키마·DB 참조무결성·법률 승인을 의미하지 않는다.

| 테스트 | datatype / raw / unit / sourceState | 원본 코드 분기 기대 | 관찰 | 판정 |
|---|---|---|---|---|
| 201-not_seen | money, `null`, null, not_seen | `[]` | `[]` | 일치(현행 코드 분기) |
| 201-present-null | money, `null`, KRW, present | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 일치(현행 코드 분기) |
| 201-observed-zero | money, `0`, KRW, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 201-negative-delta | money, `-120`, KRW, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 201-missing-unit | money, `200`, null, present | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 일치(현행 코드 분기) |
| 201-foreign-unit | money, `200`, USD, present | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | 일치(현행 코드 분기) |
| 202-issuer | party_role, `unknown_issuer`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 203-status | text_or_enum, `unlisted_new_status`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 204-status | text_or_enum, `unlisted_old_status`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 205-version | version_record, `not_a_version`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 206-assets | id_list, `not_a_valid_id_list`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 207-bad-date | date, `2026-02-30`, null, present | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 일치(현행 코드 분기) |
| 207-valid-date | date, `2026-12-01`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 208-plan-value | money, `250`, KRW, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 208-unit-missing | money, `250`, null, present | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 일치(현행 코드 분기) |
| 208-quote-missing | money, `250`, KRW, present | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 일치(현행 코드 분기) |
| 209-evidence-id | id_list, `not_a_valid_id_list`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 210-enum-unknown-kind | enum, `self_invented_funding_source`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 210-enum-unknown | enum, `unknown`, null, present | `[]` | `[]` | 일치(현행 코드 분기) |
| 210-null | enum, `null`, null, present | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 일치(현행 코드 분기) |
| 208-conflicting | money, `1200`, KRW, conflicting | `[]` | `[]` | 일치(현행 코드 분기) |
| 208-uncertain | money, `1200`, KRW, present | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 일치(현행 코드 분기) |

**독립 업무 공백(P2 후보)**: #205 `version_record`, #206/#209 `id_list`, #210 `enum`에서 임의 문자열도 로컬 형식검사 `[]`, #203/#204 상태도 임의값 허용. 상위 검증기의 차단은 미확인 → 제품 전체의 결함/법원 인정 오류로 단정하지 않는다. #201의 음수 증감은 의미상 허용될 수 있고 실제 `0`과 `null`은 구분된다. #208 conflicting에서 `[]`은 상위 충돌 해소 검토를 대신하지 않는다.

| ID | field temporal role | 필드 자체의 period 검증 독립 기대 | 현행 `hasPeriod` 실제 |
|---:|---|---|---|
| 201 | period_scope | true | true |
| 202 | not_applicable | false | true — **P2 과잉 후보** |
| 203 | not_applicable | false | true — **P2 과잉 후보** |
| 204 | not_applicable | false | true — **P2 과잉 후보** |
| 205 | not_applicable | false | false |
| 206 | proposed_plan_period_scope | true | true |
| 207 | proposed_event_date | true | true |
| 208 | proposed_plan_period_scope | true | true |
| 209 | proposed_plan_period_scope | true | true |
| 210 | proposed_plan_period_scope | true | true |

3/10 불일치는 문서의 사건기간 자체가 불필요하다는 뜻은 아니다. 기존 Draft #51과 충돌하므로 새 코드 변경 없음.

## 4. 요구서류·갈음·보정 및 역할별 5개 체크 ID ([ ] 유지)

`docs/substitution-coverage-matrix.json`은 `employment_history`(INTAKE-014), `medical_expense_evidence`(INTAKE-040), `closure_certificate`(INTAKE-043), `divorce_records`(INTAKE-047), `income_household_change_evidence`(INTAKE-069/070), `plan_funding_statement`(INTAKE-067) 모두 `primary_required_no_auto_substitution` 선언. 법원 보정명령 원본·B+C 갈음 승인·법원 제출 영수증은 미관찰이다. INTAKE-067은 내부 계획서 작성/검수 후보이며 원문·공식 버전·법원 인가가 아니다.

- **A3-CALC-020**: #201 신고소득 증감과 #208 처분계획 금액의 법률상 인정·월환산 차이를 기록. 직접 18산식/91입력 사용 0, 실 계산과 D1 연결 없음. 자동 원화 합산 금지.
- **A3-LAW-018**: 공식 법률 근거/시행일/관할/승인 계약은 정확 ID 0/10, 법률인정 **0%**. #205 서식 판본 자동 유효화 금지, 변호사 검토 미실행.
- **A3-DATA-013**: raw document→page/record/field→Fact→typed→formula→law→form token 전단계 중 raw 저장 구조/정적 source만 확인. 실제 Fact 저장·재조회 및 계산/공식 token 미인증.
- **A3-AX-020**: #205/#206/#209/#210 형식 미검증 문자열을 제안/검토 후보로 유지하고 사람 승인 없이 확정값으로 승격 금지. 실제 AI final gate 미실행.
- **A3-DOC-017**: 서류 수집·제안 계산·법률 인정·법원 제출·인가 확정을 분리. #201–210의 실제 제출/갈음/보정 상태는 미관찰.

## 5. 소스 blob 및 증거수준

| GitHub main 파일 | blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
| `lib/ocr-calculation-input.ts` | `8f7f51bf41f7c944b76419d7cc894e49ac771473` |
| `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` | `4f70b405f69cf76b23d0324d10b21b52b676318d` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/reference-case-projection.ts` | `92cb5fd5816571259e070490a496e7b7f4d8515c` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/assessment.ts` | `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5` |
| `lib/plan-reconciliation.ts` | `1c895fd2fd8a133368315532ed2ab9984d64b2e3` |
| `lib/repayment-plan-model.ts` | `6b9e53caba3be1eab17373956aa19717cfeec980` |
| `db/schema.ts` | `933f8686845ac14669312dd21bf85e02c62ed5e6` |
| `docs/substitution-coverage-matrix.json` | `2962dabef7bffd38f8d277153acac9a179b4b7e8` |

**A3 최종 인수 0/124**. 제품 코드 미변경, 원천/테스트 합성정보만 기재, 고객 개인정보/원본 OCR/키·.env·비공개 정답 미기재. 운영 배포·운영 DB 마이그레이션·실제 전자제출·법원 인가 확정 없음.

**다음 시작 #211** `conditional_plan_funding_source::applicability.form.proceeds_to_plan`, 순차 **#211–220**, 첫 역할 **변호사**. 계획 투입액·검토상태·선택 서식 및 신용정보 조회의 채권양도 7개 ID 적용조건/참조무결성 확인.

## 부록 A. 693 canonical ID 전체 순번 (main 인덱스 그대로)

001. `account_garnishment::account_holder`
002. `account_garnishment::account_id`
003. `account_garnishment::court_or_authority`
004. `account_garnishment::creditor`
005. `account_garnishment::effective_date`
006. `account_garnishment::garnishment_amount`
007. `account_garnishment::issue_date`
008. `account_garnishment::released_amount`
009. `account_garnishment::seized_amount`
010. `account_garnishment::status`
011. `accounting_source::account_name`
012. `accounting_source::closing_balance`
013. `accounting_source::credits`
014. `accounting_source::debits`
015. `accounting_source::entity`
016. `accounting_source::issue_date`
017. `accounting_source::opening_balance`
018. `accounting_source::period_end`
019. `accounting_source::period_start`
020. `accounting_source::source_total`
021. `applicant_narrative_statement::identity.statement.admission_or_correction`
022. `applicant_narrative_statement::identity.statement.author`
023. `applicant_narrative_statement::identity.statement.event_end`
024. `applicant_narrative_statement::identity.statement.event_start`
025. `applicant_narrative_statement::identity.statement.narrative_text`
026. `applicant_narrative_statement::identity.statement.signature_status`
027. `applicant_narrative_statement::identity.statement.signed_at`
028. `applicant_narrative_statement::identity.statement.source_references`
029. `applicant_narrative_statement::identity.statement.statement_version`
030. `applicant_narrative_statement::identity.statement.topic`
031. `application_identity_venue::procedure.application.accepted_at`
032. `application_identity_venue::procedure.application.address`
033. `application_identity_venue::procedure.application.applicant_name`
034. `application_identity_venue::procedure.application.case_number`
035. `application_identity_venue::procedure.application.court`
036. `application_identity_venue::procedure.application.jurisdiction_exception`
037. `application_identity_venue::procedure.application.ordinary_venue_basis`
038. `application_identity_venue::procedure.application.phone_home`
039. `application_identity_venue::procedure.application.phone_mobile`
040. `application_identity_venue::procedure.application.phone_work`
041. `application_identity_venue::procedure.application.resident_id`
042. `application_identity_venue::procedure.application.ruleset_id`
043. `application_identity_venue::procedure.application.submitted_at`
044. `application_identity_venue::procedure.application.transition_rule`
045. `application_identity_venue::procedure.application_date`
046. `application_identity_venue::procedure.venue`
047. `asset_transfer_disposition::asset_id`
048. `asset_transfer_disposition::consideration`
049. `asset_transfer_disposition::market_value`
050. `asset_transfer_disposition::proceeds_received`
051. `asset_transfer_disposition::registration_date`
052. `asset_transfer_disposition::relationship`
053. `asset_transfer_disposition::review_status`
054. `asset_transfer_disposition::transaction_date`
055. `asset_transfer_disposition::transferee`
056. `asset_transfer_disposition::transferor`
057. `asset_transfer_disposition::use_of_proceeds`
058. `bank_account_balance::account_holder`
059. `bank_account_balance::account_id`
060. `bank_account_balance::account_status`
061. `bank_account_balance::balance`
062. `bank_account_balance::balance_as_of`
063. `bank_account_balance::currency`
064. `bank_account_balance::institution`
065. `bank_account_balance::issue_date`
066. `bank_transactions::account_id`
067. `bank_transactions::amount`
068. `bank_transactions::counterparty`
069. `bank_transactions::direction`
070. `bank_transactions::issue_date`
071. `bank_transactions::memo`
072. `bank_transactions::period_end`
073. `bank_transactions::period_start`
074. `bank_transactions::post_balance`
075. `bank_transactions::transaction_datetime`
076. `bank_transactions::transaction_id`
077. `bank_transactions::transaction_nature`
078. `business_asset_inventory::acquisition_date`
079. `business_asset_inventory::book_value`
080. `business_asset_inventory::condition`
081. `business_asset_inventory::disposal_restriction`
082. `business_asset_inventory::goodwill_contract`
083. `business_asset_inventory::market_value`
084. `business_asset_inventory::quantity`
085. `business_asset_inventory::quantity_unit`
086. `business_assets_liabilities::as_of_date`
087. `business_assets_liabilities::asset_or_claim_id`
088. `business_assets_liabilities::business_entity`
089. `business_assets_liabilities::gross_value`
090. `business_assets_liabilities::item_kind`
091. `business_assets_liabilities::ownership_interest`
092. `business_assets_liabilities::payable_amount`
093. `business_assets_liabilities::period_end`
094. `business_assets_liabilities::period_start`
095. `business_assets_liabilities::receivable_amount`
096. `business_assets_liabilities::secured_payoff`
097. `business_costs_and_ledgers::income.business_cost.accounting_basis`
098. `business_costs_and_ledgers::income.business_cost.business_continuity_flag`
099. `business_costs_and_ledgers::income.business_cost.business_entity`
100. `business_costs_and_ledgers::income.business_cost.expense_category`
101. `business_costs_and_ledgers::income.business_cost.gross_amount`
102. `business_costs_and_ledgers::income.business_cost.payment_date`
103. `business_costs_and_ledgers::income.business_cost.payment_status`
104. `business_costs_and_ledgers::income.business_cost.period_end`
105. `business_costs_and_ledgers::income.business_cost.period_start`
106. `business_costs_and_ledgers::income.business_cost.supplier`
107. `business_costs_and_ledgers::income.business_cost.tax_component`
108. `business_current_income_summary::income.self_employment.business_costs`
109. `business_current_income_summary::income.self_employment.contract_end`
110. `business_current_income_summary::income.self_employment.contract_id`
111. `business_current_income_summary::income.self_employment.gross_receivable`
112. `business_current_income_summary::income.self_employment.invoice_date`
113. `business_current_income_summary::income.self_employment.net_receipt`
114. `business_current_income_summary::income.self_employment.operator`
115. `business_current_income_summary::income.self_employment.payer_customer`
116. `business_current_income_summary::income.self_employment.service_period_end`
117. `business_current_income_summary::income.self_employment.service_period_start`
118. `business_current_income_summary::income.self_employment.withheld_tax`
119. `business_registration::business_entity`
120. `business_registration::business_id`
121. `business_registration::business_items`
122. `business_registration::business_type`
123. `business_registration::issue_date`
124. `business_registration::joint_operators`
125. `business_registration::opening_date`
126. `business_registration::registration_date`
127. `business_registration::representative`
128. `business_registration::status`
129. `business_sales_vat::income.sales.business_entity`
130. `business_sales_vat::income.sales.exempt_sales`
131. `business_sales_vat::income.sales.filing_date`
132. `business_sales_vat::income.sales.gross_sales`
133. `business_sales_vat::income.sales.issue_date`
134. `business_sales_vat::income.sales.reporting_period_end`
135. `business_sales_vat::income.sales.reporting_period_start`
136. `business_sales_vat::income.sales.returns_refunds`
137. `business_sales_vat::income.sales.sales_count`
138. `business_sales_vat::income.sales.taxable_sales`
139. `business_sales_vat::income.sales.vat_collected`
140. `card_statement::billed_amount`
141. `card_statement::billing_period`
142. `card_statement::card_product_kind`
143. `card_statement::installment_count`
144. `card_statement::merchant`
145. `card_statement::purchase_amount`
146. `card_statement::remaining_installments`
147. `cash_deposit_asset::actual_payoff`
148. `cash_deposit_asset::as_of_date`
149. `cash_deposit_asset::asset_id`
150. `cash_deposit_asset::asset_kind`
151. `cash_deposit_asset::encumbrance`
152. `cash_deposit_asset::gross_value`
153. `cash_deposit_asset::owner`
154. `cash_deposit_asset::ownership_share`
155. `cash_deposit_asset::protected_or_excluded_claim`
156. `cash_deposit_asset::valuation_basis`
157. `cash_holding_statement::acquisition_source`
158. `cash_holding_statement::cash_currency`
159. `cash_holding_statement::declaration_author`
160. `cash_holding_statement::declaration_date`
161. `cash_holding_statement::storage_location`
162. `conditional_case_specific_request::conditional.court_request.case_number`
163. `conditional_case_specific_request::conditional.court_request.court`
164. `conditional_case_specific_request::conditional.court_request.item_due`
165. `conditional_case_specific_request::conditional.court_request.legal_citation`
166. `conditional_case_specific_request::conditional.court_request.operative_text`
167. `conditional_case_specific_request::conditional.court_request.request_type`
168. `conditional_case_specific_request::conditional.court_request.response_deadline`
169. `conditional_case_specific_request::conditional.court_request.response_filed_at`
170. `conditional_case_specific_request::conditional.court_request.service_date`
171. `conditional_case_specific_request::conditional.court_request.status_change`
172. `conditional_education_childcare::conditional.education.billed_amount`
173. `conditional_education_childcare::conditional.education.enrollment_end`
174. `conditional_education_childcare::conditional.education.enrollment_start`
175. `conditional_education_childcare::conditional.education.fee_type`
176. `conditional_education_childcare::conditional.education.frequency`
177. `conditional_education_childcare::conditional.education.paid_amount`
178. `conditional_education_childcare::conditional.education.payer`
179. `conditional_education_childcare::conditional.education.provider`
180. `conditional_education_childcare::conditional.education.recipient`
181. `conditional_education_childcare::conditional.education.relation`
182. `conditional_education_childcare::conditional.education.subsidy`
183. `conditional_medical_expense::conditional.medical.applicant_relation`
184. `conditional_medical_expense::conditional.medical.billed_cost`
185. `conditional_medical_expense::conditional.medical.care_period_end`
186. `conditional_medical_expense::conditional.medical.care_period_start`
187. `conditional_medical_expense::conditional.medical.expected_recurring_cost`
188. `conditional_medical_expense::conditional.medical.medical_opinion_period`
189. `conditional_medical_expense::conditional.medical.paid_cost`
190. `conditional_medical_expense::conditional.medical.patient`
191. `conditional_medical_expense::conditional.medical.provider`
192. `conditional_medical_expense::conditional.medical.reimbursement`
193. `conditional_medical_expense::conditional.medical.service_date`
194. `conditional_medical_expense::conditional.medical.service_kind`
195. `conditional_nonstandard_income_or_household_event::conditional.change.affected_person`
196. `conditional_nonstandard_income_or_household_event::conditional.change.duration_end`
197. `conditional_nonstandard_income_or_household_event::conditional.change.effective_date`
198. `conditional_nonstandard_income_or_household_event::conditional.change.event_date`
199. `conditional_nonstandard_income_or_household_event::conditional.change.event_kind`
200. `conditional_nonstandard_income_or_household_event::conditional.change.expense_delta`
201. `conditional_nonstandard_income_or_household_event::conditional.change.income_delta`
202. `conditional_nonstandard_income_or_household_event::conditional.change.issuer`
203. `conditional_nonstandard_income_or_household_event::conditional.change.new_status`
204. `conditional_nonstandard_income_or_household_event::conditional.change.old_status`
205. `conditional_plan_funding_source::applicability.form.current_official_version`
206. `conditional_plan_funding_source::applicability.form.disposition_asset_ids`
207. `conditional_plan_funding_source::applicability.form.disposition_date`
208. `conditional_plan_funding_source::applicability.form.disposition_proceeds`
209. `conditional_plan_funding_source::applicability.form.income_source_evidence_ids`
210. `conditional_plan_funding_source::applicability.form.plan_source`
211. `conditional_plan_funding_source::applicability.form.proceeds_to_plan`
212. `conditional_plan_funding_source::applicability.form.review_status`
213. `conditional_plan_funding_source::applicability.form.selected_form_code`
214. `credit_information_report::assignment_event_date`
215. `credit_information_report::current_reported_creditor`
216. `credit_information_report::event_record_id`
217. `credit_information_report::issue_date`
218. `credit_information_report::previous_creditor`
219. `credit_information_report::report_as_of`
220. `credit_information_report::report_subject`
221. `credit_report::currency_unit`
222. `credit_report::event_date`
223. `credit_report::event_kind`
224. `credit_report::institution`
225. `credit_report::product_code`
226. `credit_report::reported_amount`
227. `credit_report::status`
228. `creditor_assignment_dispute::assignment_date`
229. `creditor_assignment_dispute::claim_id`
230. `creditor_assignment_dispute::claim_status`
231. `creditor_assignment_dispute::current_claimant`
232. `creditor_assignment_dispute::dispute_basis`
233. `creditor_assignment_dispute::disputed_amount`
234. `creditor_assignment_dispute::notice_date`
235. `creditor_assignment_dispute::prior_creditor`
236. `creditor_assignment_dispute::supporting_record`
237. `crypto_balance::account_owner`
238. `crypto_balance::asset_symbol`
239. `crypto_balance::available_quantity`
240. `crypto_balance::average_acquisition_price`
241. `crypto_balance::displayed_valuation`
242. `crypto_balance::exchange_or_wallet`
243. `crypto_balance::locked_quantity`
244. `crypto_balance::network`
245. `crypto_balance::total_quantity`
246. `crypto_balance::valuation_currency`
247. `crypto_balance::valuation_datetime`
248. `crypto_balance::valuation_unit_price`
249. `crypto_balance::wallet_address`
250. `crypto_transactions::asset_symbol`
251. `crypto_transactions::completed_at`
252. `crypto_transactions::counterparty_account_identity`
253. `crypto_transactions::crypto_event_kind`
254. `crypto_transactions::destination_address`
255. `crypto_transactions::fee_asset`
256. `crypto_transactions::fee_quantity`
257. `crypto_transactions::gross_trade_amount`
258. `crypto_transactions::network`
259. `crypto_transactions::quantity`
260. `crypto_transactions::quote_currency`
261. `crypto_transactions::requested_at`
262. `crypto_transactions::source_address`
263. `crypto_transactions::transfer_status`
264. `crypto_transactions::txid`
265. `crypto_transactions::unit_price`
266. `current_nonwage_income::income.other.contract_end`
267. `current_nonwage_income::income.other.deductions`
268. `current_nonwage_income::income.other.earning_period_end`
269. `current_nonwage_income::income.other.earning_period_start`
270. `current_nonwage_income::income.other.frequency`
271. `current_nonwage_income::income.other.gross_amount`
272. `current_nonwage_income::income.other.income_kind`
273. `current_nonwage_income::income.other.net_received`
274. `current_nonwage_income::income.other.payer`
275. `current_nonwage_income::income.other.payment_date`
276. `current_nonwage_income::income.other.recipient`
277. `debt_certificate::as_of_date`
278. `debt_certificate::claim_cause`
279. `debt_certificate::contract_id`
280. `debt_certificate::contract_interest_rate`
281. `debt_certificate::creditor`
282. `debt_certificate::creditor_address`
283. `debt_certificate::debtor`
284. `debt_certificate::fees`
285. `debt_certificate::interest_balance`
286. `debt_certificate::issue_date`
287. `debt_certificate::issuer`
288. `debt_certificate::original_principal`
289. `debt_certificate::origination_date`
290. `debt_certificate::overdue_interest`
291. `debt_certificate::principal_balance`
292. `debt_certificate::total_claim`
293. `divorce_records::actual_support_paid`
294. `divorce_records::agreement_or_order_date`
295. `divorce_records::divorce_date`
296. `divorce_records::former_spouse`
297. `divorce_records::marriage_date`
298. `divorce_records::partition_amount`
299. `divorce_records::partition_asset`
300. `divorce_records::support_child`
301. `divorce_records::support_payer`
302. `divorce_records::support_period`
303. `divorce_records::support_periodic_amount`
304. `divorce_records::support_recipient`
305. `employment_contract::employer_signature_date`
306. `employment_contract::employer_signature_status`
307. `employment_history::insurance_scheme`
308. `employment_history::qualification_acquired`
309. `employment_history::qualification_lost`
310. `employment_history::qualification_record_scope`
311. `employment_history::qualification_type`
312. `employment_history::qualification_workplace`
313. `employment_relationship::income.employment.allowance_terms`
314. `employment_relationship::income.employment.base_wage`
315. `employment_relationship::income.employment.contract_term`
316. `employment_relationship::income.employment.employee`
317. `employment_relationship::income.employment.employer`
318. `employment_relationship::income.employment.employment_type`
319. `employment_relationship::income.employment.end_date`
320. `employment_relationship::income.employment.hours`
321. `employment_relationship::income.employment.issue_date`
322. `employment_relationship::income.employment.start_date`
323. `guarantee_joint_claim::applicant_role`
324. `guarantee_joint_claim::creditor`
325. `guarantee_joint_claim::dispute_status`
326. `guarantee_joint_claim::guarantee_claimed`
327. `guarantee_joint_claim::guarantee_limit`
328. `guarantee_joint_claim::principal_debtor`
329. `guarantee_joint_claim::recourse_status`
330. `guarantee_joint_claim::underlying_claim_id`
331. `health_insurance_arrears::as_of_date`
332. `health_insurance_arrears::authority`
333. `health_insurance_arrears::disposal_cost`
334. `health_insurance_arrears::issue_date`
335. `health_insurance_arrears::late_charge`
336. `health_insurance_arrears::period_end`
337. `health_insurance_arrears::period_start`
338. `health_insurance_arrears::subscriber`
339. `health_insurance_arrears::total_arrear`
340. `health_insurance_arrears::unpaid_contribution`
341. `household_composition_support::household.support.member`
342. `household_composition_support::household.support.other_income`
343. `household_composition_support::household.support.relationship`
344. `household_composition_support::household.support.residence_end`
345. `household_composition_support::household.support.residence_start`
346. `household_composition_support::household.support.support_amount`
347. `household_composition_support::household.support.support_frequency`
348. `household_composition_support::household.support.support_period_end`
349. `household_composition_support::household.support.support_period_start`
350. `household_composition_support::household.support.support_provider`
351. `household_composition_support::household.support.support_recipient`
352. `household_living_expense::household.expense.arrears`
353. `household_living_expense::household.expense.beneficiary`
354. `household_living_expense::household.expense.billed_amount`
355. `household_living_expense::household.expense.billing_period_end`
356. `household_living_expense::household.expense.billing_period_start`
357. `household_living_expense::household.expense.expense_kind`
358. `household_living_expense::household.expense.issue_date`
359. `household_living_expense::household.expense.paid_amount`
360. `household_living_expense::household.expense.payer`
361. `household_living_expense::household.expense.provider`
362. `household_living_expense::household.expense.shared_allocation`
363. `identity_residence_record::identity.address`
364. `identity_residence_record::identity.household_members`
365. `identity_residence_record::identity.issue_date`
366. `identity_residence_record::identity.marital_status`
367. `identity_residence_record::identity.name`
368. `identity_residence_record::identity.record_number`
369. `identity_residence_record::identity.registration_id`
370. `identity_residence_record::identity.relationship`
371. `income_source_inventory::amount_basis`
372. `income_source_inventory::income_source_id`
373. `income_source_inventory::reported_expenses`
374. `income_source_inventory::reported_gross`
375. `income_source_inventory::reported_net`
376. `income_source_inventory::source_document_reference`
377. `income_source_inventory::source_kind`
378. `inheritance_records::attributed_amount`
379. `inheritance_records::decedent`
380. `inheritance_records::disclaimer_or_limited_acceptance`
381. `inheritance_records::filing_or_order_reference`
382. `inheritance_records::heir`
383. `inheritance_records::heir_relationship`
384. `inheritance_records::inherited_asset_id`
385. `inheritance_records::partition_agreement_date`
386. `inheritance_records::stated_share`
387. `inheritance_records::succession_opened_at`
388. `insurance_policy_asset::as_of_date`
389. `insurance_policy_asset::beneficiary`
390. `insurance_policy_asset::contract_holder`
391. `insurance_policy_asset::coverage_amount`
392. `insurance_policy_asset::end_date`
393. `insurance_policy_asset::insured`
394. `insurance_policy_asset::insurer`
395. `insurance_policy_asset::issue_date`
396. `insurance_policy_asset::pledge`
397. `insurance_policy_asset::policy_id`
398. `insurance_policy_asset::policy_loan_balance`
399. `insurance_policy_asset::policy_status`
400. `insurance_policy_asset::premium_per_payment`
401. `insurance_policy_asset::refund_net_basis`
402. `insurance_policy_asset::start_date`
403. `insurance_policy_asset::surrender_value`
404. `insurance_policy_asset::total_premium`
405. `lease_contract::fixed_date`
406. `lease_housing::applicant_relation`
407. `lease_housing::arrears_deduction`
408. `lease_housing::deposit`
409. `lease_housing::issue_date`
410. `lease_housing::landlord`
411. `lease_housing::monthly_rent`
412. `lease_housing::period_end`
413. `lease_housing::period_start`
414. `lease_housing::property_id`
415. `lease_housing::renewal_status`
416. `lease_housing::secured_balance`
417. `lease_housing::security_assignment`
418. `lease_housing::tenant`
419. `lease_housing::use`
420. `litigation_enforcement::case_id`
421. `litigation_enforcement::claim_type`
422. `litigation_enforcement::claimed_amount`
423. `litigation_enforcement::court_or_authority`
424. `litigation_enforcement::enforced_amount`
425. `litigation_enforcement::event_date`
426. `litigation_enforcement::issue_date`
427. `litigation_enforcement::judgment_amount`
428. `litigation_enforcement::parties`
429. `litigation_enforcement::security_or_attachment`
430. `litigation_enforcement::status`
431. `loan_contract::contract_interest_rate`
432. `loan_contract::maturity_date`
433. `loan_contract::repayment_installments`
434. `loan_contract::repayment_method`
435. `loan_contract::scheduled_payment`
436. `local_tax::arrears`
437. `local_tax::as_of_date`
438. `local_tax::assessed_amount`
439. `local_tax::authority`
440. `local_tax::collection_cost`
441. `local_tax::issue_date`
442. `local_tax::paid_amount`
443. `local_tax::surcharge`
444. `local_tax::tax_base`
445. `local_tax::tax_period`
446. `local_tax::tax_type`
447. `local_tax::taxpayer`
448. `local_tax_assessment::jurisdiction_scope`
449. `local_tax_assessment::no_assessment_text`
450. `local_tax_assessment::row_or_subtotal_kind`
451. `local_tax_assessment::tax_assessment_year`
452. `local_tax_assessment::tax_notice_status`
453. `local_tax_assessment::tax_object`
454. `payroll_payslip::income.payroll.allowances`
455. `payroll_payslip::income.payroll.bonus`
456. `payroll_payslip::income.payroll.employee`
457. `payroll_payslip::income.payroll.employer`
458. `payroll_payslip::income.payroll.gross_base`
459. `payroll_payslip::income.payroll.hours_days`
460. `payroll_payslip::income.payroll.issue_date`
461. `payroll_payslip::income.payroll.net_pay`
462. `payroll_payslip::income.payroll.other_deductions`
463. `payroll_payslip::income.payroll.overtime`
464. `payroll_payslip::income.payroll.pay_date`
465. `payroll_payslip::income.payroll.pay_period_end`
466. `payroll_payslip::income.payroll.pay_period_start`
467. `payroll_payslip::income.payroll.social_contributions`
468. `payroll_payslip::income.payroll.tax_withheld`
469. `pension_benefit_income::income.benefit.beneficiary`
470. `pension_benefit_income::income.benefit.benefit_type`
471. `pension_benefit_income::income.benefit.decision_date`
472. `pension_benefit_income::income.benefit.deductions`
473. `pension_benefit_income::income.benefit.monthly_gross`
474. `pension_benefit_income::income.benefit.net_payment`
475. `pension_benefit_income::income.benefit.payment_date`
476. `pension_benefit_income::income.benefit.payment_end`
477. `pension_benefit_income::income.benefit.payment_start`
478. `pension_benefit_income::income.benefit.provider`
479. `pension_benefit_income::income.benefit.review_status`
480. `pension_contribution_benefit::as_of_date`
481. `pension_contribution_benefit::benefit_amount`
482. `pension_contribution_benefit::benefit_type`
483. `pension_contribution_benefit::contribution`
484. `pension_contribution_benefit::encumbrance`
485. `pension_contribution_benefit::issue_date`
486. `pension_contribution_benefit::member`
487. `pension_contribution_benefit::payment_start`
488. `pension_contribution_benefit::period_end`
489. `pension_contribution_benefit::period_start`
490. `pension_contribution_benefit::plan_id`
491. `pension_contribution_benefit::provider`
492. `pension_contribution_benefit::vested_balance`
493. `pension_contribution_benefit::withdrawal_value`
494. `pension_contribution_statement::contribution_record_kind`
495. `pension_contribution_statement::paid_amount`
496. `pension_contribution_statement::paid_months`
497. `pension_contribution_statement::payable_amount`
498. `pension_contribution_statement::payable_months`
499. `pension_contribution_statement::standard_monthly_income`
500. `pension_contribution_statement::subscriber_type`
501. `pension_contribution_statement::unpaid_amount`
502. `pension_contribution_statement::unpaid_months`
503. `pension_contribution_statement::unpayable_amount`
504. `pension_contribution_statement::unpayable_months`
505. `procedure_court_orders::procedure.order.case_number`
506. `procedure_court_orders::procedure.order.court`
507. `procedure_court_orders::procedure.order.deadline`
508. `procedure_court_orders::procedure.order.debtor`
509. `procedure_court_orders::procedure.order.effective_date`
510. `procedure_court_orders::procedure.order.finality`
511. `procedure_court_orders::procedure.order.operative_text`
512. `procedure_court_orders::procedure.order.order_date`
513. `procedure_court_orders::procedure.order.order_type`
514. `procedure_court_orders::procedure.order.scope`
515. `procedure_court_orders::procedure.order.service_date`
516. `procedure_court_orders::procedure.order.status_change`
517. `procedure_enforcement_garnishment::procedure.enforcement.asset_or_income`
518. `procedure_enforcement_garnishment::procedure.enforcement.attached_amount`
519. `procedure_enforcement_garnishment::procedure.enforcement.authority`
520. `procedure_enforcement_garnishment::procedure.enforcement.case_number`
521. `procedure_enforcement_garnishment::procedure.enforcement.claimed_amount`
522. `procedure_enforcement_garnishment::procedure.enforcement.creditor`
523. `procedure_enforcement_garnishment::procedure.enforcement.debtor`
524. `procedure_enforcement_garnishment::procedure.enforcement.effective_date`
525. `procedure_enforcement_garnishment::procedure.enforcement.order_date`
526. `procedure_enforcement_garnishment::procedure.enforcement.order_type`
527. `procedure_enforcement_garnishment::procedure.enforcement.released_amount`
528. `procedure_enforcement_garnishment::procedure.enforcement.service_date`
529. `procedure_enforcement_garnishment::procedure.enforcement.status`
530. `procedure_prior_insolvency::procedure.history.case_number`
531. `procedure_prior_insolvency::procedure.history.case_type`
532. `procedure_prior_insolvency::procedure.history.court_authority`
533. `procedure_prior_insolvency::procedure.history.debtor`
534. `procedure_prior_insolvency::procedure.history.discharge_date`
535. `procedure_prior_insolvency::procedure.history.filing_date`
536. `procedure_prior_insolvency::procedure.history.finality_date`
537. `procedure_prior_insolvency::procedure.history.order_date`
538. `procedure_prior_insolvency::procedure.history.order_kind`
539. `procedure_prior_insolvency::procedure.history.private_adjustment_attempt`
540. `procedure_prior_insolvency::procedure.history.record_issue_date`
541. `procedure_private_creditor_request::procedure.creditor_info.as_of_date`
542. `procedure_private_creditor_request::procedure.creditor_info.claim_id`
543. `procedure_private_creditor_request::procedure.creditor_info.claim_origin_date`
544. `procedure_private_creditor_request::procedure.creditor_info.creditor`
545. `procedure_private_creditor_request::procedure.creditor_info.debtor`
546. `procedure_private_creditor_request::procedure.creditor_info.interest_balance`
547. `procedure_private_creditor_request::procedure.creditor_info.interest_rate`
548. `procedure_private_creditor_request::procedure.creditor_info.principal_balance`
549. `procedure_private_creditor_request::procedure.creditor_info.principal_original`
550. `procedure_private_creditor_request::procedure.creditor_info.request_copy`
551. `procedure_private_creditor_request::procedure.creditor_info.request_date`
552. `procedure_private_creditor_request::procedure.creditor_info.response_date`
553. `property_search::issue_date`
554. `property_search::jurisdiction_scope`
555. `property_search::ownership_share`
556. `property_search::property_found`
557. `property_search::property_id`
558. `property_search::registered_owner`
559. `property_search::search_as_of`
560. `property_search::searched_subject`
561. `real_estate_register::ownership_change_text`
562. `real_estate_register::property_address`
563. `real_property_register::acquisition_date`
564. `real_property_register::issue_date`
565. `real_property_register::maximum_claim`
566. `real_property_register::mortgage_holder`
567. `real_property_register::ownership_share`
568. `real_property_register::property_id`
569. `real_property_register::property_type`
570. `real_property_register::registered_owner`
571. `real_property_register::registered_value`
572. `real_property_register::registration_date`
573. `real_property_register::release_date`
574. `real_property_valuation::actual_payoff`
575. `real_property_valuation::disposal_cost`
576. `real_property_valuation::market_value`
577. `real_property_valuation::owner`
578. `real_property_valuation::ownership_share`
579. `real_property_valuation::property_id`
580. `real_property_valuation::valuation_date`
581. `real_property_valuation::valuation_method`
582. `receivable_collectability::collected_amount`
583. `receivable_collectability::collection_status`
584. `receivable_collectability::counterparty_status`
585. `receivable_collectability::demand_date`
586. `receivable_collectability::receivable_id`
587. `receivable_collectability::security_reference`
588. `receivable_collectability::uncollected_reason`
589. `resident_registration::address_change_date`
590. `resident_registration::historical_address`
591. `resident_registration::residence_history_period`
592. `retirement_estimate::estimated_retirement_date`
593. `retirement_estimate::payout_condition`
594. `retirement_estimate::retirement_scheme`
595. `retirement_estimate::service_period`
596. `retirement_estimate::transfer_history`
597. `salary_statement::employer_confirmation_status`
598. `salary_statement::employer_signature_date`
599. `salary_statement::gross_total`
600. `salary_statement::total_deductions`
601. `secured_claim_security::actual_payoff`
602. `secured_claim_security::collateral_id`
603. `secured_claim_security::discharge_date`
604. `secured_claim_security::grantor`
605. `secured_claim_security::priority`
606. `secured_claim_security::registered_maximum`
607. `secured_claim_security::registration_date`
608. `secured_claim_security::secured_party`
609. `secured_claim_security::security_type`
610. `securities_balance::account_coverage`
611. `securities_balance::asset_class`
612. `securities_balance::cash_balance`
613. `securities_balance::quantity`
614. `securities_balance::quantity_unit`
615. `securities_balance::security_id`
616. `securities_balance::security_name`
617. `securities_balance::settlement_basis`
618. `securities_balance::unsettled_liability`
619. `securities_balance::valuation_currency`
620. `securities_balance::valuation_datetime`
621. `securities_balance::valuation_method`
622. `securities_balance::valuation_unit_price`
623. `securities_transactions::counter_account`
624. `securities_transactions::fee`
625. `securities_transactions::quantity`
626. `securities_transactions::quantity_unit`
627. `securities_transactions::security_event_kind`
628. `securities_transactions::security_id`
629. `securities_transactions::security_name`
630. `securities_transactions::settled_amount`
631. `securities_transactions::settlement_date`
632. `securities_transactions::tax`
633. `securities_transactions::trade_gross`
634. `securities_transactions::trade_unit_price`
635. `tax_income::arrears`
636. `tax_income::gross_receipts`
637. `tax_income::income_after_expenses`
638. `tax_income::income_kind`
639. `tax_income::issue_date`
640. `tax_income::necessary_expenses`
641. `tax_income::period_end`
642. `tax_income::period_start`
643. `tax_income::tax_assessed`
644. `tax_income::tax_paid`
645. `tax_income::tax_year`
646. `tax_income::taxpayer`
647. `tax_public_arrear::as_of_date`
648. `tax_public_arrear::assessment_date`
649. `tax_public_arrear::authority`
650. `tax_public_arrear::costs`
651. `tax_public_arrear::debtor`
652. `tax_public_arrear::due_date`
653. `tax_public_arrear::issue_date`
654. `tax_public_arrear::principal_arrear`
655. `tax_public_arrear::surcharge_interest`
656. `tax_public_arrear::tax_period`
657. `tax_public_arrear::tax_type`
658. `tax_public_arrear::total_due`
659. `vehicle_registration::model_year`
660. `vehicle_registration::plate_number`
661. `vehicle_registration::record_issue_date`
662. `vehicle_registration::vin`
663. `vehicle_registry::acquisition_date`
664. `vehicle_registry::co_owners`
665. `vehicle_registry::lien_date`
666. `vehicle_registry::lien_holder`
667. `vehicle_registry::ownership_share`
668. `vehicle_registry::registered_lien_amount`
669. `vehicle_registry::registered_owner`
670. `vehicle_registry::registration_status`
671. `vehicle_registry::release_date`
672. `vehicle_registry::transfer_date`
673. `vehicle_registry::vehicle_id`
674. `vehicle_valuation::actual_payoff`
675. `vehicle_valuation::market_value`
676. `vehicle_valuation::mileage`
677. `vehicle_valuation::model_year`
678. `vehicle_valuation::owner`
679. `vehicle_valuation::registered_lien_amount`
680. `vehicle_valuation::valuation_date`
681. `vehicle_valuation::valuation_method`
682. `vehicle_valuation::vehicle_id`
683. `wage_withholding_tax::income.tax.employment_start_end`
684. `wage_withholding_tax::income.tax.gross_wages`
685. `wage_withholding_tax::income.tax.issue_date`
686. `wage_withholding_tax::income.tax.resident_tax`
687. `wage_withholding_tax::income.tax.tax_exempt_allowances`
688. `wage_withholding_tax::income.tax.tax_year`
689. `wage_withholding_tax::income.tax.taxable_allowances`
690. `wage_withholding_tax::income.tax.taxpayer`
691. `wage_withholding_tax::income.tax.withheld_income_tax`
692. `wage_withholding_tax::income.tax.withholding_agent`
693. `wage_withholding_tax::income.tax.year_end_adjustment`

## 부록 B. 6담당자 A3 체크 ID 124개 전체 순번 (완료 0)

001. `A3-IT-001` [ ]
002. `A3-IT-002` [ ]
003. `A3-IT-003` [ ]
004. `A3-IT-004` [ ]
005. `A3-IT-005` [ ]
006. `A3-IT-006` [ ]
007. `A3-IT-007` [ ]
008. `A3-IT-008` [ ]
009. `A3-IT-009` [ ]
010. `A3-IT-010` [ ]
011. `A3-IT-011` [ ]
012. `A3-IT-012` [ ]
013. `A3-IT-013` [ ]
014. `A3-IT-014` [ ]
015. `A3-IT-015` [ ]
016. `A3-IT-016` [ ]
017. `A3-IT-017` [ ]
018. `A3-IT-018` [ ]
019. `A3-IT-019` [ ]
020. `A3-IT-020` [ ]
021. `A3-DOC-001` [ ]
022. `A3-DOC-002` [ ]
023. `A3-DOC-003` [ ]
024. `A3-DOC-004` [ ]
025. `A3-DOC-005` [ ]
026. `A3-DOC-006` [ ]
027. `A3-DOC-007` [ ]
028. `A3-DOC-008` [ ]
029. `A3-DOC-009` [ ]
030. `A3-DOC-010` [ ]
031. `A3-DOC-011` [ ]
032. `A3-DOC-012` [ ]
033. `A3-DOC-013` [ ]
034. `A3-DOC-014` [ ]
035. `A3-DOC-015` [ ]
036. `A3-DOC-016` [ ]
037. `A3-DOC-017` [ ]
038. `A3-DOC-018` [ ]
039. `A3-DOC-019` [ ]
040. `A3-DOC-020` [ ]
041. `A3-CALC-001` [ ]
042. `A3-CALC-002` [ ]
043. `A3-CALC-003` [ ]
044. `A3-CALC-004` [ ]
045. `A3-CALC-005` [ ]
046. `A3-CALC-006` [ ]
047. `A3-CALC-007` [ ]
048. `A3-CALC-008` [ ]
049. `A3-CALC-009` [ ]
050. `A3-CALC-010` [ ]
051. `A3-CALC-011` [ ]
052. `A3-CALC-012` [ ]
053. `A3-CALC-013` [ ]
054. `A3-CALC-014` [ ]
055. `A3-CALC-015` [ ]
056. `A3-CALC-016` [ ]
057. `A3-CALC-017` [ ]
058. `A3-CALC-018` [ ]
059. `A3-CALC-019` [ ]
060. `A3-CALC-020` [ ]
061. `A3-LAW-001` [ ]
062. `A3-LAW-002` [ ]
063. `A3-LAW-003` [ ]
064. `A3-LAW-004` [ ]
065. `A3-LAW-005` [ ]
066. `A3-LAW-006` [ ]
067. `A3-LAW-007` [ ]
068. `A3-LAW-008` [ ]
069. `A3-LAW-009` [ ]
070. `A3-LAW-010` [ ]
071. `A3-LAW-011` [ ]
072. `A3-LAW-012` [ ]
073. `A3-LAW-013` [ ]
074. `A3-LAW-014` [ ]
075. `A3-LAW-015` [ ]
076. `A3-LAW-016` [ ]
077. `A3-LAW-017` [ ]
078. `A3-LAW-018` [ ]
079. `A3-LAW-019` [ ]
080. `A3-LAW-020` [ ]
081. `A3-LAW-021` [ ]
082. `A3-LAW-022` [ ]
083. `A3-DATA-001` [ ]
084. `A3-DATA-002` [ ]
085. `A3-DATA-003` [ ]
086. `A3-DATA-004` [ ]
087. `A3-DATA-005` [ ]
088. `A3-DATA-006` [ ]
089. `A3-DATA-007` [ ]
090. `A3-DATA-008` [ ]
091. `A3-DATA-009` [ ]
092. `A3-DATA-010` [ ]
093. `A3-DATA-011` [ ]
094. `A3-DATA-012` [ ]
095. `A3-DATA-013` [ ]
096. `A3-DATA-014` [ ]
097. `A3-DATA-015` [ ]
098. `A3-DATA-016` [ ]
099. `A3-DATA-017` [ ]
100. `A3-DATA-018` [ ]
101. `A3-DATA-019` [ ]
102. `A3-DATA-020` [ ]
103. `A3-DATA-021` [ ]
104. `A3-DATA-022` [ ]
105. `A3-AX-001` [ ]
106. `A3-AX-002` [ ]
107. `A3-AX-003` [ ]
108. `A3-AX-004` [ ]
109. `A3-AX-005` [ ]
110. `A3-AX-006` [ ]
111. `A3-AX-007` [ ]
112. `A3-AX-008` [ ]
113. `A3-AX-009` [ ]
114. `A3-AX-010` [ ]
115. `A3-AX-011` [ ]
116. `A3-AX-012` [ ]
117. `A3-AX-013` [ ]
118. `A3-AX-014` [ ]
119. `A3-AX-015` [ ]
120. `A3-AX-016` [ ]
121. `A3-AX-017` [ ]
122. `A3-AX-018` [ ]
123. `A3-AX-019` [ ]
124. `A3-AX-020` [ ]
