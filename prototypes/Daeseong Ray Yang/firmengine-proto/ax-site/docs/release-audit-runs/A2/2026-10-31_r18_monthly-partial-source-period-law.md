# FirmEngine A2 18차 — 변호사 순환: 부분월 monthly 소득의 계산 승격 차단

- 감사일: **2026-10-31 KST**. 담당 순환: r14 AX → r15 IT → r16 서류담당자 → r17 계산사무장 → **r18 변호사** (다음 데이터담당자).
- 감사 시작 main SHA: `24e28b794abd9e0d71afecc0a1b8915c69548b8a`. r17 감사 영수증과 중앙 보드, 최근 커밋 및 오픈 PR을 조회. 최신 main과 원본 `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5` 기준.
- 단일 인수 보드 ID 5개: `A2-LAW-011`, `A2-LAW-014`, `A2-LAW-015`, `A2-LAW-022`, `A2-CALC-016`. **전부 부분 확인·[ ] 유지**, 법률/회계 인증 없음.
- 관련 코드·계약 직접 확인: `lib/assessment.ts`(`monthlyIncome`, `monthSpan`, `aggregateIncomeObservations`, `calculateCase`), `lib/domain.ts`(Fact/IncomeSource/NumericInput), `lib/business-income-policy.ts`, `db/schema.ts`, `drizzle/0011_case_calculation_features.sql`, `tests/ocr-calculator-input-integration.test.ts`, `tests/calculation-audit.test.ts`, `tests/case-legal-calculation-preflight.test.ts`. 기존 PR #58/#60와 새 #67은 Draft, 병합 안 함.

## 1. 원문→Fact→typed 소득 산식 P1 반례

실제 `monthlyIncome()` 함수본문을 GitHub main에서 읽고 타입표기만 제거해 V8에서 격리 실행. 월력 `monthSpan`/금액 파싱 등 주변 helper는 동등 의미의 **합성 shim**을 사용하므로 전체 Node 프로젝트 실행이라고 주장하지 않음. 원 단위 BigInt 비교, 다른 고객정보 없음.

합성 원문: `SYN: 월급 2,400,000원, 관찰기간 2026-01-15~2026-01-31` (실제 급여명세서 아님).
- Fact 스키마: `{id:'SYN-fact',subjectId:'SYN-R18-income',key:'income.net',value:'2400000',rawValue:'2400000',sourceUnit:'KRW',state:'verified',recognition:'accepted',numeric:{amountWon:'2400000',unit:'KRW',currency:'KRW',normalizationStatus:'exact'}}` (검증/인정값은 **테스트 설정**, 실제 사람 승인 아님).
- typed `IncomeSource`: `{kind:'wage',amountBasis:'monthly',periodStart:'2026-01-15',periodEnd:'2026-01-31',periodMonths:1,net:{amountWon:'2400000',...},factIds:['SYN-fact']}`.
- 독립 기대: **불완전한 월별 원천기간을 검증된 전월 월수입으로 취급하지 않고 `null`/검토 필요**. 확인된 `0`원과 구별.

| 테스트 입력 | 독립 기대값 | main 원함수 V8 | 수정 브랜치 원함수 V8 |
|---|---|---|---|
| monthly, 2026-01-15~31, 2,400,000원 | null/검토 | **2,400,000원** | null + `INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS` |
| monthly, 2026-02-01~30(존재하지 않는 날짜) | null/검토 | **2,400,000원** | null + 동일 코드 |
| monthly, 시작일만 2026-01-01 | null/검토 | **2,400,000원** | null + 동일 코드 |
| monthly, 2026-01-01~31 | 2,400,000원(산술 원천값) | 2,400,000원 | 2,400,000원 |
| monthly, 명시적 0원·완전월 | 0원 | 0원 | 0원 |
| monthly, 진짜 미관찰 null | null | null | null |
| monthly, 기간 미기재 | 2,400,000원 *원천 관측만*, 법률상 승인 아님 | 2,400,000원 | 2,400,000원 |
| period_total, 2026-01-01~02-28, 4,600,001원/2개월 | 2,300,000원(절사) | 2,300,000원 | 2,300,000원 |
| period_total, 부분월·개월수 불일치 등 3건 | 각각 null 또는 기존 값 | 기대 일치 | 기대 일치 |

**V8 격리 결과:** 수정 전 기대 일치 **8/11**, 수정 후 **11/11**. 이 수치는 코드 조각과 테스트 shim의 비교 결과이며 전체 엔진·SQL·Word/법원 적합성 합격 아님.

## 2. 수정·격리 검증·보류

- 비인가적 법적 수입 인정액 변경은 하지 않음. `monthlyIncome()`에서 `amountBasis:'monthly'`도 원천 기간이 제공된 경우 불완전/무효 달력월을 `period_total`과 동일하게 검토 코드로 차단. 원천을 지우거나 0으로 대체하지 않음.
- 별도 브랜치 `audit/a2-r18-monthly-partial-period-20261031-0612`; 제품 소스 수정 커밋 `b9d12ed50d3c5ac75adb686283031fab2e91dd4d`, 신규 Node 테스트 6개 소스 커밋 `81d316da769c127cef10410659b9ee78dc4b5bdf`.
- **Draft PR #67:** https://github.com/firmengine/firmengine/pull/67. main에 병합하지 않음. 신규 `tests/a2-r18-monthly-partial-period.test.ts`를 작성했지만 프로젝트 Node/TS 테스트로 **실행하지 못함**. PR 자체의 CI·staging·법률 승인은 별도.
- 실제 `calculateCase` 코드 정적 검토상 11/12월 coverage 가드가 존재하나, monthly 부분월은 원함수에서 월액으로 통과하고 집계의 기간 fallback이 관찰개월에 활용될 수 있음. 전체 `calculateCase` 실제 런타임으로 해당 교차경로를 실행하지는 못했음. 새 회귀 테스트에 케이스 경계를 추가.

## 3. 실제 저장 스키마의 SQL 격리 재조회(운영 아님)

`drizzle/0011_case_calculation_features.sql`의 3 테이블 컬럼·FK 정의를 로컬 **SQLite in-memory로 수기 동형 구성**하고 `cases` 최소 더미 1건을 만든 뒤 `case_calculation_runs` 1건, `case_calculation_features` 3건을 직접 삽입·재조회. **앱 저장 코드·D1 staging은 호출하지 않음.**

| 합성 feature 상태 | 독립 기대 SQL 값 | 관찰 `value_json` / `value_won` / `status` |
|---|---|---|
| 부분월 Blocked | `null` / SQL NULL / blocked | `null` / NULL / blocked |
| 실제 0원 | `"0"` / `"0"` / provisional | `"0"` / `"0"` / provisional |
| 완전월 관측만 | `"2400000"` / `"2400000"` / provisional | 기대 일치 |

3/3 직접 INSERT·SELECT 및 FK integrity 0건 오류. 합성 status는 테스트 작성자가 지정한 것이며 제품 승인 게이트를 입증하지 않음. SQL 외래키·타입 roundtrip과 R2/Fact 연결의 종단 일치도 별도 과제.

## 4. 등록 명세/공식 근거와 적용일

- `reference-decision-tables.json` 정적 JSON 파싱: **18 모듈 / 91 입력 선언(고유 78) / 42 출력·42 resultPaths**. `template-token-catalog.json` 정적 JSON: **D5103=37, D5110=55, D5111=82 토큰**. 동작·SQL·DOCX 토큰 채움은 *미검증*.
- 국가법령정보센터, 「채무자 회생 및 파산에 관한 법률」 **[시행 2026.10.02, 법률 제21490호]**, 제611조(변제계획에 소득·재산 및 변제기간 사항 포함). 원문 https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221. 월소득 출처 검증을 인가요건 충족과 혼동 금지.
- **서울회생법원** 2026-10-01 보도자료: 실무준칙 제424호 제2조 제2항 **제7호 신설** 공지. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187. **첨부 PDF 조문·부칙·사건 적용일은 미검증**; 서울 외 법원 자동 적용/규칙 승격 불가.
- **국세청** 부가가치세 개요: 일반과세 매출·매입세액 계산과 간이과세 별도 공제 체계, 과세기간 구분. https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272. 급여·사업 소득 인정액과 신고 VAT는 동치가 아님. 이번 코드는 세무 산식을 변경하지 않음.
- **법률·회계 적합성은 변호사/계산사무장 독립 검토 전 미인증.** 시행일·법원 확인은 자동규칙 시행 승인과 다름.

## 5. 다음 회차

**다음 데이터담당자 순환:** `A2-DATA-016/017/018` 및 `A2-IT-015` 등의 미검증 ID를 보드에서 새로 선정. PR #67과 기존 #58/#60의 **정식 Node 테스트**, 급여 11/12월 원문→Fact→typed→SQL feature 42출력·D5103/10/11 대응, 일반/간이 VAT·종소세 중복·채권/재산/청산가치, 36/48/60 원화잔여원·날짜를 이어서 검증할 것. 운영 D1/R2/Cron, CI, 공식 DOCX, 법원 제출, 전문가 승인은 모두 미관찰/미인증. 운영배포·D1 운영마이그레이션·실제 전자제출은 하지 않음.
