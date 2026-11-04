# FirmEngine A3 r125 — 개인채권자 자료송부청구서 #541–550 원천·계산·법률·서식 소비처 감사

- 실행 기준: 2026-11-04 KST; GitHub `main` 사전 조회 HEAD `a478d022f35dfef4d63902d415ffff39042ec3d6`; 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 직전 A3 r124 #531–540 이어받음. 최신 보드 blob `ad311f99741be2a470fa6cd8b44ae6a82ef065aa`.
- 업무 역할 순환: **사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자**. 이번 중앙 보드 미완료 5개 ID: `A3-DOC-004`, `A3-CALC-005`, `A3-LAW-004`, `A3-DATA-008`, `A3-AX-019`; 전부 **[ ] 유지**.
- 사전 조회: 최신 main ref, 최근 commit/PR, A3 r124 및 r63 #541–560 영수증, 실제 JSON 인덱스/원천·적용조건, binding/gate/form/법률/갈음 코드. 운영 배포·운영 D1 migration·전자제출·인가확정 금지.

## 1. 원천 인덱스 실제 재조회와 검증 수준

- canonical 693/693 고유 693, 사전순 일치; 문서 85, 패밀리 48, 문서×패밀리 route 141. 원천 슬롯 1582 기본 + 207 문서확장 + 19 OCR 보강 = **1808**.
- 계산 모듈 18, 선언입력 91 (고유 78), 위험 95, 법률규칙 50, 예외 46. A3 6역할 체크 ID 124, 미완료 124; 이 수치들은 현재 정적 계약 크기이며 전체 기능/법적 승인 합격률이 아님.
- 이번 심층 재감사 #541–550 **10 canonical / 10 문서-패밀리 원천 슬롯 / 1 문서 / 1 패밀리**. 필드별 개별 applicability 10/10 **등록**, 실제 사건 적용·인정·변호사 승인은 미관찰(승인 합격 0%). 필드 locator `document_id`,`document_sha256`,`page`,`quote` 등 필수 **선언** 10/10, 실제 원본문서·페이지·행·OCR 좌표·Fact 저장 재조회 **미실행**.
- 다문서 경계: `creditor_request_copy`는 `debt_certificate`, `procedure_private_creditor_request` 두 추출 family를 허용. 같은 원천에서 2개의 채무를 자동 생성하지 말 것. `recordPolicy`의 원천 당사자·행·기간 분리 및 summary/detail 중복차용 금지 선언 확인, 실행 증거 없음.

## 2. 개별 ID의 실제 원천·대상·원단위·기간·소비처/공백

| # | 정확 canonical ID | doc / datatype / unit | temporal_role / subject | applicability | 정확 typed · 계산 · 법률 · form 소비 |
|---:|---|---|---|---|---|
| 541 | `procedure_private_creditor_request::procedure.creditor_info.as_of_date` | `creditor_request_copy` · date · not_applicable | balance_as_of_date / creditor | 등록: Balance measurement date | 직접 typed 없음; source-only; 승인형 법률 exact 없음; 정확 form token 없음 |
| 542 | `procedure_private_creditor_request::procedure.creditor_info.claim_id` | `creditor_request_copy` · string · not_applicable | not_applicable / creditor | 등록: Claim identifier | 직접 typed 없음; source-only; 승인형 법률 exact 없음; 정확 form token 없음 |
| 543 | `procedure_private_creditor_request::procedure.creditor_info.claim_origin_date` | `creditor_request_copy` · date · not_applicable | event_date / creditor | 등록: Claim inception/accrual date | 직접 typed 없음; source-only; 승인형 법률 exact 없음; 정확 form token 없음 |
| 544 | `procedure_private_creditor_request::procedure.creditor_info.creditor` | `creditor_request_copy` · party_role · not_applicable | not_applicable / creditor | 등록: Claim holder/source creditor | 직접 typed 없음; source-only; 승인형 법률 exact 없음; 정확 form token 없음 |
| 545 | `procedure_private_creditor_request::procedure.creditor_info.debtor` | `creditor_request_copy` · party_role · not_applicable | not_applicable / applicant_debtor | 등록: Named debtor | 직접 typed 없음; source-only; 승인형 법률 exact 없음; 정확 form token 없음 |
| 546 | `procedure_private_creditor_request::procedure.creditor_info.interest_balance` | `creditor_request_copy` · money · KRW | source_as_of_date / applicant_debtor | 등록: Interest at stated as-of | 직접 typed 없음; must_reconcile→debt.interest; 승인형 법률 exact 없음; 정확 form token 없음 |
| 547 | `procedure_private_creditor_request::procedure.creditor_info.interest_rate` | `creditor_request_copy` · decimal_or_text · % | source_as_of_date / applicant_debtor | 등록: Rate and basis exactly stated | 직접 typed 없음; source-only; 승인형 법률 exact 없음; 정확 form token 없음 |
| 548 | `procedure_private_creditor_request::procedure.creditor_info.principal_balance` | `creditor_request_copy` · money · KRW | source_as_of_date / applicant_debtor | 등록: Outstanding principal at stated as-of | 직접 typed 없음; must_reconcile→debt.principal; 승인형 법률 exact 없음; 정확 form token 없음 |
| 549 | `procedure_private_creditor_request::procedure.creditor_info.principal_original` | `creditor_request_copy` · money · KRW | event_date / applicant_debtor | 등록: Original principal | 직접 typed 없음; source-only; 승인형 법률 exact 없음; 정확 form token 없음 |
| 550 | `procedure_private_creditor_request::procedure.creditor_info.request_copy` | `creditor_request_copy` · boolean_or_status · not_applicable | not_applicable / applicant_debtor | 등록: Proof of actual request attached | 직접 typed 없음; source-only; 승인형 법률 exact 없음; 정확 form token 없음 |

**경로 판정:** `canonical-field-binding.ts`의 `projections`에 `procedure_private_creditor_request` typed 기록 매핑이 없어 10/10 정확 typed 직접 변환 없음. `material-calculation-source-gate.ts`에서 #546 → `debt.interest`, #548 → `debt.principal` 두 개만 `must_reconcile`; #541–545/#547/#549/#550은 정확 material 0개인 source-only. `reference-decision-tables.json` 18 계산/91 입력에서 본 구간 정확 typed 직결 없음; 실제 SQL/CaseData 산식 실행 미실행.
**서식·법률:** `ocr-chain-matrix.ts` 정확 form 대상 0/10. `feature-lineage-audit.ts::reviewScope`에서 절차/채무 관련 D5100/D5105/D5106/D5110은 **검토 후보**이며 공식 출력 token 아님. `legal-catalog.json`의 `KR-PR-010`(채권자목록 대조) 및 `KR-PR-013`(발급 곤란 시 자료청구)은 사건 수준 연구규칙. `legal-evidence-criteria.ts` 기본 seed `checks=[]`; 이 10 OCR ID→실제 승인된 위험95/규칙50/예외46의 정확 증거 결속은 **미등록·미인증**, 법률상 합격 0%.
**갈음·보정:** `reference-intake-catalog.json`의 `creditor_request_copy` 서류 목적은 발급 곤란 시 대체 증빙 **검토**이며 청구만으로 잔액 확정 금지. `approve-document-substitution.ts`는 사람 승인·원천 Fact fingerprint 경계를 갖고, `document-substitution.ts`는 공개 정책·시점·원천과 기간 재대조. 실제 이 사례의 갈음 승인·법원 보정 항목 생성·확정 또는 법원 접수 테스트 미실행.
**원천-DB 구분:** `extraction-row-store.ts`/`extraction_field_coverage`/`extracted_features`, CaseData Fact/typed 경로는 코드상 존재하나 이번에 고객 Fact·실 D1/R2 저장/재조회는 수행하지 않음. 원문 문서 ID/해시, page, 여러 행, 상대방/원채권 식별자, 기준일·원통화가 없는 증거는 `not_seen`/`null` 등으로 남기고 0원·비해당·법적 확정으로 승격 금지.

## 3. 실제 원본 코드 V8 격리시험: 바인딩 50/50 현행 반환 일치

- 입력: 이번 인덱스 10 ID의 실제 `document-agent-field-contracts.json` family 정의, GitHub `main`의 `canonical-field-binding.ts::bindCanonicalSourceField` **원본 함수 본문**(TypeScript 타입 주석·nonnull 표시만 제거). 기대는 각 family의 정확 ID/키 계약에서 독립 도출.
- 각 ID별 동일 5종: (A) 정확 ID+local key → `explicit_id`; (B) local-only → `exact_key`; (C) 정확 ID + **다른 등록 local key** → `unbound`(conflict); (D) 다른 namespace ID → `unbound`; (E) 등록되지 않은 key → `unbound`. 10×5 = 50회 실제 V8 실행, 관찰 50/50 기대 일치. 모든 케이스 원문 사건·실제 OCR 아님.
| ID | A exact ID | B local key | C conflict | D foreign ID | E unknown |
|---:|---|---|---|---|---|
| 541 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 542 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 543 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 544 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 545 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 546 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 547 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 548 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 549 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |
| 550 | explicit_id=관찰✓ | exact_key=관찰✓ | unbound=관찰✓ | unbound=관찰✓ | unbound=관찰✓ |

## 4. 실제 원본 계산 대조 게이트 V8 격리시험: 10/10 현재 반환 재현

- 입력은 실제 `material-calculation-source-gate.ts::auditMaterialCalculatorSources` 원본 함수에서 TypeScript 타입 구문만 제거해 V8에서 실행. `MATERIAL_CALCULATION_SOURCES` 29개 정의도 동일 원본. `currentFacts`, `moneyValue`, `validSourceRef`, `createCaseReadIndex`는 **합성 스텁**. 실제 DB·Node CI·실 금액파서·법률 규정 테스트가 아니다.
| 합성 입력 | 독립 기술 기대 | 실제 관찰 |
|---|---|---|
| #548 현재원금100 / 동일 단일 typed 채무 100 / 정상 Fact | issue 없음 | issue 없음 |
| #548 현재원금100 / typed 행 없음 | `CALC_INPUT_UNCONNECTED_MATERIAL` | 동일 |
| #548 현재원금100 / 동일 Fact 2개 typed 행에 재사용 | `CALC_INPUT_MULTIPLE_TYPED_MATCHES` | 동일 |
| #548 원천100 / typed 현재원금99 | `CALC_INPUT_AMOUNT_MISMATCH` | 동일 |
| #548 값 null / `sourceState=not_seen` | `CALC_INPUT_AMOUNT_INVALID` | 동일 |
| #548 원천100 / Fact `state=disputed` | `CALC_INPUT_SOURCE_INVALID` | 동일 |
| #548 `sourceState=explicit_none` / 숫자 null | issue 없음, observedIds 미포함 | 동일 |
| #549 `principal_original`만 원천100 관찰 | 대조 정의 없음, issue 없음 | 동일 |
| #546 현재이자20 / 단일 typed 이자20 | issue 없음 | 동일 |
| #548 원천 채권자 A, typed 채권자 B, 금액100·factId 일치 | **현재 이 gate의 구조상** issue 없음 (당사자 검증은 별도 필요) | issue 없음 |

- 검토 공백 P2: 마지막 경우에 **실무상 독립 안전 기대는 채권자/채무자/계약번호/기준일 동일성 재검증**이다. 이 국소 함수는 금액/Fact ID 중심이며 party identity를 확인하지 않고 issue 0을 돌려준다. 전체 전처리·법률 단계가 차단하는지는 **미확인**. source-only #549도 누락/0원 판정이 아니라 원채권 발생금 검산 자료로 남긴다. 검증 코드 자체의 현행 동작 일치 10/10을 제품 안전 합격으로 해석 금지.

## 5. 6역할 / 중앙 미완료 ID별 관찰과 독립 검토

- **사용자·서류 — A3-DOC-004 [ ]:** `creditor_request_copy` 2 family 허용, 실제 원천 #541–550 10개와 자료청구서 사본·회신·발송 이력 요구를 분리. 실제 발급곤란 입증, 사무직원 승인·갈음/법원 보정 E2E 미인증.
- **계산사무장 — A3-CALC-005 [ ]:** 현재 원금 #548 vs 최초 원금 #549, 잔여이자 #546 vs 이자율 #547 (%) 구분. 원본 계산 material 게이트 10 합성 분기, 실제 18 계산·91입력 산식 및 채무잔액 총합 미인증. 원화 자동합산 금지.
- **변호사 — A3-LAW-004 [ ]:** `KR-PR-010`, `KR-PR-013`은 기준정보 **연구** 규칙이며 개별 사건의 자료청구 사본을 채권자 발급증명과 동등하게 법적 인정하지 않음. 담당자 및 변호사/법원 적용 승인 미관찰 0%.
- **데이터 — A3-DATA-008 [ ]:** 10/10 문서/page/quote/sha locator 필수 계약, 2 family의 source row 및 다중 채권자·계약 ID 분리 선언. 실제 D1 Fact·typed의 중복방지/row 검증 미실행.
- **AX — A3-AX-019 [ ]:** 금액 3종/이율을 서로 혼합하거나 자연어 비슷한 문자열만으로 typed 채무에 결속하지 않음. synthetic creditor A↔B에서 국소 금액 gate issue0 검토 후보 확인; AI 출력/통합 검증 미실행.
- **IT(후속 순환)**: main 최신 ref/blob 및 다른 축 커밋 확인, 코드 직접 수정 불요(승인 의미 변경 위험) 판단. 정확 ID 바인딩 50건 함수 단위 V8 기술 재현. Node 전체 CI/staging 미인증.

## 6. 상태 판정 및 후속

- 개별 ID 10개 원천 관측 여부: **미관찰**. `null`=값 부재 가능성, `0`=실측 금액 영, `not_applicable`=요건 판단, `conflicting`=복수 주장 상충, `source-only`=원문보존/검산 목적, `preapproval`=사람 승인 전을 서로 대체하지 않음.
- 법률상 채권 인정·원금 잔액·갈음/전자제출/법원 인정은 **0% 승인**, 자동으로 참/거짓·0원 지정하지 않음. 정보 미확보시 채권자 회신, 계약번호·기준일, 원거래·상환내역, 청구서 발송·송달, 법률 적격 근거를 역질문 대상으로 남김.
- 전체 OCR 최초 정적 순회 693/693, 이 심층 연속 재검수는 **#550/693**, 잔여 **143개**, A3 최종 인수 **0/124**. 다음 **#551 `procedure_private_creditor_request::procedure.creditor_info.request_date`**, 범위 **#551–560**. 다음 역할 **계산사무장 → 변호사 → 데이터 → AX → IT → 사용자·서류**.
- 구분: 코드/계약 존재 ≠ V8 합성시험 ≠ Node 전체 CI ≠ staging D1/R2/Cron ≠ 실제 OCR 페이지 ≠ 공식 서식 ≠ 변호사 승인 ≠ 배포. **운영 배포·D1 migration·전자제출·법원 인가 확정 실행 없음**.

## Appendix A — 693개 최신 canonical 인덱스 원문 순서

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

## Appendix B — 보드 A3 6역할 124개 체크 ID 최신 순서

1. `A3-IT-001` [ ]
2. `A3-IT-002` [ ]
3. `A3-IT-003` [ ]
4. `A3-IT-004` [ ]
5. `A3-IT-005` [ ]
6. `A3-IT-006` [ ]
7. `A3-IT-007` [ ]
8. `A3-IT-008` [ ]
9. `A3-IT-009` [ ]
10. `A3-IT-010` [ ]
11. `A3-IT-011` [ ]
12. `A3-IT-012` [ ]
13. `A3-IT-013` [ ]
14. `A3-IT-014` [ ]
15. `A3-IT-015` [ ]
16. `A3-IT-016` [ ]
17. `A3-IT-017` [ ]
18. `A3-IT-018` [ ]
19. `A3-IT-019` [ ]
20. `A3-IT-020` [ ]
21. `A3-DOC-001` [ ]
22. `A3-DOC-002` [ ]
23. `A3-DOC-003` [ ]
24. `A3-DOC-004` [ ]
25. `A3-DOC-005` [ ]
26. `A3-DOC-006` [ ]
27. `A3-DOC-007` [ ]
28. `A3-DOC-008` [ ]
29. `A3-DOC-009` [ ]
30. `A3-DOC-010` [ ]
31. `A3-DOC-011` [ ]
32. `A3-DOC-012` [ ]
33. `A3-DOC-013` [ ]
34. `A3-DOC-014` [ ]
35. `A3-DOC-015` [ ]
36. `A3-DOC-016` [ ]
37. `A3-DOC-017` [ ]
38. `A3-DOC-018` [ ]
39. `A3-DOC-019` [ ]
40. `A3-DOC-020` [ ]
41. `A3-CALC-001` [ ]
42. `A3-CALC-002` [ ]
43. `A3-CALC-003` [ ]
44. `A3-CALC-004` [ ]
45. `A3-CALC-005` [ ]
46. `A3-CALC-006` [ ]
47. `A3-CALC-007` [ ]
48. `A3-CALC-008` [ ]
49. `A3-CALC-009` [ ]
50. `A3-CALC-010` [ ]
51. `A3-CALC-011` [ ]
52. `A3-CALC-012` [ ]
53. `A3-CALC-013` [ ]
54. `A3-CALC-014` [ ]
55. `A3-CALC-015` [ ]
56. `A3-CALC-016` [ ]
57. `A3-CALC-017` [ ]
58. `A3-CALC-018` [ ]
59. `A3-CALC-019` [ ]
60. `A3-CALC-020` [ ]
61. `A3-LAW-001` [ ]
62. `A3-LAW-002` [ ]
63. `A3-LAW-003` [ ]
64. `A3-LAW-004` [ ]
65. `A3-LAW-005` [ ]
66. `A3-LAW-006` [ ]
67. `A3-LAW-007` [ ]
68. `A3-LAW-008` [ ]
69. `A3-LAW-009` [ ]
70. `A3-LAW-010` [ ]
71. `A3-LAW-011` [ ]
72. `A3-LAW-012` [ ]
73. `A3-LAW-013` [ ]
74. `A3-LAW-014` [ ]
75. `A3-LAW-015` [ ]
76. `A3-LAW-016` [ ]
77. `A3-LAW-017` [ ]
78. `A3-LAW-018` [ ]
79. `A3-LAW-019` [ ]
80. `A3-LAW-020` [ ]
81. `A3-LAW-021` [ ]
82. `A3-LAW-022` [ ]
83. `A3-DATA-001` [ ]
84. `A3-DATA-002` [ ]
85. `A3-DATA-003` [ ]
86. `A3-DATA-004` [ ]
87. `A3-DATA-005` [ ]
88. `A3-DATA-006` [ ]
89. `A3-DATA-007` [ ]
90. `A3-DATA-008` [ ]
91. `A3-DATA-009` [ ]
92. `A3-DATA-010` [ ]
93. `A3-DATA-011` [ ]
94. `A3-DATA-012` [ ]
95. `A3-DATA-013` [ ]
96. `A3-DATA-014` [ ]
97. `A3-DATA-015` [ ]
98. `A3-DATA-016` [ ]
99. `A3-DATA-017` [ ]
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
