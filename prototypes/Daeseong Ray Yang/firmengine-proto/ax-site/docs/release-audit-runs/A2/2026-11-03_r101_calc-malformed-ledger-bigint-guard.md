# FirmEngine A2 r101 — 계산사무장: malformed 원장 금액 BigInt 예외 / 분류 오집계 독립감사

- 기준일: **2026-11-03 KST**. 역할순환: **r100 사용자·서류담당자 → r101 계산사무장 → r102 변호사**.
- 작업범위: `firmengine/firmengine` main, **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`** 한정. 시작 main SHA `ac75fca7a9323a16fc9f85fff51d73318128e92d`. 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 `A2-CALC-019 / 025 / 026 / 030` **모두 [ ] 유지**.
- 최근 main r100 감사 및 A1/A3 변경, [Draft #203](https://github.com/firmengine/firmengine/pull/203), [#194](https://github.com/firmengine/firmengine/pull/194), [#192](https://github.com/firmengine/firmengine/pull/192), [#144](https://github.com/firmengine/firmengine/pull/144), [#220](https://github.com/firmengine/firmengine/pull/220) 읽음. 정적 원문 `lib/plan-reconciliation.ts` main blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`와 Draft #203 동종 함수, `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`, `lib/legal-calculation-readiness.ts` blob `9edab755df5adae5f143d15285c550feb0e0f6d5`, 테스트 `tests/legal-field-and-calculation.test.ts`, r95b·r89·r100 영수증, 저장형식/법원서식 계약 검토.
- 실 개인정보·원본 OCR·고객 Fact·비공개 정답·토큰/.env **사용/저장하지 않음**. 결과는 합성 독립 기술감사이며 법률/세무·회계 최종 승인 아님.

## 1. 실제 코드 실행: 독립 입력·기대·관찰

GitHub에 존재하는 main `reconcilePlanLedger()` 함수 본문과 Draft #203 함수 본문에서 **TypeScript 타입 표시만 제거**하고 JavaScript V8 격리 실행. 의존 함수 `moneyValue()`만 합성 `{amountWon:"0"}→0n` 대역으로 사용. 이는 함수 실행 확인이지 전체 프로젝트 Node/test, D1, DOCX 생성·재독이 아니다.

합성 타입/계보: `data.context.planMonths=36|48|60`, `data.debts=[{id:"SYN-D",priority:"ordinary",classification:"ordinary",principal:{amountWon:N},interest:{amountWon:"0"}}]`, `calculation={ordinaryRepaymentBudgetWon:"1",monthlyPaymentWon:"1",disposableIncomeWon:"1",planTotalWon:N}`, `ledger={status:"complete",issues:[],rows:[{installment:1..N,debtId:"SYN-D",claimClass:"ordinary",fundingSourceId:"ordinary_budget",principalWon:"1",interestWon:"0",otherComponentWon:"0",balanceAfter:N-installment,sourceIds:["SYN-F"]}]}`. `N`은 36·48·60. 실 원문/Fact 승인/SQL feature ID는 **존재하지 않는 합성 키**이며 조회 미실행.

| 각 N=36/48/60에서 1회차 변형 | 독립 기술 기대 | main 실제 | Draft #203 실제 |
| --- | --- | --- | --- |
| 정상 원금 1원×N | reconciled, principal/total=N, trustee=0 | 정상 3/3 | 정상 3/3 |
| 원금 `1,20` | **예외 없이 blocked·금액 미확정** | **SyntaxError 3/3** | **SyntaxError 3/3** |
| 이자 `0a` | **예외 없이 blocked·금액 미확정** | **SyntaxError 3/3** | **SyntaxError 3/3** |
| 기타액 `1,,000` | **예외 없이 blocked·금액 미확정** | **SyntaxError 3/3** | **SyntaxError 3/3** |
| 잔액 `bad` | blocked/INVALID_LEDGER_MONEY | blocked 3/3 | 미실행 |
| 미등록 `claimClass="other"` | blocked, trustee_fee 0 | **reconciled/trusteeFeeWon=N 3/3** | blocked/trusteeFeeWon=0 3/3 |

- **main 실제 18조건**: 정상 3, 잔액-invalid 차단 3, 비정상 금액 **9 예외**, 미등록 분류 **3 거짓 정상**. 위 18건은 통과 건수 18이 아님.
- **#203 실제 15조건**: 정상 3, unknown-class blocked 3, 비정상 금액 **9 예외 그대로**. #203의 분류 개선은 의미 있으나 malformed 수치의 실행 중단을 고치지 않음.
- 범위 한정 **P1 후보**: 코드 첫 반복에서 `INVALID_LEDGER_MONEY`를 issues에 넣은 후 후속 `BigInt(row.principalWon|interestWon|otherComponentWon)` 연산이 바로 throw. 기존 blocked 반환이 보장되지 않는다. 숫자-null/미관찰/무효 형식/0의 구별과 에러 전달계약 필요. 반면 정상 `N`원은 독립 `1n*BigInt(N)` 정수 산술과 일치.
- #203/#192/#194는 `plan-reconciliation.ts`에 모두 변경을 넣으므로 단독 PR 통과를 합본 통과로 오인 금지. 기존 [#144](https://github.com/firmengine/firmengine/pull/144)는 별개의 D5110/11 표시 파서 버그를 이미 다루므로 중복 신규 PR을 생성하지 않음.

## 2. 수정·보류 사유

**제품 코드 수정 없음 / Draft 새 생성 없음.** 오류 숫자를 무조건 `"0"`으로 바꾸거나 `PlanReconciliation.totals`을 0으로 만들어 반환하면 ‘미관찰/오류’를 ‘실측 0원’으로 오인시킬 위험이 있다. 안전한 회복은 `blocked + 계산총액 미확정(null 등 명시적 표현)`을 소비처 전체(법원서식/최종승인 게이트)와 동시 설계·회귀검증해야 하므로 고위험 계약변경으로 별도 Draft+IT·계산사무장·변호사 검토를 요구한다. **현재 main의 오류를 고쳤다고 기록하지 않음**.

## 3. 18모듈/91입력/42출력 및 서식 정적 재독

GitHub main 기준 `lib/reference-decision-tables.json` 실제 JSON 재파싱: **18계산모듈, 입력선언 91(고유78), 출력선언 42(고유40), 결과 저장경로 42**. `lib/template-token-catalog.json`: **D5103 37 / D5106 48 / D5110 55 / D5111 82** 등록 토큰. 검증은 정의 목록의 정적 집계이지 **18개 실행·91 입력 소비·42 출력 SQL 왕복·Word 토큰값 일치가 아님**. SQL migration 0011 / Fact ownership / typed 변환 / 합성 실행의 DB 저장·재조회 및 실제 D5110·D5111 생성은 **이번 회차 미실행**. 독립 명목 정수산술 `900000×[36,48,60]` = `[32400000,43200000,54000000]`원, **PV 할인·법원 인정 변제금과 별개**.

## 4. 공식원문/법원·세무 기준 (조회일 2026-11-03)

- 서울회생법원 [2026-10-01 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 제424호 제2조제2항제7호 신설. 기존 r96~r100 영수증에 따르면 **2026-09-23 개정 / 2026-10-01 시행 / 시행 후 최초 접수 사건**에 적용. **이번 회차 PDF 실무준칙 원문 직접 재독은 시간초과로 미완료**. 관할·최초 접수일을 입력 기본값으로 법률 확정하지 않음.
- [국가법령정보센터 채무자회생법 시행 2026-10-02, 법률 제21490호 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR) / [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): 3년 원칙/특별사정 5년 한도와 변제계획 인가의 현재가치·청산 비교·채권자 이의 조건. 정수 기간 테스트로 사건별 특별사정 및 인가요건을 자동 확정하지 않음.
- [국세청 VAT 개요](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272): 개인 일반과세자 통상 반기, 간이과세자 원칙 연간 과세기간. 신고매출·매입VAT·종소세와 월별 사업소득은 각각 다르게 취급; 자동 혼산·법원 인정 월순소득 확정 없음.

## 5. A2 ID별 판단 / 차기

| ID | 실제 확인 및 단계 | 인수 |
| --- | --- | --- |
| **A2-CALC-019** | 원금/이자/기타액 malformed 9건 예외 (원천 채권 인정·금액변환 미검증) | 부분 **[ ]** |
| **A2-CALC-025** | 정상 ordinary 원장 36·48·60 정수 보존, unknown class의 trustee 오집계 main 3건 (#203 후보는 기술 차단) | 부분 **[ ]** |
| **A2-CALC-026** | 36/48/60 각 정상 원장 금액은 N원. 미래월·잔여원·phase/서식 종단 미실행 | 부분 **[ ]** |
| **A2-CALC-030** | 잘못된 원단위 문자의 throw 9건, 잔액 invalid 3건 blocked; **null/0/source-only/NA/상충/승인전 구분 인수는 미검증** | 부분 **[ ]** |

**다음 r102 변호사:** 분류/세금·우선채권의 법률상 승인 전 상태와 malformed 반환 계약을 검토하고 #203/#194/#192/#144/#220 충돌·테스트를 통합. 코드 본문 V8/단독 시험/프로젝트 Node 전체 CI/staging D1-R2-Cron/DOCX ZIP 재독/공식 법원서식/변호사 승인/배포를 서로 동등하게 표시하지 않는다. **제품 최종 인수 0**. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 수행하지 않음.
