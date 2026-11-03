# FirmEngine A3 r105 — canonical #341–350 가구원·부양 증거·계산·법률·서식 소비처 감사

- 기준: 2026-11-03 KST, GitHub `main` HEAD `55c3a0ca80611c99e1fe352fffcaa0260f80a8a3`, 직전 r104 #331–340 및 과거 r18 #341–360 영수증·최신 원천 파일·보드 비교. 최근 main 커밋은 A2 r105, A1 r104, A3 r104 문서 변경. 이 영수증 및 보드 수정은 지정 `ax-site/` 하위만.
- 여섯 역할 순환: **사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → IT담당자 → AX담당자**. 이번 집중 체크 다섯 ID: `A3-DOC-003`, `A3-CALC-009`, `A3-LAW-008`, `A3-DATA-008`, `A3-IT-003`. 모두 **미완료 [ ] 유지**. AX 담당자는 의미·용도/상충 교차검토, 추가 체크 ID 상태 변경 없음.
- 검증층: 최신 JSON/TS **정적 원천 결속** + 원본 `calculationSourceCellIssues`의 타입 표기만 제거한 V8 격리 호출 **18/18 현행 반환 재현**. `normalizeMoney` 의존 함수는 **합성 stub**(KRW+숫자만 exact)으로 대체, 실제 환율·금액 정규화·상위 검증·Node CI 테스트가 아니다. 원본 고객 자료/환경/키 사용하지 않음.

## 1. 실측 정적 카탈로그 및 승인 경계

| 항목 | 정적 조회값 / 독립 기대·관찰 | 검증 수준 |
|---|---|---|
| 등록 canonical ID / 중복 | **693/693**, 중복 0 | 실제 인덱스 전수 순회 |
| 서류/패밀리/문서×패밀리 라우트 | **85 / 48 / 141** | 상담·원천 카탈로그 join |
| 전체 원천 슬롯/고아/미등록 ID | **1,808 / 0 / 0** | `shared-document-catalog.ts`의 base+shared extension+supplement 병합을 JS에서 재구성해 전수 검사 |
| 이번 ID/원천 슬롯 | **10/50** | 가구부양 family 5개 증빙문서 × 10 피처 |
| 적용조건 등록 | **10/10** `source_conditional`, **실무·법률 승인 미인증(0% 합격)** | 개별 적용계약 선언 |
| 정확 typed / material / 직접 계산 / 서식토큰 | **0 / 0 / 0 / 0** | canonical binding / material gate / calc 18·91 / OCR form target 정확 ID 대조 |
| 승인 법률 증거계약 | **0/10 (seed checks=[])**, 운영 관리형 승인값 **미조회** | 95위험·50규칙·46예외는 후보 카탈로그, 직접 승인 아님 |
| 전체 선언 계산/입력 | **18 / 91** (고유 입력 78) | 실제 JSON 정적 검사 |
| source locator 및 DB | `extraction_records`, `extracted_features`, 문서 SHA/page/row/quote/bbox 원천 결속 선언 | 실제 D1 Fact/typed 저장·재조회 **미관찰** |
| 시간/단위 표시 요구 | `hasPeriod` **7/10** · `hasUnit` **2/10** | 선언 술어만 적용; 타 필드 교차조건이나 원문인증 아님 |
| V8 로컬 테스트 | **18/18 현행 분기 일치** | 독립 계산·법률 안전성 합격 아님 |
| A3 전체 담당자 체크 | **124**, 최종 합격 **0/124** | 기존 보드 `[ ]` 유지 |

**0개 직접 소비처는 ‘무용’ 판정이 아니다.** 원문 당사자·실거주·부양관계·실제 지급·기간에 대한 source-only 증거, 검산/역질문/법률 판단 후보로 보존한다. 미관찰/null/명시0/confirmed_none/비해당/상충/미승인은 서로 다르게 취급하고, 원화 합산·법률상 인정 자동승격 금지.

## 2. canonical #341~350 개별 실제 원천·소비처/공백

원천 문서 5개: `family_relation`, `dependent_evidence`, `spouse_asset_evidence`, `free_residence_confirmation`, `divorce_records`; `household_composition_support` family. 문서×가구원×원천행 구분이 중요하며, 각 source가 실제로 해당 피처를 포함한다는 뜻은 아님.

| # | canonical 정확 ID | **선언된 원천 문서 / route** | 데이터형 / 단위 / 기간 / 대상 | 계산·typed·법률·양식 소비처 | 증거·검산·실무 확인 질문 |
|---:|---|---|---|---|---|
| 341 | `household_composition_support::household.support.member` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `party_role` / `not_applicable` / `not_applicable` / `household_member` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 거주 사실·신청인과 관계·실제 생활공동체를 구분 |
| 342 | `household_composition_support::household.support.other_income` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `money_or_unknown` / `KRW` / `period_scope` / `household_member` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 가구원 수입≠신청인 수입; 기간·실귀속 확인, 합산 금지 |
| 343 | `household_composition_support::household.support.relationship` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `relationship_enum` / `not_applicable` / `not_applicable` / `household_member` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 원문 가족관계≠법률상 부양대상; 증빙·변호사 검토 |
| 344 | `household_composition_support::household.support.residence_end` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `date` / `not_applicable` / `statement_period_end` / `household_member` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 동거 종료일, 시작일 및 가구원·주소 동일성 결속 |
| 345 | `household_composition_support::household.support.residence_start` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `date` / `not_applicable` / `statement_period_start` / `household_member` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 동거 시작일, 종료일 및 가구원·주소 동일성 결속 |
| 346 | `household_composition_support::household.support.support_amount` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `money` / `KRW` / `event_date` / `applicant_debtor` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 실지급 vs 약정·지원·인정 생계비 분리, 원통화/원천 검증 |
| 347 | `household_composition_support::household.support.support_frequency` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `enum_or_text` / `not_applicable` / `period_scope` / `applicant_debtor` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 지급 주기·횟수·월환산 여부는 입금증거 필요 |
| 348 | `household_composition_support::household.support.support_period_end` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `date` / `not_applicable` / `statement_period_end` / `applicant_debtor` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 지원 종료기간, 시작일/주체/실지급 교차검증 |
| 349 | `household_composition_support::household.support.support_period_start` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `date` / `not_applicable` / `statement_period_start` / `applicant_debtor` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 지원 시작기간, 종료일/주체/실지급 교차검증 |
| 350 | `household_composition_support::household.support.support_provider` | `family_relation` · `dependent_evidence` · `spouse_asset_evidence` · `free_residence_confirmation` · `divorce_records` (5) | `party_role` / `not_applicable` / `not_applicable` / `payer` | `source_conditional` 승인 전; typed/material/calc/exact token/approved legal = **0** | 송금자/부양의무자/가구원/신청인 역할 구분 |

실제 source 문서 hash·페이지·bbox·quote·row ordinal·복수행·원단위·당사자 ID·실제 Fact ID는 **0건 조회/미관찰**. DB 설계와 `extraction_records`/typed 참조코드 존재는 실제 사건 실행 증빙이 아니다. `feature-lineage-audit.ts`의 family 기반 `SEOUL-405` 및 `D5100,D5103,D5105`는 검토 **후보**이며, 10개 필드의 법률상 인정 기준 또는 정확 서식 token과 동일하지 않다. 갈음/법원보정의 문서 요구 workflow 코드 존재도 실제 갈음 승인·보정 이행·서식 생성·법원 승인과 다름.

## 3. 원본 OCR 로컬 함수 18개 합성 격리시험

| 번호 | 원본 함수에 투입한 입력 시나리오 | 현재 코드 반환 독립 예상 | 관찰 반환 | 현행 분기 재현 |
|---:|---|---|---|---|
| 1 | member arbitrary | `[]` | `[]` | 일치 |
| 2 | income unobserved | `[]` | `[]` | 일치 |
| 3 | income zero | `[]` | `[]` | 일치 |
| 4 | income missing unit | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 일치 |
| 5 | relation unsupported | `[]` | `[]` | 일치 |
| 6 | residence end bad date | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 일치 |
| 7 | residence start valid | `[]` | `[]` | 일치 |
| 8 | support amount valid | `[]` | `[]` | 일치 |
| 9 | support amount source currency conflict | `[]` | `[]` | 일치 |
| 10 | support amount no unit | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 일치 |
| 11 | support amount malformed | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | 일치 |
| 12 | frequency impossible | `[]` | `[]` | 일치 |
| 13 | support period end bad | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 일치 |
| 14 | support period start valid | `[]` | `[]` | 일치 |
| 15 | provider unverified | `[]` | `[]` | 일치 |
| 16 | provider quote missing | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 일치 |
| 17 | amount uncertain | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 일치 |
| 18 | amount present null | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 일치 |

상기 예상은 **현재 분기의 기계적 기대값**이며, 실제 업무상 안전 기대와 반드시 일치하지 않는다. 18건 전부 현행 동작 재현이지만 독립 안전성 합격으로 기록하지 않는다.

## 4. 업무 독립 기대값 대비 공백 (정적 또는 로컬 검사 범위)

| 중요도·원인 | 독립 안전 기대/합성 반례 | 원본에서 실제 확인된 사실 | 후속 처리 |
|---|---|---|---|
| P2 / 부양액 원문 통화 | #346 수치 `300000`, 선언 단위 KRW, 원문 `300000 USD`는 **통화상충 경고** 필요 | 로컬 함수 `[]` (합성 normalizeMoney) | 상위 교차검증·실 통화 보존·원본 인용 대조, 자동 환산 금지 |
| P2 / 동거기간 역순 | #345=2026-12-01, #344=2026-01-01이면 같은 가구원/기록에서 역순 **경고** 필요 | 양쪽 날짜 개별 검사 각각 `[]`; 상호 join 검증 미입증 | 원문 기록·동거 가구원·날짜 선후 매핑 확인 |
| P2 / 부양기간 역순 | #349=2026-12-01, #348=2026-01-01이면 같은 지급기록에서 역순 **경고** 필요 | 로컬 셀 검사에서는 개별 유효일만 검증 | 같은 row/지급자/대상/월기간 교차검증 |
| P2 / 부양관계 값 | #343 `mars_kin`은 의미검토 필요 | 로컬 `relationship_enum` 검증 분기 없음, `[]` | 공식/내부 기준정보·법률 인정과 분리 |
| P2 / 비정상 주기 | #347 `every -8 days`는 타당성 검토 필요 | 로컬 `enum_or_text` 분기 없음, `[]` | 지급횟수·계좌 증거 후 승인형 환산 검토 |
| P2 / 중복 지급 | 동일 300,000원 이체가 `divorce_records`와 `dependent_evidence`에 중복 기재된 합성 사례는 **하나의 송금**으로 검산 | 다섯 문서 route의 source-only 선언만 확인 | 문서 SHA·page·row·이체번호 결속 및 상위 중복방지 E2E |
| P2 / 부양자 소득과 지급액 | #342 가구원 소득은 #346 신청인 지원 실지급액과 주체/성격이 다름 | 직접 typed/계산 경로 0/10 | 가구원 소득을 신청인 총소득 또는 인정 생계비로 합산 금지 |

새로운 법률·산식 인정 기준을 `main`에 임의 반영하지 않았다. 위험/의미 변경은 기존 미병합 Draft PR들과 충돌을 재확인한 후 **별도 PR/변호사·계산사무장 승인** 필요. 개발 수정·전체 CI·staging D1/R2/Cron·공식 법원 서식·운영 배포·전자제출·인가 확정은 **모두 미실행**.

## 5. 상태별 독립 검증 및 다음 시작

| 단계 | 상태 |
|---|---|
| 693 전체 정적 ID·모든 원천 슬롯·#341–350 개별 메타/적용 등록 | 현재 소스에서 재현 |
| 로컬 OCR 형식함수 18개 합성 | 현행 반환 재현(정규화 stub, 법률 승인 아님) |
| 실제 고객 OCR/원문 사실값·문서/PDF·복수행 | 미관찰; 공개 Git 기록 0건 |
| D1 저장·Fact/typed 재조회 및 동일 사건/월/대상 검산 | 미관찰 |
| 법률 위험 95·규칙 50·예외 46: 정확 법적 인정 기준 | 후보·선언만 확인, 승인 전 |
| 법원 양식 정확 token, 갈음/보정 실제 판단, 변호사 승인 | 미인증 |
| 전체 Node CI / staging D1·R2/Cron / 사이트 배포 | 미실행 |
| 운영 D1 마이그레이션 / 전자제출 / 법원 인가 확정 | 수행하지 않음 |

**다음 ID: #351 `household_composition_support::household.support.support_recipient` → #360**, 다음 우선 담당 **계산사무장**. 가구부양 실제 지급/소득·생활비 등 다른 피처 혼합 및 원문 송금 금액의 중복계상 차단을 계속 조사한다. 최종 A3 **0/124**.

## 부록 A. 등록 canonical OCR 693개, 실제 인덱스 원순서

```text
001 account_garnishment::account_holder
002 account_garnishment::account_id
003 account_garnishment::court_or_authority
004 account_garnishment::creditor
005 account_garnishment::effective_date
006 account_garnishment::garnishment_amount
007 account_garnishment::issue_date
008 account_garnishment::released_amount
009 account_garnishment::seized_amount
010 account_garnishment::status
011 accounting_source::account_name
012 accounting_source::closing_balance
013 accounting_source::credits
014 accounting_source::debits
015 accounting_source::entity
016 accounting_source::issue_date
017 accounting_source::opening_balance
018 accounting_source::period_end
019 accounting_source::period_start
020 accounting_source::source_total
021 applicant_narrative_statement::identity.statement.admission_or_correction
022 applicant_narrative_statement::identity.statement.author
023 applicant_narrative_statement::identity.statement.event_end
024 applicant_narrative_statement::identity.statement.event_start
025 applicant_narrative_statement::identity.statement.narrative_text
026 applicant_narrative_statement::identity.statement.signature_status
027 applicant_narrative_statement::identity.statement.signed_at
028 applicant_narrative_statement::identity.statement.source_references
029 applicant_narrative_statement::identity.statement.statement_version
030 applicant_narrative_statement::identity.statement.topic
031 application_identity_venue::procedure.application.accepted_at
032 application_identity_venue::procedure.application.address
033 application_identity_venue::procedure.application.applicant_name
034 application_identity_venue::procedure.application.case_number
035 application_identity_venue::procedure.application.court
036 application_identity_venue::procedure.application.jurisdiction_exception
037 application_identity_venue::procedure.application.ordinary_venue_basis
038 application_identity_venue::procedure.application.phone_home
039 application_identity_venue::procedure.application.phone_mobile
040 application_identity_venue::procedure.application.phone_work
041 application_identity_venue::procedure.application.resident_id
042 application_identity_venue::procedure.application.ruleset_id
043 application_identity_venue::procedure.application.submitted_at
044 application_identity_venue::procedure.application.transition_rule
045 application_identity_venue::procedure.application_date
046 application_identity_venue::procedure.venue
047 asset_transfer_disposition::asset_id
048 asset_transfer_disposition::consideration
049 asset_transfer_disposition::market_value
050 asset_transfer_disposition::proceeds_received
051 asset_transfer_disposition::registration_date
052 asset_transfer_disposition::relationship
053 asset_transfer_disposition::review_status
054 asset_transfer_disposition::transaction_date
055 asset_transfer_disposition::transferee
056 asset_transfer_disposition::transferor
057 asset_transfer_disposition::use_of_proceeds
058 bank_account_balance::account_holder
059 bank_account_balance::account_id
060 bank_account_balance::account_status
061 bank_account_balance::balance
062 bank_account_balance::balance_as_of
063 bank_account_balance::currency
064 bank_account_balance::institution
065 bank_account_balance::issue_date
066 bank_transactions::account_id
067 bank_transactions::amount
068 bank_transactions::counterparty
069 bank_transactions::direction
070 bank_transactions::issue_date
071 bank_transactions::memo
072 bank_transactions::period_end
073 bank_transactions::period_start
074 bank_transactions::post_balance
075 bank_transactions::transaction_datetime
076 bank_transactions::transaction_id
077 bank_transactions::transaction_nature
078 business_asset_inventory::acquisition_date
079 business_asset_inventory::book_value
080 business_asset_inventory::condition
081 business_asset_inventory::disposal_restriction
082 business_asset_inventory::goodwill_contract
083 business_asset_inventory::market_value
084 business_asset_inventory::quantity
085 business_asset_inventory::quantity_unit
086 business_assets_liabilities::as_of_date
087 business_assets_liabilities::asset_or_claim_id
088 business_assets_liabilities::business_entity
089 business_assets_liabilities::gross_value
090 business_assets_liabilities::item_kind
091 business_assets_liabilities::ownership_interest
092 business_assets_liabilities::payable_amount
093 business_assets_liabilities::period_end
094 business_assets_liabilities::period_start
095 business_assets_liabilities::receivable_amount
096 business_assets_liabilities::secured_payoff
097 business_costs_and_ledgers::income.business_cost.accounting_basis
098 business_costs_and_ledgers::income.business_cost.business_continuity_flag
099 business_costs_and_ledgers::income.business_cost.business_entity
100 business_costs_and_ledgers::income.business_cost.expense_category
101 business_costs_and_ledgers::income.business_cost.gross_amount
102 business_costs_and_ledgers::income.business_cost.payment_date
103 business_costs_and_ledgers::income.business_cost.payment_status
104 business_costs_and_ledgers::income.business_cost.period_end
105 business_costs_and_ledgers::income.business_cost.period_start
106 business_costs_and_ledgers::income.business_cost.supplier
107 business_costs_and_ledgers::income.business_cost.tax_component
108 business_current_income_summary::income.self_employment.business_costs
109 business_current_income_summary::income.self_employment.contract_end
110 business_current_income_summary::income.self_employment.contract_id
111 business_current_income_summary::income.self_employment.gross_receivable
112 business_current_income_summary::income.self_employment.invoice_date
113 business_current_income_summary::income.self_employment.net_receipt
114 business_current_income_summary::income.self_employment.operator
115 business_current_income_summary::income.self_employment.payer_customer
116 business_current_income_summary::income.self_employment.service_period_end
117 business_current_income_summary::income.self_employment.service_period_start
118 business_current_income_summary::income.self_employment.withheld_tax
119 business_registration::business_entity
120 business_registration::business_id
121 business_registration::business_items
122 business_registration::business_type
123 business_registration::issue_date
124 business_registration::joint_operators
125 business_registration::opening_date
126 business_registration::registration_date
127 business_registration::representative
128 business_registration::status
129 business_sales_vat::income.sales.business_entity
130 business_sales_vat::income.sales.exempt_sales
131 business_sales_vat::income.sales.filing_date
132 business_sales_vat::income.sales.gross_sales
133 business_sales_vat::income.sales.issue_date
134 business_sales_vat::income.sales.reporting_period_end
135 business_sales_vat::income.sales.reporting_period_start
136 business_sales_vat::income.sales.returns_refunds
137 business_sales_vat::income.sales.sales_count
138 business_sales_vat::income.sales.taxable_sales
139 business_sales_vat::income.sales.vat_collected
140 card_statement::billed_amount
141 card_statement::billing_period
142 card_statement::card_product_kind
143 card_statement::installment_count
144 card_statement::merchant
145 card_statement::purchase_amount
146 card_statement::remaining_installments
147 cash_deposit_asset::actual_payoff
148 cash_deposit_asset::as_of_date
149 cash_deposit_asset::asset_id
150 cash_deposit_asset::asset_kind
151 cash_deposit_asset::encumbrance
152 cash_deposit_asset::gross_value
153 cash_deposit_asset::owner
154 cash_deposit_asset::ownership_share
155 cash_deposit_asset::protected_or_excluded_claim
156 cash_deposit_asset::valuation_basis
157 cash_holding_statement::acquisition_source
158 cash_holding_statement::cash_currency
159 cash_holding_statement::declaration_author
160 cash_holding_statement::declaration_date
161 cash_holding_statement::storage_location
162 conditional_case_specific_request::conditional.court_request.case_number
163 conditional_case_specific_request::conditional.court_request.court
164 conditional_case_specific_request::conditional.court_request.item_due
165 conditional_case_specific_request::conditional.court_request.legal_citation
166 conditional_case_specific_request::conditional.court_request.operative_text
167 conditional_case_specific_request::conditional.court_request.request_type
168 conditional_case_specific_request::conditional.court_request.response_deadline
169 conditional_case_specific_request::conditional.court_request.response_filed_at
170 conditional_case_specific_request::conditional.court_request.service_date
171 conditional_case_specific_request::conditional.court_request.status_change
172 conditional_education_childcare::conditional.education.billed_amount
173 conditional_education_childcare::conditional.education.enrollment_end
174 conditional_education_childcare::conditional.education.enrollment_start
175 conditional_education_childcare::conditional.education.fee_type
176 conditional_education_childcare::conditional.education.frequency
177 conditional_education_childcare::conditional.education.paid_amount
178 conditional_education_childcare::conditional.education.payer
179 conditional_education_childcare::conditional.education.provider
180 conditional_education_childcare::conditional.education.recipient
181 conditional_education_childcare::conditional.education.relation
182 conditional_education_childcare::conditional.education.subsidy
183 conditional_medical_expense::conditional.medical.applicant_relation
184 conditional_medical_expense::conditional.medical.billed_cost
185 conditional_medical_expense::conditional.medical.care_period_end
186 conditional_medical_expense::conditional.medical.care_period_start
187 conditional_medical_expense::conditional.medical.expected_recurring_cost
188 conditional_medical_expense::conditional.medical.medical_opinion_period
189 conditional_medical_expense::conditional.medical.paid_cost
190 conditional_medical_expense::conditional.medical.patient
191 conditional_medical_expense::conditional.medical.provider
192 conditional_medical_expense::conditional.medical.reimbursement
193 conditional_medical_expense::conditional.medical.service_date
194 conditional_medical_expense::conditional.medical.service_kind
195 conditional_nonstandard_income_or_household_event::conditional.change.affected_person
196 conditional_nonstandard_income_or_household_event::conditional.change.duration_end
197 conditional_nonstandard_income_or_household_event::conditional.change.effective_date
198 conditional_nonstandard_income_or_household_event::conditional.change.event_date
199 conditional_nonstandard_income_or_household_event::conditional.change.event_kind
200 conditional_nonstandard_income_or_household_event::conditional.change.expense_delta
201 conditional_nonstandard_income_or_household_event::conditional.change.income_delta
202 conditional_nonstandard_income_or_household_event::conditional.change.issuer
203 conditional_nonstandard_income_or_household_event::conditional.change.new_status
204 conditional_nonstandard_income_or_household_event::conditional.change.old_status
205 conditional_plan_funding_source::applicability.form.current_official_version
206 conditional_plan_funding_source::applicability.form.disposition_asset_ids
207 conditional_plan_funding_source::applicability.form.disposition_date
208 conditional_plan_funding_source::applicability.form.disposition_proceeds
209 conditional_plan_funding_source::applicability.form.income_source_evidence_ids
210 conditional_plan_funding_source::applicability.form.plan_source
211 conditional_plan_funding_source::applicability.form.proceeds_to_plan
212 conditional_plan_funding_source::applicability.form.review_status
213 conditional_plan_funding_source::applicability.form.selected_form_code
214 credit_information_report::assignment_event_date
215 credit_information_report::current_reported_creditor
216 credit_information_report::event_record_id
217 credit_information_report::issue_date
218 credit_information_report::previous_creditor
219 credit_information_report::report_as_of
220 credit_information_report::report_subject
221 credit_report::currency_unit
222 credit_report::event_date
223 credit_report::event_kind
224 credit_report::institution
225 credit_report::product_code
226 credit_report::reported_amount
227 credit_report::status
228 creditor_assignment_dispute::assignment_date
229 creditor_assignment_dispute::claim_id
230 creditor_assignment_dispute::claim_status
231 creditor_assignment_dispute::current_claimant
232 creditor_assignment_dispute::dispute_basis
233 creditor_assignment_dispute::disputed_amount
234 creditor_assignment_dispute::notice_date
235 creditor_assignment_dispute::prior_creditor
236 creditor_assignment_dispute::supporting_record
237 crypto_balance::account_owner
238 crypto_balance::asset_symbol
239 crypto_balance::available_quantity
240 crypto_balance::average_acquisition_price
241 crypto_balance::displayed_valuation
242 crypto_balance::exchange_or_wallet
243 crypto_balance::locked_quantity
244 crypto_balance::network
245 crypto_balance::total_quantity
246 crypto_balance::valuation_currency
247 crypto_balance::valuation_datetime
248 crypto_balance::valuation_unit_price
249 crypto_balance::wallet_address
250 crypto_transactions::asset_symbol
251 crypto_transactions::completed_at
252 crypto_transactions::counterparty_account_identity
253 crypto_transactions::crypto_event_kind
254 crypto_transactions::destination_address
255 crypto_transactions::fee_asset
256 crypto_transactions::fee_quantity
257 crypto_transactions::gross_trade_amount
258 crypto_transactions::network
259 crypto_transactions::quantity
260 crypto_transactions::quote_currency
261 crypto_transactions::requested_at
262 crypto_transactions::source_address
263 crypto_transactions::transfer_status
264 crypto_transactions::txid
265 crypto_transactions::unit_price
266 current_nonwage_income::income.other.contract_end
267 current_nonwage_income::income.other.deductions
268 current_nonwage_income::income.other.earning_period_end
269 current_nonwage_income::income.other.earning_period_start
270 current_nonwage_income::income.other.frequency
271 current_nonwage_income::income.other.gross_amount
272 current_nonwage_income::income.other.income_kind
273 current_nonwage_income::income.other.net_received
274 current_nonwage_income::income.other.payer
275 current_nonwage_income::income.other.payment_date
276 current_nonwage_income::income.other.recipient
277 debt_certificate::as_of_date
278 debt_certificate::claim_cause
279 debt_certificate::contract_id
280 debt_certificate::contract_interest_rate
281 debt_certificate::creditor
282 debt_certificate::creditor_address
283 debt_certificate::debtor
284 debt_certificate::fees
285 debt_certificate::interest_balance
286 debt_certificate::issue_date
287 debt_certificate::issuer
288 debt_certificate::original_principal
289 debt_certificate::origination_date
290 debt_certificate::overdue_interest
291 debt_certificate::principal_balance
292 debt_certificate::total_claim
293 divorce_records::actual_support_paid
294 divorce_records::agreement_or_order_date
295 divorce_records::divorce_date
296 divorce_records::former_spouse
297 divorce_records::marriage_date
298 divorce_records::partition_amount
299 divorce_records::partition_asset
300 divorce_records::support_child
301 divorce_records::support_payer
302 divorce_records::support_period
303 divorce_records::support_periodic_amount
304 divorce_records::support_recipient
305 employment_contract::employer_signature_date
306 employment_contract::employer_signature_status
307 employment_history::insurance_scheme
308 employment_history::qualification_acquired
309 employment_history::qualification_lost
310 employment_history::qualification_record_scope
311 employment_history::qualification_type
312 employment_history::qualification_workplace
313 employment_relationship::income.employment.allowance_terms
314 employment_relationship::income.employment.base_wage
315 employment_relationship::income.employment.contract_term
316 employment_relationship::income.employment.employee
317 employment_relationship::income.employment.employer
318 employment_relationship::income.employment.employment_type
319 employment_relationship::income.employment.end_date
320 employment_relationship::income.employment.hours
321 employment_relationship::income.employment.issue_date
322 employment_relationship::income.employment.start_date
323 guarantee_joint_claim::applicant_role
324 guarantee_joint_claim::creditor
325 guarantee_joint_claim::dispute_status
326 guarantee_joint_claim::guarantee_claimed
327 guarantee_joint_claim::guarantee_limit
328 guarantee_joint_claim::principal_debtor
329 guarantee_joint_claim::recourse_status
330 guarantee_joint_claim::underlying_claim_id
331 health_insurance_arrears::as_of_date
332 health_insurance_arrears::authority
333 health_insurance_arrears::disposal_cost
334 health_insurance_arrears::issue_date
335 health_insurance_arrears::late_charge
336 health_insurance_arrears::period_end
337 health_insurance_arrears::period_start
338 health_insurance_arrears::subscriber
339 health_insurance_arrears::total_arrear
340 health_insurance_arrears::unpaid_contribution
341 household_composition_support::household.support.member
342 household_composition_support::household.support.other_income
343 household_composition_support::household.support.relationship
344 household_composition_support::household.support.residence_end
345 household_composition_support::household.support.residence_start
346 household_composition_support::household.support.support_amount
347 household_composition_support::household.support.support_frequency
348 household_composition_support::household.support.support_period_end
349 household_composition_support::household.support.support_period_start
350 household_composition_support::household.support.support_provider
351 household_composition_support::household.support.support_recipient
352 household_living_expense::household.expense.arrears
353 household_living_expense::household.expense.beneficiary
354 household_living_expense::household.expense.billed_amount
355 household_living_expense::household.expense.billing_period_end
356 household_living_expense::household.expense.billing_period_start
357 household_living_expense::household.expense.expense_kind
358 household_living_expense::household.expense.issue_date
359 household_living_expense::household.expense.paid_amount
360 household_living_expense::household.expense.payer
361 household_living_expense::household.expense.provider
362 household_living_expense::household.expense.shared_allocation
363 identity_residence_record::identity.address
364 identity_residence_record::identity.household_members
365 identity_residence_record::identity.issue_date
366 identity_residence_record::identity.marital_status
367 identity_residence_record::identity.name
368 identity_residence_record::identity.record_number
369 identity_residence_record::identity.registration_id
370 identity_residence_record::identity.relationship
371 income_source_inventory::amount_basis
372 income_source_inventory::income_source_id
373 income_source_inventory::reported_expenses
374 income_source_inventory::reported_gross
375 income_source_inventory::reported_net
376 income_source_inventory::source_document_reference
377 income_source_inventory::source_kind
378 inheritance_records::attributed_amount
379 inheritance_records::decedent
380 inheritance_records::disclaimer_or_limited_acceptance
381 inheritance_records::filing_or_order_reference
382 inheritance_records::heir
383 inheritance_records::heir_relationship
384 inheritance_records::inherited_asset_id
385 inheritance_records::partition_agreement_date
386 inheritance_records::stated_share
387 inheritance_records::succession_opened_at
388 insurance_policy_asset::as_of_date
389 insurance_policy_asset::beneficiary
390 insurance_policy_asset::contract_holder
391 insurance_policy_asset::coverage_amount
392 insurance_policy_asset::end_date
393 insurance_policy_asset::insured
394 insurance_policy_asset::insurer
395 insurance_policy_asset::issue_date
396 insurance_policy_asset::pledge
397 insurance_policy_asset::policy_id
398 insurance_policy_asset::policy_loan_balance
399 insurance_policy_asset::policy_status
400 insurance_policy_asset::premium_per_payment
401 insurance_policy_asset::refund_net_basis
402 insurance_policy_asset::start_date
403 insurance_policy_asset::surrender_value
404 insurance_policy_asset::total_premium
405 lease_contract::fixed_date
406 lease_housing::applicant_relation
407 lease_housing::arrears_deduction
408 lease_housing::deposit
409 lease_housing::issue_date
410 lease_housing::landlord
411 lease_housing::monthly_rent
412 lease_housing::period_end
413 lease_housing::period_start
414 lease_housing::property_id
415 lease_housing::renewal_status
416 lease_housing::secured_balance
417 lease_housing::security_assignment
418 lease_housing::tenant
419 lease_housing::use
420 litigation_enforcement::case_id
421 litigation_enforcement::claim_type
422 litigation_enforcement::claimed_amount
423 litigation_enforcement::court_or_authority
424 litigation_enforcement::enforced_amount
425 litigation_enforcement::event_date
426 litigation_enforcement::issue_date
427 litigation_enforcement::judgment_amount
428 litigation_enforcement::parties
429 litigation_enforcement::security_or_attachment
430 litigation_enforcement::status
431 loan_contract::contract_interest_rate
432 loan_contract::maturity_date
433 loan_contract::repayment_installments
434 loan_contract::repayment_method
435 loan_contract::scheduled_payment
436 local_tax::arrears
437 local_tax::as_of_date
438 local_tax::assessed_amount
439 local_tax::authority
440 local_tax::collection_cost
441 local_tax::issue_date
442 local_tax::paid_amount
443 local_tax::surcharge
444 local_tax::tax_base
445 local_tax::tax_period
446 local_tax::tax_type
447 local_tax::taxpayer
448 local_tax_assessment::jurisdiction_scope
449 local_tax_assessment::no_assessment_text
450 local_tax_assessment::row_or_subtotal_kind
451 local_tax_assessment::tax_assessment_year
452 local_tax_assessment::tax_notice_status
453 local_tax_assessment::tax_object
454 payroll_payslip::income.payroll.allowances
455 payroll_payslip::income.payroll.bonus
456 payroll_payslip::income.payroll.employee
457 payroll_payslip::income.payroll.employer
458 payroll_payslip::income.payroll.gross_base
459 payroll_payslip::income.payroll.hours_days
460 payroll_payslip::income.payroll.issue_date
461 payroll_payslip::income.payroll.net_pay
462 payroll_payslip::income.payroll.other_deductions
463 payroll_payslip::income.payroll.overtime
464 payroll_payslip::income.payroll.pay_date
465 payroll_payslip::income.payroll.pay_period_end
466 payroll_payslip::income.payroll.pay_period_start
467 payroll_payslip::income.payroll.social_contributions
468 payroll_payslip::income.payroll.tax_withheld
469 pension_benefit_income::income.benefit.beneficiary
470 pension_benefit_income::income.benefit.benefit_type
471 pension_benefit_income::income.benefit.decision_date
472 pension_benefit_income::income.benefit.deductions
473 pension_benefit_income::income.benefit.monthly_gross
474 pension_benefit_income::income.benefit.net_payment
475 pension_benefit_income::income.benefit.payment_date
476 pension_benefit_income::income.benefit.payment_end
477 pension_benefit_income::income.benefit.payment_start
478 pension_benefit_income::income.benefit.provider
479 pension_benefit_income::income.benefit.review_status
480 pension_contribution_benefit::as_of_date
481 pension_contribution_benefit::benefit_amount
482 pension_contribution_benefit::benefit_type
483 pension_contribution_benefit::contribution
484 pension_contribution_benefit::encumbrance
485 pension_contribution_benefit::issue_date
486 pension_contribution_benefit::member
487 pension_contribution_benefit::payment_start
488 pension_contribution_benefit::period_end
489 pension_contribution_benefit::period_start
490 pension_contribution_benefit::plan_id
491 pension_contribution_benefit::provider
492 pension_contribution_benefit::vested_balance
493 pension_contribution_benefit::withdrawal_value
494 pension_contribution_statement::contribution_record_kind
495 pension_contribution_statement::paid_amount
496 pension_contribution_statement::paid_months
497 pension_contribution_statement::payable_amount
498 pension_contribution_statement::payable_months
499 pension_contribution_statement::standard_monthly_income
500 pension_contribution_statement::subscriber_type
501 pension_contribution_statement::unpaid_amount
502 pension_contribution_statement::unpaid_months
503 pension_contribution_statement::unpayable_amount
504 pension_contribution_statement::unpayable_months
505 procedure_court_orders::procedure.order.case_number
506 procedure_court_orders::procedure.order.court
507 procedure_court_orders::procedure.order.deadline
508 procedure_court_orders::procedure.order.debtor
509 procedure_court_orders::procedure.order.effective_date
510 procedure_court_orders::procedure.order.finality
511 procedure_court_orders::procedure.order.operative_text
512 procedure_court_orders::procedure.order.order_date
513 procedure_court_orders::procedure.order.order_type
514 procedure_court_orders::procedure.order.scope
515 procedure_court_orders::procedure.order.service_date
516 procedure_court_orders::procedure.order.status_change
517 procedure_enforcement_garnishment::procedure.enforcement.asset_or_income
518 procedure_enforcement_garnishment::procedure.enforcement.attached_amount
519 procedure_enforcement_garnishment::procedure.enforcement.authority
520 procedure_enforcement_garnishment::procedure.enforcement.case_number
521 procedure_enforcement_garnishment::procedure.enforcement.claimed_amount
522 procedure_enforcement_garnishment::procedure.enforcement.creditor
523 procedure_enforcement_garnishment::procedure.enforcement.debtor
524 procedure_enforcement_garnishment::procedure.enforcement.effective_date
525 procedure_enforcement_garnishment::procedure.enforcement.order_date
526 procedure_enforcement_garnishment::procedure.enforcement.order_type
527 procedure_enforcement_garnishment::procedure.enforcement.released_amount
528 procedure_enforcement_garnishment::procedure.enforcement.service_date
529 procedure_enforcement_garnishment::procedure.enforcement.status
530 procedure_prior_insolvency::procedure.history.case_number
531 procedure_prior_insolvency::procedure.history.case_type
532 procedure_prior_insolvency::procedure.history.court_authority
533 procedure_prior_insolvency::procedure.history.debtor
534 procedure_prior_insolvency::procedure.history.discharge_date
535 procedure_prior_insolvency::procedure.history.filing_date
536 procedure_prior_insolvency::procedure.history.finality_date
537 procedure_prior_insolvency::procedure.history.order_date
538 procedure_prior_insolvency::procedure.history.order_kind
539 procedure_prior_insolvency::procedure.history.private_adjustment_attempt
540 procedure_prior_insolvency::procedure.history.record_issue_date
541 procedure_private_creditor_request::procedure.creditor_info.as_of_date
542 procedure_private_creditor_request::procedure.creditor_info.claim_id
543 procedure_private_creditor_request::procedure.creditor_info.claim_origin_date
544 procedure_private_creditor_request::procedure.creditor_info.creditor
545 procedure_private_creditor_request::procedure.creditor_info.debtor
546 procedure_private_creditor_request::procedure.creditor_info.interest_balance
547 procedure_private_creditor_request::procedure.creditor_info.interest_rate
548 procedure_private_creditor_request::procedure.creditor_info.principal_balance
549 procedure_private_creditor_request::procedure.creditor_info.principal_original
550 procedure_private_creditor_request::procedure.creditor_info.request_copy
551 procedure_private_creditor_request::procedure.creditor_info.request_date
552 procedure_private_creditor_request::procedure.creditor_info.response_date
553 property_search::issue_date
554 property_search::jurisdiction_scope
555 property_search::ownership_share
556 property_search::property_found
557 property_search::property_id
558 property_search::registered_owner
559 property_search::search_as_of
560 property_search::searched_subject
561 real_estate_register::ownership_change_text
562 real_estate_register::property_address
563 real_property_register::acquisition_date
564 real_property_register::issue_date
565 real_property_register::maximum_claim
566 real_property_register::mortgage_holder
567 real_property_register::ownership_share
568 real_property_register::property_id
569 real_property_register::property_type
570 real_property_register::registered_owner
571 real_property_register::registered_value
572 real_property_register::registration_date
573 real_property_register::release_date
574 real_property_valuation::actual_payoff
575 real_property_valuation::disposal_cost
576 real_property_valuation::market_value
577 real_property_valuation::owner
578 real_property_valuation::ownership_share
579 real_property_valuation::property_id
580 real_property_valuation::valuation_date
581 real_property_valuation::valuation_method
582 receivable_collectability::collected_amount
583 receivable_collectability::collection_status
584 receivable_collectability::counterparty_status
585 receivable_collectability::demand_date
586 receivable_collectability::receivable_id
587 receivable_collectability::security_reference
588 receivable_collectability::uncollected_reason
589 resident_registration::address_change_date
590 resident_registration::historical_address
591 resident_registration::residence_history_period
592 retirement_estimate::estimated_retirement_date
593 retirement_estimate::payout_condition
594 retirement_estimate::retirement_scheme
595 retirement_estimate::service_period
596 retirement_estimate::transfer_history
597 salary_statement::employer_confirmation_status
598 salary_statement::employer_signature_date
599 salary_statement::gross_total
600 salary_statement::total_deductions
601 secured_claim_security::actual_payoff
602 secured_claim_security::collateral_id
603 secured_claim_security::discharge_date
604 secured_claim_security::grantor
605 secured_claim_security::priority
606 secured_claim_security::registered_maximum
607 secured_claim_security::registration_date
608 secured_claim_security::secured_party
609 secured_claim_security::security_type
610 securities_balance::account_coverage
611 securities_balance::asset_class
612 securities_balance::cash_balance
613 securities_balance::quantity
614 securities_balance::quantity_unit
615 securities_balance::security_id
616 securities_balance::security_name
617 securities_balance::settlement_basis
618 securities_balance::unsettled_liability
619 securities_balance::valuation_currency
620 securities_balance::valuation_datetime
621 securities_balance::valuation_method
622 securities_balance::valuation_unit_price
623 securities_transactions::counter_account
624 securities_transactions::fee
625 securities_transactions::quantity
626 securities_transactions::quantity_unit
627 securities_transactions::security_event_kind
628 securities_transactions::security_id
629 securities_transactions::security_name
630 securities_transactions::settled_amount
631 securities_transactions::settlement_date
632 securities_transactions::tax
633 securities_transactions::trade_gross
634 securities_transactions::trade_unit_price
635 tax_income::arrears
636 tax_income::gross_receipts
637 tax_income::income_after_expenses
638 tax_income::income_kind
639 tax_income::issue_date
640 tax_income::necessary_expenses
641 tax_income::period_end
642 tax_income::period_start
643 tax_income::tax_assessed
644 tax_income::tax_paid
645 tax_income::tax_year
646 tax_income::taxpayer
647 tax_public_arrear::as_of_date
648 tax_public_arrear::assessment_date
649 tax_public_arrear::authority
650 tax_public_arrear::costs
651 tax_public_arrear::debtor
652 tax_public_arrear::due_date
653 tax_public_arrear::issue_date
654 tax_public_arrear::principal_arrear
655 tax_public_arrear::surcharge_interest
656 tax_public_arrear::tax_period
657 tax_public_arrear::tax_type
658 tax_public_arrear::total_due
659 vehicle_registration::model_year
660 vehicle_registration::plate_number
661 vehicle_registration::record_issue_date
662 vehicle_registration::vin
663 vehicle_registry::acquisition_date
664 vehicle_registry::co_owners
665 vehicle_registry::lien_date
666 vehicle_registry::lien_holder
667 vehicle_registry::ownership_share
668 vehicle_registry::registered_lien_amount
669 vehicle_registry::registered_owner
670 vehicle_registry::registration_status
671 vehicle_registry::release_date
672 vehicle_registry::transfer_date
673 vehicle_registry::vehicle_id
674 vehicle_valuation::actual_payoff
675 vehicle_valuation::market_value
676 vehicle_valuation::mileage
677 vehicle_valuation::model_year
678 vehicle_valuation::owner
679 vehicle_valuation::registered_lien_amount
680 vehicle_valuation::valuation_date
681 vehicle_valuation::valuation_method
682 vehicle_valuation::vehicle_id
683 wage_withholding_tax::income.tax.employment_start_end
684 wage_withholding_tax::income.tax.gross_wages
685 wage_withholding_tax::income.tax.issue_date
686 wage_withholding_tax::income.tax.resident_tax
687 wage_withholding_tax::income.tax.tax_exempt_allowances
688 wage_withholding_tax::income.tax.tax_year
689 wage_withholding_tax::income.tax.taxable_allowances
690 wage_withholding_tax::income.tax.taxpayer
691 wage_withholding_tax::income.tax.withheld_income_tax
692 wage_withholding_tax::income.tax.withholding_agent
693 wage_withholding_tax::income.tax.year_end_adjustment
```

## 부록 B. 인수 보드 A3 6담당자 체크 ID 총 124개

```text
A3-IT-001
A3-IT-002
A3-IT-003
A3-IT-004
A3-IT-005
A3-IT-006
A3-IT-007
A3-IT-008
A3-IT-009
A3-IT-010
A3-IT-011
A3-IT-012
A3-IT-013
A3-IT-014
A3-IT-015
A3-IT-016
A3-IT-017
A3-IT-018
A3-IT-019
A3-IT-020
A3-DOC-001
A3-DOC-002
A3-DOC-003
A3-DOC-004
A3-DOC-005
A3-DOC-006
A3-DOC-007
A3-DOC-008
A3-DOC-009
A3-DOC-010
A3-DOC-011
A3-DOC-012
A3-DOC-013
A3-DOC-014
A3-DOC-015
A3-DOC-016
A3-DOC-017
A3-DOC-018
A3-DOC-019
A3-DOC-020
A3-CALC-001
A3-CALC-002
A3-CALC-003
A3-CALC-004
A3-CALC-005
A3-CALC-006
A3-CALC-007
A3-CALC-008
A3-CALC-009
A3-CALC-010
A3-CALC-011
A3-CALC-012
A3-CALC-013
A3-CALC-014
A3-CALC-015
A3-CALC-016
A3-CALC-017
A3-CALC-018
A3-CALC-019
A3-CALC-020
A3-LAW-001
A3-LAW-002
A3-LAW-003
A3-LAW-004
A3-LAW-005
A3-LAW-006
A3-LAW-007
A3-LAW-008
A3-LAW-009
A3-LAW-010
A3-LAW-011
A3-LAW-012
A3-LAW-013
A3-LAW-014
A3-LAW-015
A3-LAW-016
A3-LAW-017
A3-LAW-018
A3-LAW-019
A3-LAW-020
A3-LAW-021
A3-LAW-022
A3-DATA-001
A3-DATA-002
A3-DATA-003
A3-DATA-004
A3-DATA-005
A3-DATA-006
A3-DATA-007
A3-DATA-008
A3-DATA-009
A3-DATA-010
A3-DATA-011
A3-DATA-012
A3-DATA-013
A3-DATA-014
A3-DATA-015
A3-DATA-016
A3-DATA-017
A3-DATA-018
A3-DATA-019
A3-DATA-020
A3-DATA-021
A3-DATA-022
A3-AX-001
A3-AX-002
A3-AX-003
A3-AX-004
A3-AX-005
A3-AX-006
A3-AX-007
A3-AX-008
A3-AX-009
A3-AX-010
A3-AX-011
A3-AX-012
A3-AX-013
A3-AX-014
A3-AX-015
A3-AX-016
A3-AX-017
A3-AX-018
A3-AX-019
A3-AX-020
```

## 부록 C. 실제 조회한 주요 blob SHA

- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/reference-intake-catalog.json`: `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/ocr-calculation-input.ts`: `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`: `177bfe141ce0c0d9f94b4e6975b361824c5393fa`
- 추가 대조 소스: `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, `lib/risk-catalog.json` `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`, `lib/legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`, `lib/legal-exceptions.json` `6e51197226bfd8320e1147d8df3f12c11e00927c`, `lib/canonical-field-binding.ts` `60ee5c7762d52b72a165b4f4f8214680eb98f148`, `lib/ocr-chain-matrix.ts` `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`, `lib/material-calculation-source-gate.ts` `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, `lib/legal-evidence-criteria.ts` `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`.
