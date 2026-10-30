# FirmEngine 계산 18모듈 — 입력/산식/출력 정합성 점검 기록

기준: 2026-10-30, GitHub \`main\` 소스와 연결된 별도 계산 MCP의 실응답. **법원 인가 판단이나 18모듈의 전부 통과 인증이 아니다.**

## 범위와 검증방법

- 소스 계약: \`reference-decision-tables.json\`의 18개 \`calculations\` + \`execution-catalog.ts\`.
- 입력: \`extracted_features\`의 canonical field ID/기재상태/단위/원문행 → \`extraction.ts:projectPage\` → \`domain.ts:applyExtraction\` → \`assessment.ts:calculateCase\` → \`case-calculation-feature-store.ts\` → \`form-mapping.ts\`.
- **실제로 이번 대화에서 실행한 독립 산술 확인:** 현재 GitHub 함수 본문을 격리 JS V8로 실행(원래 수식 그대로, 일부 타입표기 제거, 참조함수는 대응 구현으로 주입) 65개 사례, 기대값 일치 65건. 그중 \`monthlyIncome\`, \`allocateProRata\`, \`calculateDisposal\`, \`liquidationContribution\`의 산식 본문 21건, 제614조 이의사건 후보 9건, 서울 424 후보 조건 9건, 생계비 기준표 6건, 지분/날짜/출처형식 20건이다.
- **실제 서비스 계산 API에 호출한 사례:** \`calculate_disposal\`에 합성 NumericInput 3건을 전송하여 3건 모두 기대 금액/상태와 일치했다. 이는 현 배포판 \`case-execution/1.2.0\`의 처분계산만 증명하며 GitHub 최신 전체 코드의 동작 검증은 아니다.
- **작성하여 main에 추가한 자동 테스트**는 이 문서에 나열하지만, 이번 세션의 컨테이너가 GitHub 네트워크/D1 런타임에 접근하지 못하므로 **Node/TypeScript 전체 회귀시험을 실행한 기록은 없다**. 파일 존재·코드 검사와 테스트 통과는 별개다.

| No. | 모듈 | 계산용 실제 입력 인자 | 기대되는 결과·테스트 케이스 | 확인 수준 / 남은 위험 |
| ---: | --- | --- | --- | --- |
| 1 | income_average | \`income.net/gross/expenses/amountBasis/periodStart/periodEnd/periodMonths\` | 900만원/3개월 → 월 300만원; 기간불명·월급/공제 불일치 → null | **격리 실행 통과 7건**. 부분월인데 periodMonths=1을 임의 부여해 계산하던 우회 경로 수정; 통합 회귀 미실행 |
| 2 | income_aggregation | \`payerIdentityId/aggregationTreatment/filingPeriod\`, 월별 SourceRow | 같은 확인된 지급자의 200만+250만/2개월 → 월평균 225만원; 이름만 일치하면 보류 | 관련 계산 구현/테스트 추가. **전 통합 실행 미완료** |
| 3 | debt_total | \`creditor/contractId/principal/interest/asOf\`, 합계/비용 원문 | 원금 100만, 이자 3만 → 103만원; 최초원금 사용 금지; 별도 비용은 자동 가산 금지 | total_claim/fees canonical key 누락 보완. 다중 원문/DB 재현 테스트 추가; **통합 실행 미완료** |
| 4 | debt_cap | \`secured/classification/guaranteeDetails/asOf/applicationDate\` | 명시 무담보 1억원/담보 0원. 미분류/중복보증은 확정 불가 | 합성 golden 테스트 추가, 실제 운영 케이스 테스트 필요 |
| 5 | asset_liquidation | \`grossValue/ownershipBps/securedPayoff/securedPayoffScope/disposalCosts/protectedValue/asOf\` | 100만원×50%−10만원−1만원=39만원. 담보범위 미확인·비용누락 → null | **격리 실행 통과 7건**. 정확 지분 비율 처리 보완. 현업 법률 분류 별도 필요 |
| 6 | available_income | \`monthlyIncomeWon/recognizedLivingCost/additionalLivingCost/IncludesAdditional\` | 300만원−150만원=150만원. 포함된 추가비용 재차 차감 금지 | 합성 golden 테스트 작성, 전체 실행 미완료 |
| 7 | ordinary_budget | \`disposableIncomeWon/monthlyTrusteeFee/monthlyPriorityPayment/monthlyEstatePayment\` | 150만원−0−0−0=150만원 | 합성 golden 테스트 작성, 전체 실행 미완료 |
| 8 | nominal_plan | \`monthlyPaymentWon/planMonths\` | 100만원×36개월=3600만원. 가변구간 일정이 있으면 reconciliation 별도 필요 | 합성 golden 테스트 작성, 전체 실행 미완료 |
| 9 | allocation | \`allocationBasis/ordinary debt principal/interest/planTotalWon\` | 원금 우선/비례배분 합계 보존; 2원/3명 1,1,0 | **격리 원금비례 배분 통과 4건**, 전체 배분/우선·재단채권 golden 미실행 |
| 10 | liquidation_comparison | \`approvedPresentValue/presentValueBasis/presentValueReviewed/liquidationValueWon\` | 별도 PV 3000만원 대 청산가치 100만원 → 비교차 2900만원, met | **미실행 golden**. **현재가치 PV는 자체 할인현금흐름 계산이 아니라 검토·승인된 사건 입력값**이다. PV 산출근거가 없으면 자동 확정 금지 |
| 11 | disposal_conservation | \`saleAmount/securedPayoff/costs\` | 100만원−30만원−10만원=60만원. 100만−110만−10만=−20만, 부족 20만. 결측→null | **실제 연결 계산 도구 3/3 통과** + 격리 함수 3/3 통과 |
| 12 | payment_schedule | \`paymentSchedule.phases/expectedInstallments\` | 36회차, 월별 배분/회차중복/비용, 원장합계 일치 | 별도 \`repayment-plan-model.test.ts\` 기존 테스트와 신규 golden 추가, 전체 실행 미완료 |
| 13 | living_cost_proposal | \`year/courtId/recognizedMembers/additionalExpenseWon\` | 서울 2026 1인가구 기준중위소득 2,564,238원의 60%=1,538,542.8원(아직 법원 인정액 아님) | **격리 실행 6/6 통과** (2026 표/관할/인원 검증), 서식 및 사건 인정 조건 별도 |
| 14 | objection_minimum | \`planApprovalDate/claims PV/plan PV/creditor objection\` | 청구 PV 4999.9만원: 5%=249.995만원; 5000만원: 3%+100만원=250만원; 30백만원 상한 | **격리 실행 9/9 통과**. 제614조 판본·인가일 근거 확보 필요 |
| 15 | seoul_short_term | \`court/applicationDate/planMonths\` 및 법정 특정 사실·기간·채권 조건 | 관할 제외/시행일 이전/7호 누적조건/증거누락 상태 구분 | **격리 실행 9/9 통과**, 현행 서울 424호 적용판본·경과규정 별도 법률 검토 |
| 16 | transaction_review | \`transaction.date/accountId/amount/direction/kind\` | 2026-10-27T17:20+09:00 → 2026-10-27 거래일; 원문 전체 타임스탬프 보존 | 날짜-시간 표현 불일치 수정, OCR/실물 DB 회귀 테스트 추가, 전체 실행 미완료 |
| 17 | form_projection | \`calculateCase\` 출력값, 서식토큰, 월별 원문 출처 | D5103 월별 정액을 연간 합계와 혼동 금지; D5106 원금과 이자; D5110 월액 | 기간형식 V8 검증, 원천 \`incomeRows\` 기준으로 중복 제거, 정렬/출력 tests 작성(미실행) |
| 18 | installment_distribution | \`planMonths/paymentSchedule\`, \`allocation\` | 원금·이자·회차별 잔액과 합계 보존, 누락/중복시 차단 | 기존 \`repayment-plan-model.test.ts\`와 신규 golden 작성, **전체 실행 미완료** |

## 이번 수정에서 재현·발견해 차단한 연결 결함

1. **OCR 표준 키가 실제 금액으로 연결되지 않는 문제**: \`payroll_payslip::income.payroll.net_pay\` 등 명시적 canonical binding 사용; 알 수 없는 ID는 계산/사실키에 위장하지 않고 원문 격리.
2. **동일 기간 계좌거래의 datetime → date 불일치**: 원문 \`transaction_datetime\` 은 Fact에 보존하고 계산 객체의 \`Transaction.date\` 는 실제 거래일만 사용. 거래 대조도 같은 기준.
3. **채무증명서 합계/비용이 계산검증에서 탈락**: \`total_claim → debt.total\`, \`fees → debt.costs\` 를 연결하여 원금+이자와 대조; 추가 비용의 법적 산입은 수동검토.
4. **재산 지분 \`ownership_share\` 미연결**: 문서 원문의 명시적 퍼센트/분수/비율만 정수 bps로 변환; bare 숫자/순환소수·비정확 지분은 보류.
5. **부분월인데 \`periodMonths:1\` 기재해 월 평균을 산출하는 위험**: 부분/잘못된 명시기간은 \`INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS\` 로 null 처리.
6. **동일 업체 월별 급여의 잘못된 중복 합산·누락**: 명시적 동질성 검토 전 회사 이름만으로 병합하지 않음; 매 기간 검토한 연속 월평균만 허용.
7. **12개월 연간소득을 D5103 1개월 금액으로 잘못 기재**: 단일 완전 달력월·엔진 \`monthlyWon\` 값만 기재, 나머지는 확인필요·최종 차단.
8. **계산에서 제외된 중복 급여행이 서식에 재등장**: \`rows.month\` 와 편집용 안정 행 ID를 \`calculation.incomeRows\` 에 연결.

## 작성한 테스트·실행 상태

- \`tests/ocr-calculator-input-integration.test.ts\`: 실제 표준 \`PageRead\` → \`projectPage\` → \`applyExtraction\` → \`calculateCase\` 테스트.
- \`tests/extraction-row-store.test.ts\`: SQLite/D1 호환 모의 DB에 원문행과 피처 저장·조회 후 재투영하여 동일 회사 2개월 급여 200만원·250만원, 수동 월별 검토 뒤 225만원 계산을 기대하는 테스트. 무단위 금액 보류도 검사.
- \`tests/calculation-18-output-golden.test.ts\`: 18개 계산 계약과 핵심 수입/채무/재산/변제/법률후보/문서 출력 golden 예상값.
- \`tests/form-month-calculation-integrity.test.ts\`: D5103 기간, 연간·부분월 오기재 차단, 계산 소득행과 문서행의 동일성.
- **상기 GitHub 테스트 파일은 추가·수정했지만 실행하지 못했다**. 실행 전이므로 “전체 통과”, “법적 정확도 99%” 등의 주장은 하지 않는다.

## 반드시 남겨둘 P0/P1 문제

- 현재 계산에 필요한 OCR 키가 계약에 없는 600개 이상 필드의 모든 법률·대상·금액 소비처를 법률전문가 검수 없이 무조건 자동산입해서는 안 된다.
- \`presentValueWon\` 은 실제 할인율·지급일·채권자별 배분을 독립 산출하는 엔진이 **아니다**. 현재는 사건의 \`approvedPresentValue\` / 근거/검토 상태를 이용하므로 PV 산출 방식 자체의 독립 검증이 필요하다.
- 소득과 증빙의 **최대 12개월 범위** 및 급여 대체 6개월 조건 등 관할·서류 종류별 필수 조사기간, 정부발급일, 담보·우선채권·세금 채권 개별 산정은 별도 조건부 검토가 필요하다.
- 법률상 서류 작성 완결·법원 전자소송 형식 일치·인가 여부는 숫자 산식과 구분한다.

실측 상태를 다시 확인하려면 실제 운영 D1 마이그레이션 적용 상태, 소득·채무·재산 파일 정답셋, 별도 CI 또는 테스트 가능 머신에서 \`npm ci\` 이후 전체 Node 테스트를 실행해야 한다.
