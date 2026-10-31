# FirmEngine A2 r25 — 데이터담당자: 무효 대표기간의 월소득 승인토큰 거짓 통과

- 회차: r25, 2026-10-31 KST. 역할 순환: r24 변호사 → **r25 데이터담당자** → r26 AX담당자.
- 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 최신 main 조회 SHA: 초기 `20ce7c2d6e9d353fd1b63800cc1f6d45ca21f0a1`; 영수증 생성 직전 `20ce7c2d6e9d353fd1b63800cc1f6d45ca21f0a1`.
- 인수 보드 선택 ID: **A2-DATA-012, A2-DATA-018, A2-DATA-020, A2-DATA-022** (모두 부분 검증 **[ ] 유지**, 제품 인수 0).
- 읽은 자료: main 최근 변경/PR 상태, [r24 기록](2026-10-31_r24_1215KST_law-selected-period-approved-income.md), 중앙 보드, `lib/assessment.ts`, `lib/form-mapping.ts`, `lib/domain.ts`, `lib/reference-decision-tables.json`, `lib/template-token-catalog.json`, `drizzle/0011_case_calculation_features.sql`, `package.json`, 기존 Draft PR #76 테스트·코드 및 PR #58/#67/#71 개요.
- 참고 PR #76: https://github.com/firmengine/firmengine/pull/76 (Draft, **미병합**).

## A2-DATA-012 / DATA-018 / DATA-020 — P1 승인 표시 선행조건 불일치

**결함:** PR #76 전 `buildFormBindings().scalars.approved_monthly_income` 실제 승인조건은 대표기간의 **존재** 여부 `!!data.context.filingPeriod`만 검사한다. 반면 같은 앱의 `aggregateIncomeObservations`는 불완전/무효 기간을 `INCOME_FILING_PERIOD_INVALID`로 적으며, D5103 월별행은 기간 양 끝이 완전한 달력월인지 별도로 확인한다. 법률상 인정의 의미를 변경하지 않더라도 **무효 대표기간을 승인 완료처럼 표기할 수 있는 UI/서식 내부 정합성 결함**이다.

**실제 실행:** GitHub PR #76의 `lib/form-mapping.ts` blob `ba21fc0bf8f9ef3e5179593861e8476ba74531d7`에서 `approved_monthly_income`의 **실제 조건식 본문**을 추출하여 V8에서 직접 평가. 합성 `data.context.inventoryComplete.income="yes"`, `incomePeriodReviewed=true`, `data.incomes=[{id:"SYN-I", recognition:"accepted",factIds:["F-1"]}]`, `calculation.incomeRows=[{id:"SYN-I",monthlyWon:"2400000"}]`, `calculation.monthlyIncomeWon="2400000"`, lineage 함수는 격리 대역으로 오류 없음 `[]` 제공. **원본 Fact 생성·typed 저장·실제 calculateCase/D1/DOCX 실행은 아님.**

| 합성 대표기간 / 값 | 독립 기대(승인조건) | PR #76 수정 전 조건식 | 수정 후 |
| --- | --- | --- | --- |
| 2026-01-01~2026-12-31, 2,400,000원 | true | true | true |
| 2026-01-15~2026-12-31, 2,400,000원 | false | **true** | false |
| 2026-01-01~2026-12-15, 2,400,000원 | false | **true** | false |
| 2026-01-01~2026-02-30, 2,400,000원 | false | **true** | false |
| 2026-12-01~2026-01-31, 2,400,000원 | false | **true** | false |
| 대표기간 없음, 2,400,000원 | false | false | false |
| 정상 기간, 명시적 0원 | true | true | true |
| 시작일 부분월, 명시적 0원 | false | **true** | false |
| 정상 기간, 계산액 null | false | false | false |

- **독립 기대 일치: 기존 4/9 → 수정 후 9/9**. 실제 predicate+검사 helper의 V8 격리 실행만 통과. `true`는 **해당 승인조건식만 참**이라는 뜻이며 실제 법률상 인정 또는 서식 생성 승인이 아니다.
- **수정:** 기존 Draft PR #76의 `lib/form-mapping.ts`에 달력월 시작일·말일·실존 날짜·시작/종료 순서를 검증하는 `completeFilingWindow()`를 추가하여 `approved_monthly_income` 조건에 적용. 제품 코드 blob `81f9f952f355288ecb2b78005f7c9f05c8c360e8`, 커밋 `cb99f30c5c1398a44b4ff3bb94fe9ec32377dfd0`.
- 같은 Draft의 `tests/a2-r23-filing-window-month-form.test.ts`에 합성 Node 테스트 **2그룹 작성**(정상/부분월/무효일자/기간 역전·source-only); commit `acf80775987e7bace1171d275723eeb46037cca2`, test blob `c7e05b7cc1b5bb066bb4397974af59541a162bcd`. **Node 실행 미실시**, 전체 CI 미실행, staging D1·R2·DOCX 미실행. PR #76 변경 파일 2개 모두 허용 경로 안, Draft·미병합 확인.
- 안전성 경계: 선택 기간을 자동 생성하거나 법률상 대표기간으로 승인하지 않음. 기존 원문 관측금액, Fact, typed 금액, SQL feature, 계산 산식, 날짜·토큰 카탈로그 불변. `approved_monthly_income`만 명시적으로 미확정. `monthly_income` 관측 프리뷰 및 D5103 월별행의 실제 출력·표기 역시 미인증으로 남김.

## A2-DATA-022 — 독립 정수원 기대값 (엔진 대조 미실시)

- 가상 월 2,400,000원×12개월 = 28,800,000원; 11개월 = 26,400,000원; 차이 2,400,000원. 두 수는 원천 관측량으로 **법률상 인정/소득 변제기초 금액이 아님**.
- 가상 순소득 2,400,000원−가상 생계비 1,400,000원 = 월 1,000,000원; 36·48·60회 명목총액 36,000,000 / 48,000,000 / 60,000,000원. 예외기간 선택의 법률적 적합성은 미인증.
- 현 main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 18 모듈, 입력 선언 91(고유 78), 출력 선언 42(고유 40), resultPaths 42(고유 42). `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5110 55, D5111 82개. **정적 등록정보 파싱**으로서 91개 typed pointer/42 SQL 저장·재독/출력/서식 값 일치가 아님.
- SQL 스키마 `case_calculation_features.value_json TEXT NOT NULL`, `value_won TEXT` NULL 허용 및 status 별도. 기존 Draft PR #71과 SQL 저장/재생의 공동 통합 시험은 미완료.

## 공식 출처·시행일 (검토 경계)

1. 법령정보센터 「채무자 회생 및 파산에 관한 법률」 [시행 **2026-10-02**] [법률 제21490호 2026-03-24 타법개정] 제611조. 재산·소득·채권 변제계획과 변제기간(원칙 3년/특별사정 최대 5년)을 명시. https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221
2. **서울회생법원** 2026-10-01 보도자료: 실무준칙 제424호 **제2조 제2항 제7호 신설** 공지. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . **첨부 개정전문 PDF/부칙·경과조치·사건별 적용일 미확인**이므로 새 자동규칙/변제기간 승인 금지.
3. **국세청** 부가가치세 신고 안내: 일반과세자 확정 과세기간 통상 각 6개월, 간이과세자 연간. https://ems.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574 . VAT 과세표준, 종합소득세 신고 소득, 회생 소득 인정은 동일값으로 자동 간주 금지.

## 다음 r26 — AX 담당자

1. PR #76 추가 Node 테스트 2그룹 **실행**, #58 D5103 중간월·끝단 누락, #67 부분월 소득, #71 SQL replay와 최신 main 통합/파일 충돌 검증. 계산엔진 `INCOME_FILING_PERIOD_INVALID`과 `approved_monthly_income`의 실제 전체 함수 호출 E2E가 우선.
2. 2026년 1~12월 중 11개월(첫/중간/마지막 결손), 합법적 명시적 0, null, 휴직, 부분월, 미래월, 겸업사업자·VAT/종소세 이중계산을 **Fact/typed/SQL feature→42 outputs→D5103·D5110·D5111**에서 전단 대조.
3. 36/48/60회 원단위 배분·채권/재산 청산가치, 공식 서식/법령판본 법률 검토, staging D1/R2 별도 증빙. 변호사·계산사무장 확인 전 **법률·세무·회계 적합성 미인증**, 인수 0건.
4. 운영 배포, 운영 D1 마이그레이션, 전자제출, 법원 인가 확정 실행 없음. 고객자료/OCR 원문/.env/키/비공개 답안 없음.
