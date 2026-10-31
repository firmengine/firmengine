# FirmEngine A2 r39 — IT담당자: D5110/D5111 승인 월소득 미확정 시 최종본 보류

- 기록 기준: **2026-11-01 03:08 KST**. 이전 r38 **AX담당자** → 이번 r39 **IT담당자** → 다음 r40 **사용자·서류담당자**.
- 감사 시작 및 영수증 작성 직전 main: `3fabd60d80fe8539e1ab06f91fa1f95e0093b34e` (작성 직전 실제 HEAD `3fabd60d80fe8539e1ab06f91fa1f95e0093b34e`). 커밋/PR 최근 변경 재독. 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A2-IT-004 / A2-IT-016 / A2-IT-017** 점검, 모두 **[ ] 유지**.
- 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 실고객문서·OCR 사실값·개인정보·키·.env·비공개 정답 사용/공개 Git 적재 없음.
- 제품 인수/실제 법률·회계 전문가 승인 0건. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 수행 안 함.

## 1. 소스/PR/스키마 재독과 현재 계약

| 확인 파일 | 본문 Git blob SHA |
| --- | --- |
| `lib/document-preflight.ts` (main) | `dc771c0ff0497d24df19478b0366ebbb397bfbf2` |
| `lib/form-contracts.ts` | `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef` |
| `lib/legal-form-field-policy.json` | `f6ea8211ff1f4e4c1339165e510e2120d2d4775b` |
| `lib/form-mapping.ts` (main) | `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e` |
| `lib/income-resolution.ts` (main) | `f370c4b14fd347089708c5c3241fa9c72522d4bf` |
| `lib/assessment.ts` (main) | `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5` |
| `drizzle/0011_case_calculation_features.sql` | `0caa359d250dce45765d269d271ad63170ec3efa` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| `lib/template-token-catalog.json` | `899c4d564fcb1726861f89dcf04dbf1b7e372687` |

- JSON 원문 실제 파싱: **계산 18모듈 / 입력 선언 91(고유 78) / 출력 선언 42(고유 40) / resultPaths 42(고유 42)**. 등록 서식 토큰 **D5103 37 / D5110 55 / D5111 82**.
- **이번에 확인한 조건:** `lib/legal-form-field-policy.json`의 D5103은 `month.period` 조건부만 지정하며, D5110/D5111 `approved_monthly_income`은 `form-contracts.ts`에서 `unverified`로 남음. 현재 main `evaluateDocumentPreflight`는 그 토큰의 미확정을 final **warning**으로 처리하고, 별도 blocker가 없으면 `ready`를 반환할 수 있음.
- Draft PR [#93](https://github.com/firmengine/firmengine/pull/93): **D5103만** 미승인 월소득 final blocker와 월별 누락 및 숫자 형식을 보완. Draft [#97](https://github.com/firmengine/firmengine/pull/97), [#96](https://github.com/firmengine/firmengine/pull/96), [#98](https://github.com/firmengine/firmengine/pull/98), [#102](https://github.com/firmengine/firmengine/pull/102): 동일 Fact 분류 상충 → 계산 null → 서식 승인값 경계를 서로 다른 브랜치에서 보강 중. **각각 main 미병합·정식 종단시험 미실행**.

## 2. P1 후보 — D5110/D5111 내부 최종본 게이트 누락

실제 `document-preflight.ts`의 **함수 본문**에서 TypeScript 문법 표시만 제거하고 V8에서 실행. 계산/법률 외부 함수, 계약 해시, FormContract는 합성 stub이므로 **전체 제품 실행이 아님**. 계약 fixture에서 `client_name`은 정상, `approved_monthly_income`은 `unverified`(실제 현행 정책), 그 외 법률 연산 blocker 없음으로 분리. 소득/변제금액은 전부 합성.

| # | 합성 입력(코드 / 모드 / 관측 / 승인 / 변제) | 독립 내부 무결성 기대 | main 실제 | Draft #104 수정안 |
|---:|---|---|---|---|
| 1 | D5110 final / 2,400,000 / [확인 필요] / 없음 | `blocked` | **ready** | blocked |
| 2 | D5111 final / 2,400,000 / SQL null / 없음 | `blocked` | **ready** | blocked |
| 3 | D5110 draft / 2,400,000 / [확인 필요] / 없음 | 경고·draft | draft_with_unresolved | draft_with_unresolved·warning |
| 4 | D5110 final / 2,400,000 / 승인 2,400,000 / 월변제 900,000 | 본 게이트 통과 | ready | ready |
| 5 | D5111 final / **명시적 0** / **승인 0** / 월변제 0 | 본 게이트 통과 | ready | ready |
| 6 | D5110 final / 미관찰 / 미관찰 / 변제 없음 | 본 게이트 비해당(결손은 기존 필드 검토) | ready | ready |
| 7 | D5111 final / 미관찰 / 미관찰 / 월변제 900,000 | `blocked` | **ready** | blocked |
| 8 | D5111 final / 미관찰 / 미관찰 / 총변제 36,000,000 | `blocked` | **ready** | blocked |
| 9 | D5110 final / 관측 **0** / 승인 미확정 / 월변제 **0** | `blocked` | **ready** | blocked |

**함수 격리실행 9/9개 수정안이 독립 기대에 부합. main은 이 중 5건에서 별도 blocker가 없다면 `ready`를 반환하는 경로를 관찰.** D5103은 이번 패치 범위 밖이며 #93과 통합해야 함. `ready` 관찰은 합성 계약/외부 mock 조건에서만 입증, 실제 제품 전체 `ready`/서류 발급 성공 주장 금지.

## 3. 수정/테스트 저장

- **Draft PR [#104](https://github.com/firmengine/firmengine/pull/104)** / branch `audit/a2-r39-it-plan-approved-income-preflight-20261101-0308` (main 미병합). 소스 변경 `lib/document-preflight.ts` 1개 + 회귀 테스트 파일 `tests/a2-r39-it-plan-approved-income-preflight.test.ts` 1개. 모두 허용 경로 안.
- 코드: D5110/D5111에서 `monthly_income`, `monthly_payment`, `total_repayment` 중 표시된 값이 하나라도 있고 `approved_monthly_income`이 미확정이면, `PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED` (final blocker / draft warning). 정확히 0원은 관측/승인 상태를 분리하여 0으로 보존하며, null/미관찰은 0으로 치환하지 않는다.
- 실제 V8 격리시험: main blob `dc771c0f...`와 PR blob `1368e23548f5bc3fb317e5a6c7f054903b57fd9f`을 각각 실행해 비교.
- **실제 Node 프로젝트 회귀 테스트 8건은 작성만 했고 실행하지 않음**. TypeScript 전체 정적검사, 전체 CI, 실제 D1/R2/Cron, DOCX 출력, 공식서식 동등성, 변호사 인수 미실행. 다수 Draft를 단순 병합하면 보존 여부 불명.
- `drizzle/0011` 계산 저장 스키마는 본문 재독. 이전 r37 합성 SQLite 스크립트를 **이번 회차에 다시 실행하여 9/9 기대 일치** (0/null, provisional, 열 불일치 저장 가능 등). 기존 독립 기능 재현이고 D1 실측/저장 API E2E는 아님.

## 4. 법률·세무 공식 출처 / 사건 적용 경계

- **채무자 회생 및 파산에 관한 법률 제611조**, 국가법령정보센터 원문 `[시행 2026.10.2][법률 제21490호]` 확인: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777. 변제기간 3년 원칙, 특별한 사정에 법정 한도 5년. **제614조 별도 당회 공식 조문 확인은 미완료**.
- **서울회생법원 2026-10-01 공지**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187. 실무준칙 제424호 제2조 제2항 제7호 신설 확인. **개정전문 부칙·경과조치·사건별 관할·적용일은 미관찰**. 공지일만으로 사건 적용하지 않음.
- **국세청 VAT 과세기간 공식 설명**: https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486. 일반과세자 6개월(1·2기), 간이과세자 통상 1년. **VAT 총매출·종소세 신고금액을 개인회생 승인 월순소득으로 자동 승격하지 않음**.
- 법률·회계 적합성은 변호사/계산사무장 실무승인 전 **미인증**. 이번 수정은 인정 요건이나 법원 적용일을 변경하지 않는다.

## 5. A2 ID별 영수증과 다음 r40

- `A2-IT-017`: D5110/D5111 미승인 소득 final 게이트 P1 재현→#104 Draft. D5103 #93 통합, 실제 Word/종단 인수 남음.
- `A2-IT-004`: SQL null, 미관찰 marker, 명시 0, 승인전 상태가 표기 게이트에서 서로 다름 확인. 전체 입력 API 경로는 미검증.
- `A2-IT-016`: 계산/승인 토큰의 원화 표시 2,400,000 / 900,000 / 0 / 36,000,000을 합성으로 대조. 실제 D1 결과→DOCX 정밀도 E2E 미검증.
- r40 **사용자·서류담당자**가 #93과 #104 동일 파일 통합(새 브랜치 PR, 원본문 비교/실제 Node), #76·#98 문서 매핑 병합, #97/#96/#102 계산과 D5103·D5110·D5111 연결을 우선. 대표기간 첫·끝 11/12개월, 미래월/사업소득 VAT·종소세 중복, SQL 값/상태 재검산도 미해결. 기존 P0 구 reference SHA head 덮어쓰기는 독립 blocker.
- **제품 RELEASE_READY/최종 합격 0건. [ ] 체크 상태 유지**. 사람 승인 없이 계산·법률 확정/운영 작업 절대 실행하지 않음.
