# FirmEngine A3 r107 — canonical #361–370 가구생활비·신원 증거/소비처 감사

2026-11-03 KST. 시작 main HEAD 4042a1aec754d2dbbdf29a7d837777e13b6b415f. 작업 디렉터리 prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/ 한정. 직전 r106 #351~360 및 이전 r19 #361~380 영수증과 최신 원본 코드/스키마 확인. 이번 #361은 household.expense.provider이며 #362가 shared_allocation임(직전 다음 시작 안내의 필드명 순서 정정).

역할 순환: 데이터담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사 → AX담당자. 보드 이번 체크 ID A3-DATA-008 / A3-IT-003 / A3-DOC-003 / A3-CALC-009 / A3-LAW-008. 5개 모두 미완료 [ ] 유지. 최근 main: 4042a1ae(A2 r107), 68d902a2(A1 r106), 326b6012(A3 r106). 기간/숫자 검증 기존 Draft PR #51/#169 오픈·미병합, 중복 코드수정 없음.

## 1. 최신 정적 등록과 정확한 검증 경계

- canonical 693개(고유 693), 85서류 / 48패밀리 / 141 문서×패밀리 / 1808 선언 원천 슬롯. 524 기본필드 + 207 서류 확장 + 19 보충 선언, 중복 선언을 합친 canonical 고유집합 693. 인덱스 고아 0; 서로 다른 서류의 동일 ID 선언은 원문 중복 Fact를 뜻하지 않음.
- 현재 10개 ID / 50원천 슬롯 / 9고유 서류, 10/10 개별 source_conditional 적용조건 등록. 법률상 적용 및 실무자 승인 미관찰=인수 합격률 0%.
- 직접 typed mapping 3/10: #363 person.address, #367 person.name, #369 person.resident_id_masked. 내부 D5100 후보 3/10: D5100.address, D5100.client_name, D5100.resident_id. 원본 template-token-catalog D5100에 세 토큰 존재 확인(과거 r19 및 현 소스 대조). 공식 e-form·Word 출력 적합성은 미인증.
- 계산 계약 18 / 선언 입력 91(고유78). 이번 10개의 정확 canonical ID를 명시하는 계산 계약 0/10, material 직접 계약 0/10(원본 material-calculation-source-gate.ts 정적 대조). 위험95/법률규칙50/예외46에 정확 canonical 직접 승인 법률 증거계약 0/10(기존 catalog 실제 대조); document-family 기반 참고 후보 및 일반 법률 위험과 구별.
- 모든 50 원천 라우트에 recordPolicy.sourceOnly=true 및 noCrossRecordBorrowing=true. source_locator_required의 document_id/document_sha256/page/quote와 bbox/행(존재시) 요구를 확인. extraction-row-store.ts의 extraction_records, extracted_features.canonical_field_id, extraction_field_coverage 경로 존재. 실제 OCR 문서·페이지·여러 행/주체/기간/단위 값·D1 Fact/typed 소비는 0건 조회/실행.
- 정적 불변식 23/23 결과: 693 indexed; unique index; union matches index; core 524; extensions 207; supplements 19; documents 85; families 48; routes 141; source slots 1808; calculator count 18; input count 91; distinct inputs 78; target 10; target 50 slots; target 9 documents; applicability 10/10; source locators; source-only/record separation; typed 3; form candidates 3; direct calc 0; board 124 unchecked. V8 실제 로컬 함수 현재 동작 24/24 재현. 이들 성능 수치는 전체 제품 통과를 뜻하지 않음.

## 2. 10 ID별 원천 문서·타입/단위/기간/대상·후속 소비처 및 공백

H 5서류: free_residence_confirmation; medical_expense_evidence; housing_expense_evidence; education_expense_evidence; household_expense_ledger.
I 5서류: resident_registration; family_relation; free_residence_confirmation; inheritance_records; divorce_records.
두 집합의 공통 서류 1개로 고유 9서류. 모든 행 각각 5 slots이며 50개는 선언 라우트.

| # | 정확 canonical ID | datatype / unit / temporal / subject | source slots | 정확 typed | 내부 form 후보 | 증거/법률/검산 역질문 |
|---:|---|---|---:|---|---|---|
| 361 | household_living_expense::household.expense.provider | party_role / not_applicable / not_applicable / payee | 5 | source-only | none | 지급처≠납부자≠수혜자, 원본 행·수취인 대조 |
| 362 | household_living_expense::household.expense.shared_allocation | ratio_or_amount / not_applicable / period_scope / applicant_debtor | 5 | source-only | none | 분담 150%/-300도 로컬 허용, 비율/금액/분모/단위/기간·지급자 검토 필요 |
| 363 | identity_residence_record::identity.address | address / not_applicable / record_as_of_date / applicant_debtor | 5 | person.address | D5100.address | 발급당시 주소≠현재 거주/송달지 |
| 364 | identity_residence_record::identity.household_members | party_list / not_applicable / not_applicable / household_member | 5 | source-only | none | 여러 명·여러 행·서류당 주체를 한 인물로 병합 금지 |
| 365 | identity_residence_record::identity.issue_date | date / not_applicable / document_issue_date / issuer | 5 | source-only | none | 발급일 유효와 현주소 법률 적격 별개 |
| 366 | identity_residence_record::identity.marital_status | enum / not_applicable / record_as_of_date / applicant_debtor | 5 | source-only | none | 혼인상태 enum 미검증; 이혼/별거 법률효과와 분리 |
| 367 | identity_residence_record::identity.name | string / not_applicable / not_applicable / applicant_debtor | 5 | person.name | D5100.client_name | 신청인/가족·피상속인 이름 구분 |
| 368 | identity_residence_record::identity.record_number | string / not_applicable / not_applicable / issuer | 5 | source-only | none | 문서번호/발행자/수정판본 대조 |
| 369 | identity_residence_record::identity.registration_id | masked_identifier / not_applicable / not_applicable / applicant_debtor | 5 | person.resident_id_masked | D5100.resident_id | masked ID 보존·원문 번호 복원 금지 |
| 370 | identity_residence_record::identity.relationship | relationship_enum / not_applicable / not_applicable / household_member | 5 | source-only | none | 기록상 관계≠법률상 부양 인정 |

#362 ratio_or_amount이지만 canonical_unit=not_applicable, sourceCondition도 Source/reviewer allocation only; not auto-assigned임. 분담율, 실제 분담금액, 청구/지급(기존 #352/#354/#359), 동일 세대·월/연·원통화가 결속되어야 함. 원문 비율 0·150%·음수 값으로 원화 합산/법률상 생계비 자동 인정 금지. #364 household_members 목록과 #370 관계는 다중행/대상자를 각각 보존해야 하며 가족명단만으로 법률상 인정 부양가족 수를 정하지 않음.

typed 선언의 실제 후단은 canonical-field-binding.ts → person.* projection, form-mapping.ts → applicantIdentityValue()의 역할/원천 증거 조건과 D5100 후보 선언으로 확인. OCR 원문/가족의 이름을 당사자 신청인 필드에 무조건 대입하는 계약이 아님. 갈음은 document-substitution.ts의 승인·주체·기간 증거, case-requirement-field-plan.ts는 mappingStatus review_required, court correction은 preapproval-correction-item-store.ts의 requiredCanonicalFieldIds 경로만 정적으로 존재. **이번 10 ID 실사건 갈음/법원보정/공식서식 승인 연결은 미관찰**.

## 3. 로컬 원본 함수 격리 재현 (synthetic V8 24조건)

lib/ocr-calculation-input.ts 실제 validDate/validTime/calculationSourceCellIssues 함수에서 TS 타입만 제거해 V8 실행. normalizeMoney는 money 분기가 호출될 경우 throw하도록 stub 설정(이번 10개 데이터타입에는 money 없음). 기대값은 **기존 함수 현재 분기**에 대한 독립 예상이며 안전성 기준 합격이 아님.

| 합성 조건 | 합성 입력 JSON | 로컬 예상 | 원본 함수 관찰 |
|---|---|---|---|
| 1 (#361) provider | {"value":"Provider A","unit":null,"quote":"Provider A"} | [] | [] |
| 2 (#361) missing quote | {"value":"Provider A","unit":null,"quote":null} | ["SOURCE_QUOTE_MISSING"] | ["SOURCE_QUOTE_MISSING"] |
| 3 (#362) 150 pct | {"value":"150%","unit":null,"quote":"150%"} | [] | [] |
| 4 (#362) negative | {"value":"-300","unit":null,"quote":"-300"} | [] | [] |
| 5 (#362) zero | {"value":"0","unit":null,"quote":"0"} | [] | [] |
| 6 (#362) null present | {"value":null,"unit":null,"quote":"blank","sourceState":"present"} | ["SOURCE_PRESENT_VALUE_MISSING"] | ["SOURCE_PRESENT_VALUE_MISSING"] |
| 7 (#363) address | {"value":"가상 주소 A","unit":null,"quote":"가상 주소 A"} | [] | [] |
| 8 (#363) uncertain | {"value":"가상 주소 A","unit":null,"quote":"가상 주소 A","confidence":"uncertain"} | ["SOURCE_READ_UNCERTAIN"] | ["SOURCE_READ_UNCERTAIN"] |
| 9 (#364) members arbitrary | {"value":"person A and B","unit":null,"quote":"person A and B"} | [] | [] |
| 10 (#364) members unknown | {"value":null,"unit":null,"quote":null,"sourceState":"unknown"} | [] | [] |
| 11 (#365) invalid date | {"value":"2026-02-30","unit":null,"quote":"2026-02-30"} | ["SOURCE_DATE_INVALID"] | ["SOURCE_DATE_INVALID"] |
| 12 (#365) valid date | {"value":"2026-10-01","unit":null,"quote":"2026-10-01"} | [] | [] |
| 13 (#366) invalid marital enum | {"value":"unknown_fake_status","unit":null,"quote":"unknown_fake_status"} | [] | [] |
| 14 (#366) masked state | {"value":"masked","unit":null,"quote":"masked","sourceState":"masked"} | [] | [] |
| 15 (#367) name | {"value":"Applicant A","unit":null,"quote":"Applicant A"} | [] | [] |
| 16 (#367) name missing quote | {"value":"Applicant A","unit":null,"quote":null} | ["SOURCE_QUOTE_MISSING"] | ["SOURCE_QUOTE_MISSING"] |
| 17 (#368) masked doc number | {"value":"REC-***","unit":null,"quote":"REC-***"} | [] | [] |
| 18 (#368) record unknown | {"value":null,"unit":null,"quote":null,"sourceState":"unknown"} | [] | [] |
| 19 (#369) masked identifier | {"value":"***MASKED***","unit":null,"quote":"***MASKED***"} | [] | [] |
| 20 (#369) unmasked marker | {"value":"UNMASKED_STRING","unit":null,"quote":"UNMASKED_STRING"} | [] | [] |
| 21 (#369) uncertain mask | {"value":"***MASKED***","unit":null,"quote":"***MASKED***","confidence":"uncertain"} | ["SOURCE_READ_UNCERTAIN"] | ["SOURCE_READ_UNCERTAIN"] |
| 22 (#370) invalid relationship | {"value":"made_up_relation","unit":null,"quote":"made_up_relation"} | [] | [] |
| 23 (#370) null present | {"value":null,"unit":null,"quote":"missing","sourceState":"present"} | ["SOURCE_PRESENT_VALUE_MISSING"] | ["SOURCE_PRESENT_VALUE_MISSING"] |
| 24 (#370) explicit none | {"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"} | [] | [] |

현재 반환 일치 24/24. 별도의 업무 안전 기대는 미충족 후보: #362 150%/음수 분담 오류 미탐지, #366 무효 enum, #370 무효 relationship_enum, #364 임의 목록 문자열, #369 nonmask marker도 로컬 []. #365 2026-02-30은 SOURCE_DATE_INVALID 검출. 미관찰 null+unknown과 명시적 none은 로컬 []여도 0/비해당/승인 아님. sourceState present+null은 SOURCE_PRESENT_VALUE_MISSING, uncertain은 SOURCE_READ_UNCERTAIN. 상위 제품 검증은 미실행.

## 4. 업무 독립 기대/실제 공백/필요 검토

| P | 독립 업무 기대 | 관찰 범위 | 미완료 조치 |
|---|---|---|---|
| P2 #362 | 분담율 범위/분모·원단위·기간·대상/실납부 결속, 임의 150%·음수는 사람 심사 | ratio_or_amount 로컬 [] | 의미 변경/자동월환산 금지, PR #169와 충돌 검토, 회계/법률 담당 승인 |
| P2 #364/#366/#370 | 가족관계 원문·동거 및 신청인 실제 부양을 분리 | 목록/enum 로컬 [] | 다중 행·주체 ID·발급일/기간/법원 기준 검증 |
| P2 #363/#367/#369 | 실제 신청인 이름/주소/마스킹 식별자만 본인 서식 기입 | typed 3/form 후보 3만 확인 | DB Facts, source SHA/page/quote, applicantIdentityValue 역할·상충, Word/변호사 승인 |
| P2 #365/#368 | 발급일/문서번호와 실제 거주·송달·서류 판본 구별 | 날짜 개별 형식검사 | 최신 주소 이력·증빙 발행자/판본 검산 |
| P1 전체 | source-only 7피처 삭제하지 않고 증거·검산·역질문/법률 근거 검토 | 정확 10 ID 법률 승인 0, 실 갈음·보정 0 | 실사건 D1/R2/Cron/공식 법원서식/변호사 인수 |

상태 구분: 미관찰, null, 명시 0, 비해당(승인전), 상충, source-only, 법률 승인전 별도. 미등록/미승인 요건 합격 0%. 코드 존재/정적검증/합성 단위 재현/Node CI/실 운영 인수/사이트 배포 별개. 고객 원문·PII/키/.env/비공개 정답 공개 저장 없음. 운영 배포/운영 D1 migration/전자제출/법원 인가 확정 없음.

## 5. 조회 blob SHA 및 다음 범위
- lib/canonical-field-id-index.json : 27ecdddd208de82a2f5c675e7482485e3a8838c2
- lib/document-agent-field-contracts.json : 9884b3fecf44643fefcdc4a421ed66ffc5477b3a
- lib/shared-document-field-contracts.json : 9decab974e0909ae24ad927bdfe241d75b71f3a9
- lib/ocr-field-supplements.json : 63b2bf853acb2e9620a6fb72377dc278ff3cd2a5
- lib/field-applicability-contracts.json : 6076b26f782c4643a21a7b2f1a8f6261bb588b68
- lib/reference-decision-tables.json : 6924e3977caf748ce8a3d617fae15aff7d2fe2ce
- lib/ocr-calculation-input.ts : 8f7f51bf41f7c944b76419d7cc894e49ac771473
- lib/ocr-chain-matrix.ts : 977de86ba698bd805cc6b95d1384e3b49d0dbb4c
- lib/canonical-field-binding.ts : 60ee5c7762d52b72a165b4f4f8214680eb98f148
- docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md : 2b6b25453f61525f9dc73a6fc742b4cb1fde7f07

추가 실제 소스 대조: material-calculation-source-gate.ts 0286b44484913b63fa8ec3f7bf0ca59b034d0dab; feature-lineage-audit.ts de81bc3b8c460b8a4dde3fda9e13087e619e74ff; form-mapping.ts 514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e; applicant-identity.ts e9dd4a9ea8ddbcf0aade011e80ee32c5764f8edb. 체크 5건 모두 [ ], 제품 인수 0/124.

**다음 시작 #371 income_source_inventory::amount_basis → #380**, 다음 우선 역할 IT담당자. income_source_inventory의 원문 기간·주체·gross/expenses/net/원통화 및 inheritance의 source-only·법적효과 분리. 실 OCR 페이지·SQL 저장/replay·전체 CI·공식 법원 Word·실무자 검토는 미인증.

## 부록 A. main 인덱스 canonical 전체 693개 순번
번호 | canonical ID
---: | ---
1 | account_garnishment::account_holder
2 | account_garnishment::account_id
3 | account_garnishment::court_or_authority
4 | account_garnishment::creditor
5 | account_garnishment::effective_date
6 | account_garnishment::garnishment_amount
7 | account_garnishment::issue_date
8 | account_garnishment::released_amount
9 | account_garnishment::seized_amount
10 | account_garnishment::status
11 | accounting_source::account_name
12 | accounting_source::closing_balance
13 | accounting_source::credits
14 | accounting_source::debits
15 | accounting_source::entity
16 | accounting_source::issue_date
17 | accounting_source::opening_balance
18 | accounting_source::period_end
19 | accounting_source::period_start
20 | accounting_source::source_total
21 | applicant_narrative_statement::identity.statement.admission_or_correction
22 | applicant_narrative_statement::identity.statement.author
23 | applicant_narrative_statement::identity.statement.event_end
24 | applicant_narrative_statement::identity.statement.event_start
25 | applicant_narrative_statement::identity.statement.narrative_text
26 | applicant_narrative_statement::identity.statement.signature_status
27 | applicant_narrative_statement::identity.statement.signed_at
28 | applicant_narrative_statement::identity.statement.source_references
29 | applicant_narrative_statement::identity.statement.statement_version
30 | applicant_narrative_statement::identity.statement.topic
31 | application_identity_venue::procedure.application.accepted_at
32 | application_identity_venue::procedure.application.address
33 | application_identity_venue::procedure.application.applicant_name
34 | application_identity_venue::procedure.application.case_number
35 | application_identity_venue::procedure.application.court
36 | application_identity_venue::procedure.application.jurisdiction_exception
37 | application_identity_venue::procedure.application.ordinary_venue_basis
38 | application_identity_venue::procedure.application.phone_home
39 | application_identity_venue::procedure.application.phone_mobile
40 | application_identity_venue::procedure.application.phone_work
41 | application_identity_venue::procedure.application.resident_id
42 | application_identity_venue::procedure.application.ruleset_id
43 | application_identity_venue::procedure.application.submitted_at
44 | application_identity_venue::procedure.application.transition_rule
45 | application_identity_venue::procedure.application_date
46 | application_identity_venue::procedure.venue
47 | asset_transfer_disposition::asset_id
48 | asset_transfer_disposition::consideration
49 | asset_transfer_disposition::market_value
50 | asset_transfer_disposition::proceeds_received
51 | asset_transfer_disposition::registration_date
52 | asset_transfer_disposition::relationship
53 | asset_transfer_disposition::review_status
54 | asset_transfer_disposition::transaction_date
55 | asset_transfer_disposition::transferee
56 | asset_transfer_disposition::transferor
57 | asset_transfer_disposition::use_of_proceeds
58 | bank_account_balance::account_holder
59 | bank_account_balance::account_id
60 | bank_account_balance::account_status
61 | bank_account_balance::balance
62 | bank_account_balance::balance_as_of
63 | bank_account_balance::currency
64 | bank_account_balance::institution
65 | bank_account_balance::issue_date
66 | bank_transactions::account_id
67 | bank_transactions::amount
68 | bank_transactions::counterparty
69 | bank_transactions::direction
70 | bank_transactions::issue_date
71 | bank_transactions::memo
72 | bank_transactions::period_end
73 | bank_transactions::period_start
74 | bank_transactions::post_balance
75 | bank_transactions::transaction_datetime
76 | bank_transactions::transaction_id
77 | bank_transactions::transaction_nature
78 | business_asset_inventory::acquisition_date
79 | business_asset_inventory::book_value
80 | business_asset_inventory::condition
81 | business_asset_inventory::disposal_restriction
82 | business_asset_inventory::goodwill_contract
83 | business_asset_inventory::market_value
84 | business_asset_inventory::quantity
85 | business_asset_inventory::quantity_unit
86 | business_assets_liabilities::as_of_date
87 | business_assets_liabilities::asset_or_claim_id
88 | business_assets_liabilities::business_entity
89 | business_assets_liabilities::gross_value
90 | business_assets_liabilities::item_kind
91 | business_assets_liabilities::ownership_interest
92 | business_assets_liabilities::payable_amount
93 | business_assets_liabilities::period_end
94 | business_assets_liabilities::period_start
95 | business_assets_liabilities::receivable_amount
96 | business_assets_liabilities::secured_payoff
97 | business_costs_and_ledgers::income.business_cost.accounting_basis
98 | business_costs_and_ledgers::income.business_cost.business_continuity_flag
99 | business_costs_and_ledgers::income.business_cost.business_entity
100 | business_costs_and_ledgers::income.business_cost.expense_category
101 | business_costs_and_ledgers::income.business_cost.gross_amount
102 | business_costs_and_ledgers::income.business_cost.payment_date
103 | business_costs_and_ledgers::income.business_cost.payment_status
104 | business_costs_and_ledgers::income.business_cost.period_end
105 | business_costs_and_ledgers::income.business_cost.period_start
106 | business_costs_and_ledgers::income.business_cost.supplier
107 | business_costs_and_ledgers::income.business_cost.tax_component
108 | business_current_income_summary::income.self_employment.business_costs
109 | business_current_income_summary::income.self_employment.contract_end
110 | business_current_income_summary::income.self_employment.contract_id
111 | business_current_income_summary::income.self_employment.gross_receivable
112 | business_current_income_summary::income.self_employment.invoice_date
113 | business_current_income_summary::income.self_employment.net_receipt
114 | business_current_income_summary::income.self_employment.operator
115 | business_current_income_summary::income.self_employment.payer_customer
116 | business_current_income_summary::income.self_employment.service_period_end
117 | business_current_income_summary::income.self_employment.service_period_start
118 | business_current_income_summary::income.self_employment.withheld_tax
119 | business_registration::business_entity
120 | business_registration::business_id
121 | business_registration::business_items
122 | business_registration::business_type
123 | business_registration::issue_date
124 | business_registration::joint_operators
125 | business_registration::opening_date
126 | business_registration::registration_date
127 | business_registration::representative
128 | business_registration::status
129 | business_sales_vat::income.sales.business_entity
130 | business_sales_vat::income.sales.exempt_sales
131 | business_sales_vat::income.sales.filing_date
132 | business_sales_vat::income.sales.gross_sales
133 | business_sales_vat::income.sales.issue_date
134 | business_sales_vat::income.sales.reporting_period_end
135 | business_sales_vat::income.sales.reporting_period_start
136 | business_sales_vat::income.sales.returns_refunds
137 | business_sales_vat::income.sales.sales_count
138 | business_sales_vat::income.sales.taxable_sales
139 | business_sales_vat::income.sales.vat_collected
140 | card_statement::billed_amount
141 | card_statement::billing_period
142 | card_statement::card_product_kind
143 | card_statement::installment_count
144 | card_statement::merchant
145 | card_statement::purchase_amount
146 | card_statement::remaining_installments
147 | cash_deposit_asset::actual_payoff
148 | cash_deposit_asset::as_of_date
149 | cash_deposit_asset::asset_id
150 | cash_deposit_asset::asset_kind
151 | cash_deposit_asset::encumbrance
152 | cash_deposit_asset::gross_value
153 | cash_deposit_asset::owner
154 | cash_deposit_asset::ownership_share
155 | cash_deposit_asset::protected_or_excluded_claim
156 | cash_deposit_asset::valuation_basis
157 | cash_holding_statement::acquisition_source
158 | cash_holding_statement::cash_currency
159 | cash_holding_statement::declaration_author
160 | cash_holding_statement::declaration_date
161 | cash_holding_statement::storage_location
162 | conditional_case_specific_request::conditional.court_request.case_number
163 | conditional_case_specific_request::conditional.court_request.court
164 | conditional_case_specific_request::conditional.court_request.item_due
165 | conditional_case_specific_request::conditional.court_request.legal_citation
166 | conditional_case_specific_request::conditional.court_request.operative_text
167 | conditional_case_specific_request::conditional.court_request.request_type
168 | conditional_case_specific_request::conditional.court_request.response_deadline
169 | conditional_case_specific_request::conditional.court_request.response_filed_at
170 | conditional_case_specific_request::conditional.court_request.service_date
171 | conditional_case_specific_request::conditional.court_request.status_change
172 | conditional_education_childcare::conditional.education.billed_amount
173 | conditional_education_childcare::conditional.education.enrollment_end
174 | conditional_education_childcare::conditional.education.enrollment_start
175 | conditional_education_childcare::conditional.education.fee_type
176 | conditional_education_childcare::conditional.education.frequency
177 | conditional_education_childcare::conditional.education.paid_amount
178 | conditional_education_childcare::conditional.education.payer
179 | conditional_education_childcare::conditional.education.provider
180 | conditional_education_childcare::conditional.education.recipient
181 | conditional_education_childcare::conditional.education.relation
182 | conditional_education_childcare::conditional.education.subsidy
183 | conditional_medical_expense::conditional.medical.applicant_relation
184 | conditional_medical_expense::conditional.medical.billed_cost
185 | conditional_medical_expense::conditional.medical.care_period_end
186 | conditional_medical_expense::conditional.medical.care_period_start
187 | conditional_medical_expense::conditional.medical.expected_recurring_cost
188 | conditional_medical_expense::conditional.medical.medical_opinion_period
189 | conditional_medical_expense::conditional.medical.paid_cost
190 | conditional_medical_expense::conditional.medical.patient
191 | conditional_medical_expense::conditional.medical.provider
192 | conditional_medical_expense::conditional.medical.reimbursement
193 | conditional_medical_expense::conditional.medical.service_date
194 | conditional_medical_expense::conditional.medical.service_kind
195 | conditional_nonstandard_income_or_household_event::conditional.change.affected_person
196 | conditional_nonstandard_income_or_household_event::conditional.change.duration_end
197 | conditional_nonstandard_income_or_household_event::conditional.change.effective_date
198 | conditional_nonstandard_income_or_household_event::conditional.change.event_date
199 | conditional_nonstandard_income_or_household_event::conditional.change.event_kind
200 | conditional_nonstandard_income_or_household_event::conditional.change.expense_delta
201 | conditional_nonstandard_income_or_household_event::conditional.change.income_delta
202 | conditional_nonstandard_income_or_household_event::conditional.change.issuer
203 | conditional_nonstandard_income_or_household_event::conditional.change.new_status
204 | conditional_nonstandard_income_or_household_event::conditional.change.old_status
205 | conditional_plan_funding_source::applicability.form.current_official_version
206 | conditional_plan_funding_source::applicability.form.disposition_asset_ids
207 | conditional_plan_funding_source::applicability.form.disposition_date
208 | conditional_plan_funding_source::applicability.form.disposition_proceeds
209 | conditional_plan_funding_source::applicability.form.income_source_evidence_ids
210 | conditional_plan_funding_source::applicability.form.plan_source
211 | conditional_plan_funding_source::applicability.form.proceeds_to_plan
212 | conditional_plan_funding_source::applicability.form.review_status
213 | conditional_plan_funding_source::applicability.form.selected_form_code
214 | credit_information_report::assignment_event_date
215 | credit_information_report::current_reported_creditor
216 | credit_information_report::event_record_id
217 | credit_information_report::issue_date
218 | credit_information_report::previous_creditor
219 | credit_information_report::report_as_of
220 | credit_information_report::report_subject
221 | credit_report::currency_unit
222 | credit_report::event_date
223 | credit_report::event_kind
224 | credit_report::institution
225 | credit_report::product_code
226 | credit_report::reported_amount
227 | credit_report::status
228 | creditor_assignment_dispute::assignment_date
229 | creditor_assignment_dispute::claim_id
230 | creditor_assignment_dispute::claim_status
231 | creditor_assignment_dispute::current_claimant
232 | creditor_assignment_dispute::dispute_basis
233 | creditor_assignment_dispute::disputed_amount
234 | creditor_assignment_dispute::notice_date
235 | creditor_assignment_dispute::prior_creditor
236 | creditor_assignment_dispute::supporting_record
237 | crypto_balance::account_owner
238 | crypto_balance::asset_symbol
239 | crypto_balance::available_quantity
240 | crypto_balance::average_acquisition_price
241 | crypto_balance::displayed_valuation
242 | crypto_balance::exchange_or_wallet
243 | crypto_balance::locked_quantity
244 | crypto_balance::network
245 | crypto_balance::total_quantity
246 | crypto_balance::valuation_currency
247 | crypto_balance::valuation_datetime
248 | crypto_balance::valuation_unit_price
249 | crypto_balance::wallet_address
250 | crypto_transactions::asset_symbol
251 | crypto_transactions::completed_at
252 | crypto_transactions::counterparty_account_identity
253 | crypto_transactions::crypto_event_kind
254 | crypto_transactions::destination_address
255 | crypto_transactions::fee_asset
256 | crypto_transactions::fee_quantity
257 | crypto_transactions::gross_trade_amount
258 | crypto_transactions::network
259 | crypto_transactions::quantity
260 | crypto_transactions::quote_currency
261 | crypto_transactions::requested_at
262 | crypto_transactions::source_address
263 | crypto_transactions::transfer_status
264 | crypto_transactions::txid
265 | crypto_transactions::unit_price
266 | current_nonwage_income::income.other.contract_end
267 | current_nonwage_income::income.other.deductions
268 | current_nonwage_income::income.other.earning_period_end
269 | current_nonwage_income::income.other.earning_period_start
270 | current_nonwage_income::income.other.frequency
271 | current_nonwage_income::income.other.gross_amount
272 | current_nonwage_income::income.other.income_kind
273 | current_nonwage_income::income.other.net_received
274 | current_nonwage_income::income.other.payer
275 | current_nonwage_income::income.other.payment_date
276 | current_nonwage_income::income.other.recipient
277 | debt_certificate::as_of_date
278 | debt_certificate::claim_cause
279 | debt_certificate::contract_id
280 | debt_certificate::contract_interest_rate
281 | debt_certificate::creditor
282 | debt_certificate::creditor_address
283 | debt_certificate::debtor
284 | debt_certificate::fees
285 | debt_certificate::interest_balance
286 | debt_certificate::issue_date
287 | debt_certificate::issuer
288 | debt_certificate::original_principal
289 | debt_certificate::origination_date
290 | debt_certificate::overdue_interest
291 | debt_certificate::principal_balance
292 | debt_certificate::total_claim
293 | divorce_records::actual_support_paid
294 | divorce_records::agreement_or_order_date
295 | divorce_records::divorce_date
296 | divorce_records::former_spouse
297 | divorce_records::marriage_date
298 | divorce_records::partition_amount
299 | divorce_records::partition_asset
300 | divorce_records::support_child
301 | divorce_records::support_payer
302 | divorce_records::support_period
303 | divorce_records::support_periodic_amount
304 | divorce_records::support_recipient
305 | employment_contract::employer_signature_date
306 | employment_contract::employer_signature_status
307 | employment_history::insurance_scheme
308 | employment_history::qualification_acquired
309 | employment_history::qualification_lost
310 | employment_history::qualification_record_scope
311 | employment_history::qualification_type
312 | employment_history::qualification_workplace
313 | employment_relationship::income.employment.allowance_terms
314 | employment_relationship::income.employment.base_wage
315 | employment_relationship::income.employment.contract_term
316 | employment_relationship::income.employment.employee
317 | employment_relationship::income.employment.employer
318 | employment_relationship::income.employment.employment_type
319 | employment_relationship::income.employment.end_date
320 | employment_relationship::income.employment.hours
321 | employment_relationship::income.employment.issue_date
322 | employment_relationship::income.employment.start_date
323 | guarantee_joint_claim::applicant_role
324 | guarantee_joint_claim::creditor
325 | guarantee_joint_claim::dispute_status
326 | guarantee_joint_claim::guarantee_claimed
327 | guarantee_joint_claim::guarantee_limit
328 | guarantee_joint_claim::principal_debtor
329 | guarantee_joint_claim::recourse_status
330 | guarantee_joint_claim::underlying_claim_id
331 | health_insurance_arrears::as_of_date
332 | health_insurance_arrears::authority
333 | health_insurance_arrears::disposal_cost
334 | health_insurance_arrears::issue_date
335 | health_insurance_arrears::late_charge
336 | health_insurance_arrears::period_end
337 | health_insurance_arrears::period_start
338 | health_insurance_arrears::subscriber
339 | health_insurance_arrears::total_arrear
340 | health_insurance_arrears::unpaid_contribution
341 | household_composition_support::household.support.member
342 | household_composition_support::household.support.other_income
343 | household_composition_support::household.support.relationship
344 | household_composition_support::household.support.residence_end
345 | household_composition_support::household.support.residence_start
346 | household_composition_support::household.support.support_amount
347 | household_composition_support::household.support.support_frequency
348 | household_composition_support::household.support.support_period_end
349 | household_composition_support::household.support.support_period_start
350 | household_composition_support::household.support.support_provider
351 | household_composition_support::household.support.support_recipient
352 | household_living_expense::household.expense.arrears
353 | household_living_expense::household.expense.beneficiary
354 | household_living_expense::household.expense.billed_amount
355 | household_living_expense::household.expense.billing_period_end
356 | household_living_expense::household.expense.billing_period_start
357 | household_living_expense::household.expense.expense_kind
358 | household_living_expense::household.expense.issue_date
359 | household_living_expense::household.expense.paid_amount
360 | household_living_expense::household.expense.payer
361 | household_living_expense::household.expense.provider
362 | household_living_expense::household.expense.shared_allocation
363 | identity_residence_record::identity.address
364 | identity_residence_record::identity.household_members
365 | identity_residence_record::identity.issue_date
366 | identity_residence_record::identity.marital_status
367 | identity_residence_record::identity.name
368 | identity_residence_record::identity.record_number
369 | identity_residence_record::identity.registration_id
370 | identity_residence_record::identity.relationship
371 | income_source_inventory::amount_basis
372 | income_source_inventory::income_source_id
373 | income_source_inventory::reported_expenses
374 | income_source_inventory::reported_gross
375 | income_source_inventory::reported_net
376 | income_source_inventory::source_document_reference
377 | income_source_inventory::source_kind
378 | inheritance_records::attributed_amount
379 | inheritance_records::decedent
380 | inheritance_records::disclaimer_or_limited_acceptance
381 | inheritance_records::filing_or_order_reference
382 | inheritance_records::heir
383 | inheritance_records::heir_relationship
384 | inheritance_records::inherited_asset_id
385 | inheritance_records::partition_agreement_date
386 | inheritance_records::stated_share
387 | inheritance_records::succession_opened_at
388 | insurance_policy_asset::as_of_date
389 | insurance_policy_asset::beneficiary
390 | insurance_policy_asset::contract_holder
391 | insurance_policy_asset::coverage_amount
392 | insurance_policy_asset::end_date
393 | insurance_policy_asset::insured
394 | insurance_policy_asset::insurer
395 | insurance_policy_asset::issue_date
396 | insurance_policy_asset::pledge
397 | insurance_policy_asset::policy_id
398 | insurance_policy_asset::policy_loan_balance
399 | insurance_policy_asset::policy_status
400 | insurance_policy_asset::premium_per_payment
401 | insurance_policy_asset::refund_net_basis
402 | insurance_policy_asset::start_date
403 | insurance_policy_asset::surrender_value
404 | insurance_policy_asset::total_premium
405 | lease_contract::fixed_date
406 | lease_housing::applicant_relation
407 | lease_housing::arrears_deduction
408 | lease_housing::deposit
409 | lease_housing::issue_date
410 | lease_housing::landlord
411 | lease_housing::monthly_rent
412 | lease_housing::period_end
413 | lease_housing::period_start
414 | lease_housing::property_id
415 | lease_housing::renewal_status
416 | lease_housing::secured_balance
417 | lease_housing::security_assignment
418 | lease_housing::tenant
419 | lease_housing::use
420 | litigation_enforcement::case_id
421 | litigation_enforcement::claim_type
422 | litigation_enforcement::claimed_amount
423 | litigation_enforcement::court_or_authority
424 | litigation_enforcement::enforced_amount
425 | litigation_enforcement::event_date
426 | litigation_enforcement::issue_date
427 | litigation_enforcement::judgment_amount
428 | litigation_enforcement::parties
429 | litigation_enforcement::security_or_attachment
430 | litigation_enforcement::status
431 | loan_contract::contract_interest_rate
432 | loan_contract::maturity_date
433 | loan_contract::repayment_installments
434 | loan_contract::repayment_method
435 | loan_contract::scheduled_payment
436 | local_tax::arrears
437 | local_tax::as_of_date
438 | local_tax::assessed_amount
439 | local_tax::authority
440 | local_tax::collection_cost
441 | local_tax::issue_date
442 | local_tax::paid_amount
443 | local_tax::surcharge
444 | local_tax::tax_base
445 | local_tax::tax_period
446 | local_tax::tax_type
447 | local_tax::taxpayer
448 | local_tax_assessment::jurisdiction_scope
449 | local_tax_assessment::no_assessment_text
450 | local_tax_assessment::row_or_subtotal_kind
451 | local_tax_assessment::tax_assessment_year
452 | local_tax_assessment::tax_notice_status
453 | local_tax_assessment::tax_object
454 | payroll_payslip::income.payroll.allowances
455 | payroll_payslip::income.payroll.bonus
456 | payroll_payslip::income.payroll.employee
457 | payroll_payslip::income.payroll.employer
458 | payroll_payslip::income.payroll.gross_base
459 | payroll_payslip::income.payroll.hours_days
460 | payroll_payslip::income.payroll.issue_date
461 | payroll_payslip::income.payroll.net_pay
462 | payroll_payslip::income.payroll.other_deductions
463 | payroll_payslip::income.payroll.overtime
464 | payroll_payslip::income.payroll.pay_date
465 | payroll_payslip::income.payroll.pay_period_end
466 | payroll_payslip::income.payroll.pay_period_start
467 | payroll_payslip::income.payroll.social_contributions
468 | payroll_payslip::income.payroll.tax_withheld
469 | pension_benefit_income::income.benefit.beneficiary
470 | pension_benefit_income::income.benefit.benefit_type
471 | pension_benefit_income::income.benefit.decision_date
472 | pension_benefit_income::income.benefit.deductions
473 | pension_benefit_income::income.benefit.monthly_gross
474 | pension_benefit_income::income.benefit.net_payment
475 | pension_benefit_income::income.benefit.payment_date
476 | pension_benefit_income::income.benefit.payment_end
477 | pension_benefit_income::income.benefit.payment_start
478 | pension_benefit_income::income.benefit.provider
479 | pension_benefit_income::income.benefit.review_status
480 | pension_contribution_benefit::as_of_date
481 | pension_contribution_benefit::benefit_amount
482 | pension_contribution_benefit::benefit_type
483 | pension_contribution_benefit::contribution
484 | pension_contribution_benefit::encumbrance
485 | pension_contribution_benefit::issue_date
486 | pension_contribution_benefit::member
487 | pension_contribution_benefit::payment_start
488 | pension_contribution_benefit::period_end
489 | pension_contribution_benefit::period_start
490 | pension_contribution_benefit::plan_id
491 | pension_contribution_benefit::provider
492 | pension_contribution_benefit::vested_balance
493 | pension_contribution_benefit::withdrawal_value
494 | pension_contribution_statement::contribution_record_kind
495 | pension_contribution_statement::paid_amount
496 | pension_contribution_statement::paid_months
497 | pension_contribution_statement::payable_amount
498 | pension_contribution_statement::payable_months
499 | pension_contribution_statement::standard_monthly_income
500 | pension_contribution_statement::subscriber_type
501 | pension_contribution_statement::unpaid_amount
502 | pension_contribution_statement::unpaid_months
503 | pension_contribution_statement::unpayable_amount
504 | pension_contribution_statement::unpayable_months
505 | procedure_court_orders::procedure.order.case_number
506 | procedure_court_orders::procedure.order.court
507 | procedure_court_orders::procedure.order.deadline
508 | procedure_court_orders::procedure.order.debtor
509 | procedure_court_orders::procedure.order.effective_date
510 | procedure_court_orders::procedure.order.finality
511 | procedure_court_orders::procedure.order.operative_text
512 | procedure_court_orders::procedure.order.order_date
513 | procedure_court_orders::procedure.order.order_type
514 | procedure_court_orders::procedure.order.scope
515 | procedure_court_orders::procedure.order.service_date
516 | procedure_court_orders::procedure.order.status_change
517 | procedure_enforcement_garnishment::procedure.enforcement.asset_or_income
518 | procedure_enforcement_garnishment::procedure.enforcement.attached_amount
519 | procedure_enforcement_garnishment::procedure.enforcement.authority
520 | procedure_enforcement_garnishment::procedure.enforcement.case_number
521 | procedure_enforcement_garnishment::procedure.enforcement.claimed_amount
522 | procedure_enforcement_garnishment::procedure.enforcement.creditor
523 | procedure_enforcement_garnishment::procedure.enforcement.debtor
524 | procedure_enforcement_garnishment::procedure.enforcement.effective_date
525 | procedure_enforcement_garnishment::procedure.enforcement.order_date
526 | procedure_enforcement_garnishment::procedure.enforcement.order_type
527 | procedure_enforcement_garnishment::procedure.enforcement.released_amount
528 | procedure_enforcement_garnishment::procedure.enforcement.service_date
529 | procedure_enforcement_garnishment::procedure.enforcement.status
530 | procedure_prior_insolvency::procedure.history.case_number
531 | procedure_prior_insolvency::procedure.history.case_type
532 | procedure_prior_insolvency::procedure.history.court_authority
533 | procedure_prior_insolvency::procedure.history.debtor
534 | procedure_prior_insolvency::procedure.history.discharge_date
535 | procedure_prior_insolvency::procedure.history.filing_date
536 | procedure_prior_insolvency::procedure.history.finality_date
537 | procedure_prior_insolvency::procedure.history.order_date
538 | procedure_prior_insolvency::procedure.history.order_kind
539 | procedure_prior_insolvency::procedure.history.private_adjustment_attempt
540 | procedure_prior_insolvency::procedure.history.record_issue_date
541 | procedure_private_creditor_request::procedure.creditor_info.as_of_date
542 | procedure_private_creditor_request::procedure.creditor_info.claim_id
543 | procedure_private_creditor_request::procedure.creditor_info.claim_origin_date
544 | procedure_private_creditor_request::procedure.creditor_info.creditor
545 | procedure_private_creditor_request::procedure.creditor_info.debtor
546 | procedure_private_creditor_request::procedure.creditor_info.interest_balance
547 | procedure_private_creditor_request::procedure.creditor_info.interest_rate
548 | procedure_private_creditor_request::procedure.creditor_info.principal_balance
549 | procedure_private_creditor_request::procedure.creditor_info.principal_original
550 | procedure_private_creditor_request::procedure.creditor_info.request_copy
551 | procedure_private_creditor_request::procedure.creditor_info.request_date
552 | procedure_private_creditor_request::procedure.creditor_info.response_date
553 | property_search::issue_date
554 | property_search::jurisdiction_scope
555 | property_search::ownership_share
556 | property_search::property_found
557 | property_search::property_id
558 | property_search::registered_owner
559 | property_search::search_as_of
560 | property_search::searched_subject
561 | real_estate_register::ownership_change_text
562 | real_estate_register::property_address
563 | real_property_register::acquisition_date
564 | real_property_register::issue_date
565 | real_property_register::maximum_claim
566 | real_property_register::mortgage_holder
567 | real_property_register::ownership_share
568 | real_property_register::property_id
569 | real_property_register::property_type
570 | real_property_register::registered_owner
571 | real_property_register::registered_value
572 | real_property_register::registration_date
573 | real_property_register::release_date
574 | real_property_valuation::actual_payoff
575 | real_property_valuation::disposal_cost
576 | real_property_valuation::market_value
577 | real_property_valuation::owner
578 | real_property_valuation::ownership_share
579 | real_property_valuation::property_id
580 | real_property_valuation::valuation_date
581 | real_property_valuation::valuation_method
582 | receivable_collectability::collected_amount
583 | receivable_collectability::collection_status
584 | receivable_collectability::counterparty_status
585 | receivable_collectability::demand_date
586 | receivable_collectability::receivable_id
587 | receivable_collectability::security_reference
588 | receivable_collectability::uncollected_reason
589 | resident_registration::address_change_date
590 | resident_registration::historical_address
591 | resident_registration::residence_history_period
592 | retirement_estimate::estimated_retirement_date
593 | retirement_estimate::payout_condition
594 | retirement_estimate::retirement_scheme
595 | retirement_estimate::service_period
596 | retirement_estimate::transfer_history
597 | salary_statement::employer_confirmation_status
598 | salary_statement::employer_signature_date
599 | salary_statement::gross_total
600 | salary_statement::total_deductions
601 | secured_claim_security::actual_payoff
602 | secured_claim_security::collateral_id
603 | secured_claim_security::discharge_date
604 | secured_claim_security::grantor
605 | secured_claim_security::priority
606 | secured_claim_security::registered_maximum
607 | secured_claim_security::registration_date
608 | secured_claim_security::secured_party
609 | secured_claim_security::security_type
610 | securities_balance::account_coverage
611 | securities_balance::asset_class
612 | securities_balance::cash_balance
613 | securities_balance::quantity
614 | securities_balance::quantity_unit
615 | securities_balance::security_id
616 | securities_balance::security_name
617 | securities_balance::settlement_basis
618 | securities_balance::unsettled_liability
619 | securities_balance::valuation_currency
620 | securities_balance::valuation_datetime
621 | securities_balance::valuation_method
622 | securities_balance::valuation_unit_price
623 | securities_transactions::counter_account
624 | securities_transactions::fee
625 | securities_transactions::quantity
626 | securities_transactions::quantity_unit
627 | securities_transactions::security_event_kind
628 | securities_transactions::security_id
629 | securities_transactions::security_name
630 | securities_transactions::settled_amount
631 | securities_transactions::settlement_date
632 | securities_transactions::tax
633 | securities_transactions::trade_gross
634 | securities_transactions::trade_unit_price
635 | tax_income::arrears
636 | tax_income::gross_receipts
637 | tax_income::income_after_expenses
638 | tax_income::income_kind
639 | tax_income::issue_date
640 | tax_income::necessary_expenses
641 | tax_income::period_end
642 | tax_income::period_start
643 | tax_income::tax_assessed
644 | tax_income::tax_paid
645 | tax_income::tax_year
646 | tax_income::taxpayer
647 | tax_public_arrear::as_of_date
648 | tax_public_arrear::assessment_date
649 | tax_public_arrear::authority
650 | tax_public_arrear::costs
651 | tax_public_arrear::debtor
652 | tax_public_arrear::due_date
653 | tax_public_arrear::issue_date
654 | tax_public_arrear::principal_arrear
655 | tax_public_arrear::surcharge_interest
656 | tax_public_arrear::tax_period
657 | tax_public_arrear::tax_type
658 | tax_public_arrear::total_due
659 | vehicle_registration::model_year
660 | vehicle_registration::plate_number
661 | vehicle_registration::record_issue_date
662 | vehicle_registration::vin
663 | vehicle_registry::acquisition_date
664 | vehicle_registry::co_owners
665 | vehicle_registry::lien_date
666 | vehicle_registry::lien_holder
667 | vehicle_registry::ownership_share
668 | vehicle_registry::registered_lien_amount
669 | vehicle_registry::registered_owner
670 | vehicle_registry::registration_status
671 | vehicle_registry::release_date
672 | vehicle_registry::transfer_date
673 | vehicle_registry::vehicle_id
674 | vehicle_valuation::actual_payoff
675 | vehicle_valuation::market_value
676 | vehicle_valuation::mileage
677 | vehicle_valuation::model_year
678 | vehicle_valuation::owner
679 | vehicle_valuation::registered_lien_amount
680 | vehicle_valuation::valuation_date
681 | vehicle_valuation::valuation_method
682 | vehicle_valuation::vehicle_id
683 | wage_withholding_tax::income.tax.employment_start_end
684 | wage_withholding_tax::income.tax.gross_wages
685 | wage_withholding_tax::income.tax.issue_date
686 | wage_withholding_tax::income.tax.resident_tax
687 | wage_withholding_tax::income.tax.tax_exempt_allowances
688 | wage_withholding_tax::income.tax.tax_year
689 | wage_withholding_tax::income.tax.taxable_allowances
690 | wage_withholding_tax::income.tax.taxpayer
691 | wage_withholding_tax::income.tax.withheld_income_tax
692 | wage_withholding_tax::income.tax.withholding_agent
693 | wage_withholding_tax::income.tax.year_end_adjustment

## 부록 B. 중앙 보드 A3 담당자 체크 ID 124개 순번
번호 | check ID
---: | ---
1 | A3-IT-001
2 | A3-IT-002
3 | A3-IT-003
4 | A3-IT-004
5 | A3-IT-005
6 | A3-IT-006
7 | A3-IT-007
8 | A3-IT-008
9 | A3-IT-009
10 | A3-IT-010
11 | A3-IT-011
12 | A3-IT-012
13 | A3-IT-013
14 | A3-IT-014
15 | A3-IT-015
16 | A3-IT-016
17 | A3-IT-017
18 | A3-IT-018
19 | A3-IT-019
20 | A3-IT-020
21 | A3-DOC-001
22 | A3-DOC-002
23 | A3-DOC-003
24 | A3-DOC-004
25 | A3-DOC-005
26 | A3-DOC-006
27 | A3-DOC-007
28 | A3-DOC-008
29 | A3-DOC-009
30 | A3-DOC-010
31 | A3-DOC-011
32 | A3-DOC-012
33 | A3-DOC-013
34 | A3-DOC-014
35 | A3-DOC-015
36 | A3-DOC-016
37 | A3-DOC-017
38 | A3-DOC-018
39 | A3-DOC-019
40 | A3-DOC-020
41 | A3-CALC-001
42 | A3-CALC-002
43 | A3-CALC-003
44 | A3-CALC-004
45 | A3-CALC-005
46 | A3-CALC-006
47 | A3-CALC-007
48 | A3-CALC-008
49 | A3-CALC-009
50 | A3-CALC-010
51 | A3-CALC-011
52 | A3-CALC-012
53 | A3-CALC-013
54 | A3-CALC-014
55 | A3-CALC-015
56 | A3-CALC-016
57 | A3-CALC-017
58 | A3-CALC-018
59 | A3-CALC-019
60 | A3-CALC-020
61 | A3-LAW-001
62 | A3-LAW-002
63 | A3-LAW-003
64 | A3-LAW-004
65 | A3-LAW-005
66 | A3-LAW-006
67 | A3-LAW-007
68 | A3-LAW-008
69 | A3-LAW-009
70 | A3-LAW-010
71 | A3-LAW-011
72 | A3-LAW-012
73 | A3-LAW-013
74 | A3-LAW-014
75 | A3-LAW-015
76 | A3-LAW-016
77 | A3-LAW-017
78 | A3-LAW-018
79 | A3-LAW-019
80 | A3-LAW-020
81 | A3-LAW-021
82 | A3-LAW-022
83 | A3-DATA-001
84 | A3-DATA-002
85 | A3-DATA-003
86 | A3-DATA-004
87 | A3-DATA-005
88 | A3-DATA-006
89 | A3-DATA-007
90 | A3-DATA-008
91 | A3-DATA-009
92 | A3-DATA-010
93 | A3-DATA-011
94 | A3-DATA-012
95 | A3-DATA-013
96 | A3-DATA-014
97 | A3-DATA-015
98 | A3-DATA-016
99 | A3-DATA-017
100 | A3-DATA-018
101 | A3-DATA-019
102 | A3-DATA-020
103 | A3-DATA-021
104 | A3-DATA-022
105 | A3-AX-001
106 | A3-AX-002
107 | A3-AX-003
108 | A3-AX-004
109 | A3-AX-005
110 | A3-AX-006
111 | A3-AX-007
112 | A3-AX-008
113 | A3-AX-009
114 | A3-AX-010
115 | A3-AX-011
116 | A3-AX-012
117 | A3-AX-013
118 | A3-AX-014
119 | A3-AX-015
120 | A3-AX-016
121 | A3-AX-017
122 | A3-AX-018
123 | A3-AX-019
124 | A3-AX-020
