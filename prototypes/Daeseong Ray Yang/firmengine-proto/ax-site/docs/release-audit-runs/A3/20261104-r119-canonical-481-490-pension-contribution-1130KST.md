# FirmEngine A3 r119 — canonical OCR #481–490 연금 납입·수급 증거/계산/법률/양식 소비처 독립감사

기준: 2026-11-04 11:30 KST | 시작 GitHub main HEAD `2a8a79f1cfeaafd492d71d956f7475a65b4f2173` | 수정범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 직전 r118 #471–480를 이어서 조사. 역할 순환: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**. 이전 r25/r60 동일 영역 영수증 및 관련 기존 테스트 소스를 비교하고, 최신 source JSON/코드를 새로 재조회·실제 V8 함수 실행함.

## 1. 감사 범위와 정확한 검증 수준
- 693 unique canonical; 693 register; 85 docs; 48 families; 141 routes; 1808 source slots; #481–490 10 canonical / 40 source slots / 4 documents; 124 A3 board IDs [ ]. 정적 전수 조인은 `canonical-field-id-index.json` ↔ `docs/ocr-693-field-register.md` **693/693 순번·ID 일치**, 기본 패밀리+문서확장+보강 결합 1808 슬롯/141 라우트 재계산.
- 회차 모든 10 ID에 대해 각 4 원천 문서의 datatype/unit/temporal/subject와 locator·source-only·no-cross-record 선언을 독립 비교. 실제 고객 문서의 40개 관측값을 확인한 것이 아닌 **40개의 가능한 원천 선언 슬롯**.
- `canonical-field-binding.ts`의 **원본 bindCanonicalSourceField 함수**(TS 타입만 제거)를 V8 실행: **exact ID/key 40/40 성공**, **잘못된 다른 local key + explicit ID 40/40 차단**. `feature-lineage-audit.ts` **원본 hasPeriod·hasUnit 술어** V8 실행: 기간 true 40/40, 단위 요구 true 8/40.
- 18개 계산 모듈/91 입력 선언, risk 95/rules 50/exceptions 46 및 법률 승인 여부는 실제 기존 카탈로그를 읽고 원본 소스 코드 계약과 분리. 본 회차 legal·form·material의 이번 10 ID 정적 exact 연결 0. 카탈로그 존재/합성 테스트는 법률 적격성·전체 CI·DB/서식 완료의 의미가 아님.

## 2. 개별 OCR ID 10개 원천/소비처·공백
| 번호 | Canonical ID | 문서별 source slot | datatype / exact unit / temporal / subject | 적용조건 | 직접 소비처 상태 |
| ---: | --- | --- | --- | --- | --- |
| 481 | `pension_contribution_benefit::benefit_amount` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `money` / `currency and exact source unit if monetary` / `not_applicable` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 482 | `pension_contribution_benefit::benefit_type` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `category` / `not_applicable` / `not_applicable` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 483 | `pension_contribution_benefit::contribution` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `money` / `currency and exact source unit if monetary` / `not_applicable` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 484 | `pension_contribution_benefit::encumbrance` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `category` / `not_applicable` / `not_applicable` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 485 | `pension_contribution_benefit::issue_date` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `date` / `source date format normalized to ISO without loss` / `document_issue_date` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 486 | `pension_contribution_benefit::member` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `party_role` / `not_applicable` / `not_applicable` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 487 | `pension_contribution_benefit::payment_start` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `date` / `source date format normalized to ISO without loss` / `effective_date` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 488 | `pension_contribution_benefit::period_end` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `date` / `source date format normalized to ISO without loss` / `statement_period_end` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 489 | `pension_contribution_benefit::period_start` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `date` / `source date format normalized to ISO without loss` / `statement_period_start` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |
| 490 | `pension_contribution_benefit::plan_id` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | `identifier` / `not_applicable` / `not_applicable` / `member` | `source_conditional` (미승인) | typed 0 / Material 0 / form 0 / 법률정확ID 0 |

**공통 source locator 계약:** 네 문서 모두 고유 문서 hash, 페이지, 행/원문 quote/bbox·대상·기간 증거를 구분해 보존하도록 선언. 원문 PDF·실 OCR·상세/합계 반복행·D1 저장값의 실제 일치·원통화 확인은 **전혀 수행하지 않음**. 미관찰·null·명시 0·비해당·상충·source-only·승인전은 별개 상태.

## 3. 6역할 소비처 감사 (코드 존재 vs 실제 사용 구분)
| 축 | 직접 확인한 최신 계약/코드 | 남은 미인증 경계 |
| --- | --- | --- |
| IT/원천·DB | `shared-document-field-contracts.json` 4서류, `document-agent-field-contracts.json` 1패밀리, `ocr-field-supplements.json`; `db/schema.ts`의 `extraction_runs`, `extraction_records`, `extracted_features`(canonical ID/raw/source state/quote/bbox), `extraction_field_coverage` 계약 읽음 | 원본 파일/페이지/복수행/해시 대조 및 D1 Fact/typed 재조회 0 |
| 사용자·서류 | `required_source_anchor`, `recordPolicy.noCrossRecordBorrowing/sourceOnly/summaryPolicy` 40 슬롯·4 문서 선언. #485 발급일, #487 지급개시, #488~489 납입기간, #486 가입자, #490 상품번호 분리 | 상품·가입자·기간별 요구서류/역질문·갈음 승인·법원보정 실제 실행 0 |
| 계산 | `canonical-field-binding.ts::projections`에 `pension_contribution_benefit` 직접 typed 경로 없음; `material-calculation-source-gate.ts` 이번 정확 ID 0, 다음 #493 `withdrawal_value→asset.grossValue` 필수대조. 18계산/91입력 | 실제 월 수급·납입을 자산 또는 소득으로 합산/환산 금지; 18개 실계산과 공식 수치 재검산 0 |
| 변호사/법률 | 카탈로그 risk95/rules50/exceptions46의 일반 review 후보와 개별 canonical ID 승인계약 구분; `legal-evidence-criteria.ts` seed 빈 정책. 이번 10 ID 정확 승인 연결 0 | 권리귀속, 인출제한, 변제재원/청산가치/연금권 보장·관할/시행일·변호사 승인 0 |
| AX/서식 | `ocr-chain-matrix.ts::OCR_DECLARED_FORM_TARGETS` 정확 #481–490 토큰 0. `feature-lineage-audit.ts::reviewScope(pension_contribution_benefit)` 원본 family regex는 직접 자산/소득 서식 아닌 EVIDENCE_INDEX 간접 검토 후보 | 공식 e-form parity, D5101·D5110·회생서식 출력, 사람 최종확인 0 |
| 갈음·법원보정 | `approve-document-substitution.ts` 승인/fingerprint 및 `preapproval-correction-item-store.ts` requiredCanonicalFieldIds 사용 코드 읽음 | #481–490 사건별 승인·보정 요구·회신·실제 법원 제출/인가 0 |

## 4. 독립 기대/실제 관찰 — 합성 시험 로그
| 실행한 입력 | 독립 기대 | 실제 관찰 | 판단 수준 |
| --- | --- | --- | --- |
| 693 원본 인덱스 + 693 별도 문서순번 | 693/693 일치·유일 | 693/693, 고유 693 | **정적 PASS** |
| 85문서/48패밀리의 base+extension+supplement 실제 결합 | 141 routes, 1808 slots, 이번 10×4=40 | 141 routes, 1808 slots, 이번 40 | **정적 PASS** |
| 각 #481–490 × 네 문서, original bindCanonicalSourceField({key:local_id,canonicalFieldId:exact}) | 40 exact 성공 | 40/40 exact | **원본 함수 V8 격리 PASS** |
| 각 #481–490 × 네 문서, explicit ID 유지하고 key를 다음 피처로 바꿈 | 모두 연결 거부(오결속 안전) | 40/40 exact ID-key conflict | **원본 함수 V8 격리 PASS** |
| hasUnit(datatype) original: money 2 IDs×4=8 true, 나머지 false | true8 / false32 | true 8, false 32 | **원본 술어 V8 PASS** |
| hasPeriod(temporal_role,family) original + 독립 의미 검토: 4 ID(#482/#484/#486/#490)의 temporal_role=not_applicable는 개별 기간 요구 불필요 | 16 nonperiod slots false 권장 | **16 nonperiod slots가 true**; 전체 40/40 true | **P2 후보**, 로컬 코드 현행 결과 재현 |
| 각 ID applicability. 조건이 등록돼도 승인된 실제 법적 요건은 자동합격 불가 | 등록 10/10, 승인 0 | 10/10 등록, 직접 typed/material/form/승인법률0 | 정적, 법률승인 미실행 |

## 5. 실제 발견·조치 분기
1. **P2 과잉 기간 요구 후보**: `hasPeriod` family 정규식에 `contribution`이 있어 #482 benefit_type, #484 encumbrance, #486 member, #490 plan_id (각 4문서 16슬롯)가 `temporal_role=not_applicable`인데도 true. 수급 기간·문서 기간의 요구 자체를 폐기하는 것이 아니라, 필드별 날짜·금액과 비시간 category/subject/identifier를 분리 검토해야 한다. 기존 열려있는 Draft PR #51과 충돌·효력 범위가 있으므로 main 직접 수정하지 않음.
2. **P2 금액 의미 혼동**: #481 benefit_amount는 수급액, #483 contribution은 기여·납입액. 지난 #480 as_of_date, 다음 #492 vested_balance, #493 withdrawal_value와 다른 값. 가입자·상품번호·기간·원통화/인출가능성·법령 보호범위가 불명확하면 원화 임의합산·자동 자산인정 금지.
3. **P2 소비처 미연결도 evidence-only 유지**: 이번 10개 모두 직접 typed, Material, 공식 token 없음. 검산·후속 자료 요청·법원보정·법적근거 검토 대상이므로 삭제·0원·비해당·해당없음 판정 금지. 적용조건 10개 전부 선언됐더라도 사람 승인 합격 0%.
4. **P2 #493 연결 선행경고**: 같은 family의 #493 withdrawal_value는 `must_reconcile→asset.grossValue`이지만 실제 typed 경로가 없다(다음 범위). 관할/법적 보호·상품·가입자·기준일의 인정이 없으면 자산 계산을 완결로 표시 금지.

## 6. 중앙 보드 5개 ID — 부분감사, [ ] 유지
- `A3-IT-007`: datatype/unit/temporal alias 10ID×4문서, original hasPeriod 과잉 후보 16슬롯 재현. [ ]
- `A3-IT-020`: direct consumer=0인 10개 source-only도 보존·역질문 필요, 실제 DB 보존/폐기 큐 미확인. [ ]
- `A3-DOC-006`: 4증빙/가입자·상품·기간·행 분리와 갈음/보정 승인 필요, E2E 미검증. [ ]
- `A3-CALC-008`: 수급액/납입액/인출가능액 혼동방지; 다음 #493 material 검증, 현재 원화 합산 금지. [ ]
- `A3-LAW-014`: 수급권 보호/인출제한·재산 귀속의 사람 승인·관할·법령 판본 미확인. [ ]
역할순환으로 DATA는 서류 hash·원문/팩트 링크 확인, AX는 금액 의미·서식 오승격 확인을 별도 평가했으며 모두 제품 합격 미인증.

## 7. 상태/다음 시작·blob 충돌방지
- 순차 심층 **#490/693**, 잔여 **203**. 다음 **#491 `pension_contribution_benefit::provider`**부터 #491–500. 다음 첫 역할 **사용자·서류담당자**.
- 전체 보드 A3 124 ID [x] 0; 최종 인수 0/124. 테스트들은 원본 함수 V8 격리/정적 계약만 검증. 전체 Node/CI, staging D1/R2/Cron, 공식 법원 양식·변호사 승인·사이트 배포 모두 미인증.
- 실제 고객 정보·원본 OCR 사실값·키/.env/비공개 정답 미기록. 운영 배포·D1 마이그레이션·전자제출·법원 인가 확정 미실행.
- source blob SHAs: `lib/canonical-field-id-index.json`=`27ecdddd208de82a2f5c675e7482485e3a8838c2`; `docs/ocr-693-field-register.md`=`dfa1a09cf035a07130e2cf40a6b4e7dae44581d4`; `lib/document-agent-field-contracts.json`=`9884b3fecf44643fefcdc4a421ed66ffc5477b3a`; `lib/shared-document-field-contracts.json`=`9decab974e0909ae24ad927bdfe241d75b71f3a9`; `lib/ocr-field-supplements.json`=`63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`; `lib/field-applicability-contracts.json`=`6076b26f782c4643a21a7b2f1a8f6261bb588b68`; `lib/canonical-field-binding.ts`=`60ee5c7762d52b72a165b4f4f8214680eb98f148`; `lib/feature-lineage-audit.ts`=`de81bc3b8c460b8a4dde3fda9e13087e619e74ff`; `lib/material-calculation-source-gate.ts`=`0286b44484913b63fa8ec3f7bf0ca59b034d0dab`; `lib/ocr-chain-matrix.ts`=`977de86ba698bd805cc6b95d1384e3b49d0dbb4c`.

## Appendix A. Main 최신 canonical OCR 693개 번호 전체
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

## Appendix B. Main 중앙 보드 A3 6역할 124 체크 ID 번호 전체
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
