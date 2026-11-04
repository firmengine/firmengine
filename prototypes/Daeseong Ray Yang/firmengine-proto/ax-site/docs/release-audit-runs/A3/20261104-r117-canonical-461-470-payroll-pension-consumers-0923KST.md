# FirmEngine A3 r117 — canonical #461–470 급여명세·연금 피처 소비처 감사 (2026-11-04 KST)

## 1. Authoritative main snapshot and audit level
- Actual `main` commit SHA read at start: `e3fbe05e8575b59e7fb785d2f6fdfb2c4cb35f09`. Every source below fetched with `ref=e3fbe05e8575b59e7fb785d2f6fdfb2c4cb35f09`, not unpinned latest.
- Continuation after actual previous r116 receipt read (#451–460); next #461, leading **변호사 → 데이터 → IT → 사용자·서류 → 계산사무장 → AX**. Related open Draft PRs #230/#231/#232 (OCR money parsing) and #51 (period gate) reviewed at metadata level; no PR merge.
- Restricted write prefix `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`, A3 only. Exact **10 canonical IDs / 10 source slots / 2 document kinds**. Full canonical and A3 board inventories are enumerated below from *this* actual index.
- This run executed **40 static checks (40 matches)** and **24 original-function V8 synthetic calls (24 current outputs reproduced)**. Passing these does NOT equal Node CI, production/staging D1/R2/Cron, actual extracted PDF/Fact/typed readback, official court form, lawyer approval, site deployment or legal acceptance.
- No operating DB migration/deployment, electronic filing, legal confirmation, original OCR data, customer data, PDF, secret, .env or private test answer committed.

## 2. All ten source/consumer/absence rows
| # | canonical ID | actual document/family | datatype / canonical unit / temporal role / source subject | exact individual applicability | exact typed / material / calculation / legal / form |
|---:|---|---|---|---|---|
| 461 | `payroll_payslip::income.payroll.net_pay` | salary_statement/payroll_payslip | money, KRW, period_scope, applicant_debtor | source_conditional | income.net / must_reconcile → income.net / canonical calc 0 / legal exact 0 / form exact 0 |
| 462 | `payroll_payslip::income.payroll.other_deductions` | salary_statement/payroll_payslip | money_or_itemized, KRW, period_scope, applicant_debtor | source_conditional | source-only / none / canonical calc 0 / legal exact 0 / form exact 0 |
| 463 | `payroll_payslip::income.payroll.overtime` | salary_statement/payroll_payslip | money, KRW, period_scope, applicant_debtor | source_conditional | source-only / none / canonical calc 0 / legal exact 0 / form exact 0 |
| 464 | `payroll_payslip::income.payroll.pay_date` | salary_statement/payroll_payslip | date, not_applicable, event_date, payee | source_conditional | source-only / none / canonical calc 0 / legal exact 0 / form exact 0 |
| 465 | `payroll_payslip::income.payroll.pay_period_end` | salary_statement/payroll_payslip | date, not_applicable, statement_period_end, applicant_debtor | source_conditional | income.period_end / none / canonical calc 0 / legal exact 0 / form exact 0 |
| 466 | `payroll_payslip::income.payroll.pay_period_start` | salary_statement/payroll_payslip | date, not_applicable, statement_period_start, applicant_debtor | source_conditional | income.period_start / none / canonical calc 0 / legal exact 0 / form exact 0 |
| 467 | `payroll_payslip::income.payroll.social_contributions` | salary_statement/payroll_payslip | money, KRW, period_scope, applicant_debtor | source_conditional | source-only / none / canonical calc 0 / legal exact 0 / form exact 0 |
| 468 | `payroll_payslip::income.payroll.tax_withheld` | salary_statement/payroll_payslip | money, KRW, period_scope, applicant_debtor | source_conditional | source-only / none / canonical calc 0 / legal exact 0 / form exact 0 |
| 469 | `pension_benefit_income::income.benefit.beneficiary` | pension_certificate/pension_benefit_income | party_role, not_applicable, not_applicable, applicant_debtor | source_conditional | source-only / none / canonical calc 0 / legal exact 0 / form exact 0 |
| 470 | `pension_benefit_income::income.benefit.benefit_type` | pension_certificate/pension_benefit_income | enum_or_text, not_applicable, not_applicable, applicant_debtor | source_conditional | source-only / none / canonical calc 0 / legal exact 0 / form exact 0 |

- **Source contracts:** exactly 10 source declarations in two kinds: `salary_statement/payroll_payslip` #461–468 and `pension_certificate/pension_benefit_income` #469–470. All 10 have individual `source_conditional` registrations, document hash/page/quote and field/row locator requirements, and both record policies include `noCrossRecordBorrowing` and `separate_summary_from_detail_do_not_double_count`. Actual PDFs/pages/subject identities, rows and D1 storage **not tested**.
- **Typed/indirect calculation:** #461 `income.net`, #465 `income.period_end`, #466 `income.period_start` are exact `runtime_mapped` candidates in `lib/reference-case-projection.ts:75–77`; `income_average` uses typed `income.net`, but 0/10 IDs are *literal* 18-module/91-input canonical IDs. This indirect route is meaningful, not evidence of end-to-end acceptance.
- **Material gate:** #461 `must_reconcile → income.net` in `lib/material-calculation-source-gate.ts`; an unconnected present fact is not safe to convert into a zero-income finding. Other nine lack a direct named material entry. The 7 without typed mapping are **source-only for now, not trash**.
- **Gross/net reconciliation:** #462 other deductions, #467 insurance contributions, #468 withholding tax, supplementary `salary_statement::total_deductions`, previous #454 allowances, #455 bonus, #458 gross base, #463 overtime, supplementary `salary_statement::gross_total`, and #461 net pay cannot be summed or double-subtracted without source row/period/employee/employer identity and inclusion relationships.
- **Timing:** #464 pay_date (event) differs from #465/466 pay period (statement dates). The original field-local validator checks dates independently and cannot detect a reversed pair. Actual existing test source `tests/ocr-calculator-input-integration.test.ts` checks partial-month `monthlyWon=null`; this source was inspected, **not executed via Node**.
- **Benefits:** #469 beneficiary and #470 benefit category are neither proof of applicant identity nor legal entitlement, nor do they demonstrate the periodic net payment. Pension receipts vs pension withdrawal assets must remain separate. No AI auto-law recognition.
- **Legal/form:** risk 95, law rules 50, exceptions 46; no exact canonical reference to these ten IDs in inspected static legal seed/catalogs. The seed `checks=[]` gives zero approved exact evidence mappings for this scope. No direct official token binding authenticated; candidate income form D5103 is not official-form parity. Do not treat declaration/legal-source mention as lawyer approval.
- **Generic document substitution/court correction:** earlier source code inspected `lib/document-substitution.ts` (reviewer, exact proof, policy gate) and `lib/preapproval-correction-item-store.ts` (`requiredCanonicalFieldIds`, legal order). They are generic routes; no exact #461–470 real substitution, lawyer review, order response or receipt observed.
- **DB Fact/typed:** existing `db/schema.ts` exposes `extraction_schema_fields.canonical_field_id`, `extracted_features.canonical_field_id`, source document/page and Fact. This is declared storage, not D1 evidence of this run.

## 3. Independent static checks at pinned commit (contract match ≠ product acceptance)
| # | independently expected assertion | expectation | observed | verdict |
|---:|---|---|---|---|
| 1 | canonical index size | 693 | 693 | MATCH |
| 2 | canonical unique | 693 | 693 | MATCH |
| 3 | document types | 85 | 85 | MATCH |
| 4 | families | 48 | 48 | MATCH |
| 5 | document/family routes | 141 | 141 | MATCH |
| 6 | base slots | 1582 | 1582 | MATCH |
| 7 | extensions | 207 | 207 | MATCH |
| 8 | supplement slots | 19 | 19 | MATCH |
| 9 | total source slots | 1808 | 1808 | MATCH |
| 10 | target IDs | 10 | 10 | MATCH |
| 11 | first ID | "payroll_payslip::income.payroll.net_pay" | "payroll_payslip::income.payroll.net_pay" | MATCH |
| 12 | last ID | "pension_benefit_income::income.benefit.benefit_type" | "pension_benefit_income::income.benefit.benefit_type" | MATCH |
| 13 | declared source slots | 10 | 10 | MATCH |
| 14 | distinct target document kinds | 2 | 2 | MATCH |
| 15 | all anchored to doc/hash/page/quote | 10 | 10 | MATCH |
| 16 | all forbid cross-record borrowing | 10 | 10 | MATCH |
| 17 | all separate summary/detail | 10 | 10 | MATCH |
| 18 | applicability fields registered | 10 | 10 | MATCH |
| 19 | source-conditional (not law approved) | 10 | 10 | MATCH |
| 20 | runtime-mapped typed candidate | 3 | 3 | MATCH |
| 21 | source-only typed status | 7 | 7 | MATCH |
| 22 | material must-reconcile contracts | 1 | 1 | MATCH |
| 23 | exact canonical calculator input declarations | 0 | 0 | MATCH |
| 24 | calculation modules | 18 | 18 | MATCH |
| 25 | calculation declared inputs | 91 | 91 | MATCH |
| 26 | distinct calculation input paths | 78 | 78 | MATCH |
| 27 | income_average indirect typed input income.net | true | true | MATCH |
| 28 | legal risks | 95 | 95 | MATCH |
| 29 | legal rules | 50 | 50 | MATCH |
| 30 | legal exceptions | 46 | 46 | MATCH |
| 31 | exact legal canonical mentions | 0 | 0 | MATCH |
| 32 | direct literal source-form tokens among target | 0 | 0 | MATCH |
| 33 | projection netPay code | true | true | MATCH |
| 34 | projection period start | true | true | MATCH |
| 35 | projection period end | true | true | MATCH |
| 36 | legal seed empty | true | true | MATCH |
| 37 | A3 IDs | 124 | 124 | MATCH |
| 38 | A3 IDs unique | 124 | 124 | MATCH |
| 39 | A3 selected still pending | 5 | 5 | MATCH |
| 40 | A3 checked | 0 | 0 | MATCH |

## 4. Original V8 source function tests — 24 actual calls
- Directly executed the original `normalizeMoney` function body from `lib/domain.ts` and `calculationSourceCellIssues`, `validDate`, `validTime` from `lib/ocr-calculation-input.ts`, removing TypeScript types/import/export only; `ONE=1n` and `ZERO=0n`. No money stub. These are *existing* outputs, not a declaration that each input is safely validated.
- `expected` code arrays were set before calls, with business-review expectations expressed separately; observed issue codes from actual functions below.

| test | field/case | fully synthetic input | independent review question | actually observed issues | current behavior reproduction |
|---:|---|---|---|---|---|
| 1 | #461 normal net | `{"value":"2310000","unit":"KRW","quote":"2310000","sourceState":"present","confidence":null,"datatype":"money"}` | 정확한 KRW; 법률상 인정은 별개 | `[]` | REPRODUCED |
| 2 | #461 quote USD/declared KRW | `{"value":"100","unit":"KRW","quote":"100 USD","sourceState":"present","confidence":null,"datatype":"money"}` | 원문과 단위 상충 경고 필요 | `[]` | REPRODUCED |
| 3 | #461 declared USD | `{"value":"100","unit":"USD","quote":"USD 100","sourceState":"present","confidence":null,"datatype":"money"}` | 실제 외화 단위 차단 | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | REPRODUCED |
| 4 | #461 not_seen | `{"value":null,"unit":"KRW","quote":"","sourceState":"not_seen","confidence":null,"datatype":"money"}` | 미관찰은 0 아님 | `[]` | REPRODUCED |
| 5 | #461 observed zero | `{"value":"0","unit":"KRW","quote":"0","sourceState":"present","confidence":null,"datatype":"money"}` | 관찰 0 유지 | `[]` | REPRODUCED |
| 6 | #461 present null | `{"value":null,"unit":"KRW","quote":"","sourceState":"present","confidence":null,"datatype":"money"}` | present/null 불일치 차단 | `["SOURCE_PRESENT_VALUE_MISSING"]` | REPRODUCED |
| 7 | #461 uncertain OCR | `{"value":"300","unit":"KRW","quote":"300","sourceState":"present","confidence":"uncertain","datatype":"money"}` | 낮은 확신 경고 | `["SOURCE_READ_UNCERTAIN"]` | REPRODUCED |
| 8 | #461 bad grouping | `{"value":"1,00","unit":"KRW","quote":"1,00","sourceState":"present","confidence":null,"datatype":"money"}` | 쉼표 그룹 로컬 미검출(기존 Draft PR) | `[]` | REPRODUCED |
| 9 | #462 itemized deductions | `{"value":"식대 50,000; 기타 2,000","unit":"KRW","quote":"식대 50,000; 기타 2,000","sourceState":"present","confidence":null,"datatype":"money_or_itemized"}` | 복수 행/총액 구분 | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | REPRODUCED |
| 10 | #462 single deduction | `{"value":"52000","unit":"KRW","quote":"52000","sourceState":"present","confidence":null,"datatype":"money_or_itemized"}` | 단일액 포함 관계 미검증 | `[]` | REPRODUCED |
| 11 | #463 negative overtime | `{"value":"-10000","unit":"KRW","quote":"-10000","sourceState":"present","confidence":null,"datatype":"money"}` | 정정/환급 등 음수 의미 확인 | `[]` | REPRODUCED |
| 12 | #464 invalid pay date | `{"value":"2026-02-30","unit":null,"quote":"2026-02-30","sourceState":"present","confidence":null,"datatype":"date"}` | 달력 오류 차단 | `["SOURCE_DATE_INVALID"]` | REPRODUCED |
| 13 | #464 valid pay date | `{"value":"2026-02-28","unit":null,"quote":"2026-02-28","sourceState":"present","confidence":null,"datatype":"date"}` | 귀속기간과 다른 지불일 가능 | `[]` | REPRODUCED |
| 14 | #465 end earlier than start | `{"value":"2026-01-01","unit":null,"quote":"2026-01-01","sourceState":"present","confidence":null,"datatype":"date"}` | #466과 함께 역전 여부 검증 필요 | `[]` | REPRODUCED |
| 15 | #466 start after end | `{"value":"2026-12-01","unit":null,"quote":"2026-12-01","sourceState":"present","confidence":null,"datatype":"date"}` | #465와 함께 역전 여부 검증 필요 | `[]` | REPRODUCED |
| 16 | #467 insurance quote USD | `{"value":"100","unit":"KRW","quote":"USD 100","sourceState":"present","confidence":null,"datatype":"money"}` | 원문 통화 상충 미검출 | `[]` | REPRODUCED |
| 17 | #468 no quote | `{"value":"100","unit":"KRW","quote":"","sourceState":"present","confidence":null,"datatype":"money"}` | 원문 인용 누락 차단 | `["SOURCE_QUOTE_MISSING"]` | REPRODUCED |
| 18 | #468 no unit | `{"value":"100","unit":null,"quote":"100","sourceState":"present","confidence":null,"datatype":"money"}` | 단위 누락 차단 | `["SOURCE_MONETARY_UNIT_MISSING"]` | REPRODUCED |
| 19 | #469 unknown beneficiary | `{"value":"unknown-beneficiary","unit":null,"quote":"unknown-beneficiary","sourceState":"present","confidence":null,"datatype":"party_role"}` | 수급자 신원 미결속 | `[]` | REPRODUCED |
| 20 | #470 unregistered classification | `{"value":"classification-999","unit":null,"quote":"classification-999","sourceState":"present","confidence":null,"datatype":"enum_or_text"}` | 급여종류 의미 미검증 | `[]` | REPRODUCED |
| 21 | #461 원 suffix | `{"value":"100원","unit":"KRW","quote":"100원","sourceState":"present","confidence":null,"datatype":"money"}` | 원 접미부 형식 허용 | `[]` | REPRODUCED |
| 22 | #463 OT not seen | `{"value":null,"unit":"KRW","quote":"","sourceState":"not_seen","confidence":null,"datatype":"money"}` | 미관찰 OT는 0 아님 | `[]` | REPRODUCED |
| 23 | #465 invalid end date | `{"value":"2026-02-30","unit":null,"quote":"2026-02-30","sourceState":"present","confidence":null,"datatype":"date"}` | 귀속기간 유효날짜 검사 | `["SOURCE_DATE_INVALID"]` | REPRODUCED |
| 24 | #461 quote $ and KRW | `{"value":"100","unit":"KRW","quote":"$100","sourceState":"present","confidence":null,"datatype":"money"}` | 원문 달러기호 상충 미검출 | `[]` | REPRODUCED |

**P2 field-local gaps (NOT proven whole-system bypass):** #461 and #467 quoted USD/foreign symbol declared KRW, #461 `1,00` grouping, #465–466 reversed *pair*, #462 itemized row/total inclusion, #469 unverified beneficiary and #470 arbitrary classification are not established by this isolated validator. Negative #463 overtime may be a correction; don't hard-reject without payroll/business review. Existing stacked Draft PRs and upstream gates require review before code modification. No code change in this run.

**Observed field-local blocks:** `SOURCE_MONEY_NOT_EXACT_KRW` for foreign declared unit or non-single amount, `SOURCE_PRESENT_VALUE_MISSING` for present/null, `SOURCE_QUOTE_MISSING`, `SOURCE_MONETARY_UNIT_MISSING`, `SOURCE_DATE_INVALID`, `SOURCE_READ_UNCERTAIN`. `not_seen` null and `present` 0 remain distinct. Missing / 0 / NA / conflicting / source-only / unapproved were not interchanged.

## 5. A3 5 selected checks / 6 role rotation — no false green
| responsibility | checklist ID | observed partial evidence / outstanding |
|---|---|---|
| 변호사 | `A3-LAW-015` [ ] | exact risk95/rules50/exceptions46 reviewed, 0 exact approved legal contracts; practice/court approval absent |
| 데이터 | `A3-DATA-008` [ ] | 10 source row/hash/page/period/subject declarations, no actual D1 Fact/typed replay |
| IT | `A3-IT-003` [ ] | 18/91/78 cross-check, 3 typed and one material, end-to-end runner/CI not verified |
| 사용자·서류 | `A3-DOC-012` [ ] | wage/monthly proof and alternative proof gaps documented; no real required-doc or substitution |
| 계산사무장 | `A3-CALC-001` [ ] | net/gross/deductions/OT/period double-count risks and input examples; no approved amount/period |
| AX | next review candidate | full agent/OCR/reasoning chain untested; all six perspectives rotated, no model acceptance inferred |

## 6. Reproducible SHA receipt and next start
- Prior r116 #460 → current #461–470. Sequential audited on this pass **470/693**, **223 remain**. All **124 A3 IDs [ ]**, final A3 product acceptance **0/124**.
- Next #471 = `pension_benefit_income::income.benefit.decision_date`, next batch **#471–480**, next lead **데이터 → IT → 사용자·서류 → 계산사무장 → 변호사 → AX**.
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `31b0d0e0a90cb1c01aa52fac692cd32ee9a9edd7`
- `lib/canonical-field-id-index.json` blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` blob `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` blob `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` blob `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` blob `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/module-contracts.generated.json` blob `46a395a763ac17ab8e66c492c26c8e20fc037f56`
- `lib/risk-catalog.json` blob `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json` blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`
- `lib/ocr-calculation-input.ts` blob `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/reference-case-projection.ts` blob `92cb5fd5816571259e070490a496e7b7f4d8515c`
- `lib/material-calculation-source-gate.ts` blob `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/legal-evidence-criteria.ts` blob `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
- Existing tests actually inspected (not executed): `tests/a3-canonical-register-order.test.mjs` SHA `16481c0ad24333f05d5dfd9ccad4e829400ba723`; `tests/ocr-calculator-input-integration.test.ts` SHA `48fe6b3ddf3f162d55608b532af1102f765d0310`; `tests/reference-case-projection.test.ts` SHA `7efcc35b29ca2ef8e5dc145d6cc37a1823afc79a`; `tests/material-calculation-source-gate.test.ts` SHA `eb37d53f09ad13fa0d13839325db8fd635c76bb7`; `tests/feature-lineage-audit.test.ts` SHA `4257434140eaa18efef88bc4fd1fc721048a4d00`.

## Appendix A — full latest canonical 693 index, in exact order
| ordinal | canonical ID |
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

## Appendix B — full 124 A3 checklist IDs from this central board
| ordinal | A3 checklist ID | status |
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
