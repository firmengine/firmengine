# FirmEngine A2 r107 — 계산사무장 / 다중채권 원화·정책·분류 상태 계약 교차검증

- 2026-11-03 23:15 KST 기준. 순환: r106 사용자·서류담당자 → **r107 계산사무장** → r108 변호사. 허용 수정 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 시작 최신 main 검색 SHA `68d902a215f65dea41e9196c88209445a00e9412` (최근 main 커밋: docs(A1): r106 merge only IT-011 AX-011 CALC-011 receipts); 작성 전 중앙 보드 blob `1586928849b189f10c74017f4224331e63aa63f0`. 이전 [r106 영수증](2026-11-03_r106_2220KST_doc-blocked-zero-recon-summaries-pr223.md), r105·r103·r102·r101, Draft #43/#203/#222/#223의 실제 코드와 PR 변경목록 확인.
- 실제 main `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, Draft #43 `3eca93d20dfb9a851c26262ece8e1d5a69d932ed`, #203 `fcefc9239808c9c1356b6eb4bc438efe5ac51bf9`, #222 `60bed62146a254c2c08937592ebd308c3fa96858`. main `lib/document-annexes.ts` blob `9041330c95858390647d355cc3d1cbdbcab76b47`, Draft #223 `lib/document-annexes.ts`의 기존 개선은 별도 branch/미병합.
- 원본문 `reconcilePlanLedger`을 GitHub에서 읽고 TypeScript 형식 선언만 최소 제거해 V8 격리 함수로 호출. 애플리케이션 `calculateCase` / Node 프로젝트 테스트 러너 / 전체 CI / staging D1·R2·Cron / DOCX 출력 및 재독은 실행하지 않음. **본 결과는 독립 기술 검증이며 법률·회계상 인정이 아님.**

## 합성 입력 / 독립 산술

전부 가상 케이스(SYN-ORD, SYN-PRI)이며 실고객 사실값 없음. 원장 행 형식은 `{installment:number,debtId:string,claimClass:"ordinary"|"priority",principalWon:"1",interestWon:"0",otherComponentWon:"0",balanceAfter:string,fundingSourceId:"ordinary_budget"|"priority_budget",phaseId:"SYN",paymentDate:"2027-01-01"}`. 사건 `context.planMonths`는 36/48/60, `monthlyPriorityPayment.amountWon="1"`; 계산 `ordinaryRepaymentBudgetWon="1",monthlyPaymentWon="2",disposableIncomeWon="2",planTotalWon=36/48/60 문자열`. 채권 2개 각각 원금 36/48/60원, 이자 0원; priority policy `{PRI:{applicability:"confirmed",deadlineInstallment:term}}`을 정상 케이스에서만 제공.

- 독립 기대 정상 월합 1원+1원=2원, 36/48/60개월 **총액 72/96/120원**, 일반채권 총계 36/48/60원, 우선채권 총계 36/48/60원. 이 기대는 BigInt 별도 곱셈으로 검산.
- `policyMissing`: policy map의 PRI 항목 삭제. **기대 우선채권 법률검토 `unknown`**(산술총액은 보존).
- `malformedMoney`: 최초 ordinary 원금 문자열만 `"1,20"`; 기대 예외 없는 `blocked`와 **총액 미확정(null/source-only), 실제 0원으로 표시 금지**.
- `classMismatch`: 최초 ordinary 행 `claimClass="other"`로만 변형, 기대 `blocked`.
- `sourceBlocked`: 원장 `ledger.status="blocked"`로만 변경, 합계 숫자는 존재하더라도 확정 표시 금지.
- `underpaidPriority`: priority 마지막 회차 원금을 1→0원, 마지막 잔액 1원으로 조정; 독립 기대 총액 2×term−1 = **71/95/119원**, priority `blocked`.
- `trueZero`: 채권 원금과 모든 월행 원금을 **실제 관측 0원**으로 바꾸고 잔액 0원 유지, 독립 기대 총액 **0원**. `malformedMoney`의 가짜 sentinel 0과 반드시 구분.
- `missingInterest`: 우선채권 원천 이자 `amountWon=null`, 월행 이자 0원, 기대 채권 구성 검토보류·비승인.

4개 판본 × 3기간 × 8시나리오 = **96개 원본문 V8 호출**, 각 호출의 status/priorityCoverage/totalWon/issues/legalReviewTasks 및 예외 관찰을 비교(정식 project Node/CI가 아님).

## 독립 기대 / 실제 관찰 (각 행은 36·48·60월에서 3/3 재현)

| 시나리오 | 독립 기술 기대 | main | Draft #43 | Draft #203 | Draft #222 |
|---|---|---|---|---|---|
| 정상 2채권 | reconciled, covered, 72/96/120원 | 일치 | 일치 | 일치 | 일치 |
| 미승인 정책 | priority unknown + 검토과제 | **covered/검토과제 없음** | **covered/없음** | **covered/없음** | unknown+검토과제 |
| 원화 `1,20` | 예외 없이 blocked, 합계 미확정 | **SyntaxError** | blocked이나 **totalWon="0" sentinel** | **SyntaxError** | **SyntaxError** |
| 미등록 채권분류 | blocked | **reconciled**(법률검토과제만) | blocked, **0 sentinel** | blocked | **reconciled**(과제만) |
| sourceBlocked | blocked, 합계 비인증 | blocked, 계산된 금액 유지 | 동일 | 동일 | 동일 |
| 우선채권 1원 미지급 | blocked, total=71/95/119 | 일치 | 일치 | 일치 | 일치 |
| 실제 0원 | actual 0 보존 | 0원 보존 | 0원 보존 | 0원 보존 | 0원 보존 |
| 이자 원천 null | 채권 구성 blocked/unknown | blocked/unknown | blocked/unknown | blocked/unknown | blocked/unknown |

**핵심 P1 위험:** #43의 구조오류 조기 반환은 법률·계산 승인전 상태를 blocked로 유지하지만 총액 8필드 모두 문자열 0원으로 제공. `trueZero`와 API 숫자만 보면 동일. #223은 서식 annex 일부의 방어이며, 원장 생산자·typed SQL/API/다른 서식의 총계 위험을 없애지 않는다. #203은 분류를, #222는 정책누락을 별도로 해결하지만 단독병합으로는 충분하지 않다. 승인된 법률 분류/정책의 사건·원천 Fact·승인자/승인일 검증도 아직 없음.

이번 회차 제품 코드는 **변경하지 않음**: 금액 반환형/null 계약을 바꾸면 계산→SQL→API→서식까지 다수 소비처가 영향을 받는 고위험 변경이므로, #43/#203/#222/#223 통합 및 반환계약 확정 후 별도 Draft 코드 통합/실무자 검토가 필요하다. [#43 결함 검증 댓글](https://github.com/firmengine/firmengine/pull/43#issuecomment-6606272440), [#222 결함 검증 댓글](https://github.com/firmengine/firmengine/pull/222#issuecomment-6606274278). 합성 96건 테스트는 함수본문 독립 실행이며 Draft 테스트/CI의 통과로 표시하지 않음.

## 계산/서식 기준정보 정적 계약

main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` JSON.parse: 계산 **18모듈**, inputs **91선언/고유78**, outputs **42선언/고유40**, resultPaths **42/고유42**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5106 **48**, D5110 **55**, D5111 **82** 토큰. 이는 정적 참조형식과 개수 검증이지 18모듈 실계산/91입력 소비/SQL 저장·재조회/실제 DOCX·공식서식 동등성 검증이 아님.

## 공식 법률·세무 원문 판본 / 법원과 출처

- 서울회생법원 실무준칙 [제424호 개정전문 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2) **P271 제424호, P272 제2조② 제7호**, **P391 부칙**을 웹 PDF 스크린샷으로 직접 재확인. **2026-09-23 개정, 2026-10-01 시행**, 이후 **최초 접수된 사건**부터 적용; 이전 인가 변제계획 효력 불변. 법원 2026-10-01 [보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187)로 7호 신설도 확인. 서울 외 법원 자동적용 금지, 날짜/관할 원천 Fact·사람 승인 없이는 대상 확정 금지.
- 국가법령정보센터 **채무자회생법 [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR)**: 별도 **2026-10-02 시행판**, 변제계획 기재·우선/재단채권 변제 및 인가요건. 이번 원화 기술 계산의 `reconciled/covered`는 법률적 인가·청산가치 판단이 아님.
- 국세청 [VAT 신고 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 반기/간이과세자 통상 1년 과세기간. VAT/종소세 신고금액을 사건의 인정 월순소득으로 자동 승격하지 않음. 소득/부가세 산식 자체는 이번 원장-focused 회차 미실행.

## 중앙 보드 4ID 상태·다음 회차

- `A2-CALC-019 [ ]`: 원금/이자/기타와 null/비정형 문자열 구분. main/#203/#222 잘못된 원화 SyntaxError 9회, #43 zero sentinel 3회. 채권 원금/이자 법적 인정·출처 Fact 미인증.
- `A2-CALC-025 [ ]`: 2채권 ordinary/priority 월예산과 합계 검증. 미등록 분류 main/#222 6회 `reconciled` 오판, #203 차단, #43 구조차단 수치 0 위험. 세금·재단/보수 실배분 전체 미검증.
- `A2-CALC-026 [ ]`: 36/48/60개월 각 2행, 정상 72/96/120원, priority 마지막 1원 미지급 71/95/119원 산술보존 재현. 조기변제/잔여원/Word 실제 대조 미검증.
- `A2-CALC-030 [ ]`: 96 V8 호출, 0/null/잘못된 원화/분류·승인전 상태의 상호 충돌. #43 zero sentinel과 실제 0원이 같은 `"0"` 직렬화라는 실증. 프로젝트 전체 Node·CI/D1·DOCX 재독·법률 승인 미검증.

다음 r108 **변호사**: 제611·614조와 제424호 관할/적용시점 및 정책 승인의 Fact 계보; 기술 `covered`/zero sentinel/서식 출력을 법률적 완결로 승격하지 않는 최종 게이트, #43/#203/#222/#223 통합 Draft 법률 승인경계 점검. 추가 기술 우선순위는 **source Fact→typed→SQL feature→42출력→D5103/D5106/D5110/D5111** 종단 검증. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 금지, 고객 문서/개인정보/OCR값/키/.env/비공개 정답 미기록. **제품 최종 인수 0건**.
