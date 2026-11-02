# FirmEngine A2 r72 — 변호사 / 기본 변제원장 원천 누락·배분 합계·인가 경계

- 기준시각: **2026-11-02 12:16 KST**. 순환: r71 계산사무장 → **r72 변호사** → r73 데이터담당자.
- 대상: `firmengine/firmengine` main, **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만**. 인공 사건·채권·Fact ID 사용. 실제 고객·서류·원본 OCR·비공개 정답·환경변수·키 사용 없음.
- 감사 시작 main `4c4b14a276f5249870076e938e687f0ec83421b8`; 본 영수증 기록 직전 관찰 main `4c4b14a276f5249870076e938e687f0ec83421b8`. r71 [원장 영수증](2026-11-02_r71_1113KST_calc-default-allocation-integrity.md)부터 지속. 최근 main A1/A3/A4 기록과 A2 Draft #168/#165/#166(#157/#133 의존) 읽음.
- 현재 실제 원문 blob: main `repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`; r71 #168 blob `9abf2eff723d11d9da3d1b13507bbb2b27022422`; r72 분기 수정 blob `7d434e0a6170ce219b9df615e138582717611099`. 원본 계산기 `assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`.
- 별도 [Draft PR #172](https://github.com/firmengine/firmengine/pull/172)는 **#168 브랜치를 base로 하는 stacked 미병합 후보**. main 제품 코드 수정하지 않음. 승인 전 병합 금지.

## 1. 새로 관찰한 원장 신뢰성 갭: source-only → 확정 잔액 변환 위험

`buildRepaymentPlanModel` **실제 GitHub 원문 generated-default 분기**를 그대로 추출해 TypeScript 타입 주석/비-null 표기만 제거하고 V8에서 실행했다. 의존성 `moneyValue`, `addTrusteeFeeRows`, `orderRows`는 최소 동작 대체. 따라서 **실제 함수 분기 실행이지만 전체 Node 모듈 import, D1, DOCX, 법적 승인 시험은 아니다**.

합성 입력: 사건 `revision=8`, 채권 `SYN-A`·`SYN-B` 각 원금 1,000원/명시 이자 0원, `FactId=SYN-F1/SYN-F2`, 월 배분 각 1원, 36·48·60개월, 회생위원 보수 명시적 0원.

| 입력/변경 | 독립 기대 | Draft #168 관찰 | Draft #172 후보 관찰 |
|---|---|---|---|
| 정상 36/48/60개월 | 각 72/96/120원, provisional(법률 승인 아님) | provisional·이슈 없음 | 동일 |
| `SYN-A.principal=null` | 원천 미관찰, 0원 전환 금지, blocked | **provisional / 첫 balanceAfter=0** | blocked / `DEFAULT_ALLOCATION_SOURCE_BALANCE_MISSING`, 빈 원장 |
| `SYN-A.interest=null` | 미관찰 이자 보류, blocked | **provisional** | blocked / 동일 코드 |
| `planTotalWon=999`, 배분합 72/96/120 | 독립 금액 불일치 blocked | **provisional** | blocked / `DEFAULT_ALLOCATION_TOTAL_MISMATCH` |
| `allocations=[]`, planTotal 72/96/120 | 비영 원장 무배분 차단 | **provisional** | blocked / `DEFAULT_ALLOCATION_TOTAL_MISMATCH` |
| 동일 debt ID 중복 배분 | r71 결함 회귀, blocked | blocked | blocked 유지 |
| `caseRevision=7` vs 사건 8 | r65 판본 회귀, blocked | blocked | blocked 유지 |
| 명시적 `planTotalWon="0"`, 배분도 0 | 0은 null 아님, 승인 아님 | provisional | provisional 유지 |

**실행 관찰: 36/48/60 × 9 경계 시나리오 = V8 후보 독립기대 27/27 일치.** 위 주항목 외 `priority` 무일정 상태도 별도 실행. 계산식 `(원금 배분+이자 배분) 합 = planTotalWon`을 수정 후보에서 직접 재검산하며 금액 재배분/보간/법적 인가판단은 하지 않음.

**추가 미해결 두 조건** (27건 중 일부이되 합격 아님):
1. `priority` 세금채권 100원 추가·월 우선채권 10원·명시 일정 없음인 합성 건에서 #168/#172 고립 원장은 `provisional`·우선채권 행 0. 실제 생산 함수 `calculateCase`는 별도로 `PRIORITY_CLAIM_SCHEDULE_COVERAGE_REQUIRED` 이슈를 발행함을 원문에서 확인했으나 원장 단독 소비처까지 전파되는지는 **미확인**. 법적 분류 및 예외 계약 검토 전 자동규칙 도입하지 않음.
2. `SYN-A` 원금 1,000원에 배분 2,000원, 총배분 및 월제안액을 맞춰 놓은 경우에도 단독 기본원장이 `provisional`. 실제 계산기가 생산할 수 있다고 단정할 수 없는 **손상·복원 결과 방어갭**. 법률/계산사무장 승인 전 채권별 상한 정책 변경 금지.

## 2. 변경/회귀/실제 실행 경계

- [Draft #172](https://github.com/firmengine/firmengine/pull/172): `lib/repayment-plan-model.ts` **9줄 추가**, 기존 #168의 ID 중복/음수/비정규형/판본 차단 보존. `tests/a2-r72-law-default-plan-source-conservation.test.mjs` 신규: **24개 실행형 Node 테스트 선언 + 2개 명시 TODO**. 두 경로 모두 `ax-site` 내부; GitHub 두 파일 커밋 및 #168 대비 2파일 차이를 확인.
- **실제 수행:** V8 변환 분기·합성 입력 27건 독립 예상값과 결과 대조, 원문 소비자 `assessment.ts`/schema 읽기, JSON 정적 재파싱, 독립 BigInt 산술. 프로젝트 Node 테스트 러너(새 24개 시험) **실행 안 함**. 전체 CI/staging D1·R2/Cron/실제 Word/DOCX/공식 양식 동등성 **미실행**.
- 고위험: interest null이 일부 사건의 실제 `비해당`인지 `미관찰`인지 typed 계약 및 원천 Fact 증명 필요. 과차단 영향은 실무자 검토 전 미확정. 원문/Fact/typed/SQL status (`missing`·`blocked`·`provisional`·`not_applicable`·`computed`·`conflict`)를 서로 덮어쓰지 말 것.
- 전체 `case_calculation_features`의 `value_json`·`value_won`·`status`·`source_fact_ids_json` DDL은 [drizzle/0011](../../drizzle/0011_case_calculation_features.sql) blob `0caa359d250dce45765d269d271ad63170ec3efa` 및 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`에서 읽음. **이번 회차 SQL INSERT/재조회 없음**, 이전 회차 SQL 시험을 이번 회차 PASS로 재사용하지 않음.

## 3. 계산/서식 계약 및 독립 산술

- `reference-decision-tables.json` main blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 계산 **18모듈, 91 선언 입력(고유 78), 42 선언 출력(고유 40), 저장 경로 42**. `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37개 / D5110 55개 / D5111 82개 토큰. 이 수치는 `JSON.parse` **정적 계약**이며 실제 18×91×42 SQL/Word 경로 전체 실행이 아님.
- 독립 BigInt: 급여 2,400,000원×12=**28,800,000원**; 사업소득 1,000,000원×11=**11,000,000원**; 관측 합계 **39,800,000원**. 2026-12 사업소득은 미래 미관찰 **null**, 12개월 사업소득 평균 **미산정**.
- VAT 신고매출 가상 60,000,000원과 종소세 신고금액 가상 20,000,000원은 **source-only**이며 소득 합계에 추가하지 않음. 월 900,000원×36/48/60=**32,400,000/43,200,000/54,000,000원**은 명목 계산만. PV 30,000,000원 vs 청산가치 32,000,000원 차액 **2,000,000원**도 인가요건 증명이 아님.

## 4. 법률 원문 및 시행/관할/승인 경계 (2026-11-02 직접 확인)

- **법제처 국가법령정보센터**, [채무자 회생 및 파산에 관한 법률 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), **[2026-10-02 시행, 법률 제21490호]**: 제1항의 우선/재단채권 전액 및 채권자목록 변제 기재, 제3항 동순위 형평, 제5항 3년 초과 원칙 금지·특별사정 5년 범위. 36/48/60 산술은 48/60개월 특별사정 승인과 무관.
- **동법 제614조**, [2026-10-02 시행판 공식 조문](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 공정·형평·수행가능성과 인가일 기준 청산가치 요건은 개별 사실/채권자 동의 등을 요구, 내부 provisional/blocked와 동일시 금지.
- **서울회생법원** 2026-10-01 [공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): **실무준칙 제424호 제2조 제2항 제7호 신설** 확인. **공지일 ≠ 사건 적용일**. 첨부 개정전문·부칙/경과조치 및 개별 사건 적용일은 **미검증**. 서울 외 법원으로 확장 금지, 사람 승인 없이 자동 3년 미만 특례 적용 금지.
- **국세청** [VAT 과세기간 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 반기, 간이과세자 통상 연간(유형전환 등 예외 있음). 사업 매출·종소세 신고금액을 법원 인정 월순소득으로 자동 결정하지 않음.

## 5. 중앙 A2 ID / 승인상태 / 후속

| ID | 이번 실제 관찰 | 결과 |
|---|---|---|
| `A2-LAW-007` | 우선·재단 별도 schedule 없는 단독 원장은 provisional이고 producer는 별도 이슈를 발행함. 채권별 분류·별제권·판본 미검증 | **부분 [ ] 유지** |
| `A2-LAW-014` | 36/48/60개월 별 정상·null·합계불일치·stale·0의 V8 분기·독립 금액 확인 | **부분 [ ] 유지** |
| `A2-LAW-018` | 배분합≠planTotal 및 원천 미관찰로 제614조 수행가능성 판단을 할 수 없는 케이스의 내부 보류 후보 | **부분 [ ] 유지** |
| `A2-LAW-022` | 원문 null→0→provisional 허위 정상 경계 및 #172 차단 후보, 법적 승인과 계산 provisional 구별 | **부분 [ ] 유지** |

**다음 r73 데이터담당자**: #172/#168 의존성을 고정해 source Fact→typed debt balance→SQL `case_calculation_features`→원장→D5110·D5111의 동일 값 재독. null 이자를 실제 미관찰/비해당으로 구분, 별도 우선채권 행 및 초과배분 2 TODO를 독립 기대값으로 재심사. Node 24개 실실행, 전체 CI와 staging 증빙 확보 전 PR 병합·인수 승격 금지.

**이번 제품 최종 인수: 0건.** 운영 배포, 운영 D1 migration, 전자제출, 법원 인가 확정, 법률상 인정값 자동 적용 **모두 미수행**.
