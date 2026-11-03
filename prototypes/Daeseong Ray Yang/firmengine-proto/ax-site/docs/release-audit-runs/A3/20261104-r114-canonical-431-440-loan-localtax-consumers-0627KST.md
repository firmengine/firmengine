# FirmEngine A3 r114 — OCR canonical #431~440 전체 소비처 독립 재감사 (2026-11-04 KST)

## 1. 조사 범위 · 판본 · 이전 회차

- GitHub `firmengine/firmengine` **main 고정 읽기 SHA `cb18e9f8fc38fc76356d07c2079beaf9c0fb6ec5`**, 변경 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 이전 [r113 #421–430](20261104-r113-canonical-421-430-litigation-enforcement-0530KST.md) 다음의 **#431–440** 확인. 과거 [r22 #421–440](20261031-r22-canonical-421-440-1029KST.md) 광역 감사와 비교하되 이번 r114는 10개 ID별로 별도 확인했다.
- 담당자 순환: **데이터 → IT → 사용자·서류 → 계산사무장 → 변호사 → AX**. 실제 보드 체크 ID 5개: `A3-DATA-008`, `A3-IT-007`, `A3-DOC-015`, `A3-CALC-005`, `A3-LAW-003`. 모두 **[ ] 미완료 유지**.
- main 최근 A3 r113/A1 r113/A2 r114 커밋과 A3 Draft PR 목록을 선행 조회. 과거 지방세 generic review 후보 미연결(r22) 지적은 **main 수정 완료로 가정하지 않음**.
- 실제 GitHub 데이터 조회: 마지막 **파일 SHA 15개 표**, 별도 읽은 `feature-lineage-audit.ts`, `canonical-field-binding.ts`, `document-substitution.ts`, `preapproval-correction-item-store.ts`, `shared-document-catalog.ts`; 이전 회차 영수증. 사용한 원본 함수는 아래 `ocr-calculation-input.ts`이다.
- 고객 PDF/OCR 사실값/개인정보/키/.env 사용 및 기록 없음. 합성 입력만 사용. **전체 Node CI, staging D1/R2/Cron, 실제 공식 법원 서식, 변호사 승인·사이트 배포 미실행/미인증**. 제품 코드·운영정책·운영 DB·전자제출 수정 금지.

## 2. 전체 등록자산·실행범위

| 항목 | 실제 확인 | 수준 |
|---|---:|---|
| Canonical OCR / 중복 | 693 / 0 | 최신 인덱스 |
| 증빙서류 / family / 문서×family | 85 / 48 / 141 | 최신 원천 |
| base+shared+OCR supplement 원천 슬롯 | 1808 (OCR supplement 19) | 선언 필드 슬롯, 실제 추출 건수 아님 |
| 이번 감사 | **10 ID / 20 슬롯 / 3 문서** | #431~440 |
| 적용조건 | loan 확장 **0/5 미등록**; 지방세 **5/5 source_conditional 등록** | 등록≠법률 승인, 미등록 0% 합격 |
| 직접 typed / material / 계산 input / form token / 승인 법률 | **0/10 / 0/10 / 0/10 / 0/10 / 0 인증** | exact static, 동적·운영 미검증 |
| 계산 / 선언 input / unique input | 18 / 91 / 78 | 계산 실행 아님 |
| 법률위험 / 규칙 / 예외 | 95 / 50 / 46 | 인가·운영판본 미조회 |
| 독립 계약 assertions | 30/30 | static boolean 비교 |
| 원본 field-local V8 합성 사례 | 15 | domain normalizeMoney 합성 stub |
| A3 최종 제품 인수 | **0/124** | 계속 미완료 |

**원본·행·사건 분리:** 문서ID·해시, page, 인용·bbox, 동일 과세기간/대상자/채권자, source record ordinal, 기간·금액 단위·원문통화가 같은 판본으로 결속돼야 한다. `ocr-chain-matrix.ts`에서는 `extracted_features.canonical_field_id`, `raw_value_json`, `source_state`를 선언하지만 실제 D1 current Fact insert/readback과 typed 변환은 미관찰. `null`, `0`, `unobserved`, `not_applicable`, `conflict`, `source-only`, `pending-approval`을 혼동하지 않는다.

## 3. 각 canonical ID의 evidence / DB Fact / 산식 / 법률 / 서식 / 갈음/보정

| # | canonical ID | 실제 서류·family 슬롯 | 타입 / 원단위 / 대상 / 시간역할 | 적용조건 | 직접 typed / material / calc / token / legal-approved | 독립 역질문/소비공백 |
|---:|---|---|---|---|---|---|
| 431 | `loan_contract::contract_interest_rate` | loan_contract/debt_certificate/shared_extension<br>loan_contract/bank_transactions/shared_extension | `decimal_or_text` / `source rate unit` / `document_subject` / `not_applicable` | `UNREGISTERED` | 0 / 0 / 0 / 0 / 미승인 | 약정 채권자/계약번호/상환주기·일자, 현재 채무원금·이자와 다른 출처로 보존 |
| 432 | `loan_contract::maturity_date` | loan_contract/debt_certificate/shared_extension<br>loan_contract/bank_transactions/shared_extension | `date` / `not_applicable` / `document_subject` / `source_date_time_or_period` | `UNREGISTERED` | 0 / 0 / 0 / 0 / 미승인 | 약정 채권자/계약번호/상환주기·일자, 현재 채무원금·이자와 다른 출처로 보존 |
| 433 | `loan_contract::repayment_installments` | loan_contract/debt_certificate/shared_extension<br>loan_contract/bank_transactions/shared_extension | `integer` / `count` / `document_subject` / `not_applicable` | `UNREGISTERED` | 0 / 0 / 0 / 0 / 미승인 | 약정 채권자/계약번호/상환주기·일자, 현재 채무원금·이자와 다른 출처로 보존 |
| 434 | `loan_contract::repayment_method` | loan_contract/debt_certificate/shared_extension<br>loan_contract/bank_transactions/shared_extension | `string` / `not_applicable` / `document_subject` / `not_applicable` | `UNREGISTERED` | 0 / 0 / 0 / 0 / 미승인 | 약정 채권자/계약번호/상환주기·일자, 현재 채무원금·이자와 다른 출처로 보존 |
| 435 | `loan_contract::scheduled_payment` | loan_contract/debt_certificate/shared_extension<br>loan_contract/bank_transactions/shared_extension | `money` / `source currency/unit` / `document_subject` / `not_applicable` | `UNREGISTERED` | 0 / 0 / 0 / 0 / 미승인 | 약정 채권자/계약번호/상환주기·일자, 현재 채무원금·이자와 다른 출처로 보존 |
| 436 | `local_tax::arrears` | tax_arrears/local_tax/base<br>local_tax_assessment/local_tax/base | `money` / `currency and exact source unit if monetary` / `taxpayer` / `not_applicable` | `source_conditional` | 0 / 0 / 0 / 0 / 미승인 | 세목·과세기관·납세자, 부과/납부/체납/징수비용과 기준일 결속 확인 |
| 437 | `local_tax::as_of_date` | tax_arrears/local_tax/base<br>local_tax_assessment/local_tax/base | `date` / `source date format normalized to ISO without loss` / `taxpayer` / `balance_as_of_date` | `source_conditional` | 0 / 0 / 0 / 0 / 미승인 | 세목·과세기관·납세자, 부과/납부/체납/징수비용과 기준일 결속 확인 |
| 438 | `local_tax::assessed_amount` | tax_arrears/local_tax/base<br>local_tax_assessment/local_tax/base | `money` / `currency and exact source unit if monetary` / `taxpayer` / `not_applicable` | `source_conditional` | 0 / 0 / 0 / 0 / 미승인 | 세목·과세기관·납세자, 부과/납부/체납/징수비용과 기준일 결속 확인 |
| 439 | `local_tax::authority` | tax_arrears/local_tax/base<br>local_tax_assessment/local_tax/base | `party_role` / `not_applicable` / `taxpayer` / `not_applicable` | `source_conditional` | 0 / 0 / 0 / 0 / 미승인 | 세목·과세기관·납세자, 부과/납부/체납/징수비용과 기준일 결속 확인 |
| 440 | `local_tax::collection_cost` | tax_arrears/local_tax/base<br>local_tax_assessment/local_tax/base | `money` / `currency and exact source unit if monetary` / `taxpayer` / `not_applicable` | `source_conditional` | 0 / 0 / 0 / 0 / 미승인 | 세목·과세기관·납세자, 부과/납부/체납/징수비용과 기준일 결속 확인 |

- #431 이율(`decimal_or_text`)의 150%/연·월·변동/고정 등 의미 검증, #433 회차수(`integer`) 음수, #434 약정 상환방식, #435 예정 금액(`money`)의 지급주기 및 원통화·원문인용은 별도 도메인 체크가 필요. **예정납부액은 현재 채무 잔액과 동일하지 않다.** 월환산·원화무단합산 금지.
- #436 체납(`arrears`)은 불납원금, #438 부과액(`assessed_amount`)은 부과기록, #440 징수비용(`collection_cost`)은 별도 비용. #441 이후의 `paid_amount`·`surcharge` 및 세목·세액 기준일·납세자 동일성, 납부명령/법적 우선권 대조 전 중복합산 금지. `tax_public_arrear::principal_arrear`와 `local_tax::arrears`는 **서로 다른 exact canonical ID**, 자동 매핑 금지.
- 법률 위험95·규칙50·예외46의 등록은 해당 canonical의 법률상 인정이 아니다. `legal-evidence-criteria.ts`의 seed `checks=[]`, 운영 승인형 정책 D1 확인 안 됨; **법률 최종 인가 0%**. generic family `reviewScope`의 D5106/D5110 등은 직접 공식 서식 token이나 판본 증명 아님.
- 갈음·보정은 `document-substitution.ts`의 증거 대체 정책, `preapproval-correction-item-store.ts`의 human `requiredCanonicalFieldIds`가 있으나 **#431~440 실제 도달 사례/공식 보정명령 경로 미조회**. 정확 계산/법률 소비처 0인 경우도 증거·검산·역질문·법률근거 후보로 유지하고 폐기 금지.

## 4. 독립 정적 불변식 검사 — 30/30

| 번호 | 검증 명제 | 기대 | 관찰 |
|---:|---|---|---|
| 1 | 693 canonical | true | true |
| 2 | index no repeats | true | true |
| 3 | 85 documents | true | true |
| 4 | 48 families | true | true |
| 5 | 141 document/family routes | true | true |
| 6 | 1808 merged slots | true | true |
| 7 | 19 OCR supplemental slots | true | true |
| 8 | 10 target fields | true | true |
| 9 | 20 target slots | true | true |
| 10 | 3 target documents | true | true |
| 11 | loan five fields each two routes | true | true |
| 12 | tax five fields each two routes | true | true |
| 13 | loan extension applicability 0/5 | true | true |
| 14 | local tax applicability 5/5 source conditional | true | true |
| 15 | field type/unit/role/temporal defined | true | true |
| 16 | all target source anchors | true | true |
| 17 | all routes record isolation declared | true | true |
| 18 | target exact typed 0 | true | true |
| 19 | target no projection literal | true | true |
| 20 | target exact material 0 | true | true |
| 21 | target exact calculation inputs 0 | true | true |
| 22 | target exact form tokens 0 | true | true |
| 23 | legal policy seed empty | true | true |
| 24 | 18 calculation modules | true | true |
| 25 | 91 declared input slots | true | true |
| 26 | 78 unique calc inputs | true | true |
| 27 | 95 risk checks | true | true |
| 28 | 50 legal rules | true | true |
| 29 | 46 exception scenarios | true | true |
| 30 | 124 unique A3 board checks | true | true |

## 5. 실제 실행한 로컬 OCR 원본 함수 V8 합성시험 — 15건

`ocr-calculation-input.ts` 원본 `validDate`, `validTime`, `calculationSourceCellIssues`에서 TypeScript **타입 주석만 제거**하여 V8 `new Function`으로 호출. `normalizeMoney`만 **실 domain.ts 아닌 합성 stub(KRW 정수 문자열만 exact)**으로 주입. 독립 기대는 기존 코드 반환값이 아니라 검토해야 할 도메인 안전성이다. 15/15 실행은 법률·산식 업무 합격이 아님.

| 번호 | field / 합성 입력 | 독립 기대 | 실제 로컬 관찰 결과 | 판정 |
|---:|---|---|---|---|
| 1 | `loan_contract::contract_interest_rate`: interest_rate 150% `{"value":"150%","unit":"%","quote":"150%","sourceState":"present"}` | `BUSINESS_RATE_SCOPE_REVIEW` | `[]` | FIELD_LOCAL_BUSINESS_GAP |
| 2 | `loan_contract::maturity_date`: invalid maturity date `{"value":"2026-02-30","unit":null,"quote":"2026-02-30","sourceState":"present"}` | `SOURCE_DATE_INVALID` | `["SOURCE_DATE_INVALID"]` | DETECTED |
| 3 | `loan_contract::repayment_installments`: negative installments `{"value":"-12","unit":"count","quote":"-12","sourceState":"present"}` | `BUSINESS_NEGATIVE_INSTALLMENTS` | `[]` | FIELD_LOCAL_BUSINESS_GAP |
| 4 | `loan_contract::repayment_method`: unknown method `{"value":"unregistered-method","unit":null,"quote":"unregistered-method","sourceState":"present"}` | `BUSINESS_METHOD_EVIDENCE` | `[]` | FIELD_LOCAL_BUSINESS_GAP |
| 5 | `loan_contract::scheduled_payment`: USD quote, KRW unit `{"value":"100","unit":"KRW","quote":"USD 100","sourceState":"present"}` | `BUSINESS_QUOTE_UNIT_MISMATCH` | `[]` | FIELD_LOCAL_BUSINESS_GAP |
| 6 | `local_tax::arrears`: USD quote, KRW unit `{"value":"100","unit":"KRW","quote":"USD 100","sourceState":"present"}` | `BUSINESS_QUOTE_UNIT_MISMATCH` | `[]` | FIELD_LOCAL_BUSINESS_GAP |
| 7 | `local_tax::as_of_date`: invalid as-of date `{"value":"2026-02-30","unit":null,"quote":"2026-02-30","sourceState":"present"}` | `SOURCE_DATE_INVALID` | `["SOURCE_DATE_INVALID"]` | DETECTED |
| 8 | `local_tax::assessed_amount`: USD quote, KRW unit `{"value":"400","unit":"KRW","quote":"USD 400","sourceState":"present"}` | `BUSINESS_QUOTE_UNIT_MISMATCH` | `[]` | FIELD_LOCAL_BUSINESS_GAP |
| 9 | `local_tax::authority`: unverified collecting authority `{"value":"arbitrary-authority","unit":null,"quote":"arbitrary-authority","sourceState":"present"}` | `BUSINESS_AUTHORITY_IDENTITY` | `[]` | FIELD_LOCAL_BUSINESS_GAP |
| 10 | `local_tax::collection_cost`: USD quote, KRW unit `{"value":"20","unit":"KRW","quote":"USD 20","sourceState":"present"}` | `BUSINESS_QUOTE_UNIT_MISMATCH` | `[]` | FIELD_LOCAL_BUSINESS_GAP |
| 11 | `loan_contract::scheduled_payment`: source present but value null `{"value":null,"unit":"KRW","quote":"","sourceState":"present"}` | `SOURCE_PRESENT_VALUE_MISSING` | `["SOURCE_PRESENT_VALUE_MISSING"]` | DETECTED |
| 12 | `local_tax::arrears`: source quote missing `{"value":"100","unit":"KRW","quote":"","sourceState":"present"}` | `SOURCE_QUOTE_MISSING` | `["SOURCE_QUOTE_MISSING"]` | DETECTED |
| 13 | `local_tax::arrears`: monetary unit missing `{"value":"100","unit":null,"quote":"100","sourceState":"present"}` | `SOURCE_MONETARY_UNIT_MISSING` | `["SOURCE_MONETARY_UNIT_MISSING"]` | DETECTED |
| 14 | `local_tax::arrears`: uncertain OCR reading `{"value":"100","unit":"KRW","quote":"100","sourceState":"present","confidence":"uncertain"}` | `SOURCE_READ_UNCERTAIN` | `["SOURCE_READ_UNCERTAIN"]` | DETECTED |
| 15 | `local_tax::arrears`: unknown source state `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `UNKNOWN_NO_DECISION` | `[]` | NO_DECISION |

날짜 형식불능, source-present에서 값·인용·단위 누락, uncertain confidence는 로컬에서 검출. 이율 150%, 음수 회차, 임의 상환방법·기관, 원문 인용 USD vs 선언 KRW는 **field-local warning 없음**. 상위 게이트에서 차단되는지는 미확인, 따라서 운영 전체 결함 확정/실제 금액 정상화 정확도 인증 금지.

## 6. 이번 보드 5 ID 부분증거 (완료 [ ] 불가)

| 보드 ID | 실제 검증·누적 | 남은 인증 |
|---|---|---|
| A3-DATA-008 | 20 source slots / 3 documents / row isolation 정책 선언 | 실문서 다중 행, 페이지·원문·bbox·해시, D1 current Fact 재조회 |
| A3-IT-007 | 별도 단위·자료형, 로컬 OCR 형식 15회 | 실제 numeric normalization, 원통화 충돌 상위 검증/전체 Node CI |
| A3-DOC-015 | loan_contract 2 family 확장 5개 source-only, 지방세 2문서 | 계약자/채권자·원인·공식 제출서류 동일성 검증 |
| A3-CALC-005 | 계산18·입력91 exact 연결0, 금액 의미 구별 | 실제 원금·이자·납부/체납·비용·중복검산 |
| A3-LAW-003 | 95/50/46 정적 및 법률 seed empty | 우선·담보/별제권, 지방세 법적 분류·근거·관할/시행일·변호사 승인 |

## 7. 조사 상태 및 다음 ID

**r114 재감사 끝 #440/693, 잔여 253. A3 제품 인수 0/124.** 운영 배포/전자제출/실 DB 수정 및 기준의 법률상 확정값 승격 없음. **다음 시작 #441 `local_tax::issue_date` ~ #450**, 다음 역할 **IT담당자 시작**. 지방세 납부/가산금/기간·채무귀속 및 대출·공적채무 중복검산.

### 실제 조회 파일 blob SHA

| 소스 경로 (ax-site 내부) | blob SHA |
|---|---|
| `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` | `5e5247eec2597c3cd3ad7e71252ff96db73c57e5` |
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
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/reference-case-projection.ts` | `92cb5fd5816571259e070490a496e7b7f4d8515c` |

### canonical OCR 최신 전체 인덱스 693개

| # | Canonical ID |
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

### A3 6역할 체크 ID 전체 124개

| # | ID |
|---:|---|
| 1 | `A3-IT-001` |
| 2 | `A3-IT-002` |
| 3 | `A3-IT-003` |
| 4 | `A3-IT-004` |
| 5 | `A3-IT-005` |
| 6 | `A3-IT-006` |
| 7 | `A3-IT-007` |
| 8 | `A3-IT-008` |
| 9 | `A3-IT-009` |
| 10 | `A3-IT-010` |
| 11 | `A3-IT-011` |
| 12 | `A3-IT-012` |
| 13 | `A3-IT-013` |
| 14 | `A3-IT-014` |
| 15 | `A3-IT-015` |
| 16 | `A3-IT-016` |
| 17 | `A3-IT-017` |
| 18 | `A3-IT-018` |
| 19 | `A3-IT-019` |
| 20 | `A3-IT-020` |
| 21 | `A3-DOC-001` |
| 22 | `A3-DOC-002` |
| 23 | `A3-DOC-003` |
| 24 | `A3-DOC-004` |
| 25 | `A3-DOC-005` |
| 26 | `A3-DOC-006` |
| 27 | `A3-DOC-007` |
| 28 | `A3-DOC-008` |
| 29 | `A3-DOC-009` |
| 30 | `A3-DOC-010` |
| 31 | `A3-DOC-011` |
| 32 | `A3-DOC-012` |
| 33 | `A3-DOC-013` |
| 34 | `A3-DOC-014` |
| 35 | `A3-DOC-015` |
| 36 | `A3-DOC-016` |
| 37 | `A3-DOC-017` |
| 38 | `A3-DOC-018` |
| 39 | `A3-DOC-019` |
| 40 | `A3-DOC-020` |
| 41 | `A3-CALC-001` |
| 42 | `A3-CALC-002` |
| 43 | `A3-CALC-003` |
| 44 | `A3-CALC-004` |
| 45 | `A3-CALC-005` |
| 46 | `A3-CALC-006` |
| 47 | `A3-CALC-007` |
| 48 | `A3-CALC-008` |
| 49 | `A3-CALC-009` |
| 50 | `A3-CALC-010` |
| 51 | `A3-CALC-011` |
| 52 | `A3-CALC-012` |
| 53 | `A3-CALC-013` |
| 54 | `A3-CALC-014` |
| 55 | `A3-CALC-015` |
| 56 | `A3-CALC-016` |
| 57 | `A3-CALC-017` |
| 58 | `A3-CALC-018` |
| 59 | `A3-CALC-019` |
| 60 | `A3-CALC-020` |
| 61 | `A3-LAW-001` |
| 62 | `A3-LAW-002` |
| 63 | `A3-LAW-003` |
| 64 | `A3-LAW-004` |
| 65 | `A3-LAW-005` |
| 66 | `A3-LAW-006` |
| 67 | `A3-LAW-007` |
| 68 | `A3-LAW-008` |
| 69 | `A3-LAW-009` |
| 70 | `A3-LAW-010` |
| 71 | `A3-LAW-011` |
| 72 | `A3-LAW-012` |
| 73 | `A3-LAW-013` |
| 74 | `A3-LAW-014` |
| 75 | `A3-LAW-015` |
| 76 | `A3-LAW-016` |
| 77 | `A3-LAW-017` |
| 78 | `A3-LAW-018` |
| 79 | `A3-LAW-019` |
| 80 | `A3-LAW-020` |
| 81 | `A3-LAW-021` |
| 82 | `A3-LAW-022` |
| 83 | `A3-DATA-001` |
| 84 | `A3-DATA-002` |
| 85 | `A3-DATA-003` |
| 86 | `A3-DATA-004` |
| 87 | `A3-DATA-005` |
| 88 | `A3-DATA-006` |
| 89 | `A3-DATA-007` |
| 90 | `A3-DATA-008` |
| 91 | `A3-DATA-009` |
| 92 | `A3-DATA-010` |
| 93 | `A3-DATA-011` |
| 94 | `A3-DATA-012` |
| 95 | `A3-DATA-013` |
| 96 | `A3-DATA-014` |
| 97 | `A3-DATA-015` |
| 98 | `A3-DATA-016` |
| 99 | `A3-DATA-017` |
| 100 | `A3-DATA-018` |
| 101 | `A3-DATA-019` |
| 102 | `A3-DATA-020` |
| 103 | `A3-DATA-021` |
| 104 | `A3-DATA-022` |
| 105 | `A3-AX-001` |
| 106 | `A3-AX-002` |
| 107 | `A3-AX-003` |
| 108 | `A3-AX-004` |
| 109 | `A3-AX-005` |
| 110 | `A3-AX-006` |
| 111 | `A3-AX-007` |
| 112 | `A3-AX-008` |
| 113 | `A3-AX-009` |
| 114 | `A3-AX-010` |
| 115 | `A3-AX-011` |
| 116 | `A3-AX-012` |
| 117 | `A3-AX-013` |
| 118 | `A3-AX-014` |
| 119 | `A3-AX-015` |
| 120 | `A3-AX-016` |
| 121 | `A3-AX-017` |
| 122 | `A3-AX-018` |
| 123 | `A3-AX-019` |
| 124 | `A3-AX-020` |
