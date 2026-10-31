# FirmEngine A2 r40 — 사용자·서류담당자: D5103·D5110·D5111 내부 final 사전검사 통합 (부분)

- 감사 시각 기록: 2026-11-01 04:15 KST (회차 식별용). 이전 r39 **IT담당자** → 이번 r40 **사용자·서류담당자** → 다음 r41 **계산사무장**.
- **감사 시작 main**: `c48cfccf6a0c462bdcc7b25833f7c46235e26a6c`. 보드 blob(초기): `409e71dc917f9a89d693f1696c86e45231fe04d4`. 현재 main의 관련 코드 및 최근 커밋/PR, 기존 r34/r39 영수증을 읽고 시작.
- 유일한 작업 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. A2-DOC-004/005/015/016/018 **모두 [ ] 부분 검증**; 전체 제품 인수 완료 **0**. 개인정보/실고객문서/실OCR/키/.env 사용 없음. 운영배포/운영 D1 migration/전자제출/인가확정 없음.

## 1. 실제 읽은 소스와 변경 경계

| 내용 | 확인 blob SHA |
|---|---|
| main `lib/document-preflight.ts` | `dc771c0ff0497d24df19478b0366ebbb397bfbf2` |
| Draft #93 `lib/document-preflight.ts` | `5f1deccc54f77d54f5f3b9f9a5ae2bf58428c773` |
| Draft #104 `lib/document-preflight.ts` | `1368e23548f5bc3fb317e5a6c7f054903b57fd9f` |
| 통합 Draft #106 `lib/document-preflight.ts` | `9f7e39159a635e3ec678b40ddd31e6a0cc001130` (업로드 후 동일 본문 재독) |
| main `lib/form-mapping.ts` | `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e` |
| main `lib/form-contracts.ts` | `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef` |
| main `lib/document-writer.ts` | `42dc797739784b6d4354bdf377c5afe6e8fc3e5a` |
| main `drizzle/0011_case_calculation_features.sql` | `0caa359d250dce45765d269d271ad63170ec3efa` |
| main `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| main `lib/template-token-catalog.json` | `899c4d564fcb1726861f89dcf04dbf1b7e372687` |

- 코드상 구조: `buildFormBindings`의 `rows.month`는 typed 월별 데이터를 변환하지만 **선택 대표기간의 시작·끝을 preflight에 전달하지 않음**. 현재 `document-writer.ts` final 호출의 `preflight.blockers.length` 예외 처리는 **정적으로만 읽음**. 실제 writer/DOCX 실행 증빙은 아님.
- JSON 원문 파싱: **18 계산모듈 / 91 input 선언(고유 78) / 42 output 선언(고유 40) / 42 resultPaths(고유 42)**. 서식 등록 토큰 **D5103 37 / D5110 55 / D5111 82**. 실제 전체 91입력→42출력→SQL→Word 실행은 하지 않음.

## 2. 독립 합성 산술 및 실제 함수 격리 테스트

완전한 가상 월급여 `SYN-WAGE`, 2026-01~12, 월 2,400,000원: 12개월 총 **28,800,000원**, 11개월 **26,400,000원**, 차액 **2,400,000원**. 월변제 예시 900,000원 × 36회 = **32,400,000원** (실제 변제계획 승인/배분값 아님). `0`과 `null`/미관찰/미승인 문자는 구분.

GitHub에서 실시간 읽은 #93 함수 본문에 #104의 별도 소득 게이트 블록을 **원문 그대로 삽입**했다. 먼저 #104에서 해당 블록만 제거하면 main 본문과 바이트 단위로 같음을 확인하여 의도 밖 덮어쓰기가 없도록 점검했다. 이 통합 본문의 TypeScript 타입표기만 제거하고 V8에서 실행했다. **등록 계약은 synthetic mock**, `reviewLegalPlanArithmetic()`는 빈 결과 mock, `contractHash`의 crypto digest는 mock. 따라서 아래 수치는 **실제 문서 사전검사 함수의 격리 관찰**이며 실제 Node 프로젝트/법률 산식/CI/D1/DOCX/법원 승인 결과가 아니다.

| ID | 합성 조건 (mode는 표시한 경우 제외 final) | 독립 기대 | 함수 실제 | 일치 |
|---:|---|---|---|---|
| 01 | D5103 12개월·승인 240만원 | ready(해당 게이트만) | ready | 예 |
| 02 | D5103 월 240만원 source-only·승인전 | blocked | blocked: D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED | 예 |
| 03 | D5103 source-only draft | draft warning | draft_with_unresolved + warning | 예 |
| 04 | D5103 승인금액 있음·월별행 0 | blocked | blocked: D5103_MONTH_ROWS_MISSING | 예 |
| 05 | D5103 6월 월별행 없음 | blocked | blocked: D5103_MONTH_COVERAGE_GAP | 예 |
| 06 | D5103 검토완료 명시적 0원·12행 | ready | ready | 예 |
| 07 | D5103 6월 금액 `2,40,000` 오류 | blocked | blocked: D5103_MONTH_EVIDENCE_UNRESOLVED | 예 |
| **08** | **D5103 1월 누락, 2~12월 11행** | **blocked / 검토대기** | **ready** | **아니오** |
| **09** | **D5103 12월 누락, 1~11월 11행** | **blocked / 검토대기** | **ready** | **아니오** |
| 10 | D5110 관측 240만원·승인전 | blocked | blocked: PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED | 예 |
| 11 | D5111 관측 240만원·SQL null 승인 | blocked | blocked: PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED | 예 |
| 12 | D5111 월변제 90만원만 존재·승인 미관찰 | blocked | blocked: PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED | 예 |
| 13 | D5111 총변제 3,600만원만 존재·승인 미관찰 | blocked | blocked: PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED | 예 |
| 14 | D5110 별도 승인월소득 240만원 정상 | 본 게이트 ready | ready | 예 |
| 15 | D5110 승인 0원/변제 0원 | 본 게이트 ready | ready | 예 |
| 16 | D5111 변제액 `2,40,000` 오기 | blocked | blocked: PLAN_SCALAR_NUMERIC_INVALID | 예 |
| 17 | D5111 월변제 -1000원 | blocked | blocked: PLAN_SCALAR_NEGATIVE_INVALID | 예 |
| 18 | D5111 미승인 소득·draft | warning | draft_with_unresolved + warning | 예 |

**독립 기대 일치 16/18. 미해결 2건은 의도된 TODO / 불합격.** 대표기간을 전달하지 않는 상태에서 12개월을 무조건 법적 필수기간이라고 강제하는 패치 금지. 새 규칙 설계 시 `incomePeriodReviewed`와 선택 기간의 version/시행일·법원·서류담당자 승인을 분리할 것.

## 3. 수정 PR / 실행 범위

- [Draft PR #106](https://github.com/firmengine/firmengine/pull/106): branch `audit/a2-r40-doc-three-form-preflight-20261101-0415`; base main `c48cfccf6a0c462bdcc7b25833f7c46235e26a6c`. 기존 #93/#104 브랜치 변경 없음; #93 전체 본문 보존 + #104 별도 게이트 삽입, 통합본 Git blob 대조 완료.
- PR 소스 커밋 `b543ead8767748e518cc03396142bddcbe84dc3e` + 기존 #93/#104 회귀 테스트 두 파일 복사 + r40 삼중 서식 3개 실행형 / 2개 TODO 테스트 소스 추가. **실제 프로젝트 Node 테스트 실행 안 함; 테스트 파일 PASS 아님.**
- 변경 경로는 `lib/document-preflight.ts` 와 `tests/a2-r34-d5103-integrated-approval-and-month-coverage.test.ts`, `tests/a2-r39-it-plan-approved-income-preflight.test.ts`, `tests/a2-r40-doc-three-form-preflight-integration.test.ts` 네 파일. 모두 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래.
- #93, #104, #76(form-mapping), #98(approved token), #97/#96/#102(same Fact/calc) 등 **별개 Draft**와 변호사/계산사무장 통합 검증 전 병합 금지. DB P0 reference SHA head 역전도 미해결.

## 4. 공식 원문 확인과 법적 적용 보류

- 국가법령정보센터 **채무자회생법 법률 제21490호 [시행 2026-10-02] 제611조**: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 ; 변제계획 재산·소득·채권 기재사항 및 원칙 3년/특별사정 범위 내 5년.
- 같은 시행판 **제614조**: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 ; 인가요건에는 수행가능성·청산가치 등이 포함. 코드 `ready` = 법원 인가 아님.
- **서울회생법원 2026-10-01 공식 공지**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 ; 실무준칙 제424호 제2조 제2항 제7호 신설. **첨부 개정전문의 부칙/경과조치, 사건별 적용일·관할은 미검증**. 공지일로 자동규칙 활성화 금지.
- **국세청 부가가치세**: https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 ; 일반과세자 반기, 간이과세자 통상 연간. VAT 총매출/세액을 종합소득세 신고 소득이나 개인회생 승인 월순소득으로 취급하지 않음. 세무회계 공식 동등성/실무자 검토는 미인증.

## 5. A2 ID별 결론 / 다음

- `A2-DOC-004`: D5103 12월별 관측·실제 11월 결손·명시적0·오표기 V8 재현. **시작·종료월 2반례 미해결 [ ]**.
- `A2-DOC-005`: D5110/11 월변제 900,000원 및 총변제 36,000,000원 source-only 승인전 게이트 격리 재현. 실제 변제계획·채권자별 배분/공식 서식 미검증 [ ].
- `A2-DOC-015`: D5103 행0/내부월 공백과 D5110/11 승인전 final 경계를 같은 draft에 결합, 하지만 실제 final DOCX 미검증 [ ].
- `A2-DOC-016`: 명시적 0, null, [확인 필요], 잘못된 숫자 grouping의 격리 동작 분리; 비해당/원천상충/SQL↔Word는 미검증 [ ].
- `A2-DOC-018`: 등록 토큰 D5103 37·D5110 55·D5111 82와 writer 정적 예외 확인. 실제 생성 Word 바이트/공식양식·변호사 승인 미인증 [ ].
- r41 **계산사무장**: 대표기간 경계와 미래월을 입력 Fact·typed·계산·서식에 전파, VAT/종소세/복수 지급자 중복 검토; #96/#97/#98/#102와 #106 종단 통합·실제 Node 테스트 및 DB 재독·공식 서식 확인. 운영·법률상 확정 전 전문가 검토 유지.
