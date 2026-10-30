# 인가 전 P1~P5 — 법령·법원 실무준칙·공개 판례 기반 사례 실행 매트릭스

작성일 2026-10-30. 대상: FirmEngine `ax-site`의 인가 전 자료·법률·계산·보완 전 과정.

## A. 사용 데이터 및 규칙의 통합 범위

기존 데이터/코드 **보존**: 상담 85종, OCR canonical 693 필드, 46 워크플로, 18개 계산 모듈·91개 입력 사용(78개 고유), 법률 규칙 50개, 위험 체크 95개, 예외 카탈로그 46개. **카탈로그 존재가 실행 완료나 법적 적합성의 증거는 아니다.**

| 단계 | 실제 저장·읽기 경로 | 확인해야 할 결과와 역질문 |
|---|---|---|
| P1 상담·필수서류 | `consultation_heads`, `case_document_requirements`, `case_requirement_field_plans`, `case_document_work_events`, `cases.payload.workflowState`, `caseRequirementMonitor()` | 85 서류별 대상·기간·원문 OCR 후보와 실제 접수/확정/갈음 상태. 상담 결과 미연계·미접수·불명확은 완료 금지 |
| P2 원문·피처 무결성 | `inspectPreapprovalOcrStorage()` (D1 `case_extraction_heads` + `extraction_runs` + `extraction_field_coverage` + `documents`의 현행원본 SHA) 및 `cases.payload.facts`, `currentFacts()`, `factSourceLineageIssues()` | 693 canonical ID 전수 레지스트리, 실제 OCR row/page/대상/기간/원본 SHA, verified vs accepted, 중복·상충·누락 |
| P3 계산과 저장 원장 | `executeCaseNodes()`, `getCalculationSpecs()`, `case_calculation_heads/runs/features`, `calculationFeatureRows()` | 18×91 사용 입력→출처 Fact→BigInt 산식→42 출력 선언/실제 SQL row; 선택된 모듈 미적재는 `not_persisted`, 결손 숫자=0 금지 |
| P4 법률·인가요건 | `listCaseLawgraphReview()`, `legalEvidenceInventory()`, `case_legal_review_runs`, `case_legal_conditions`, 법률 규칙 50·위험 95·예외 46 | 제614조 법적 적합·공정/형평·수행가능·비용납부·청산가치, 이의 시 추가 조건; 확인된 값과 판본·관할/시행일 대조 후 변호사 검토 |
| P5 실제 보정·응답 | `cases.payload.workflowState.procedureEvents`, `auditPreapprovalCourtCorrections()` | 법원 원본명령 존재 → 요청 항목 분리 → 보완 사실 → 주문별 기한 → 접수증/재보정 → 담당 변호사 적합성. **내부 예상 보완과 실제 법원 주문 분리** |

## B. 바로 호출 가능한 단일 API와 테스트

```bash
cd "prototypes/Daeseong Ray Yang/firmengine-proto/ax-site"
npm ci
node scripts/run-preapproval-regressions.mjs
node scripts/run-preapproval-regressions.mjs --full
```

```http
GET /api/cases/{id}/approval-readiness?expectedRevision={current_revision}
```

응답 구조: `stageAudit.stages[0..4]`, `stageAudit.coverage`, `stageAudit.stages[2].allModules`, `stageAudit.stages[4].courtOrderAudit`, `storedOcrCoverage`(현재 실제 OCR D1 관측), `judgmentGraph`, `evidence.featureInventory`, `calculation.traces`, `legalReview`, `dependencyFailures`. 조회는 read-only, 기존 DB·판단·사람 법률승인은 수정하지 않음.

## C. 공식 자료에 바탕을 둔 합성 사건 42개 — 규칙 및 계산 input/output 1:1 경로

각 사례의 `calculation`은 반드시 현재 `reference-decision-tables.json`의 모듈 ID·입력 ID·출력 ID에 존재해야 한다. 사례 자체는 판례 수치의 사실 재현이 아니다.

| ID | 단계 | 법률 규칙/예외 | 계산모듈: 입력→출력 | 공식 자료 키 | 검증 주제 |
|---|---|---|---|---|---|
| S01 | P1_DOCUMENTS | KR-PR-011 / EL-42 | 법령/증거 별도 검토 | ACT589 | 법 제589조에 따른 기본 첨부서류와 신청서 피처 대조 |
| S02 | P1_DOCUMENTS | KR-PR-009 / EL-33 | 법령/증거 별도 검토 | ACT589 | 신청 전 10년 관련 절차자료(신청 사실/사건/종국일) 조사 |
| S03 | P1_DOCUMENTS | KR-PR-008 / EL-33 | 법령/증거 별도 검토 | ACT595 | 면책일/최근 5년 기각 검토, 재신청 자체로 자동 불성실 판단 금지 |
| S04 | P1_DOCUMENTS | KR-PR-014 / EL-42 | `income_average`: `income.net` → `incomeRows` | SUWON402_431_2025 | 수원 2025 준칙 제402호 급여자료 기본·갈음 경로; 2026 현행판 적용 별도 확인 |
| S05 | P2_EVIDENCE | KR-PR-014 / EL-42 | `income_average`: `income.net` → `incomeRows` | ACT589 | 급여명세 OCR 추출됐어도 지급자/월/실수령 사실과 법적 인정은 분리 |
| S06 | P2_EVIDENCE | KR-PR-016 / EL-19 | `income_average`: `income.expenses` → `incomeRows` | ACT579 | 사업 총매출·필요비·순소득 중복 및 기간 일치 |
| S07 | P2_EVIDENCE | KR-PR-020 / EL-45 | `income_aggregation`: `income.payerIdentityId` → `monthlyIncomeWon` | ACT579 | 급여 입금·자기이체·차입금 중복소득 검출 |
| S08 | P2_EVIDENCE | KR-PR-027 / EL-28 | `asset_liquidation`: `asset.grossValue` → `liquidationValueWon` | ACT614 | 보험 가입과 해약환급금 및 보험대출을 별도 출처로 확인 |
| S09 | P2_EVIDENCE | KR-PR-028 / EL-16 | `asset_liquidation`: `asset.ownershipBps` → `liquidationValueWon` | ACT614 | 배우자 명의 재산을 자동 채무자 지분으로 판단하지 않음 |
| S10 | P2_EVIDENCE | KR-PR-010 / EL-30 | `debt_total`: `debt.contractId` → `totalDebtWon` | ACT589 | 채권양도·대위변제에 따른 채권자 동일성과 중복 원금 확인 |
| S11 | P3_CALCULATIONS | KR-PR-006 / EL-04 | `debt_cap`: `debt.secured` → `securedDebtWon` | ACT579 | 담보부 채무 15억원 기준 및 이중 계산/시점 분리 |
| S12 | P3_CALCULATIONS | KR-PR-007 / EL-05 | `debt_cap`: `debt.classification` → `unsecuredDebtWon` | ACT579 | 무담보 채무 10억원 기준 및 분류 미확정 보류 |
| S13 | P3_CALCULATIONS | KR-PR-010 / EL-06 | `debt_cap`: `debt.guaranteeDetails` → `securedDebtWon` | ACT579 | 보증·연대채무를 주채무 잔액과 중복 합산 금지 |
| S14 | P3_CALCULATIONS | KR-PR-015 / EL-20 | `income_aggregation`: `context.filingPeriod` → `monthlyIncomeWon` | ACT579 | 신규취업 12개월 전자료와 대표기간의 기간 차이 |
| S15 | P3_CALCULATIONS | KR-PR-021 / EL-17 | `available_income`: `household.recognizedLivingCost` → `disposableIncomeWon` | ACT579 | 가구원 증빙 및 생계비 인정이 계산 결과에 미치는 영향 |
| S16 | P3_CALCULATIONS | KR-PR-024 / EL-41 | `available_income`: `household.additionalLivingCost` → `recognizedLivingCostWon` | ACT579 | 월 25만원 의료비 가정은 원본 변경 없이 시뮬레이션 |
| S17 | P3_CALCULATIONS | KR-PR-036 / EL-07 | `ordinary_budget`: `context.monthlyPriorityPayment` → `ordinaryRepaymentBudgetWon` | ACT611_614 | 조세 우선권·월 변제예산 누락/0 구분 |
| S18 | P3_CALCULATIONS | KR-PR-035 / EL-08 | `ordinary_budget`: `context.monthlyEstatePayment` → `ordinaryRepaymentBudgetWon` | ACT611_614 | 재단채권 지급은 일반채권 배분과 구분 |
| S19 | P3_CALCULATIONS | KR-PR-032 / EL-11 | `asset_liquidation`: `asset.securedPayoffScope` → `liquidationValueWon` | ACT614 | 공유 담보물 상환액 귀속과 청산가치 계산 |
| S20 | P3_CALCULATIONS | KR-PR-030 / EL-23 | `disposal_conservation`: `saleAmount` → `netProceedsWon` | ACT614 | 재산매각 대금·비용·담보상환과 잔존재산 연결 |
| S21 | P3_CALCULATIONS | KR-PR-048 / EL-38 | `ordinary_budget`: `context.approvedMonthlyPayment` → `monthlyPaymentWon` | ACT614 | 제안 변제금이 미확정 소득·생계비를 우회할 수 없음 |
| S22 | P3_CALCULATIONS | KR-PR-041 / EL-38 | `nominal_plan`: `context.planMonths` → `planTotalWon` | ACT611_614 | 36개월/예외기간·명목 총액과 PV를 구분 |
| S23 | P3_CALCULATIONS | KR-PR-043 / EL-37 | `liquidation_comparison`: `context.approvedPresentValue` → `liquidationComparison` | ACT614 | 청산가치 현재가치 비교 미달을 법원 기각확정으로 표시하지 않음 |
| S24 | P4_LEGAL | KR-PR-044 / EL-36 | `objection_minimum`: `context.courtObjection` → `objectionMinimum` | ACT614 | 이의 여부 확인 근거 없이 제614조 제2항을 비해당 처리 금지 |
| S25 | P4_LEGAL | KR-PR-045 / EL-36 | `objection_minimum`: `claims.presentValue` → `objectionMinimum` | ACT614 | 이의 사건의 채권 총액 PV와 변제 PV 분리 |
| S26 | P4_LEGAL | KR-PR-042 / EL-35 | `seoul_short_term`: `applicant.age` → `termCandidate` | SEOUL424_20261001 | 서울 2026.10.1 단축 후보 - 청년 여부/인가요건은 별도 승인 |
| S27 | P4_LEGAL | KR-PR-042 / EL-35 | `seoul_short_term`: `vulnerable.wageHistory` → `termCandidate` | SEOUL424_20261001 | 신규 취약채무자 단축 후보: 2년 임금·채무 5천만원·개인채권자·최근 차입 |
| S28 | P4_LEGAL | KR-PR-046 / EL-39 | 법령/증거 별도 검토 | ACT614 | 인가 전 비용·수수료 납부 영수증 부재 시 자동 통과 금지 |
| S29 | P4_LEGAL | KR-PR-048 / EL-44 | `payment_schedule`: `context.paymentSchedule.phases` → `status` | CASE2023MA6207 | 급여 압류적립액이 있는 경우 납입지연만으로 수행불능 단정 금지 |
| S30 | P4_LEGAL | KR-PR-008 / EL-33 | 법령/증거 별도 검토 | CASE2011MA201 | 과거 기각 횟수만으로 신청 불성실 단정 금지 |
| S31 | P4_LEGAL | KR-PR-040 / EL-31 | `allocation`: `debt.priority` → `allocations` | ACT614 | 동종 채권 변제 형평·별도 채권 분류 확인 |
| S32 | P5_CORRECTIONS | KR-PR-047 / EL-42 | 법령/증거 별도 검토 | ACT610_614 | 변제계획 제출 14일/법원 연장/수정 명령 기한은 근거 문서 확인 |
| S33 | P5_CORRECTIONS | KR-PR-049 / EL-42 | 법령/증거 별도 검토 | ACT595 | 실제 법원 보정명령 원문·항목·기한·응답·접수 확인 분리 |
| S34 | P5_CORRECTIONS | KR-PR-038 / EL-36 | `installment_distribution`: `context.paymentSchedule` → `documentPayloads` | SUWON402_431_2025 | 수원 2025 준칙 제431호 집회 후 이의 답변서/미송달/변경 송달 확인 |
| S35 | P5_CORRECTIONS | KR-PR-048 / EL-44 | `payment_schedule`: `context.paymentSchedule.phases` → `status` | CASE2023MA6207 | 인가 전 적립금 미납과 압류보관 급여의 수행가능성 대조 |
| S36 | P5_CORRECTIONS | KR-PR-049 / EL-42 | 법령/증거 별도 검토 | SUWON402_431_2025 | 법원 보정명령은 실제 발부가 없는 한 내부 예상 쟁점과 구분 |
| S37 | P2_EVIDENCE | KR-PR-029 / EL-22 | `asset_liquidation`: `asset.valuationBasis` → `assetRows` | ACT614 | 투자 손실과 현재 잔존 투자자산 0원을 동일시 금지 |
| S38 | P3_CALCULATIONS | KR-PR-048 / EL-34 | `payment_schedule`: `context.paymentSchedule.expectedInstallments` → `phaseTotals` | ACT611_614 | 계절 소득과 불균등 납입계획의 월별 지급 가능성 |
| S39 | P4_LEGAL | KR-PR-022 / EL-17 | `living_cost_proposal`: `household.recognizedMembers` → `livingCost` | ACT579 | 단순 동거를 실제 부양으로 인정하지 않고 부양·소득 자료 요청 |
| S40 | P4_LEGAL | KR-PR-045 / EL-36 | `objection_minimum`: `plan.repaymentPresentValue` → `objectionMinimum` | ACT614 | 변제계획 PV·채권 PV·적용시점 구분 |
| B01 | P2_EVIDENCE | KR-PR-020 / EL-45 | `transaction_review`: `transaction.amount` → `items` | ACT579 | 계좌 거래를 급여·자기이체·차입과 연결해 중복 소득 반영/미관측을 구분, transaction_review output items 및 거래원장 증거 요구 |
| B02 | P5_CORRECTIONS | KR-PR-011 / EL-42 | `form_projection`: `context.planMonths` → `formBindings` | ACT589 | 제589조 제출서류의 서식필드와 계산원장의 원문·서식 토큰 연결, form_projection output formBindings 가 D1 계산 피처에 누락되면 기존 서식엔진에서 별도 조회하며 미연결을 차단 |

이 42개 경로는 **18개 계산 모듈 ID를 모두 1회 이상 참조**한다. 50개 법률규칙 및 46 예외 각각의 심층 사건 테스트를 전부 구현한 것은 아니다. 범위 밖인 면책/인가 후 절차 예외를 현재 업무에 자동 적용하지 않는다.

## D. 대법원 3개 판례: 자동 오판 방지의 테스트 가드

- **SUP-2015MA657**: 보정에 일부 응했으나 추가 보정이 필요한 경우, 미흡 사실만으로 즉시 신청 불성실·기각이라고 자동 판정하지 않음 (원문: https://law.go.kr/LSW/precInfoP.do?precSeq=179701). 근거 확인항목: court_order_original_document, itemized_correction_response, court_reconsideration_or_hearing, counsel_review. 금지 오판: automatically_dismissed, court_approval_granted
- **SUP-2026MA6688**: 과거 개인회생 기각·폐지 반복 외에 현재 계속소득, 미납경위, 채권자 회수, 변동된 재산과 신청 목적 조사 (원문: https://sc.scourt.go.kr/portal/news/NewsViewAction.work?gubun=4&pageIndex=1&seqnum=11325&type=0). 근거 확인항목: prior_case_outcomes_and_reasons, current_wage_continuity, payment_failure_reasons, creditor_recovery_since_prior_case, financial_change. 금지 오판: automatic_bad_faith, automatically_dismissed, court_approval_granted
- **SUP-2023MA6207**: 인가 전 급여 압류/추심명령의 경우 적립금을 납부하지 않았다는 사정만으로 변제계획 수행 불가능 확정하지 않음 (원문: https://www.scourt.go.kr/portal/news/NewsViewAction.work?gubun=4&seqnum=9488). 근거 확인항목: wage_attachment_order_date, commencement_decision_date, employer_retained_wages, plan_start_after_approval, ability_to_pay. 금지 오판: automatically_infeasible, court_approval_granted

법률 적용판본: 국가법령정보센터의 채무자회생법 **2026-10-02 시행** 여부와 사건 신청일을 확인한다. 2026-10-01 **서울** 단축 변제기간 실무준칙 개정과 **수원** 2025-10 실무준칙 PDF의 제402/431호는 서로 다른 관할/시행 기준이므로 자동 혼합하지 않는다.

## E. 실제 완료/미완료

- ✅ **Node v22.16 격리 테스트**: 신규 순수 분석모듈 38/38 통과. 실제 GitHub 저장소의 과거 모든 테스트를 실행했다는 주장은 아님.
- ✅ GitHub 원본 등록 데이터 읽기 교차감사: 85/693/18×91/42/50/95/46 등록 수와 42 사례의 모든 법률규칙·예외·계산 ID/입력/출력 대조(미연결 ID 0건).
- 🟡 전체 저장소에서 `npm ci`, source check, lint, build, 전체 단위회귀, 기존 golden/OCR 18모듈 실제 실행: **아직 실행 인증 없음**.
- 🟡 운영 D1/R2와 실제 모델/OCR/법원 보정 원문: 이번 테스트 **미접근**. 추가 통합 테스트와 담당 변호사의 인가 실무 검수가 필수.
- 🟡 P5 현재는 보정명령 원문 이벤트와 요청 필드의 존재·출처를 검수하나, 보정명령의 실제 항목·기한을 주문별 데이터로 정식 구조화하는 업무계약은 미구현. 기간을 추정하거나 접수된 것으로 자동 간주하지 않음.
- 🟡 이 42+3 시나리오는 법원 인가를 예측하거나 법률 결과를 자동 확정하지 않음. 인가 관련 보완 위험과 증거/계산 검토를 제시하는 역할만 수행.

## F. 다음 인수 순서

1. 기존 `case_calculation_features`에 직접 적재되지 않는 `transactionReview`·`disposalResults`·`schedule`·`formBindings`·`documentPayloads`의 run/저장/후속 소비처를 DB와 서식 원장에서 실제 대조한다.
2. 95개 위험별 승인 evidence route 미정의 항목에 대해 관할·시행일·법령 원문·필수 canonical OR 피처·계산값을 변호사가 승인한다.
3. P5 법원 주문별 원본 항목·기한·보완 문서·답변 제출·접수증을 고유 ID에 연결하고 독립 회귀 테스트한다.
4. 모든 판본변경/후속 보완이 관련 쟁점만 재평가되도록 실행 DAG, 독립 검수·시뮬레이터를 단계적으로 운영 연결한다.

기본 규칙: 기존 계산/법률/서류 생성 흐름 무변경, 저장된 실제 Fact와 가정값 분리, 법률판단/인가 책임은 변호사와 법원에 유지.

## G. P2 운영 원본 OCR 실제 DB 교차대조 신규 적용

- `lib/preapproval-ocr-storage-audit.ts`는 **현재 활성 문서 ID**로만 `case_extraction_heads`를 찾고, `extraction_runs.stage='committed'` 및 DB 원본 SHA와 현재 사건 문서 SHA를 확인한다. 증빙 페이지 누락 또는 변경된 SHA는 `source_integrity_or_page_gap`으로 보고한다.
- 각 문서의 `extraction_field_coverage`를 실제 저장된 canonical ID 단위로 집계하여 `storedOcrCoverage.byCanonicalField[].schemaSlots/observed/requiresReview/notObservedSlots`를 반환한다. 등록된 693 ID 전체를 필수라 오인하지 않고 **현재 문서 OCR 스키마에 적용된 필드만 관측**한다.
- 알 수 없는 canonical ID, 삭제된 문서/비활성 head, 예상 증빙 페이지 OCR 누락, 쿼리 오류는 fail closed. OCR 원문값이 검증된 Fact로 자동 승격되거나 법원 보정 충족으로 인정되지 않는다.
- 관련 테스트 `tests/preapproval-ocr-storage-audit.test.ts` 6개를 추가했다. 격리 모듈 테스트 포함 총 38개 통과; 실제 운영 D1 쿼리 실행 인증은 여전히 없음.
