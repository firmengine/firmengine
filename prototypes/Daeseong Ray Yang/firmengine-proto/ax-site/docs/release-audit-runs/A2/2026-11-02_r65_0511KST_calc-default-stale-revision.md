# FirmEngine A2 r65 — 계산사무장: 생성형 기본 변제원장의 계산 snapshot revision 누락

- 검사 기준: **2026-11-02 05:11 KST 회차**, 이전 r64 사용자·서류담당자 → **r65 계산사무장** → 다음 **r66 변호사**.
- 허용범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 실제 고객정보·OCR 원문 사실·비공개 정답·키·.env **미사용**.
- 검사 시작 main HEAD: `c77eed3da325e08f4423c37f689222fe7f7d7fa0` (직전 A1 r65 보드 합병). 영수증 쓰기 전 HEAD: `c77eed3da325e08f4423c37f689222fe7f7d7fa0`; 최근 A2 r64 영수증, #133/#145/#154 Draft 및 #157 변경사항 검토.
- 원본 main `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`, #133 base blob `59cda151563d63ff2eb1187102f668829872e9b7`, 수정 branch blob `156a144115c968125f5096095c78c69235f1114f`, main `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`.
- main 기준 JSON `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`; `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`; SQL migration 0011 blob `0caa359d250dce45765d269d271ad63170ec3efa`. 저장·법률·서식 종단시험을 실행한 것은 아님.

## 1. 이번에 확인한 P1 후보 — 계산 revision 미일치의 기본 변제원장 누락

실제 `buildRepaymentPlanModel`의 **명시적 phase schedule 경로**에는 `calculation.caseRevision !== data.context.revision`에 대한 `CALCULATION_SNAPSHOT_STALE` 검사가 있다. 반면 **generated-default 경로**는 조기 반환하여 동일한 검사를 시행하지 않았다. #133의 월별 나머지 집중 검토수정에도 이 경계가 남아 있었다.

**합성 입력**, 실제 고객 사건 아님:
```json
{"case":{"context":{"revision":8,"planMonths":36,"paymentSchedule":null,"monthlyTrusteeFee":{"amountWon":"0"}},"debts":[{"id":"SYN-DEBT","principal":{"amountWon":"1000"},"interest":{"amountWon":"1000"},"classification":"ordinary","priority":"ordinary","factIds":["SYN-FACT"]}]},"calculation":{"caseRevision":7,"planTotalWon":"72","monthlyPaymentWon":"2","ordinaryRepaymentBudgetWon":"2","disposableIncomeWon":"2","allocations":[{"debtId":"SYN-DEBT","allocatedPrincipalWon":"36","allocatedInterestWon":"36","factIds":["SYN-FACT"]}]}}
```

**독립 기대:** 실제 사건 revision=8과 계산 revision=7은 일치하지 않으므로 월별 원장 금액은 보존하되 `status=blocked`와 `CALCULATION_SNAPSHOT_STALE`을 기록; `reconcilePlanLedger`에서는 `PLAN_LEDGER_BLOCKED` 전파. 현재 revision=8인 대조군은 `provisional` 원장, 산술 `reconciled`이나 **법률 승인 아님**.

| 원본 함수 버전·검증 | 36개월 | 48개월 | 60개월 | 독립 기대 |
|---|---|---|---|---|
| main 원본, stale revision 7 | provisional / stale 이슈 없음 | 동일 | 동일 | **3/3 미검출** |
| #133 선행 Draft, stale revision 7 | provisional / stale 이슈 없음 | 동일 | 동일 | **3/3 미검출** |
| #157 수정후, stale revision 7 | blocked / CALCULATION_SNAPSHOT_STALE | 동일 | 동일 | **3/3 검출** |
| #157 수정후, 현행 revision 8 | provisional / stale 이슈 없음 | 동일 | 동일 | **3/3 기대 일치** |
| #157 + main reconciliation | blocked / PLAN_LEDGER_BLOCKED | 동일 | 동일 | stale 3/3 전파; 정상 3/3 별도 산술 `reconciled` |
| #157 추가 null·0 예외 | null proposal + stale=blocked | 0 proposal/0 allocation + stale=blocked | null+0 allocation + stale=blocked | **3/3 기대 일치** |

- **실행환경:** GitHub에서 각각의 **실제 함수 전체 본문을 읽고 TypeScript 타입 문법만 제거해 JavaScript V8 격리실행**, `moneyValue`는 합성 `amountWon`를 BigInt로 읽는 최소 어댑터. main/#133/#157의 실제 소스와 독립 BigInt 오라클 대조. **프로젝트 Node·TypeScript 빌드·전체 CI 실행 아님**.
- 수정 소스 재조회 V8: ledger + reconciliation **6/6** 현행/과거 36·48·60 개별 기대 일치; 별도 null/명시 0 예외 **3/3**, #145 실제 법률산술 함수 V8 **7/7**(오입력 `9,00`, 기간 `₩36원`, 48개월, PV/청산가치, 명시 0/미관찰 등). 기능 조합/문서 출력의 E2E라고 표기하지 않음.
- #157에는 *기본 원장 반환 직전 revision 확인 1건*만 추가하며, 기존 채권배분/월액/법원 판정 규칙을 수정하지 않음.

## 2. Draft 코드/테스트 및 병합 제한

- **[Draft PR #157](https://github.com/firmengine/firmengine/pull/157)**은 선행 **[Draft #133](https://github.com/firmengine/firmengine/pull/133)** 브랜치에 쌓인 stacked PR. main 제품 코드 변경 **없음**.
- Commit `ff362ddad056c201d097bd91d6e3b63a4440f55b` — `lib/repayment-plan-model.ts`에서 generated-default 반환 전 `CALCULATION_SNAPSHOT_STALE` 검증 1건. Commit `a224b96a29d7aef16d9ca0d2275ddf5aa34ac219` — `tests/a2-r65-default-plan-snapshot-stale.test.mjs`, 36·48·60 현행/과거 6개 + null/0 2개, **작성·커밋했으나 실제 Node 러너/CI에서 미실행**.
- 비교 `#133 head…#157 head`: ahead 2, behind 0, 변경 파일 정확히 2개 모두 ax-site 내부. 승인/병합 전 #25/#29/#133 계산원장, #145 법률형식, #154 문서 사전검증, #138 Fact 계보, #141 출력상태와 충돌·실제 회귀 필수.

## 3. 계산·SQL 피처·서식 계약 정적 재독 및 독립 산술

main JSON 기준 계산 **18모듈**, 입력 **91선언·고유78**, 출력 **42선언·고유40**, 결과 `output_path` **42·고유42**. 계산 ID 중복 0, `resultPaths` 중복 0, 미등록 `dependsOn` 0. DOCX 카탈로그 **D5103=37, D5110=55, D5111=82** 토큰(각 형식 내 토큰 중복 0).

BigInt 독립 합성값:
- 급여 2,400,000×12=**28,800,000원**, 사업 순소득 관측 1,000,000×11=**11,000,000원**, 관측합 **39,800,000원**. 사업 2026-12월은 **미관찰/null**이고 **0원으로 보간 금지**.
- 900,000×36/48/60 = **32,400,000/43,200,000/54,000,000원** 명목합. 현재가치 **30,000,000원**과 합성 청산가치 **32,000,000원**의 차액 **2,000,000원**; 법적 인가 판정 아님.
- VAT 총매출 60,000,000원, 종소세 과거 신고 20,000,000원은 **source-only 자료**로 가정. 월순소득에 합산/중복계상하지 않음. VAT·종소세·사업장별 원천·거래 중복·채권별 담보/공동보증·원화 잔여분배 실제 계산은 **미실행**.
- Migration 0011 `case_calculation_runs`/`case_calculation_features`/`case_calculation_heads`의 스키마를 읽었으나 이번 회차에 실제 SQL INSERT/조회, staging D1·R2·Cron 또는 DOCX 렌더·바이트 재독을 실행하지 않음.

## 4. 공식 법률·세무 원문·법원·시행일

1. **국가법령정보센터** [채무자회생법 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **법률 제21490호, 2026-03-24 타법개정, 시행 2026-10-02** 조문 HTML 확인. 변제기간 제611조⑤의 3년 원칙/특별사정 최장 5년, 제614조의 인가요건은 내부 revision·산술 검사와 별개. 사건의 적용 판본·선행 경과조치에 대한 최종 승인 **미인증**.
2. **서울회생법원** [2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 **제424호 제2조② 제7호 신설** 공지 확인. **첨부 개정전문·부칙·경과조치·사건별 적용일 미검증**. 발표일을 획일적 사건별 시행일로 자동 적용하지 않음.
3. **국세청** [세무안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 통상 반기, 간이과세자 통상 연간 VAT 과세기간, 종소세 통상 다음해 5월 신고 구별. 법원 인정 월순소득에 자동 적용하지 않음.

## 5. 중앙 보드 체크 ID별 인수 및 다음

| ID | 실관찰과 독립 기대 | 상태/미완료 |
|---|---|---|
| `A2-CALC-025` | #157 + reconciliation 합성 월 예산 2원과 회차별 2원, stale 계산이면 downstream blocked; 실제 보수·우선/재단비용 및 다채권 분배 미시험 | **[ ] 부분** |
| `A2-CALC-026` | 36/48/60 월별 2원×기간 및 stale revision 오류 검출 3/3; 기존 #133 원화 나머지 검토상태 계승. 월별 실제 원장·예외/단축·D5110/11 미인증 | **[ ] 부분** |
| `A2-CALC-028` | #145 실제 함수 V8 합성 PV 3천만원<청산 3천2백만원 검토 이슈 발생; 자산 시가/할인율/법원 인가 미인증 | **[ ] 부분** |
| `A2-CALC-030` | stale/current×36/48/60 V8 6/6, null·명시 0 추가 3/3; 새 Node 회귀 원문 8개 테스트 **미실행** | **[ ] 부분** |

**다음 r66 변호사:** revision guard가 법률상 확정판정으로 오인되는지 검토, PR #157↔#133↔#145↔#154↔#138의 충돌·Node 회귀·SQL→D5110/D5111 재독. 공식 424 개정전문 부칙/법원·사건별 시행일, 변제기간/청산가치 법률판정·변호사/계산사무장 서면승인 별도 유지.

**이번 제품 인수 완료 0건.** 실행된 것은 함수 V8 격리시험·정적 기준 재독·독립 BigInt 산술 및 GitHub Draft 테스트 기록뿐. 전체 Node/CI, D1/R2/Cron staging, DOCX/법원서식 동등성, 법률/회계/세무 인증, 사이트 배포 **미검증**. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 **미실행**.
