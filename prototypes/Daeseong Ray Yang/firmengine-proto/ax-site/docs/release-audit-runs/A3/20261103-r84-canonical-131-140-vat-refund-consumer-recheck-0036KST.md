# FirmEngine A3 r84 — canonical OCR #131–140, VAT gross/returns and card billed evidence consumer recheck

> **2026-11-03 KST.** Scope **only** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` on GitHub `main`. Synthetic evidence/test descriptions only; no real client data, OCR fact values, personal data, .env, tokens, private answers, production D1 operations, deployment or filing. **Observed function behavior ≠ business/legal acceptance ≠ Node CI ≠ D1/R2/Cron staging ≠ official court form ≠ lawyer approval.**

## 1. Main/precedence, roles and precise completion gate

- Audited latest main HEAD **`a8f3cd9976df9e45b98a0830c10d01444012295d`** at the beginning of this receipt write; recheck any later HEAD changes before modifying shared board. Previous r83 [#121–130](20261102-r83-canonical-121-130-registration-identity-consumers-2336KST.md) handed off **#131**. Earlier r42 [#121–140](20261101-r42-canonical-121-140-consumer-recheck-0631KST.md) already recorded **#140 applicability missing**; this is a **reconfirmed**, not new discovery.
- Read recent main commits including `a8f3cd9976d...`, `38012e886ac...`, `e877e416ad4...`; open Draft #193 (business registration status/joint operator), #189 (late business expenses), historical #39/#109 business identity/period. Other writers may be editing concurrently; no PR merge or product code change here.
- Six role rotation this round: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**. Partial board receipt only: **A3-IT-003, A3-DOC-007, A3-CALC-015, A3-LAW-015, A3-DATA-013**. All remain **[ ]**; AX participates as independent cross-row review candidate without an additional board line mutation.
- Actual latest canonical: **693 unique ID**, **48 OCR families**, **85 document types**, **1808 declared document×family×field slots**, duplicate slot 0, route outside index 0; **124 A3 board check IDs**. #131–140 **10 canonical IDs / 38 declared source slots / 5 unique document types**, with 4 VAT documents and 1 card document routed to two distinct source families.
- Field source applicability **9/10 explicitly registered**, **#140 missing 1/10 (0% approved)**. Source-only preservation is independent of this registration. `reference-decision-tables` **18 calculation specifications / 91 stated inputs**. `risk-catalog` **95 risks**, `legal-catalog` **50 rules**, `legal-exceptions` **46 exceptions**: these latest source JSONs contain **0 exact canonical ID direct references in this ten-ID group**; this does not prove the entire runtime legal logic lacks indirect consumers or that a condition is legally unnecessary.
- Actual `canonical-field-binding.ts` typed converter declared **3/10** (#132 `income.gross`, #134 `income.period_end`, #135 `income.period_start`); `material-calculation-source-gate.ts` **1/10** exact must_reconcile (#132 to `income.gross`), context_only 0/10. `ocr-chain-matrix.ts:OCR_DECLARED_FORM_TARGETS` exact token 0/10; generic `D5103/D5110` form candidates are not official verified token bindings.

## 2. Each ID / document source, unit, period, subject and consumers

Catalog declares required document id/SHA, page, quote, row/column if present, bbox if possible, source state; each distinct document and each period/line/subject is **a separate source observation** (`noCrossRecordBorrowing=true`), and a missing field must not become literal zero/automatic non-applicable. These columns describe **static contracts and isolated code behavior**, not populated client data.

| # | Exact canonical ID | Document×family source routes | datatype / unit / temporal role / subject | ID-specific applicability | Observed code consumer / cross-check / follow-up question | Unverified gap |
|---:|---|---|---|---|---|---|
| 131 | `business_sales_vat::income.sales.filing_date` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | date / not_applicable / application_filing_date / business_entity | registered: Date filed | filing date, not revenue period; source-only evidence / event review | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 132 | `business_sales_vat::income.sales.gross_sales` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | money / KRW / period_scope / business_entity | registered: Sales total; VAT inclusion basis explicit | typed `income.gross`; material must_reconcile→income.gross; turnover_total; preflight selected gross | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 133 | `business_sales_vat::income.sales.issue_date` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | date / not_applicable / document_issue_date / authority | registered: Record issue date | issue date by issuing authority; not business revenue period | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 134 | `business_sales_vat::income.sales.reporting_period_end` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | date / not_applicable / statement_period_end / business_entity | registered: Tax/reporting period end | typed `income.period_end`; `businessNetReviewBasis` 기간 대조 | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 135 | `business_sales_vat::income.sales.reporting_period_start` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | date / not_applicable / statement_period_start / business_entity | registered: Tax/reporting period start | typed `income.period_start`; `businessNetReviewBasis` 기간 대조 | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 136 | `business_sales_vat::income.sales.returns_refunds` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | money / KRW / period_scope / business_entity | registered: Returns/refunds/cancellations | `business-source-evidence` returns_refunds; same-row nonzero refund preflight blocks; cross-row requires independent reconciliation | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 137 | `business_sales_vat::income.sales.sales_count` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | integer / transactions / period_scope / business_entity | registered: Count by source grouping | source-only transaction-count plausibility; negative format is not blocked in isolated format check | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 138 | `business_sales_vat::income.sales.taxable_sales` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | money / KRW / period_scope / business_entity | registered: Taxable sales base | turnover_component; same-row evidence, never double-count as total | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 139 | `business_sales_vat::income.sales.vat_collected` | 4: `business_income_report@business_sales_vat`, `vat_certificate@business_sales_vat`, `vat_exempt_certificate@business_sales_vat`, `sales_purchase_summary@business_sales_vat` | money / KRW / period_scope / business_entity | registered: VAT amount shown, not income | vat_collected; same-row evidence, not net income or deductible cost | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |
| 140 | `card_statement::billed_amount` | 2: `card_statement@debt_certificate`, `card_statement@bank_transactions` | money / source currency/unit / not_applicable / document_subject | **UNREGISTERED 0%** | card billed total source-only; not automatically current debt or bank movement | Exact official token 0; exact approved legal contract 0; actual OCR/D1/typed/official output not observed |

All four VAT documents declare **9 IDs × 4 source routes = 36**. Card `card_statement::billed_amount` independently occurs in **`card_statement@debt_certificate`** and **`card_statement@bank_transactions`** = 2 source routes, not two charge totals. `filing_date` #131 ≠ `issue_date` #133 ≠ reporting window #134–135. Total turnover #132 ≠ taxable component #138 + exempt #130 by automatic assumption; source gross may already include/exclude VAT, returns #136 and collected VAT #139 require same-period, entity, source-row and statutory accounting review. Count #137 is **transactions**, never KRW; billed amount #140 has source currency/unit, no unapproved KRW conversion.

## 3. Actually executed isolated original-function trials (not Node project)

**3.1 `canonical-field-binding.ts:bindCanonicalSourceField`: 20 calls.** Extracted original exported function body, removed only TypeScript annotations/non-null assertions and injected original family alias table into JS V8 `Function`; per ID **correct explicit field/key binding 10/10**, deliberately incompatible key **rejected 10/10** with `canonical_id_key_conflict` (some also `canonical_id_outside_family`). #140 used the debt_certificate card route; the bank_transactions card route is statically enumerated only. Independent expected binding/rejection vs returned ID was checked; **not** real extraction, SQL, typed ingestion or legality.

**3.2 `ocr-calculation-input.ts:calculationSourceCellIssues`: 11 calls.** Extracted original function body with TS annotation stripped; `validDate/validTime` equivalent function and **synthetic `normalizeMoney` stub** (exact only for synthetic KRW) injected, so foreign currency result is only format-check stub and **does not** validate actual exchange conversion.
- #131 invalid 2026-02-30 -> `SOURCE_DATE_INVALID`; valid 2026-02-28 -> no cell error.
- #132 amount `3000` with unit null -> `SOURCE_MONETARY_UNIT_MISSING`; with USD -> `SOURCE_MONEY_NOT_EXACT_KRW` (stub); KRW -> no format error. Absent quote -> `SOURCE_QUOTE_MISSING`.
- #136 amount **explicit 0**, unit KRW -> no format error; this is not equal to null/unobserved/NA.
- #137 `many` -> `SOURCE_INTEGER_FORMAT_REVIEW`; `-4` -> **no format error**, as does `0`. **P2 candidate**: negative number of transactions is syntactically an integer, but source/semantic validation of count ≥0 must be checked upstream, not silently treated as approved.
- #140 USD unit -> `SOURCE_MONEY_NOT_EXACT_KRW` synthetic normalization stub.
**11/11 current-function return outcomes reproduced**, *not* 11/11 independent legal or physical safety approval.

**3.3 `business-net-reconciliation.ts:preflightBusinessNet`: 9 synthetic component scenarios.** Actual exported function body (source SHA below), dependent policy, source index, amount normalization and basis generation supplied by synthetic stubs; not the native product case/reconciliation/legally authorized rule. Test fixture: Sep-2026 gross=3,000, approved mock cost=1,000, baseline net=**2,000** under synthetic only mock policy.
| Input scenario | Independent intended review boundary | Observed source function |
|---|---|---|
| baseline selected gross/cost | mock difference 2,000 | 2,000, 10 selected Fact IDs |
| **same source row** additional nonzero refund=250 | block unreviewed adjustment | `BUSINESS_UNRECONCILED_FINANCIAL_COMPONENT:extra` |
| same source row explicit refund=0 | include source without net change | net 2,000, source ID included; basis changed |
| **different source record** refund=250 (same period) | request cross-document entity/period reconciliation | net 2,000, source ID not included, **basis unchanged** |
| same source row VAT=300 | retain VAT evidence without automatic net deduction | net 2,000, source included/basis changed |
| same source row taxable component=2,200 | no double addition to gross | net 2,000, source included/basis changed |
| same source row sales_count=50 | count plausibility / evidence audit | net 2,000, **basis unchanged** |
| same source row filing_date=2026-10-01 | filing vs earning period distinguish | net 2,000, basis unchanged |
| separate gross doc=1,500 | independent business/period reconciliation | net 2,000, unselected source/basis unchanged |

**Observed P2 review dependency gap (not proven final-product bug):** selective `preflightBusinessNet`/review fingerprint covers the selected `subjectId` row, not all current same-business documents. A new same-period refund in another row does **not** alter that function's source basis. **Important independent system counter-control:** `business-source-evidence.ts:auditBusinessSourceEvidence` catalogs `returns_refunds` and links/unreconciled current source; `assessment.ts` checks `zeroIncomeWouldBeUnsupported` and makes aggregate income **null** if unresolved. We did **not** execute that true case end-to-end with the synthetic cross-document refund, so no claim that erroneous approved income reaches form or final decision. Existing r83 Draft #193 and r81 #189 address other late evidence; do not overwrite/merge. Remedy requires independent IT + calculation clerk + lawyer review of whether/when new return source should mark a reviewed monthly income stale and which same business/period join is defensible.

## 4. Legal, substitution, correction, form, evidence-only boundaries

- `reference-intake-catalog.json` previous r83 observed business document `INTAKE-004/005` source requirements and `substitution-policy.json` Seoul/Busan candidate `business_income_report → financial_statement`. Neither asserts #131–139 real-source fulfillment nor approved substitution. An official replacement needs case/jurisdiction/date/subject/source period/document hash and **separate staff B+C approval**. No live document/decision tested this round.
- `preapproval-correction-audit.ts`/`preapproval-correction-item-store.ts` law-court correction flow is separate from VAT source period and `reference-intake-catalog`; actual court correction order, source line/page, deadline, action/receipt and lawyer approval **all unobserved**.
- `form-mapping.ts` and D5103/D5110 declared form candidates are not a verified exact canonical #131–140 official form token or actual Word/e-file output. `income.gross` typed projection and 18/91 declared calculation mapping do not imply accepted **net** business income. #132 must_reconcile is only a **technical amount link gate**, not monthly business income or legal eligibility approval.
- No direct consumer is **not** reason to discard a source observation. #131/#133 filing/issue date is chronology evidence, #137 count is plausibility/duplicate check, #140 billed amount is transaction/debt amount reconciliation candidate, #136/#138/#139 preserve adjustment/tax components for reverse questions. Preserve source-only/not_observed/null/explicit_zero/not_applicable/conflict/review_required/accepted_by_human separately. Never multiply or sum to KRW absent source unit and approved method.

## 5. Board audit status, concrete evidence and subsequent scope

- `A3-IT-003` [ ]: 18 calculation specifications/91 declared inputs and exact typed #132/#134/#135 plus must_reconcile #132 checked; **no** 18-module end-to-end/SQL regression.
- `A3-DOC-007` [ ]: 4 VAT documents × nine canonical plus card dual-family routes; required period/business/entity/issuer and refund/count question pathways statically checked; no actual B+C substitution/correction/client doc.
- `A3-CALC-015` [ ]: amount 3000–1000→2000 synthetic original preflight; cross-same-row VAT/component not double-added; same-row nonzero refund blocked, other-row refund does not enter **preflight basis**, case E2E missing.
- `A3-LAW-015` [ ]: 95/50/46 catalog static exact canonical matching zero; legal requiredness/approval **0%** until authority, version, court and lawyer review. No legal-priority/expense recognition inferred.
- `A3-DATA-013` [ ]: 38 declared source routes; document/page/row/hash/quote/period/entity source-only declarations, exact typed 3, direct material 1, exact official form 0. Actual OCR/D1 Fact/typed return/storage/source SHA and official form trace **NOT EXECUTED**.

**A3 final acceptance: 0/124.** Initial 693/693 static inventory is not consumer E2E approval. This recheck individually inspected canonical #131–140, and r71–r83 previously rechecked #001–130. **Next canonical ID #141 `card_statement::billing_period`; next range #141–150 (10 IDs), next role starts AX** to avoid repeated initial IT. For another round, explicitly test card billed/charges/transactions original ledger, source currency, period, duplicates, technical debt and legal recognition without assigning current debt automatically.

## 6. Current source blob receipts

- main before receipt write `a8f3cd9976df9e45b98a0830c10d01444012295d`
- `lib/canonical-field-id-index.json` `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/field-applicability-contracts.json` `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json` `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json` `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/canonical-field-binding.ts` `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/ocr-calculation-input.ts` `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/material-calculation-source-gate.ts` `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/business-source-evidence.ts` `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`
- `lib/business-net-reconciliation.ts` `60a4fc295943dce404a7f99efffe88f58dd2d4ff`
- `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`
- `lib/ocr-chain-matrix.ts` `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/shared-document-catalog.ts` `4cd07ebcc11d2d9d803a117ae98424292e1c5cba`
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` at initial read `a29ac89502b6b51815f171abf4b6e2d26939882b`

## Appendix A. Canonical OCR index — exact 693 IDs, enumerated from latest index

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

## Appendix B. Central A3 board check IDs — exact 124 IDs

001. `A3-IT-001`
002. `A3-IT-002`
003. `A3-IT-003`
004. `A3-IT-004`
005. `A3-IT-005`
006. `A3-IT-006`
007. `A3-IT-007`
008. `A3-IT-008`
009. `A3-IT-009`
010. `A3-IT-010`
011. `A3-IT-011`
012. `A3-IT-012`
013. `A3-IT-013`
014. `A3-IT-014`
015. `A3-IT-015`
016. `A3-IT-016`
017. `A3-IT-017`
018. `A3-IT-018`
019. `A3-IT-019`
020. `A3-IT-020`
021. `A3-DOC-001`
022. `A3-DOC-002`
023. `A3-DOC-003`
024. `A3-DOC-004`
025. `A3-DOC-005`
026. `A3-DOC-006`
027. `A3-DOC-007`
028. `A3-DOC-008`
029. `A3-DOC-009`
030. `A3-DOC-010`
031. `A3-DOC-011`
032. `A3-DOC-012`
033. `A3-DOC-013`
034. `A3-DOC-014`
035. `A3-DOC-015`
036. `A3-DOC-016`
037. `A3-DOC-017`
038. `A3-DOC-018`
039. `A3-DOC-019`
040. `A3-DOC-020`
041. `A3-CALC-001`
042. `A3-CALC-002`
043. `A3-CALC-003`
044. `A3-CALC-004`
045. `A3-CALC-005`
046. `A3-CALC-006`
047. `A3-CALC-007`
048. `A3-CALC-008`
049. `A3-CALC-009`
050. `A3-CALC-010`
051. `A3-CALC-011`
052. `A3-CALC-012`
053. `A3-CALC-013`
054. `A3-CALC-014`
055. `A3-CALC-015`
056. `A3-CALC-016`
057. `A3-CALC-017`
058. `A3-CALC-018`
059. `A3-CALC-019`
060. `A3-CALC-020`
061. `A3-LAW-001`
062. `A3-LAW-002`
063. `A3-LAW-003`
064. `A3-LAW-004`
065. `A3-LAW-005`
066. `A3-LAW-006`
067. `A3-LAW-007`
068. `A3-LAW-008`
069. `A3-LAW-009`
070. `A3-LAW-010`
071. `A3-LAW-011`
072. `A3-LAW-012`
073. `A3-LAW-013`
074. `A3-LAW-014`
075. `A3-LAW-015`
076. `A3-LAW-016`
077. `A3-LAW-017`
078. `A3-LAW-018`
079. `A3-LAW-019`
080. `A3-LAW-020`
081. `A3-LAW-021`
082. `A3-LAW-022`
083. `A3-DATA-001`
084. `A3-DATA-002`
085. `A3-DATA-003`
086. `A3-DATA-004`
087. `A3-DATA-005`
088. `A3-DATA-006`
089. `A3-DATA-007`
090. `A3-DATA-008`
091. `A3-DATA-009`
092. `A3-DATA-010`
093. `A3-DATA-011`
094. `A3-DATA-012`
095. `A3-DATA-013`
096. `A3-DATA-014`
097. `A3-DATA-015`
098. `A3-DATA-016`
099. `A3-DATA-017`
100. `A3-DATA-018`
101. `A3-DATA-019`
102. `A3-DATA-020`
103. `A3-DATA-021`
104. `A3-DATA-022`
105. `A3-AX-001`
106. `A3-AX-002`
107. `A3-AX-003`
108. `A3-AX-004`
109. `A3-AX-005`
110. `A3-AX-006`
111. `A3-AX-007`
112. `A3-AX-008`
113. `A3-AX-009`
114. `A3-AX-010`
115. `A3-AX-011`
116. `A3-AX-012`
117. `A3-AX-013`
118. `A3-AX-014`
119. `A3-AX-015`
120. `A3-AX-016`
121. `A3-AX-017`
122. `A3-AX-018`
123. `A3-AX-019`
124. `A3-AX-020`
