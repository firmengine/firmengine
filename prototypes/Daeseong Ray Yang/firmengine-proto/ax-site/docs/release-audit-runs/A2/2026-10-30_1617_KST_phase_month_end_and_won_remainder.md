# A2 4차 — 월말 변제일 단계 분할 불변성 및 원단위 잔여원 감사 (2026-10-30 16:17 KST)

## 1. 범위·동시 작업 인계

- 제한 디렉터리: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 최신 감사 시작 GitHub main `19d54c2eac4d9dad8b31b98c04181ada321ce261`; 이 영수증 작성 직전 main `19d54c2eac4d9dad8b31b98c04181ada321ce261` 재확인.
- 이전 A2 3차 `2026-10-30_1513_KST_d5103-empty-month-sql-18calc.md`를 인수. A1/A3/A4의 최근 커밋 및 타인의 Draft PR #13·#18·#21·#22·#23·#24를 확인하고 충돌 파일을 덮어쓰지 않았다.
- 이번 고유 체크: **A2-CALC-026**, **A2-DOC-005**, **A2-DATA-023**, **A2-IT-007**, **A2-AX-015**. 계산사무장→서류담당자→데이터→IT→AX 5역할 순환. 모두 **[ ] 부분검증 / 제품 RELEASE_READY 0건**.

## 2. P1 실제 소스 산술 불일치 — 변제 단계를 2개로 나눴더니 변제일이 사흘 앞당겨짐

**현재 main 원본 코드/해시:** `lib/payment-schedule.ts` c75c310ab32d17268ad0e6130864278e918a54f4, `lib/repayment-plan-model.ts` 6b9e53caba3be1eab17373956aa19717cfeec980, `lib/context-validation.ts` 7ea7262cca177cc92a59f65fe917cc14573786db. `lib/document-annexes.ts`·`lib/form-mapping.ts`·`lib/plan-reconciliation.ts`의 소비처도 확인.

합성 입력(원문/개인정보 없음):

```json
{
  "expectedInstallments": 3,
  "onePhase": [{"id":"whole","firstInstallment":1,"lastInstallment":3,"firstPaymentDate":"2026-01-31","monthlyAvailableWon":"1","allocations":[{"creditorId":"synthetic-debt","principalWon":"1","interestWon":"0"}]}],
  "split": [
    {"id":"p1","firstInstallment":1,"lastInstallment":1,"firstPaymentDate":"2026-01-31","monthlyAvailableWon":"1","allocations":[{"creditorId":"synthetic-debt","principalWon":"1","interestWon":"0"}]},
    {"id":"p2","firstInstallment":2,"lastInstallment":3,"firstPaymentDate":"2026-02-28","monthlyAvailableWon":"1","allocations":[{"creditorId":"synthetic-debt","principalWon":"1","interestWon":"0"}]}
  ]
}
```

- **독립 기대:** 구간을 나눠도 날짜는 회차 1=2026-01-31, 2=2026-02-28, 3=2026-03-31. 금액·채권자별 합계 동일. 이는 **제품의 기존 단일구간 달력 연산과의 일관성 불변식**이지 법원이 실제 납입일을 31일로 지정했다는 법률 해석이 아니다.
- **실제 소스 날짜식 격리 Node 22 실행:** 단일구간 `[2026-01-31,2026-02-28,2026-03-31]` vs 2구간 기존식 `[2026-01-31,2026-02-28,2026-03-28]`. 2026-08-31→09-30→10-30도 10-31 예상과 다름. 2024-01-31→02-29→03-31 윤년은 원래 단일구간에서 정상. **격리 5개 단언 기대일치**. 이는 `Date.UTC`와 `Math.min` 날짜 helper 및 원본 구간 반복식을 같은 알고리즘으로 실행한 시험이며 **전체 원본 프로젝트/Node 테스트 호출을 실행한 것은 아니다.**
- **구조상 원인:** `payment-schedule.ts`와 `repayment-plan-model.ts`는 단계 2의 2월 28일을 새로운 매월 기준일로 사용, `context-validation.ts`도 단계 간 연속성을 직전 단계 시작일 기준으로 계산한다. 사용자가 단계 3에 3월 31일을 입력하면 검증에서 반대로 막히는 일관성 충돌.
- **수정안:** 최초 단계 첫 변제일을 `planAnchor`로 고정, 모든 회차 일자를 `addMonths(planAnchor, installment-1)`에서 계산. 단계 경계·계산 ledger·변제 부속표 날짜를 동기화. **Draft PR #25** `audit/a2-phase-month-anchor-20261030-1617`; 브랜치 커밋 최종 `62fe689f304753cb701d2bcf00da817f9010ffd5`. 변경 4개 파일은 `lib/payment-schedule.ts`, `lib/repayment-plan-model.ts`, `lib/context-validation.ts`, 신규 `tests/a2-phase-month-end-invariance.test.ts`. 기존 main의 실제 파일을 변경하거나 병합하지 않았다.
- **추가한 5개 Node 회귀 테스트는 소스 저장만 완료, 실제 프로젝트 CI/Node 테스트 실행은 미실행.** 분할 불변성·검증 스키마·ledger 날짜 일치·윤년·금액 변경에 따른 날짜 보존을 다룬다.
- **중요 법률/업무 위험:** 이미 변호사 검수한 날짜/법원 지정 납입일 또는 기존 사건의 다른 월말 전략이 있다면 새 방식의 소급 적용은 불가. 계산사무장/변호사가 현행 날짜 결정 기준을 검토하고, 변경 시 검수·문서·기준정보 버전을 재승인해야 한다. 그래서 **PR 미병합, Draft 유지**.

## 3. 별도 A2-DATA-023 원단위 BigInt 분배 합성 오라클

실제 `repayment-plan-model.ts` 기본분배의 `mp=p/n + (month<=p%n?1:0)`, `mi=i/n + (month<=i%n?1:0)` 표현을 독립 Node 22 함수로 격리 실행했다.

- 원금10원+이자2원/3개월 → 회차별 지급 **[5,4,3]원**, 정확 합계 12원(기대 일치).
- 원금1원/3개월 → **[1,0,0]원**, 결측과 실제 0원 혼동 없음. 원금 0/3개월은 [0,0,0].
- 10원 채권 2개/3개월 → 각각 [4,3,3]이므로 **합계 [8,6,6]원**. 전체 20원은 월 한도7×3=21원 이하이나, **1회차 8원>7원**이므로 유효한 월별 예산이라면 차단되어야 한다.
- 별도 계산 `plan-reconciliation.ts` 34~52행에서 월별 category/schedule/disposable budget 초과가 `CATEGORY_BUDGET_EXCEEDED` 또는 유사 issue로 **차단되는 코드 분기**를 확인했다. **여기서는 전체 ledger+reconciliation 엔진을 실행하지 않아 실제 issue가 발생했다는 주장은 하지 않는다.**
- 격리 원단위 예 7건 기대일치. BigInt 거액, 1원, 0원, 단일회차, 다수 채권의 원단위 보존을 확인. 다수 채권별 각각의 나머지원 앞쪽 배분이 월별 한도를 넘으면 자동 최적해로 재분배하지 않으며, 이는 정상적인 안전 보류 가능성이 있으나 사용자/계산사무장의 편성 경험 검증이 필요하다.

## 4. 법원 서식·세무/법령 외부 기준 대조(미인증 구분)

- 대한민국 법원 공개 처리지침 `재민2004-4` 제2조(이전 회차 확인, 서울회생법원 2024년 직무편람): **D5103** 수입지출 목록, **D5110/D5111** 변제계획안 구분. https://slb.scourt.go.kr/rel/information/qna/member_manual.pdf . **이번에는 2026 현재 공식 변제계획안 Word/PDF 출력물을 내려받거나 실제 페이지/바이트 동등성 검증하지 않았다.**
- 국가법령정보센터 현행 검색에서 **채무자회생법 [시행 2026-10-02], 법률 제21490호(2026-03-24 타법개정)** 표기 확인. https://law.go.kr/unSc.do?query=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0 . 특정 신청일·준칙 적용/변제일의 법률 결정은 승인하지 않았다.
- 서울 제424호 **2026-10-01** 시행 제7호 신설은 지난 회차 공식 원문 대조와 Draft PR #18의 관할 보류 규칙을 그대로 유지. 이번에는 공문 PDF의 재접속이 타임아웃되어 **당 회차 새로운 법률 적용 판정 없음**. 기존 원본 https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2 .
- 국세청 2026-10-30 기준 웹 안내는 일반과세 부가세 **매출세액−매입세액**과 간이과세 별도 계산, 신고기간을 구분한다. 이는 법원의 월 인정 순소득이나 변제일 산식이 아니다. https://sc.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272 및 https://b.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 . **VAT/장부 사업소득 계산코드는 이번에 수정하지 않았다.**

## 5. 체크 ID 및 인수 미완 경계

| ID | 관점 | 이번 증거 | 남은 검증 |
|---|---|---|---|
| A2-CALC-026 | 계산사무장 | 월말 단계 분할 날짜 반례, BigInt 분할합계 | 36/48/60회 전체·실제 18산식·법률 예외 |
| A2-DOC-005 | 서류담당자 | D5110 관련 ledger/annex 소스 경로 확인 | 실제 Word/D5110 토큰·반복행·날짜/배분표 동등성 |
| A2-DATA-023 | 데이터담당자 | BigInt 원단위 나머지 7건 격리 | SQL feature 저장/재독·다중채권 배분·0/null 전수 |
| A2-IT-007 | IT담당자 | UTC calendar month-end 경계 5개 격리 | 실제 server/client TZ·SQL·전자서식 날짜 |
| A2-AX-015 | AX담당자 | 독립 산술·날짜 oracle와 구판본 함수 논리 비교 | 전체 실제 Node 엔진·91입력/42출력/서식 실행 |

**통과 [x]: 0건, 제품 인수 0건.** 검증 층은 `CODE_REVIEWED` 일부 + `SYNTHETIC_EXECUTED` (독립 표현 격리)에 한정. PR #25 변경 코드는 타입검사·전체 Node CI·staging D1/R2/법원 양식·변호사 검수/배포 미인증.

다음 A2 우선: **A2-LAW-021**(법·시행일/관할 판본 승인), **A2-DATA-017**(42 output_path 실제 엔진 실행/DB 저장 일치), **A2-IT-015**(진짜 D1·typed round-trip), **A2-CALC-026**(36/48/60·다중채권 월별 초과차단), **A2-DOC-005**(최종 Word·D5110 원화/날짜/반복 행). 검증·법률 결론을 넘어서는 배포/운영 DB 변경/전자제출은 수행하지 않는다.
