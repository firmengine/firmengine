# FirmEngine A3 r70 — canonical #681~693 피처 증거/계산/법률/양식 소비처 심층 재감사

**실행 2026-11-02 KST**, 시작 고정 GitHub `main` HEAD `c72c4431ba64301d65fa6e8ea982dd6b76175bbe`. 작업 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 기존 [r69 #661–680](20261102-r69-canonical-661-680-consumer-recheck-09KST.md)과 초기 [r35 #681–693](20261031-r35-canonical-681-693-2327KST.md), 보드 A3 124 체크 ID, 원본 스키마·테스트·PR #51/#155를 읽고 누적. 이번 순환 **데이터 → IT → 사용자·서류 → 계산사무장 → 변호사**; 체크 ID `A3-DATA-002`, `A3-IT-003`, `A3-DOC-012`, `A3-CALC-001`, `A3-LAW-014`. 모두 **[ ] 미완료**. 다음 역할 **AX**.

## 원본 구조·수량·시험 수준

- canonical **693/693 유일**, 85문서·48패밀리·**1,808 source slots**, orphan/route 중복 **0**. 이번 **13 ID·13 슬롯·2문서**, 적용조건 **13/13**, source locator **13/13 선언**, `noCrossRecordBorrowing` **2/2 선언**. 합산규칙 `separate_summary_from_detail_do_not_double_count`, 분리 `named_party_role/tax_or_contribution_period/source_detail_row`. PDF/실 OCR·D1 row/page read-back 미실행.
- 계산 **18모듈/91 입력 선언(78 고유 경로)**. 이번 **직접 typed 0/13, material must/context 0/13, 정확 서식 token 0/13, 95위험·50규칙·46예외 정적 정확 canonical 계약 0/13**. 승인 seed `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`이며 관리형 동적 기준 정책은 미조회/미인증. 위험 95 중 기본 필수피처 누락 88은 전체 릴리스 게이트.
- 실제 원본문 `bindCanonicalSourceField` (TS 타입표기만 제거) **13/13 정확 ID 결속**, 잘못된 id/key/family **3/3 unbound**, `canonicalProjectionKey` **117 카테고리 탐색 / typed 0**. `hasPeriod/hasUnit/reviewScope` **13×3=39 원본문 격리 호출**: 기간 true **11**, 단위 true **7**; 차량 D5101/D5110 및 임금 D5103/D5110 **양식 검토 후보**. 공식 token/최종 문서 합격 아님.
- `calculationSourceCellIssues` 원본문(타입표기 제거, `normalizeMoney`는 합성 KRW/기타 stub) V8 **14/14 현재 함수 동작의 사전 예상과 일치**. 숫자/날짜/기간/상태별 독립 *업무상 안전기대*는 별개이며 아래 P2 반례를 표시. 이 수치를 Node CI·실 D1/실 판독률로 보고 금지.

## 정확 13개 ID별 소비처·공백

P/U/A = 원본 기간 술어 true / 단위 술어 true / 정확 canonical 적용조건 존재. **0은 자료 미관찰/금액 0/승인된 비해당이 아니다**. 각 필드의 페이지/문서 해시/원문 quote·bbox/행·기간·대상 메타는 코드 계약 **선언**이며, 사건의 실제 동일성/법적 인정은 별도.

| # | 정확 canonical ID | 서류 | datatype; canonical_unit; temporal_role; subject | P/U/A | 사용처·공백 |
|---:|---|---|---|:---:|---|
| 690 | `wage_withholding_tax::income.tax.taxpayer` | `salary_withholding` | party_role; not_applicable; not_applicable; applicant_debtor | 1/0/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 692 | `wage_withholding_tax::income.tax.withholding_agent` | `salary_withholding` | party_role; not_applicable; not_applicable; employer | 1/0/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 688 | `wage_withholding_tax::income.tax.tax_year` | `salary_withholding` | integer; not_applicable; tax_period_year; applicant_debtor | 1/1/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 683 | `wage_withholding_tax::income.tax.employment_start_end` | `salary_withholding` | date_range; not_applicable; period_scope; applicant_debtor | 1/0/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 684 | `wage_withholding_tax::income.tax.gross_wages` | `salary_withholding` | money; KRW; tax_period_year; applicant_debtor | 1/1/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 689 | `wage_withholding_tax::income.tax.taxable_allowances` | `salary_withholding` | money_or_itemized; KRW; tax_period_year; applicant_debtor | 1/1/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 687 | `wage_withholding_tax::income.tax.tax_exempt_allowances` | `salary_withholding` | money_or_itemized; KRW; tax_period_year; applicant_debtor | 1/1/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 691 | `wage_withholding_tax::income.tax.withheld_income_tax` | `salary_withholding` | money; KRW; tax_period_year; applicant_debtor | 1/1/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 686 | `wage_withholding_tax::income.tax.resident_tax` | `salary_withholding` | money; KRW; tax_period_year; applicant_debtor | 1/1/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 693 | `wage_withholding_tax::income.tax.year_end_adjustment` | `salary_withholding` | money_or_status; KRW; tax_period_year; applicant_debtor | 1/1/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 685 | `wage_withholding_tax::income.tax.issue_date` | `salary_withholding` | date; not_applicable; document_issue_date; authority | 1/0/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 682 | `vehicle_valuation::vehicle_id` | `vehicle_valuation` | identifier; not_applicable; not_applicable; owner_legal | 0/0/1 | source-only; typed 0; direct material 0; exact token/legal 0 |
| 681 | `vehicle_valuation::valuation_method` | `vehicle_valuation` | string; not_applicable; not_applicable; owner_legal | 0/0/1 | source-only; typed 0; direct material 0; exact token/legal 0 |

`extraction_records`→`extracted_features.raw_value_json/canonical_field_id/source_state`→`extraction_field_coverage`와 `feature-lineage-audit.ts`의 `document_id/page/record_ordinal/field_ordinal/source_sha256`는 저장/추적 **스키마**이며 실제 저장·조회/판본 동일성 영수증은 없다. 이번 피처의 0 direct 계산/법률/서식 소비를 폐기·무용 판정하지 않는다.

## 원본 V8 셀 검증 — 합성 입력·독립 동작예상·관찰

| # | 시나리오 | datatype / value / source unit | 현재 함수 동작 기대 | 실제 관찰 |
|---:|---|---|---|---|
| 1 | #683 invalid date_range | `date_range`, `not/a/range`, unit=`null` | `[]` | `[]` |
| 2 | #683 ISO date_range | `date_range`, `2025-01-01/2025-12-31`, unit=`null` | `[]` | `[]` |
| 3 | #693 numeric money_or_status missing unit | `money_or_status`, `1234`, unit=`null` | `[]` | `[]` |
| 4 | #693 textual status | `money_or_status`, `pending`, unit=`null` | `[]` | `[]` |
| 5 | #684 money missing unit | `money`, `1234`, unit=`null` | `SOURCE_MONETARY_UNIT_MISSING` | `SOURCE_MONETARY_UNIT_MISSING` |
| 6 | #684 money KRW | `money`, `1234`, unit=`KRW` | `[]` | `[]` |
| 7 | #687 itemized money missing unit | `money_or_itemized`, `1234`, unit=`null` | `SOURCE_MONETARY_UNIT_MISSING` | `SOURCE_MONETARY_UNIT_MISSING` |
| 8 | #688 invalid integer | `integer`, `20X5`, unit=`null` | `SOURCE_INTEGER_FORMAT_REVIEW` | `SOURCE_INTEGER_FORMAT_REVIEW` |
| 9 | #688 integer 9999 | `integer`, `9999`, unit=`null` | `[]` | `[]` |
| 10 | #685 impossible issue date | `date`, `2025-02-30`, unit=`null` | `SOURCE_DATE_INVALID` | `SOURCE_DATE_INVALID` |
| 11 | #690 taxpayer | `party_role`, `synthetic person`, unit=`null` | `[]` | `[]` |
| 12 | #691 non-KRW money | `money`, `100`, unit=`USD` | `SOURCE_MONEY_NOT_EXACT_KRW` | `SOURCE_MONEY_NOT_EXACT_KRW` |
| 13 | #684 source unknown | `money`, `null`, unit=`null` | `[]` | `[]` |
| 14 | #684 explicit present zero | `money`, `0`, unit=`KRW` | `[]` | `[]` |

**14/14는 현재 코드 분기의 충실한 재현**. 업무상 의미 검증까지 14/14 통과를 뜻하지 않는다. 가상 `quote`·`sourceState=present`; 미관찰 사례만 unknown. `normalizeMoney`는 실제 도메인 정규화가 아닌 **합성 stub**.

### P2·미결 검증 5개

1. **#683 날짜범위**: datatype `date_range`, 값 `not/a/range`가 `calculationSourceCellIssues`에서 오류 0. `date`의 불가능한 날짜는 차단하지만 `date_range` 분기는 없음. 실제 OCR 전처리·후속 기간규칙이 별도 차단하는지 **미확인**; 검토 완료 전 기간 유효성 인정 금지.
2. **#693 연말정산 금액/상태 혼합**: datatype `money_or_status`, 값 `1234`, 단위 `null`에서도 **오류 0**. `pending` 같은 상태를 금액으로 강제 해석해서도 안 되므로 숫자형인지 상태형인지 분기한 뒤에만 단위/원화 검산하고, 환급/추징 방향을 별도 확인해야 한다. 좁은 입력 게이트 P2 후보이며 자동 월소득 승격·원화 합산 금지.
3. **기존 r35 의미 불일치 재현**: #690 납세자·#692 원천징수의무자는 `temporal_role=not_applicable`인데 `hasPeriod` true. #688 과세연도는 `integer`·단위 `not_applicable`인데 `hasUnit` true. 이는 범용 후보 술어의 과잉 분류로, 실 사건 법원 오류를 입증하지 않음. 기존 **Draft PR #51**과 중첩하므로 main 임의 수정 금지.
4. **차량 #681~682**: 가치 평가방법·차량 식별자는 직전 #675 시가 금액과 typed 차량이 동일 객체인지 검산하는 핵심 source-only 증거. 기존 **Draft PR #155**의 대상/소유자 결속 미해결과 연결. 다른 차량/소유자/평가일 금액을 자동 합치거나 지분·담보를 무단 차감 금지.
5. **원천징수 #684~693**: 연간 세전임금·과세수당·비과세수당·소득세·지방소득세·연말정산 추가세액/환급은 중복·부호·연도를 반드시 분리. 과세연도 #688, 기간 #683, 납세자 #690, 징수의무자 #692, 발급일 #685를 대조하고 승인한 월별 실수령/가용소득 산식과만 결합. 문서/행단위 총액과 세부항목 합산을 무단 수행하지 않았다.

## 법률·갈음·보정·양식 인수 구분

- `risk-catalog.json` 95, `legal-catalog.json` 50, `legal-exceptions.json` 46 및 `legal-evidence-criteria.ts` seed 정확 ID 계약은 이번 13건 0. `activeLegalEvidencePolicy()`는 별도 관리형 기준 조회 경로이며 **운영값 미조회**; 관할·시행일·근거 원문·변호사 인수 없이는 **0% 승인**.
- `document-substitution.ts`·`preapproval-correction-audit.ts`의 승인/법원명령 소스 경로는 원본 정적 확인 수준. `salary_withholding`와 `vehicle_valuation`의 사건별 A←B+C 갈음 승인·철회·정정, 보정명령 원문/기한/접수증, 공식 D5101/D5103/D5110 서식 토큰과 법원 제출 **미검증**.
- 미관찰/not_seen·명시적 null·관찰된 숫자 0·승인된 비해당·상충/conflicting·source-only·승인 전은 각기 다른 상태. 금액/법률요건·지급자/연도 미확정 상태를 0원·합격으로 승격하지 않음.

## 5개 체크 ID — 일부만 검증, 미완

| 역할 / A3 ID | 이번 실제 조회/시험 | 미완료 |
|---|---|---|
| 데이터 `A3-DATA-002` | 693↔1,808 전체 source join; 최종 13/13 locator·적용조건 선언 | 실 PDF/다중행/SQL D1 read-back |
| IT `A3-IT-003` | 18/91/78 선언, 13/13 원본 binding, 117 category projection(typed 0) | 18계산 실제 입력/Node/CI/D1 |
| 사용자·서류 `A3-DOC-012` | 원천징수 11개 ID/발급/과세기간/주체/갈음 검토; #683 기간 검증 P2 | 급여명세·통장·원천징수 합동 실제 제출 |
| 계산사무장 `A3-CALC-001` | 세전/세후/수당/세액·연말정산 분해; #693 금액/상태 단위 P2 | 월소득·세액 산식·이중산입 실제 계산 |
| 변호사 `A3-LAW-014` | 95/50/46 정적 계약·관리 정책 경로 확인, 이번 승인 seed 0/13 | 시행일·관할·원본 법령·공식 양식/변호사 승인 |

**인수 완료 0/124.** 개별 정적 코드≠V8 합성≠전체 Node CI≠staging D1/R2/Cron≠실제 법원 양식/변호사 승인≠사이트 배포. 실제 고객 문서·개인정보·비공개 OCR 정답/키를 공개 Git에 남기지 않으며 운영 배포/DB 마이그레이션/전자제출/인가 확정은 실행하지 않았다.

## 고정된 주요 source blob

| 파일 | SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
| `lib/ocr-calculation-input.ts` | `8f7f51bf41f7c944b76419d7cc894e49ac771473` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |

## 다음 시작

**최종 #693까지 693/693의 정적·부분 격리 심층 소비처 감사 순번 완료(100% 조사 범위)**. 법률/원본/DB/공식서식 **최종 합격은 0/124**. 다음 시작은 **새 #694가 아니라 #001 위험·미해결 gap 재감사**, **AX담당자부터 순환**. 우선 #693 money/status, #683 date_range, #690/#692/#688 기간/단위, #675↔#682 차량 결속(#155), 승인형 법률 증거계약/서식 token read-back. 법률·계산 의미 변경은 실무자 승인과 별도 PR로만 다룬다.

<details><summary>최신 `main` canonical OCR 693개 전체 순번 (원본 인덱스; 법률 승인 목록 아님)</summary>

1. `account_garnishment::account_holder`
2. `account_garnishment::account_id`
3. `account_garnishment::court_or_authority`
4. `account_garnishment::creditor`
5. `account_garnishment::effective_date`
6. `account_garnishment::garnishment_amount`
7. `account_garnishment::issue_date`
8. `account_garnishment::released_amount`
9. `account_garnishment::seized_amount`
10. `account_garnishment::status`
11. `accounting_source::account_name`
12. `accounting_source::closing_balance`
13. `accounting_source::credits`
14. `accounting_source::debits`
15. `accounting_source::entity`
16. `accounting_source::issue_date`
17. `accounting_source::opening_balance`
18. `accounting_source::period_end`
19. `accounting_source::period_start`
20. `accounting_source::source_total`
21. `applicant_narrative_statement::identity.statement.admission_or_correction`
22. `applicant_narrative_statement::identity.statement.author`
23. `applicant_narrative_statement::identity.statement.event_end`
24. `applicant_narrative_statement::identity.statement.event_start`
25. `applicant_narrative_statement::identity.statement.narrative_text`
26. `applicant_narrative_statement::identity.statement.signature_status`
27. `applicant_narrative_statement::identity.statement.signed_at`
28. `applicant_narrative_statement::identity.statement.source_references`
29. `applicant_narrative_statement::identity.statement.statement_version`
30. `applicant_narrative_statement::identity.statement.topic`
31. `application_identity_venue::procedure.application.accepted_at`
32. `application_identity_venue::procedure.application.address`
33. `application_identity_venue::procedure.application.applicant_name`
34. `application_identity_venue::procedure.application.case_number`
35. `application_identity_venue::procedure.application.court`
36. `application_identity_venue::procedure.application.jurisdiction_exception`
37. `application_identity_venue::procedure.application.ordinary_venue_basis`
38. `application_identity_venue::procedure.application.phone_home`
39. `application_identity_venue::procedure.application.phone_mobile`
40. `application_identity_venue::procedure.application.phone_work`
41. `application_identity_venue::procedure.application.resident_id`
42. `application_identity_venue::procedure.application.ruleset_id`
43. `application_identity_venue::procedure.application.submitted_at`
44. `application_identity_venue::procedure.application.transition_rule`
45. `application_identity_venue::procedure.application_date`
46. `application_identity_venue::procedure.venue`
47. `asset_transfer_disposition::asset_id`
48. `asset_transfer_disposition::consideration`
49. `asset_transfer_disposition::market_value`
50. `asset_transfer_disposition::proceeds_received`
51. `asset_transfer_disposition::registration_date`
52. `asset_transfer_disposition::relationship`
53. `asset_transfer_disposition::review_status`
54. `asset_transfer_disposition::transaction_date`
55. `asset_transfer_disposition::transferee`
56. `asset_transfer_disposition::transferor`
57. `asset_transfer_disposition::use_of_proceeds`
58. `bank_account_balance::account_holder`
59. `bank_account_balance::account_id`
60. `bank_account_balance::account_status`
61. `bank_account_balance::balance`
62. `bank_account_balance::balance_as_of`
63. `bank_account_balance::currency`
64. `bank_account_balance::institution`
65. `bank_account_balance::issue_date`
66. `bank_transactions::account_id`
67. `bank_transactions::amount`
68. `bank_transactions::counterparty`
69. `bank_transactions::direction`
70. `bank_transactions::issue_date`
71. `bank_transactions::memo`
72. `bank_transactions::period_end`
73. `bank_transactions::period_start`
74. `bank_transactions::post_balance`
75. `bank_transactions::transaction_datetime`
76. `bank_transactions::transaction_id`
77. `bank_transactions::transaction_nature`
78. `business_asset_inventory::acquisition_date`
79. `business_asset_inventory::book_value`
80. `business_asset_inventory::condition`
81. `business_asset_inventory::disposal_restriction`
82. `business_asset_inventory::goodwill_contract`
83. `business_asset_inventory::market_value`
84. `business_asset_inventory::quantity`
85. `business_asset_inventory::quantity_unit`
86. `business_assets_liabilities::as_of_date`
87. `business_assets_liabilities::asset_or_claim_id`
88. `business_assets_liabilities::business_entity`
89. `business_assets_liabilities::gross_value`
90. `business_assets_liabilities::item_kind`
91. `business_assets_liabilities::ownership_interest`
92. `business_assets_liabilities::payable_amount`
93. `business_assets_liabilities::period_end`
94. `business_assets_liabilities::period_start`
95. `business_assets_liabilities::receivable_amount`
96. `business_assets_liabilities::secured_payoff`
97. `business_costs_and_ledgers::income.business_cost.accounting_basis`
98. `business_costs_and_ledgers::income.business_cost.business_continuity_flag`
99. `business_costs_and_ledgers::income.business_cost.business_entity`
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

</details>
