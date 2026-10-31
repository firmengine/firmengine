# FirmEngine A2 r26 — AX 담당자: 대표기간·서식·계산 경계 교차검증

- 기준일: 2026-10-31 KST. 역할 순환: r25 데이터담당자 → **r26 AX담당자** → r27 IT담당자.
- 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **하위에 한정**. 운영배포·D1 운영 마이그레이션·전자제출·법원 인가행위 미수행.
- 초기 GitHub main HEAD: `0bf89348221a64ecd1c019710e5b4fe9d0d922c7`; 중앙 보드 초기 blob SHA: `02493bbd34b9f205b070236d16eaa284e122740e`.
- 중앙 보드 [ ] 유지 대상: **A2-AX-010, A2-AX-012, A2-AX-014, A2-AX-015**. 이 4 ID의 검증은 모두 **부분**이다. 이번 회차 제품 인수 완료 **0건**.
- 읽은 자료: main 최근 커밋/PR, r25 영수증, 중앙 보드, `package.json`, `lib/assessment.ts`, `lib/form-mapping.ts`, `lib/document-preflight.ts`, `lib/case-calculation-feature-store.ts`, `lib/preapproval-calculation-replay.ts`, `drizzle/0011_case_calculation_features.sql`, 계산/서식 카탈로그, PR #58/#67/#71/#76 실제 변경 본문 및 테스트 소스.
- 관련 Draft PR 전부 **미병합**: [#58](https://github.com/firmengine/firmengine/pull/58), [#67](https://github.com/firmengine/firmengine/pull/67), [#71](https://github.com/firmengine/firmengine/pull/71), [#76](https://github.com/firmengine/firmengine/pull/76). 변경 경로는 각각 `document-preflight.ts` / `assessment.ts` / `preapproval-calculation-replay.ts`·API route / `form-mapping.ts`로 **이번 조회 파일목록상 교집합 없음**. 이는 실제 브랜치 합본 빌드 성공을 뜻하지 않는다.

## 입력 및 독립 기대값 — A2-AX-010 / AX-012 / AX-014

합성 원천의 형태는 `document {id:SYN-doc,sha256:synthetic}` → `page {documentId:SYN-doc,page:1,text:synthetic}` → `Fact {id:F-2026-01,subjectId:I-2026-01,key:income.net,rawValue:"2400000",value:"2400000",numeric:"2400000",state:verified,recognition:accepted,refs:[synthetic quote]}` → `income {id:I-2026-01,amountBasis:monthly,periodStart:2026-01-01,periodEnd:2026-01-31,net:"2400000",factIds:[F-2026-01]}` → 계산 `incomeRows` → 서식 `rows.month`. 이는 **회귀용 모델링 예시이지 원본 OCR/Fact/typed/SQL 실행 증거가 아니다**. 실제 DB 저장은 수행하지 않았다.

선택 기간 `2026-01-01~2026-12-31`, 월 관측 2,400,000원: **12개월 28,800,000원**, **11개월 26,400,000원**, 차이 **2,400,000원**. 단순 관측 합계이고 법률상 인정·회생 가용소득이 아니다.

PR #76 `lib/form-mapping.ts` Git blob `81f9f952f355288ecb2b78005f7c9f05c8c360e8`의 실제 `completeFilingWindow` 본문과 `approved_monthly_income` 조건식을 추출(서명/타입만 제거, 출처 line 30-38 및 147-152)해 V8에서 실행. **12/12 독립 기대 일치**:
- 정상 2026년 전체기간, 2024년 윤년 2월 → `2,400,000` 표시(합성 조건식에 한정).
- 대표기간 미선택, 부분 시작/종료, 2월30일, 기간 역전, 미관찰 null, 미수락 소득, source lineage 오류 → **`[확인 필요]`**.
- 정상 기간의 명시적 0원 → **`0`** 보존.
- **2027년 1월을 선택기간으로 지정하면 형식상 검사만으로 통과**. *미래월의 실제 증빙 관측/사건 평가기준일/법적 인정은 이 조건식의 입력에 없으므로 승인 가능하다는 결론 금지.* 미래월은 별도 프로듀서 및 사건시점 검증 필요.

같은 Git blob의 실제 `rows.month = calculation.incomeRows.map` 본문 16행을 추출하여 sourceValid/number formatter만 격리 대역으로 실행. **6/6 독립 기대 일치**: 2025-12 및 2027-01은 `[확인 필요]`; 선택기간 안 2026-01·03·04는 `2,400,000`; 2026-02 명시적 0원은 `0`. 실서식 DOCX 생성은 아님.

## D5103 누락월 최종 사전검증 — A2-AX-010 / AX-015

PR #58 `lib/document-preflight.ts` Git blob `560935bbbc61f1c253b26a05ecd866840efd6da0` 중 **실제 D5103 조건문 29행**을 TS 타입 단언만 제거해 V8에서 실행. `numeric()`은 동일 테스트 범위의 격리 정수 파서로 제공. **7/7 독립 기대 일치**:

| 합성 입력 | 독립 기대 | 실제 관찰 |
|---|---|---|
| 2026 1~12월, 승인 월액 240만원 | 추가 월누락 오류 0 | 0 |
| 6월 빠진 11개월, 최종 | D5103_MONTH_COVERAGE_GAP blocker | blocker 1 |
| 12월 빠진 1~11월, 최종 | 이 함수 단독으로 끝단 누락 감지 불가 | 0 (**미해결 종단 결손**) |
| 1월 빠진 2~12월, 최종 | 이 함수 단독으로 첫달 누락 감지 불가 | 0 (**미해결 종단 결손**) |
| 6월 명시적 0원, 12개월 | 금액 누락 아님 | 0 |
| 7월 금액 `[확인 필요]`, 최종 | D5103_MONTH_EVIDENCE_UNRESOLVED blocker | blocker 1 |
| 6월 누락, 초안 | 오류가 아닌 검토 warning | warning 1 |

**특히 첫/끝달 누락은 해당 preflight 단독으로 통과할 수 있음.** 진짜 제출가능성 판정은 `calculateCase`의 `INCOME_PERIOD_COVERAGE_INCOMPLETE` 및 승인 토큰과의 **실제 결합 호출**을 통해서만 검증할 수 있다. 12개월을 무조건 법정 필수로 자동강제하거나 휴직을 0원으로 채우지 않음.

## 실제 Node v22 격리 실행 — A2-AX-015

`node --test /mnt/data/firmengine_a2_r26/isolated_calendar.test.mjs` 실행: **15/15 PASS**, 0 fail. GitHub #76의 `completeFilingWindow` **함수 본문은 타입서명만 제거해 그대로 복사**, 12가지 유효/부분월/무효·윤년·미래기간 문법 검사; 나머지 3개는 독립 BigInt 및 0/null/비해당 산술·상태 오라클.
- 산술: (3,000,000−2,000,000) × 36/48/60회 = **36,000,000 / 48,000,000 / 60,000,000원**. 실제 배분/잔여원/청산가치 법적 판단·엔진 실행 아님.
- `0` / SQL `NULL` / `not_applicable` **표시상 독립 상태**를 JSON 합성 비교. SQL INSERT·SELECT를 수행한 것이 아님.
- **이번 Node 15건은 프로젝트 원래 import 기반 `tests/a2-r23-filing-window-month-form.test.ts` 8개를 실행한 것이 아니다.** 해당 원래 테스트의 `createCase→calculateCase→buildFormBindings` 및 전체 CI·staging D1/R2·Word는 실행하지 못했다.

## 계산 카탈로그/저장 스키마 재독 — A2-AX-015

현재 main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 계산 **18모듈**, 입력선언 **91**(고유 78), 출력선언 **42**(고유 40; `status` 및 `totals`은 모듈별 중복명), `resultPaths` **42**(고유 42). `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5110 **55**, D5111 **82** 토큰. 구조만 재파싱했으며 91 입력 실수치 계산, 42 결과 SQL 왕복, 최종 Word 값 재독해는 **미실행**.

SQL `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: `value_json TEXT NOT NULL`, `value_won TEXT` nullable, `status TEXT NOT NULL`. #71의 null/0/status/replay 보호와 #76의 기간 승인표시, #58의 D5103 중간월 공백, #67의 부분월 계산은 **서로 다른 코드 파일**이지만 **실제 하나의 main 기반 종단 경로로 병합해 테스트한 적 없음**. GitHub #76 HEAD `acf80775987e7bace1171d275723eeb46037cca2` 에 연결된 PR workflow runs **0건 검색**, commit status **0건 검색**: CI 성공으로 인정 금지.

## 공식 원문·관할·기준일

1. [국가법령정보센터 「채무자 회생 및 파산에 관한 법률」 제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221): **[시행 2026-10-02] [법률 제21490호, 2026-03-24 타법개정]**. 원칙 3년, 제614조 제1항 제4호 요건 등 특별사정에서 최대 5년; 이는 이번 36·48·60회 **산술 예시를 법적으로 승인하는 근거가 아님**.
2. [서울회생법원 2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): **서울회생법원 실무준칙 제424호 제2조 제2항 제7호 신설** 공지 확인. 첨부 개정전문 PDF의 **시행부칙·경과조치·개별 사건 적용일 미확인**. 사람이 승인하지 않은 신규 자동규칙 적용 금지.
3. [국세청 부가가치세 개요](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7694&mi=2272): 일반과세자 통상 6개월, 간이과세자 통상 1년 과세기간. 매출·VAT·종소세·인정 순소득을 동일값으로 자동 대체하지 않음. 국세청 원문 확인은 **세무 산식 종단검증이 아님**.

## 수정·차기 회차

- 이번에는 **제품 코드 수정·새 PR·운영 쓰기 없음**. 기존 #58/#67/#71/#76의 파일은 덮어쓰지 않고 읽기만 했으며, **감사 영수증 + 중앙 보드 4개 ID만 추가**. 별도 결함 수정은 종단 재현/실무 검토 전 보류.
- 다음 **r27 IT**: PR #76 원본 Node 프로젝트 테스트와 #58/#67/#71 전체 회귀를 의존성 있는 동일 작업트리에서 실행; 대표기간 **1월/6월/12월 각 1개월 결손**, 0/null/휴직/미래월을 `createCase→Fact/typed→calculateCase→D5103 preflight→SQL→D5110/11`로 추적. 기간 없는 매출/VAT·종소세 중복, 채권/재산/청산가치·원단위 배분도 다음 검증에 포함.
- **법률·회계 적합성 및 공식 서식 동등성: 변호사·계산사무장 승인 전 미인증.** Product acceptance 0; CI/staging D1/R2/Cron/Word/사이트 배포와 V8·Node 격리시험을 동일시하지 않는다. 공개 Git에 고객/OCR 원문/.env/키/비공개 정답 없음.
