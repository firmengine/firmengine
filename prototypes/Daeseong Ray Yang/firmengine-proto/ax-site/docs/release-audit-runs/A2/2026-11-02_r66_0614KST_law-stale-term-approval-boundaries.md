# FirmEngine A2 r66 — 변호사: 계산 snapshot·변제기간·청산가치와 법률 승인경계

- 검사회차: **2026-11-02 약 06:14 KST**. 역할 순서: r65 계산사무장 → **r66 변호사** → r67 데이터담당자.
- 범위: 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`, 제품 main에 수정·법률 자동규칙 적용 없음.
- 검사 시작 main HEAD: `fc4c9fd654c60b39632ef1edb7474e48b90217f8`. main 보드 blob `9ce15ab126ebdfd76fe2e1163757874f4438bb69`.
- 실제 main 소스: `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`, `lib/legal-calculation-readiness.ts` blob `9edab755df5adae5f143d15285c550feb0e0f6d5`, `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`.
- 읽은 기존 영수증: `docs/release-audit-runs/A2/2026-11-02_r65_0511KST_calc-default-stale-revision.md`; open Draft #157(기본 원장 revision 검증; #133 위 stacked), #145(#144 위 stacked), #154, #138의 실제 diff 및 호출경로 검토. 이번 회차 **새로운 코드 수정·신규 PR 생성 없음**.
- 개인정보, 실제 고객문서, OCR 원문, 키, .env, 비공개 정답 미사용. **합성 시험만**. 코드 존재/격리검증/SQLite 모사/실제 CI·staging·공식 서식·법률 승인·사이트 배포는 전부 구분한다.

## 1. A2-LAW-014 · A2-LAW-022 — revision 불일치와 법적 확정의 분리

실제 main과 Draft #157 `buildRepaymentPlanModel()` 함수 전체 본문을 읽고 **TypeScript 타입 주석·표기만 제거해 V8에서 격리 실행**하였다. `moneyValue`만 합성 `amountWon`의 BigInt 어댑터이며 계산/분배 함수는 실제 소스 본문이다.

합성 입력: 사건 `revision=8`, 계산 `caseRevision=7`(오래됨) 또는 `8`(현재), `paymentSchedule=null`, `planMonths=36/48/60`, 한 채권 `SYN-D` 원금/이자 각각 1000원, 이 채권에 배정한 원금과 이자 각각 `planMonths`원, 월 제안액 `"2"`, `"0"`, `null`, 회생위원 보수 명시적 `"0"`, Fact `SYN-F`.

독립 기대: caseRevision 7이면 법률 적용과 무관하게 **오래된 계산 재사용 차단**; 동일 revision 8이어도 `provisional`은 법원의 인가가 아니다. 명시적 0원과 실제 월지급 2원이 상충하면 제안액 초과 오류도 존재해야 한다. `null`은 0원으로 보간하지 않는다.

| 합성 테스트 | main 관찰 | Draft #157 관찰 | 독립 기대 |
|---|---|---|---|
| 현재 revision 8, 36/48/60개월 (각 3건) | `provisional` | `provisional` | 원장 생성 가능, 법률 미승인 |
| 과거 revision 7, 36/48/60개월 (3건) | **`provisional` 거짓 정상** | `blocked; CALCULATION_SNAPSHOT_STALE` | 차단 |
| 과거 revision + 제안액 명시 0원, 지급 2원 (3건) | **`provisional` 거짓 정상** | `blocked`, stale 및 월액 초과 이슈 동시 | 차단·0과 null 구분 |
| 과거 revision + 제안액 null (3건) | **`provisional` 거짓 정상** | `blocked; CALCULATION_SNAPSHOT_STALE` | 차단·미관찰 유지 |

실제 반환 원장 행 수는 각 기간 72/96/120건(일반채권 및 0원 보수행 포함). **#157 12/12 합성 기대 일치**, 기존 main은 stale 9조건을 놓쳤다. 이전 r65의 합성 입력과 달리 이번 명시 0원 반례는 실제 월 배정 2원이므로 정상적으로 초과 사유까지 검출했다. 개별 로직 격리이며 정식 Node·CI/SQL→Word 실행 결과 아님.

다른 게이트 소스 재독: `lib/calculation-adapter.ts`에는 별도의 `CALCULATION_SNAPSHOT_STALE` 검사, `lib/office-writer.ts`에는 `mode=final`에서 planIssues/calculationIssues/assessment.generationGate를 확인하는 조건이 있다. **개별 함수의 `provisional`, `reconciled`, `ready`, `issues=[]`은 법률상 인가·변호사 승인과 동의어가 아니다.**

## 2. A2-LAW-014 · A2-LAW-018 · A2-LAW-022 — 법률 산술과 단위 입력

`reviewLegalPlanArithmetic()`의 main과 stacked #145 소스 본문을 TypeScript 타입표기만 제거하고 V8에서 **각각 16종 가상 스칼라** 실행. 독립 기대는 원화 BigInt 산술과 형식 검증 분리.

- `repayment_months="36"`은 관련 이슈 없음, `"48"`·`"60"`은 `PLAN_OVER_THREE_YEARS_REQUIRES_SPECIAL_REVIEW`, `"61"`은 `PLAN_DURATION_OUTSIDE_STATUTORY_LIMIT`; 어떠한 경우에도 `automaticLegalApproval=false`.
- 비정상 개월 `"₩36원"`·`"3,6"`은 main에서 `issues=[]` **허위 정상**, #145에서 `PLAN_SCALAR_FORMAT_UNRESOLVED`. `"-1"`은 main에서 기간초과로 판단되나 #145는 입력 형식오류로 구분한다.
- `null`, `"source-only"`, `"[미관찰]"`은 계산 이슈가 없을 수 있지만 관찰된 적법값/인가로 승격하지 않는다. `repayment_months="0"`은 기간 한계 이슈가 발생하며 문자열 `monthly_payment="0"` 자체는 명시적 0원.
- 승인 월소득 2,400,000−생계비 1,400,000=**1,000,000원**인데 입력 가용소득 900,000원이면 `PLAN_DISPOSABLE_FORMULA_MISMATCH`.
- `present_value=30,000,000` < `liquidation_value=32,000,000`이면 `PLAN_LIQUIDATION_EXCEPTION_REQUIRES_REVIEW`, 2,000,000원 차액. 두 값이 같으면 해당 경고가 없어지지만 청산가치·할인율·동의·법원 인가요건을 자동 충족한다는 뜻이 아님.
- 월 변제 1,200,000원 > 가용 900,000원은 `PLAN_PAYMENT_EXCEEDS_DISPOSABLE_REVIEW` warning, 월 900,000원×36=32,400,000원과 명시 총액 32,000,000원 불일치는 `PLAN_VARIABLE_SCHEDULE_OR_TOTAL_REVIEW` warning. 법적 부적합 확정이 아니라 근거확인 대상.
- **#145 16/16 조건별 독립 기대 일치**. main은 비정상 형식 2건의 거짓 정상 판정을 재현했다. 정식 Node 프로젝트 test runner/CI 미실행; Draft #145 미병합 상태.

## 3. 정적 계약·실제 SQL DDL 기반 합성 저장 재독

`lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 실제 파싱: **18 계산모듈, 입력 선언 91(고유 78), 출력 선언 42(고유 40), 결과 경로 42(고유 42), 미등록 의존 0**.
`lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 실제 파싱: **D5103 37, D5110 55, D5111 82 토큰**.
`drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`의 `runs/features/heads` DDL을 SQLite 메모리에 적용(`cases` 외래키 부모는 최소 합성 구성). 실제 제품 저장 API나 D1 사용 아님.

| 원문→Fact→typed→합성 SQL 피처 | 독립 기대 | SQLite 실제 재조회 |
|---|---|---|
| SYN-FW: 급여 2,400,000원, 12개월 | 원화 문자열 computed | JSON `"2400000"`, value_won `"2400000"`, computed |
| SYN-FB11: 관측 사업순소득 1,000,000원, 11개월 | 원화 문자열 computed | JSON `"1000000"`, value_won `"1000000"`, computed |
| SYN-FB12: 2026-12 사업소득 미관찰(미래월) | null/SQL NULL, 0원 금지 | JSON null, value_won SQL NULL, missing |
| SYN-FVAT: VAT 연 매출 60,000,000원 | source-only, 순소득 가산 금지 | JSON에 source-only 기록, value_won SQL NULL |
| SYN-FTAX: 종소세 과거 신고 20,000,000원 | source-only, 순소득 가산 금지 | JSON에 source-only 기록, value_won SQL NULL |
| SYN-FB11: 별도 **명시적 0원** | `"0"` 보존, null 아님 | JSON `"0"`, value_won `"0"`, computed |

**6/6 합성 저장·재조회**, 외래키 위반 0. source-only 행에 넣은 `provisional`은 **합성 테스트 상태값의 가정**이지 실제 제품의 법률상 인정·최종 분류가 아니다. SQL 스키마는 내용의 법적 의미를 인증하지 않는다.
독립 정수 산술: 2,400,000×12=28,800,000원, 1,000,000×11=11,000,000원, **관측합 39,800,000원**; 사업 12월 null로 보존. 900,000×36/48/60=32,400,000/43,200,000/54,000,000원 명목총액(할인·분배·인가 아님). 복수 채권·VAT/종소세 중복·담보/우선/재단비용·청산가치 실제 산정·서식 실물 재독은 미실행.

## 4. 공식 법령·국세청·법원 원문과 효력 경계

1. [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR): **법률 제21490호(2026-03-24 타법개정), 시행 2026-10-02**. 변제개시일부터 원칙 3년 이하, 특별한 사정 등 필요한 경우 최장 5년. 사건별 선후 적용 판본은 따로 확인.
2. [채무자회생법 제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 동일 시행판. 법률 적합성·공정·형평·수행가능성, 인가결정일 기준 평가 및 채권자 동의 등의 별도 요건. 계산 이슈 없음이 인가 아님.
3. [서울회생법원 2026-10-01 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): **제424호 제2조 제2항 제7호 신설** HTML 확인. 게시일과 **개별 사건에 적용되는 시행일은 동일시 금지**. 첨부 개정전문 PDF의 부칙·경과조치·적용대상·사건 접수/개시일과 관할 법원의 법리 확인은 **미검증**; 자동규칙 변경 금지.
4. [국세청 부가가치세 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 통상 6개월, 간이과세자 통상 1년 VAT 신고. VAT 매출 또는 종소세 과거 신고액을 개인회생 인정 월순소득으로 자동 추가하지 않음.

## 5. 중앙보드 ID, 수정·다음 항목

| A2 ID | 이번 실제 관찰 | 상태 및 남은 검증 |
|---|---|---|
| `A2-LAW-014` | main/#157 원장 12합성, #145 기간형식/36·48·60 검토 재현 | **[ ] 부분**. 424 제7호/법 시행판 개별 적용, 변호사 인가검토 미완료 |
| `A2-LAW-015` | 공식 2026-10-01 법원 공지와 법 2026-10-02 시행판 별도 확인 | **[ ] 부분**. 개정전문 부칙·경과조치·사건별 법원·적용일 미인증 |
| `A2-LAW-018` | PV 3천만/청산 3천2백만 차액 200만원 및 검토 경고 실행 | **[ ] 부분**. 시가/할인율/배당·채권자 동의·공정성·수행가능성 미인증 |
| `A2-LAW-022` | #145 `automaticLegalApproval=false`, #157 stale blocked vs 현재 provisional, source-only·0·null 분리 | **[ ] 부분**. 제품 전체 final 게이트/실제 DOCX·실무자 승인 미완료 |

**이번 변경은 감사 증빙 및 중앙보드 해당 4 ID의 진행문구뿐**. 기존 Draft #157/#145/#154/#138/#133의 기능 변경이나 법률 자동판단을 main에 병합하지 않는다.

**다음 r67 데이터담당자**: #157과 #145를 실제 Node/TS 회귀 환경에서 실행하고 #138 Fact 생산자 계보, #148 원화 저장상태, #153 SQL 동일-ID replay 헤드 무결성, #154 서식 불확정값을 분리·통합 검증. 원문→Fact→typed→실제 SQL feature→D5103/D5110/D5111의 값·판본·출처 종단 재독 필요. 법원 424 PDF 경과조치/사건별 적용일 및 변호사·계산사무장 승인 별도.

**제품 최종 인수 완료 0건.** 이번 회차 실제로 한 것은 GitHub 소스·스키마/테스트·Draft diff 재독, 실제 함수 본문 V8 격리 시험, SQLite 메모리 합성 DDL 저장 재독, 공식 HTML 법조문·법원 공지/세무 안내 재조회. 전체 프로젝트 Node/CI, staging D1/R2/Cron, 실제 DOCX 생성·재독, 법원 공식서식 동등성, 사람 법률·회계·세무 승인, 사이트 배포 **미실행**. 운영 배포/운영 마이그레이션/전자제출/인가 확정 **미실행**.
