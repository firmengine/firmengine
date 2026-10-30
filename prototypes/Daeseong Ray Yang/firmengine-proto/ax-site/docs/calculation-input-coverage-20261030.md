# 18개 법적 계산 모듈 입력 계약 — 실제 OCR 피처 ID 대조

**의미:** '직접'은 표준 출처→CaseData 키가 정확히 동일하고 피처가 존재하는 경우다. 직접 키가 있어도 실제 OCR 판독/원문 증빙/동일인/기간/인정 완료가 보장되지 않는다. '미연결'은 계산에 넣어야 할 후보를 추가 검토해야 한다는 뜻이며 자동 0 처리하거나 다른 이름으로 추론해서는 안 된다.

| 모듈 | 입력 CaseData 경로 | 정확한 OCR 피처 ID | 상태 |
| --- | --- | --- | --- |
| income_average | `income.kind` | `current_nonwage_income::income.other.income_kind`, `tax_income::income_kind` | 직접 ID 연결 (검증·인정 별도) |
| income_average | `income.gross` | `business_sales_vat::income.sales.gross_sales`, `current_nonwage_income::income.other.gross_amount`, `salary_statement::gross_total`, `tax_income::gross_receipts` | 직접 ID 연결 (검증·인정 별도) |
| income_average | `income.expenses` | `current_nonwage_income::income.other.deductions`, `tax_income::necessary_expenses`, `salary_statement::total_deductions` | 직접 ID 연결 (검증·인정 별도) |
| income_average | `income.net` | `current_nonwage_income::income.other.net_received`, `payroll_payslip::income.payroll.net_pay`, `tax_income::income_after_expenses` | 직접 ID 연결 (검증·인정 별도) |
| income_average | `income.amountBasis` | 유도 후보: income.period_start + income.period_end | 유도/사람 검토 필요 |
| income_average | `income.periodStart` | `business_sales_vat::income.sales.reporting_period_start`, `current_nonwage_income::income.other.earning_period_start`, `payroll_payslip::income.payroll.pay_period_start`, `tax_income::period_start` | 직접 ID 연결 (검증·인정 별도) |
| income_average | `income.periodEnd` | `business_sales_vat::income.sales.reporting_period_end`, `current_nonwage_income::income.other.earning_period_end`, `payroll_payslip::income.payroll.pay_period_end`, `tax_income::period_end` | 직접 ID 연결 (검증·인정 별도) |
| income_average | `income.periodMonths` | 유도 후보: income.period_start + income.period_end | 유도/사람 검토 필요 |
| income_aggregation | `income.payerIdentityId` | — | **계산 입력의 표준 OCR 경로 미연결** |
| income_aggregation | `income.aggregationTreatment` | — | **계산 입력의 표준 OCR 경로 미연결** |
| income_aggregation | `income.recurring` | — | **계산 입력의 표준 OCR 경로 미연결** |
| income_aggregation | `context.filingPeriod` | — | 사건 설정·법률 검토 입력 |
| income_aggregation | `context.inventoryComplete.income` | — | 사건 설정·법률 검토 입력 |
| debt_total | `debt.creditor` | `debt_certificate::creditor` | 직접 ID 연결 (검증·인정 별도) |
| debt_total | `debt.contractId` | `debt_certificate::contract_id` | 직접 ID 연결 (검증·인정 별도) |
| debt_total | `debt.principal` | 유도 후보: `debt_certificate::principal_balance` → 검증된 `Debt.principal` | **검증된 현재 잔액에서 typed 변환** |
| debt_total | `debt.interest` | `debt_certificate::interest_balance` | 직접 ID 연결 (검증·인정 별도) |
| debt_total | `debt.asOf` | `debt_certificate::as_of_date` | 직접 ID 연결 (검증·인정 별도) |
| debt_total | `context.inventoryComplete.debt` | — | 사건 설정·법률 검토 입력 |
| debt_cap | `debt.secured` | — | **계산 입력의 표준 OCR 경로 미연결** |
| debt_cap | `debt.classification` | — | **계산 입력의 표준 OCR 경로 미연결** |
| debt_cap | `debt.guaranteeDetails` | — | **계산 입력의 표준 OCR 경로 미연결** |
| debt_cap | `context.applicationDate` | — | 사건 설정·법률 검토 입력 |
| debt_cap | `context.asOf` | — | 사건 설정·법률 검토 입력 |
| debt_cap | `context.ruleReleaseId` | — | 사건 설정·법률 검토 입력 |
| asset_liquidation | `asset.grossValue` | `cash_deposit_asset::gross_value` | 직접 ID 연결 (검증·인정 별도) |
| asset_liquidation | `asset.ownershipBps` | 유도 후보: asset.ownership_share | 유도/사람 검토 필요 |
| asset_liquidation | `asset.securedPayoff` | `cash_deposit_asset::actual_payoff` | 직접 ID 연결 (검증·인정 별도) |
| asset_liquidation | `asset.securedPayoffScope` | — | **계산 입력의 표준 OCR 경로 미연결** |
| asset_liquidation | `asset.disposalCosts` | — | **계산 입력의 표준 OCR 경로 미연결** |
| asset_liquidation | `asset.protectedValue` | — | **계산 입력의 표준 OCR 경로 미연결** |
| asset_liquidation | `asset.asOf` | `cash_deposit_asset::as_of_date`, `insurance_policy_asset::as_of_date` | 직접 ID 연결 (검증·인정 별도) |
| asset_liquidation | `asset.valuationBasis` | `cash_deposit_asset::valuation_basis` | 직접 ID 연결 (검증·인정 별도) |
| asset_liquidation | `context.inventoryComplete.asset` | — | 사건 설정·법률 검토 입력 |
| available_income | `household.recognizedLivingCost` | — | **계산 입력의 표준 OCR 경로 미연결** |
| available_income | `household.additionalLivingCost` | — | **계산 입력의 표준 OCR 경로 미연결** |
| available_income | `household.livingCostIncludesAdditional` | — | **계산 입력의 표준 OCR 경로 미연결** |
| ordinary_budget | `context.monthlyTrusteeFee` | — | 사건 설정·법률 검토 입력 |
| ordinary_budget | `context.monthlyPriorityPayment` | — | 사건 설정·법률 검토 입력 |
| ordinary_budget | `context.monthlyEstatePayment` | — | 사건 설정·법률 검토 입력 |
| ordinary_budget | `context.approvedMonthlyPayment` | — | 사건 설정·법률 검토 입력 |
| nominal_plan | `context.planMonths` | — | 사건 설정·법률 검토 입력 |
| allocation | `debt.priority` | — | **계산 입력의 표준 OCR 경로 미연결** |
| allocation | `debt.classification` | — | **계산 입력의 표준 OCR 경로 미연결** |
| allocation | `context.allocationBasis` | — | 사건 설정·법률 검토 입력 |
| allocation | `context.allocationBasisReviewed` | — | 사건 설정·법률 검토 입력 |
| liquidation_comparison | `context.approvedPresentValue` | — | 사건 설정·법률 검토 입력 |
| liquidation_comparison | `context.presentValueBasis` | — | 사건 설정·법률 검토 입력 |
| liquidation_comparison | `context.presentValueReviewed` | — | 사건 설정·법률 검토 입력 |
| liquidation_comparison | `context.assetValuationBasisReviewed` | — | 사건 설정·법률 검토 입력 |
| disposal_conservation | `saleAmount` | — | 별도 도구/법률결정 입력 |
| disposal_conservation | `securedPayoff` | — | 별도 도구/법률결정 입력 |
| disposal_conservation | `costs` | — | 별도 도구/법률결정 입력 |
| payment_schedule | `context.paymentSchedule.phases` | — | 사건 설정·법률 검토 입력 |
| payment_schedule | `context.paymentSchedule.expectedInstallments` | — | 사건 설정·법률 검토 입력 |
| living_cost_proposal | `context.applicationDate` | — | 사건 설정·법률 검토 입력 |
| living_cost_proposal | `context.courtId` | — | 사건 설정·법률 검토 입력 |
| living_cost_proposal | `household.recognizedMembers` | — | **계산 입력의 표준 OCR 경로 미연결** |
| living_cost_proposal | `household.additionalLivingCost` | — | **계산 입력의 표준 OCR 경로 미연결** |
| objection_minimum | `context.planApprovalDate` | — | **검증된 Fact 키** (`data.context` 속성 아님) |
| objection_minimum | `context.ruleReleaseId` | — | 사건 설정·법률 검토 입력 |
| objection_minimum | `context.courtObjection` | — | 사건 설정·법률 검토 입력 |
| objection_minimum | `claims.presentValue` | — | 별도 도구/법률결정 입력 |
| objection_minimum | `plan.repaymentPresentValue` | — | 별도 도구/법률결정 입력 |
| objection_minimum | `context.approvedPresentValue` | — | 사건 설정·법률 검토 입력 |
| objection_minimum | `context.presentValueReviewed` | — | 사건 설정·법률 검토 입력 |
| seoul_short_term | `context.courtId` | — | 사건 설정·법률 검토 입력 |
| seoul_short_term | `context.applicationDate` | — | 사건 설정·법률 검토 입력 |
| seoul_short_term | `context.planMonths` | — | 사건 설정·법률 검토 입력 |
| seoul_short_term | `vulnerable.wageHistory` | — | 별도 도구/법률결정 입력 |
| seoul_short_term | `debts.total` | — | 별도 도구/법률결정 입력 |
| seoul_short_term | `debts.privateCreditors` | — | 별도 도구/법률결정 입력 |
| seoul_short_term | `debts.lastYearDebt` | — | 별도 도구/법률결정 입력 |
| seoul_short_term | `applicant.age` | — | 별도 도구/법률결정 입력 |
| seoul_short_term | `legal.seoul424.statutory_severe_disability` | — | 별도 도구/법률결정 입력 |
| seoul_short_term | `household.minorChildren` | — | **검증된 Fact 키** (`data.household` 속성 아님) |
| seoul_short_term | `household.singleParent` | — | **검증된 Fact 키** (`data.household` 속성 아님) |
| seoul_short_term | `rentalFraud.officialDecision` | — | 별도 도구/법률결정 입력 |
| transaction_review | `transaction.date` | `bank_transactions::transaction_datetime` | 직접 ID 연결 (검증·인정 별도) |
| transaction_review | `transaction.accountId` | `bank_transactions::account_id` | 직접 ID 연결 (검증·인정 별도) |
| transaction_review | `transaction.counterparty` | `bank_transactions::counterparty` | 직접 ID 연결 (검증·인정 별도) |
| transaction_review | `transaction.amount` | `bank_transactions::amount` | 직접 ID 연결 (검증·인정 별도) |
| transaction_review | `transaction.direction` | `bank_transactions::direction` | 직접 ID 연결 (검증·인정 별도) |
| transaction_review | `transaction.kind` | — | **계산 입력의 표준 OCR 경로 미연결** |
| transaction_review | `transaction.relatedObjectId` | — | **계산 입력의 표준 OCR 경로 미연결** |
| form_projection | `asset.kind` | `cash_deposit_asset::asset_kind` | 직접 ID 연결 (검증·인정 별도) |
| form_projection | `income.kind` | `current_nonwage_income::income.other.income_kind`, `tax_income::income_kind` | 직접 ID 연결 (검증·인정 별도) |
| form_projection | `context.monthlyTrusteeFee` | — | 사건 설정·법률 검토 입력 |
| form_projection | `context.planMonths` | — | 사건 설정·법률 검토 입력 |
| installment_distribution | `context.planMonths` | — | 사건 설정·법률 검토 입력 |
| installment_distribution | `context.paymentSchedule` | — | 사건 설정·법률 검토 입력 |

### 검증 합계

- 18모듈의 선언 입력 슬롯 91개: 직접 21, 유도 4, 사건 설정 33, 객체 계산 입력 미연결 18, 명시 검증된 Fact 입력 3, 별도 의사결정/도구 입력 12.
- 월평균/채무총액/재산청산가치 외 변제 예산·채권 배분·선택기간·규칙판본은 OCR 값만으로 계산할 수 없다.
- 실제 실행 리그레션은 `tests/ocr-calculator-input-integration.test.ts`와 `tests/ocr-calculation-db-contract.test.ts`에 정의됨. 이 문서는 테스트 실행결과가 아닌 **현재 코드 키 계약 대조**다.
