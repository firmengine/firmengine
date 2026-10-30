# 인가 전 18개 계산 모듈 — 91개 입력 사용·42개 출력 저장 교차감사

기준: 2026-10-30 GitHub main `lib/reference-decision-tables.json`, `lib/case-calculation-feature-store.ts`, `lib/preapproval-stage-audit.ts`.

**주의:** 91은 입력 선언의 합계이며 서로 중복되는 고유 경로는 78개이다. 실제 사건에 따라 일부 모듈은 선택되지 않을 수 있고, 출력은 SQL `case_calculation_features` 이외의 서식·일정·법률 테이블에 있을 수 있다. **저장 관측과 법률상 인정을 구분한다.**

| 모듈 | 단계 | 모든 입력명 | 모든 출력명 | 저장 위치/대조 대상 |
|---|---|---|---|---|
| `income_average` | P3 | `income.kind`, `income.gross`, `income.expenses`, `income.net`, `income.amountBasis`, `income.periodStart`, `income.periodEnd`, `income.periodMonths` | `incomeRows` | incomeRows.* |
| `income_aggregation` | P3 | `income.payerIdentityId`, `income.aggregationTreatment`, `income.recurring`, `context.filingPeriod`, `context.inventoryComplete.income` | `incomeGroups`, `monthlyIncomeWon` | incomeGroups.*, monthlyIncomeWon |
| `debt_total` | P3 | `debt.creditor`, `debt.contractId`, `debt.principal`, `debt.interest`, `debt.asOf`, `context.inventoryComplete.debt` | `debtRows`, `debtPrincipalWon`, `debtInterestWon`, `totalDebtWon` | debtRows.*, debtPrincipalWon, debtInterestWon, totalDebtWon |
| `debt_cap` | P3 | `debt.secured`, `debt.classification`, `debt.guaranteeDetails`, `context.applicationDate`, `context.asOf`, `context.ruleReleaseId` | `securedDebtWon`, `unsecuredDebtWon` | securedDebtWon, unsecuredDebtWon |
| `asset_liquidation` | P3 | `asset.grossValue`, `asset.ownershipBps`, `asset.securedPayoff`, `asset.securedPayoffScope`, `asset.disposalCosts`, `asset.protectedValue`, `asset.asOf`, `asset.valuationBasis`, `context.inventoryComplete.asset` | `assetRows`, `liquidationValueWon` | assetRows.*, liquidationValueWon |
| `available_income` | P3 | `household.recognizedLivingCost`, `household.additionalLivingCost`, `household.livingCostIncludesAdditional` | `recognizedLivingCostWon`, `disposableIncomeWon` | recognizedLivingCostWon, disposableIncomeWon |
| `ordinary_budget` | P3 | `context.monthlyTrusteeFee`, `context.monthlyPriorityPayment`, `context.monthlyEstatePayment`, `context.approvedMonthlyPayment` | `ordinaryRepaymentBudgetWon`, `monthlyPaymentWon` | ordinaryRepaymentBudgetWon, monthlyPaymentWon |
| `nominal_plan` | P3 | `context.planMonths` | `planTotalWon` | planTotalWon |
| `allocation` | P3 | `debt.priority`, `debt.classification`, `context.allocationBasis`, `context.allocationBasisReviewed` | `allocations` | allocations.* |
| `liquidation_comparison` | P3 | `context.approvedPresentValue`, `context.presentValueBasis`, `context.presentValueReviewed`, `context.assetValuationBasisReviewed` | `presentValueWon`, `liquidationComparison` | presentValueWon, liquidationComparison |
| `disposal_conservation` | P3 | `saleAmount`, `securedPayoff`, `costs` | `saleWon`, `payoffWon`, `costsWon`, `netProceedsWon`, `successorCashWon`, `shortfallWon`, `conserved`, `status` | 별도 disposalResults 경로 확인 |
| `payment_schedule` | P3/P5 | `context.paymentSchedule.phases`, `context.paymentSchedule.expectedInstallments` | `status`, `rows`, `totals`, `phaseTotals`, `issues` | 별도 schedule, planLedger 경로 확인 |
| `living_cost_proposal` | P3/P4 | `context.applicationDate`, `context.courtId`, `household.recognizedMembers`, `household.additionalLivingCost` | `livingCost` | proposals.livingCost.* |
| `objection_minimum` | P4 | `context.planApprovalDate`, `context.ruleReleaseId`, `context.courtObjection`, `claims.presentValue`, `plan.repaymentPresentValue`, `context.approvedPresentValue`, `context.presentValueReviewed` | `objectionMinimum` | proposals.objectionMinimum.* |
| `seoul_short_term` | P4 | `context.courtId`, `context.applicationDate`, `context.planMonths`, `vulnerable.wageHistory`, `debts.total`, `debts.privateCreditors`, `debts.lastYearDebt`, `applicant.age`, `legal.seoul424.statutory_severe_disability`, `household.minorChildren`, `household.singleParent`, `rentalFraud.officialDecision` | `termCandidate` | proposals.termCandidate.* |
| `transaction_review` | P2/P3 | `transaction.date`, `transaction.accountId`, `transaction.counterparty`, `transaction.amount`, `transaction.direction`, `transaction.kind`, `transaction.relatedObjectId` | `items`, `transferCandidates`, `coverage`, `totals`, `policy` | 별도 transactionReview 경로 확인 |
| `form_projection` | P4/P5 | `asset.kind`, `income.kind`, `context.monthlyTrusteeFee`, `context.planMonths` | `formBindings` | 별도 formBindings + case_document_field_values |
| `installment_distribution` | P5 | `context.planMonths`, `context.paymentSchedule` | `documentPayloads` | 별도 documentPayloads + artifacts |

## 실제 호출 및 결손 확인

1. `GET /api/cases/:id/approval-readiness?expectedRevision=N` → `stageAudit.stages[2].allModules`를 조회한다.
2. 모든 모듈의 `declaredInputs[].path`, `lookup`, `observation`, `values[].factIds`를 대조한다. 빈 문자열·null·상충 값은 0원/확정값으로 치환하지 않는다.
3. `declaredOutputs[].storedRows[].outputName`, `outputPath`, `status`, `sourceFactIds`, `formula`, `value`를 저장된 계산 실행 ID로 조회한다.
4. 선택된 모듈 중 저장값을 찾지 못한 경우 `missingSelectedModuleIds`를 확인한다. SQL 저장명과 계산 계약명이 다른 `proposals.*` 세 모듈은 별도 물리명 매핑을 적용한다.
5. `case_calculation_heads`/`case_calculation_runs`의 case revision, data version, input SHA, reference SHA 일치를 먼저 확인한다. 핵심 계산 결과는 별도로 재실행하여 금액/계산상태를 대조한다.
6. 거래·처분·일정·서식 결과가 SQL 계산 피처에 없다면 **다른 저장 위치의 해당 실행 run과 실제 결과를 검증**해야 하며 `실행 안 됨` 혹은 `완료`로 단정하지 않는다.

```sql
SELECT calculation_id, output_name, output_path, subject_id, row_ordinal,
       value_json, status, source_fact_ids_json, input_refs_json, formula
FROM case_calculation_features
WHERE run_id = :current_calculation_run_id ORDER BY id;
```

**등록 현황:** 18 모듈, 입력 선언 합계 91개, 서로 다른 입력 경로 78개, 출력 선언 합계 42개. 자동으로 18개 실행 완료라고 표시하지 않는다.
