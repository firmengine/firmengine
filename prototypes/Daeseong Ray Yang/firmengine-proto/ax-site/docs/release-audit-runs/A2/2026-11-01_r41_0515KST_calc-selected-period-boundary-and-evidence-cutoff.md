# FirmEngine A2 r41 — 계산사무장: 선택 소득 대표기간의 첫·끝월·미래월 D5103 전파 (부분)

- 감사 날짜: **2026-11-01 KST**. 순환: r40 **사용자·서류담당자** → r41 **계산사무장** → 다음 r42 **변호사**.
- 시작 main: `7eeaf274921ca8385f93d63c9a35aac7ee09107b`; 영수증 생성 전 최신 main: `7eeaf274921ca8385f93d63c9a35aac7ee09107b`. 보드 기준 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 감사 체크 **A2-CALC-015 / A2-CALC-016 / A2-CALC-030**은 모두 **[ ] 부분**; 인수 완료 **0**.
- 변경 허용 디렉터리: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 실제 고객/원본 OCR/키/.env/비공개 정답 사용·적재 없음. 운영 배포·운영 D1 migration·실제 전자제출·법원 인가확정 없음.

## 1. 읽은 main 실제 소스·최근 이력

- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`: `monthSpan`, `monthlyIncome`, `aggregateIncomeObservations`, `calculateCase`의 `coverageIncomplete` 및 검토 상태 처리. **현재 계산 aggregate의 무효 부분월 기간/검토 합산분류 관련 Draft #79/#96/#102는 main에 병합되지 않음**.
- main `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`: `rows.month`는 `exactSourceCalendarMonth`로 만든 실제 월별행; `approved_monthly_income`은 기존 조건으로 계산되며 Draft #98과 차이.
- main `lib/document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`: D5103 개별 월 포맷 검사는 있으나 **선택한 대표기간 자체를 인자로 받지 않음**.
- main `lib/document-writer.ts` 변경 전 blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`; 실제 `prepareDocumentWrite()`는 사건 `data.context.filingPeriod`과 preflight의 D5103 바인딩을 모두 접근할 수 있음.
- main `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: `value_json` / `value_won` / `status` / `source_fact_ids_json` 별도 컬럼. 운영 D1 실검증 아님.
- 기준 JSON blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 계산 모듈 / 입력선언 91(고유 78) / 출력선언 42(고유 40) / resultPaths 42(고유 42)**; 토큰목록 blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37, D5110 55, D5111 82**. 파싱한 정적 계약이며 전체 91→42→SQL→Word 실연결 결과는 아님.
- 이전 [A2 r40 영수증](2026-11-01_r40_0415KST_doc-threeform-preflight-integration.md) 및 [Draft #106](https://github.com/firmengine/firmengine/pull/106) V8 18시나리오 16/18 일치: D5103 첫 달·마지막 달이 누락되어도 `ready`가 되는 두 반례를 이어받음. #106 수정 내용은 **main 반영 전**.

## 2. 이번에 실제 실행한 독립 합성 시험

실제 `data.context.filingPeriod={start:'2026-01-01',end:'2026-12-31'}`에서 월 2,400,000원 ×12 = **28,800,000원**; 한 달 미관찰이면 ×11 = **26,400,000원**, 차액 **2,400,000원**. 이는 산술상 관측 금액이며 법원 인정 월소득이 아님.

| 합성 입력·조건 | 독립 기대 | Node 22.16.0에서 새 helper 관찰 |
|---|---|---|
| 선택 1~12월, 관측 12월, 월 240만 | 결손 없음 | `complete` |
| 2~12월만 관측 (1월 미관찰) | `missing=['2026-01']` | 일치 |
| 1~11월만 관측 (12월 미관찰) | `missing=['2026-12']` | 일치 |
| 마지막 11월 중복 관측으로 12월 누락 은폐 시도 | 누락 유지 | 일치 |
| 선택 자체가 2~12월의 11개월 | 11개월로 검증 (고정 12 강제 금지) | `complete` |
| 명시적 0원 | 유효한 0관측 | `complete` |
| `[확인 필요]` / 잘못된 쉼표 `2,40,000` / 음수 | 금액은 미관찰·검토 | 일치 |
| 기간 외 2025-12 | 별도 범위 밖 | `D5103_MONTH_OUTSIDE_SELECTED_PERIOD` |
| 명시한 증빙 cutoff 2026-10-31 vs 2026-11/12 | 미래월 보류 | `D5103_SELECTED_PERIOD_AFTER_EVIDENCE_CUTOFF` |
| cutoff 자체 없음 | 미래를 추정하지 않음 | 별도 미래코드 없음 |
| 선택 기간 1/15 시작·잘못된 2026-02-29 | 잘못된 완전 달력월 | `D5103_SELECTED_PERIOD_INVALID` |
| 선택기간 미지정, 월별행 존재/없음 | 각각 검토대기/비해당 | 일치 |

- 위를 포함해 **helper Node 합성 단위시험 15/15 실제 통과**, 명령 `node --experimental-strip-types --test tests/a2-r41-period-coverage.test.ts` (동일 로컬 소스, 업로드 Git blob 동등성 재조회); `tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck lib/income-period-coverage.ts` 별도 통과.
- 이전 [r37 SQLite 합성 스크립트](2026-11-01_r37_0114KST_data-same-fact-review-and-form-gate.md)의 migration 0011 모사 테이블을 **별도로 재실행 9/9 기대 재현**. 특히 `value_json=null` + `value_won=0`, 금액상승+NULL, `0`+`blocked`가 **스키마에 저장 가능**함을 재확인. 이는 제품 PASS가 아니라 불변식 검증 필요성 증빙임. *실제 D1/전체 42개 output_path 재조회 아님*.
- 실제 제품 `prepareDocumentWrite()`의 종단 Node 로딩, Word 생성, 전체 TypeScript 빌드/CI, staging D1·R2·Cron은 **미실행**. 메인 통합 pass 주장 금지.

## 3. Draft 수정 및 파일경합 경계

- [Draft PR #108](https://github.com/firmengine/firmengine/pull/108), branch `audit/a2-r41-calc-selected-period-coverage-20261101-0515`. **미병합·실무승인 전**, main 제품 코드 변경 없음.
- 코드: `lib/income-period-coverage.ts` (동적 선택 기간·월별금액·명시적 cutoff의 보류 판단), `lib/document-writer.ts` (D5103 `final` blocker, `draft` warning; 기존 preflight 다음 단계에서 적용), `tests/a2-r41-period-coverage.test.ts` (15개 합성 테스트). 기존 #106의 `document-preflight.ts` 파일과 다른 경로로 분리했으나 **두 Draft 결합 종단시험 전 독립 병합 금지**.
- 로컬·업로드 동일 Git blob SHA: helper `d3cc44be8fc18b5760d0bf270d280f1e8aee9076`, test `6c2a1ddf6da21a0cf10507ef5afbd7e816ffeb70`; writer 수정 blob `8d0e2df82c34350cf4656990ac2224f8389a7a4a`. 변경경로 3/3 모두 `ax-site` 내부.
- 안전 이슈: 현재 #96(합산 검토 전 총액), #97(동일 Fact 상충), #98(승인 form token), #102(충돌 총액 차단), #106(삼중서식 preflight), #67/#79(부분월/무효 대표기간) 모두 관련 통합 경로를 건드림. 개별 PR 임의 병합 금지.

## 4. 공식 법률·국세청·법원 확인 (2026-11-01 기준)

- **채무자 회생 및 파산에 관한 법률** [법률 제21490호, **2026-10-02 시행**] **제611조(변제계획 내용)** `https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777`, **제614조(변제계획 인부)** `https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759`. 내부 월 누락 경고나 `ready`는 법률상 인가 또는 변제기간 인정이 아님. 사건별 기준시점 적용은 변호사 검토 필요.
- **서울회생법원 2026-10-01 공지** `https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187`: **실무준칙 제424호 제2조 제2항 제7호 신설** 공지까지 확인. **개정전문 PDF의 부칙·경과조치, 효력발생일·개별 사건 적용일 검증하지 못함**. 공지일=모든 사건 적용일이라 단정·자동규칙 등록하지 않음.
- **국세청 공식 부가가치세 안내** `https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486`: 일반과세자 반기·간이과세자 통상 연간 신고기간. VAT 총매출/매출세액/종합소득세 신고소득/법원 인정 월순소득 상호 동의어 금지. 이번 작업은 VAT·종소세·청산가치 법률 산식 수정 없음.

## 5. A2 ID 및 다음 인수

- `A2-CALC-015`: 선택 대표기간 밖 2025-12를 별도 검토 후보로 표시하는 helper 실제 테스트, 그러나 Fact→typed→완성본 E2E·법률인정 **[ ]**.
- `A2-CALC-016`: 첫/마지막월 11/12 및 동적 11개월 선택·부분월·미래월 반례 helper 15건 중 해당 사례 재현, main 구간은 미반영. **[ ]**.
- `A2-CALC-030`: 명시적 0·미관찰·음수·쉼표 오기·중복·SQL 상충 저장을 분리, 실제 helper Node 및 SQLite 합성만. **[ ]**.
- 다음 r42 **변호사**: #108 writer→#106 preflight→#96/#97/#98/#102 `calculateCase`/서식 종단 회귀; 선택 대표기간의 법률적 적용·evidence cutoff 의미, #67/#79 부분월, 서울 제424호 부칙/경과조치 승인 검토. 전체 Node·CI/D1/R2/DOCX/공식서식 및 전문가 확인 전 인수 불가.

**코드 존재 ≠ helper Node 단위통과 ≠ 전체 CI ≠ staging 데이터/서식 실검증 ≠ 법률·회계 인수 ≠ 운영 배포.**
