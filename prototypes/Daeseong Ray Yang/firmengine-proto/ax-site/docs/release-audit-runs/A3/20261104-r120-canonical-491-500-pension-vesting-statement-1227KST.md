# FirmEngine AX A3 r120 — #491–500 연금·국민연금 납입 원천 소비처 재감사
2026-11-04 12:27 KST. GitHub `main` 시작 HEAD: `5f38c0faf5c4b7f78dd022f84dff7cfd8adfc6bd`. 작업 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정.

## 인수 기준·이전 회차
기존 A3 r119 #481–490의 후속 범위이며 과거 r25·r60의 #481–500 선행 감사를 중복 제거하여 재확인한다. 6역할은 **사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX → IT** 순환. A3-DOC-006 / A3-CALC-008 / A3-LAW-014 / A3-DATA-004 / A3-IT-020의 5개 미검증 ID만 본 회차 보드 후보로 선정. 모든 체크는 [ ] 유지. A3 인수 0/124.

정확한 최신 JSON·코드 조인 결과: **693 canonical unique/고아0, 85 증빙서류, 48 OCR family, 141 문서×family, 1,808 선언 source slot**, 18 계산모듈/91 declared input(고유78), 법률 위험95·규칙50·예외46. 문서별 필드선언은 실제 OCR 사실값 개수나 승인값이 아니다.

## 10개 피처·19개 선언 source slot·4개 문서
A: employment_history, B: pension_certificate, C: retirement_estimate, D: pension_contribution_statement. #491–493은 각 A/B/C/D 4슬롯, #494–500은 D에 각 1슬롯. 문서 hash/page/source quote+bbox/행·대상별 record, 상세/소계 이중계산 금지 및 `noCrossRecordBorrowing=true`는 19/19 정적 계약에 선언되어 있지만 실제 OCR PDF/DB 저장·페이지 재독은 미검증.

| # | canonical ID | 문서(슬롯) | 자료형 / 원단위 / 주체 / 필드 시간역할 | 정확 적용조건 | Material 검토계약 | typed / exact form / exact legal |
|---:|---|---|---|---|---|---|
| 491 | `pension_contribution_benefit::provider` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | party_role / not_applicable / member / not_applicable | 등록·미승인 | source-only | 0/0/0 |
| 492 | `pension_contribution_benefit::vested_balance` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | money / currency and exact source unit if monetary / member / not_applicable | 등록·미승인 | source-only | 0/0/0 |
| 493 | `pension_contribution_benefit::withdrawal_value` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4) | money / currency and exact source unit if monetary / member / not_applicable | 등록·미승인 | must_reconcile → asset.grossValue | 0/0/0 |
| 494 | `pension_contribution_statement::contribution_record_kind` | pension_contribution_statement (1) | category / not_applicable / document_subject / not_applicable | **미등록(0%)** | source-only | 0/0/0 |
| 495 | `pension_contribution_statement::paid_amount` | pension_contribution_statement (1) | money / KRW / document_subject / not_applicable | **미등록(0%)** | source-only | 0/0/0 |
| 496 | `pension_contribution_statement::paid_months` | pension_contribution_statement (1) | integer / month / document_subject / not_applicable | **미등록(0%)** | source-only | 0/0/0 |
| 497 | `pension_contribution_statement::payable_amount` | pension_contribution_statement (1) | money / KRW / document_subject / not_applicable | **미등록(0%)** | source-only | 0/0/0 |
| 498 | `pension_contribution_statement::payable_months` | pension_contribution_statement (1) | integer / month / document_subject / not_applicable | **미등록(0%)** | source-only | 0/0/0 |
| 499 | `pension_contribution_statement::standard_monthly_income` | pension_contribution_statement (1) | money / KRW / document_subject / not_applicable | **미등록(0%)** | source-only | 0/0/0 |
| 500 | `pension_contribution_statement::subscriber_type` | pension_contribution_statement (1) | category / not_applicable / document_subject / not_applicable | **미등록(0%)** | source-only | 0/0/0 |

직접 typed 변환은 **0/10**. `canonical-field-binding.ts` family projection 정확 경로와 `ocr-chain-matrix.ts::OCR_DECLARED_FORM_TARGETS` 정확 ID로 검증한 직접 공식서식 토큰 계약도 **0/10**. 위험95·규칙50·예외46의 exact canonical ID 소비계약 **0/10**. 다만 family 일반 법령/서식 검토 *후보*와 실제 승인된 공식 서식 토큰은 다르다. `feature-lineage-audit.ts`의 일반 `EVIDENCE_INDEX` 후보는 인가된 D5101/D5103/D5110 매핑을 의미하지 않는다. `db/schema.ts`의 `extraction_records`, `extracted_features`는 원천/quote/bbox/canonical/source_state 저장 **선언**이지만 실제 D1 Fact/typed 재조회 미실행.

## P2 검토 공백 및 금액 의미 경계
1. **#494–500 적용조건 7/7 미등록**: `shared-document-field-contracts.json`의 연금납입서 document extension에는 있지만 `field-applicability-contracts.json`에서 정확한 ID를 찾을 수 없다. `document-agent-registry.ts`의 exact `sourceCondition??null` 경로로 진입한다. #491–493 3개는 적용조건 등록됐지만 법적 인정 미승인. **미등록 7개 해당 요건 합격 0%**, null은 비해당/관찰된 0/법률 판단 확정과 다르다.
2. **#493 인출가능가치**만 `material-calculation-source-gate.ts`의 정확 `must_reconcile → asset.grossValue` 대상. **직접 typed 자산행 선언은 없음**. #492 귀속잔액, #495 납입액, #497 납부예정액, #499 기준소득월액과 금액 성격이 다르고 #496/#498 납부월수의 원단위는 **month**이다. 자동 KRW 합산·월수 환산·중복계상·법률상 청산가치 인정 금지. 가입자/상품ID #490/지급기관 #491/기준일/원통화/인출 제한·보호권리·담보/상태 원천을 대조해야 한다.
3. `feature-lineage-audit.ts` 원본 `hasPeriod` 술어는 해당 19슬롯 모두 true지만 19개 슬롯의 `temporal_role`은 전부 `not_applicable`. 문서의 기간 확인과 비기간 필드 자체 요건을 구분 검토. 원본 `hasUnit` 술어는 **13/19 true**(money 11슬롯+integer 2슬롯). 과잉 경고 여부는 P2 후보, Draft #51과 중첩되어 현재 제품 코드는 무변경.
4. **source-only는 폐기 아님**: 0 직접 typed/서식/법률 소비처인 필드라도 가입자·상품·발급자 교차검증, 기간·소계 검산, 소명 역질문, 갈음 B+C·법원보정 증거 후보로 유지. `case-requirements.ts`/`document-substitution.ts`가 승인·증거 결속 구조를 선언하지만 이 10개 실제 서류대체/보정명령 E2E는 미실행.

## 독립 테스트: 실제 입력 / 기대 / 관찰 / 검증 수준
**JS 최신 source-JSON 정적 계약 검증 26개 독립 카운트 기대 모두 일치**: `{"indexed":693,"unique":693,"docs":85,"families":48,"routes":141,"slots":1808,"registered":693,"unindexed":0,"board":124,"boardCompleted":0,"calc":18,"inputs":91,"inputUnique":78,"risks":95,"laws":50,"exceptions":46,"localIds":10,"localSlots":19,"localDocs":4,"registeredHere":3,"unregisteredHere":7,"typedHere":0,"formHere":0,"legalHere":0,"materialHere":1,"bindingChecks":57,"bindingPass":57,"periodTrue":19,"unitsTrue":13}`. 인덱스↔문서별 계약 전수 재조인, registered 693/693·미등록확인 정확 ID 7개, 18·91·78, 위험·규칙·예외 95·50·46, A3 124개 [x] 0 확인. 정적 계약 일치이지 업무·법률 인정 아님.

**V8에 GitHub 현행 `bindCanonicalSourceField` 원본 함수본문을 TypeScript 타입표기(non-null 포함)만 제거하여 격리 실행: 57/57 기술 기대 일치.** 입력 19개의 문서×필드 슬롯 각각 (i) `{key:local_id,canonicalFieldId:exact_id}` → 기대 explicit_id+동일 ID+issues=[] / 19/19; (ii) `{key:"other.declared_in_another_document",canonicalFieldId:exact_id}` → 기대 unbound+`canonical_id_key_conflict` / 19/19; (iii) `{key:local_id,canonicalFieldId:"wrong::"+local_id}` → 기대 unbound+`canonical_id_outside_family` / 19/19. 예: #491 @ employment_history 실제 정상 `explicit_id`; 타 key `canonical_id_key_conflict` 및 `canonical_id_outside_family`; 존재하지 않는 ID `canonical_id_outside_family`. 각 슬롯 별 3개 실행, 실패 0. 실제 Node CI·OCR/D1은 아님.

**원본 `hasPeriod`/`hasUnit` 표현식 동적 실행: 총 38회(슬롯별 각 19).** 결과 hasPeriod 19 true/19, non-temporal 19, hasUnit 13 true/19. 현재 구현 반환 재현은 정상 법적 요건 승인과 다르다. 기존 r60의 material 9합성은 과거 관찰일 뿐 **이번 회차 새 실행으로 합산하지 않음**.

## 체크 역할·의미별 보류 상태
- A3-DOC-006: 4종/19 source slot 실서류·인출증빙/금액 기준일·갈음·보정 확인 미완 [ ].
- A3-CALC-008: #493 must_reconcile와 #492·#495/497/499의 금액 의미 분리, 실 자산/법률보호·현금화 산식 검산 미완 [ ].
- A3-LAW-014: 보호되는 연금수급권/퇴직금·관할/공식 판본/변호사 법적 인정 미완 [ ].
- A3-DATA-004: 18/91/78, 정확 bind V8 57/57, 실제 Fact→typed→SQL/DB read-back 미완 [ ].
- A3-IT-020: 0 직접 소비처 source-only 원천 보존·미사용 큐 및 source anchor 재조회 미완 [ ].

실제 고객 문서/개인정보/원본 OCR 사실값/키/.env/비공개 정답은 기록하지 않았고 제품/법률 의미 변경, 운영 배포·D1 운영 migration·전자제출·법원 인가 확정도 실행하지 않음. Node/TS 전체 CI, staging D1·R2/Cron, 공식 서식 전자파일 및 사람 승인 모두 **미인증**.

## 다음 조사와 원본 SHA
순차 재감사 **#500/693**, 남은 **193**. 다음 **#501 `pension_contribution_statement::unpaid_amount`**, 범위 #501–510; 다음 선두 **계산사무장**. 보드 수정 전에 HEAD/blob SHA 최신 확인·선정 ID 5개 행만 병합, [ ] 보존.

- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/material-calculation-source-gate.ts`: `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-chain-matrix.ts`: `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`: `b8ec3b075a8a93df96bfc20709e14aa3bf06f4bb`

## Appendix A — 등록 canonical OCR 693개 전수 순번
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

## Appendix B — A3 6담당자 체크 ID 124개 전수 순번(모두 미완료)
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
