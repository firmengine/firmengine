# FirmEngine A2 22차 — 사용자·서류담당자: D5103 월별 수입 근거 공백 확인

- 기록: 2026-10-31 KST, 역할 순환 r21 **IT담당자** → r22 **사용자·서류담당자** → r23 **계산사무장**.
- 허용 범위: `firmengine/firmengine` main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만.
- 시작 main HEAD: `a13ae7d70b6997364db5e5feb8209cc4b410ccbf` (GitHub branch API 직접 조회). 검토 PR: **#58**, Draft·미병합. 기존 r21 영수증·통합 보드·#58/#71 PR·실제 함수·0011 SQL·18개 계산 정의·서식 토큰을 읽음.
- 이번 A2 ID **A2-DOC-004, A2-DOC-015, A2-DOC-016**. 3개 모두 부분 검증 **[ ] 유지**. 제품 인수 0건.

## 1. 문제 재현 및 독립 기대

D5103은 원천별 실제 월행을 표시한다. 기존 #58은 월행 0건, 잘못된 원화 쉼표, 명시적 미확정 행을 구분했으나 **승인 월소득 문자열이 있고 월행 내부에 한 달이 빠진 경우**는 형식만 정상이라 최종 사전검증이 `ready`였다. 이는 *서식 입력을 직접 준 격리 반례*이며 전체 계산기가 이 상태를 만들어 낸다는 E2E 입증은 아니다.

합성 계약: `approved_monthly_income="2,400,000"`, `rows.month`의 `2026-01` ~ `2026-12` 각 월 `net_income="2,400,000"`, 원문/Fact/typed는 **synthetic source-backed 가정**(실제 DB 원문 아님). 결손 사례는 `2026-06` 행을 제거해 11개로 만듦. 정상 12개월 합계는 **28,800,000원**, 11개월 실제 관찰 합계는 **26,400,000원**으로 **2,400,000원 차이**. 이 합계는 독립 산술이지 법원 인정 연소득이 아님.

| 합성 입력 | 독립 기대(내부 서식 사전검증) | #58 기존 원함수 V8 관찰 | 수정 후 V8 관찰 |
| --- | --- | --- | --- |
| 2026-01~12, 12행 완전 | 공백 차단 없음 | ready | ready |
| 2026-06 행 누락, 11행, 승인 월소득 있음 | 최종본은 실무자 확인 보류 | **ready (거짓 정상)** | blocked: `D5103_MONTH_COVERAGE_GAP` |
| 동일 결손, 초안 | 경고·법률상 확정 금지 | gap 경고 없음 | gap warning, final blocker 아님 |
| 6월 명시적 **0** 행 있음 | 누락과 구별·공백 차단 없음 | ready | ready |
| 승인 월소득이 **[확인 필요]** | 승인값 없이 공백확정 승격 금지 | gap 오류 없음 | gap 오류 없음; 기존 미확정 경고 유지 |
| 2025-12와 2026-02 사이 2026-01 누락 | 연도 경계 검토 | ready | blocked |
| 단일 2027-02 관측 | 미래월 확정 여부 별도 확인, 내부 공백 추정 금지 | ready | ready |
| 월행 0개·승인 월소득 있음 | 기존 누락 차단 유지 | blocked: `D5103_MONTH_ROWS_MISSING` | blocked 유지 |
| `1,,000` 오인식 월액 | 잘못된 원화 차단 | `D5103_MONTH_EVIDENCE_UNRESOLVED` | 같은 차단 유지 |

**실행 방법:** GitHub PR #58 `lib/document-preflight.ts` blob `ed5f26cb58064cfd11b19a9b38b22d28d20d9f10`의 함수 본문을 가져와 TS 선언만 지우고 V8에서 실행. 정식 FormContract 대신 합성 최소 계약, `reviewLegalPlanArithmetic` 빈 이슈, 해시 digest 스텁 사용. 기존판 7개 행 선택의 실제 관찰과 수정판 **9/9 조건 기대 일치**. 따라서 제품 Node/TS/Word/법률승인 합격을 뜻하지 않음.

## 2. 코드 수정(승인 전 Draft만)

- 기존 Draft [PR #58](https://github.com/firmengine/firmengine/pull/58)에 `D5103_MONTH_COVERAGE_GAP` 추가. **관측된 시작·끝 달력월 사이의 내부 월공백**만 확인하며, 승인 월소득 숫자일 때만 final blocker / draft warning. `null`을 0원으로 만들거나 월소득 재계산, 법률상 제출기간 판단, 법원 인정 자동처리 없음.
- 코드 커밋 `da206b68974c222a954ba357223e091a4ab5d609`, 새 blob `560935bbbc61f1c253b26a05ecd866840efd6da0`; 새 합성 Node 회귀 **7그룹 작성만**: `tests/a2-r22-d5103-month-coverage-gap.test.ts`, 커밋 `132aea01b18552680dcb16df97127f7e1089b970`, blob `84a8b8d58134f83ba7c47037bdae09d4ad0c7bc9`. GitHub 재조회로 경로가 전부 허용 디렉터리임을 확인.
- **Node 7그룹, npm/전체 CI, TypeScript build, staging D1/R2, DOCX 출력 생성은 미실행**. V8 실행은 별도.
- **중요한 한계:** 11개월이 1~11월에만 존재하는 *끝단 결손*은 월별행만으로 요청 대표기간(12월까지)을 확정할 수 없어 이 새 가드로 탐지되지 않는다. 공식 서식이나 법규가 요구하는 월수는 *하드코딩하지 않았다*. `assessment.ts`의 `filingPeriod` 기반 coverageIncomplete 검사를 E2E로 연결·검증하고, 제출 담당자가 승인할 수 있는 합법적 휴직·무소득 설명/예외 기록 구조를 별도 검토해야 한다. 두 사항이 검증되기 전에는 제품 인수·병합 불가.

## 3. 계산·SQL·서식 계약 재독

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 modules, 91 input declarations (78 unique), 42 output declarations, 42 resultPaths**.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5110 55 / D5111 82** tokens.
- SQL `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`, `value_json` NOT NULL, `value_won` nullable, status/lineage 열 구조 확인. 이번 회차에서는 SQL INSERT/재조회 자체는 **미실행**; r21 SQLite 실행과 구별.
- `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`는 `filingPeriod` 선택과 관측개월 수 미달 `INCOME_PERIOD_COVERAGE_INCOMPLETE`를 정적으로 포함한다. `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`는 `approved_monthly_income`의 기존 인정/출처 플래그를 소비한다. 두 로직 전체 E2E는 이번에 실행하지 않음.

## 4. 공식 원문(법원·날짜·출처)과 승인 경계

- **국가법령정보센터**, 「채무자 회생 및 파산에 관한 법률」 **[시행 2026.10.02.] [법률 제21490호]**, 제611조 변제계획의 내용·기간: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221 (2026-10-31 조회). D5103 월별행 결손에 대한 법률상 자동반려 규정으로 해석하지 않음.
- **서울회생법원**, 2026-10-01 보도자료: 실무준칙 **제424호 제2조 제2항 제7호 신설**, https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . PDF 전문·부칙·경과조치 및 **사건별 적용일 미검증**, 무승인 자동규칙 적용 금지.
- **국세청**, 일반과세자 반기/간이과세자 연간 VAT 과세기간과 구분, https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 (2026-10-31 조회). 원천징수/급여/VAT/종소세를 동일 월소득으로 합산하지 않음. 관련 산식 변경 없음.
- 위 공식 출처 확인은 **법률·세무 실무적합성 인증이 아님**. 변호사와 계산사무장/서류담당자 최종 승인 전 미인증.

## 5. 다음 회차 / 인수 상태

- r23 계산사무장: 대표기간 끝단 11/12개월 및 다사업자/급여+사업, VAT·종소세/원천징수 중복을 실제 `calculateCase→buildFormBindings→evaluateDocumentPreflight` 흐름으로 종단 검증. 필요 시 변호사 검토가 가능한 예외 데이터 모델(출처·기간·이유·검토자)부터 설계.
- Draft #58의 신규 Node 7그룹 및 기존 r13/r16 정식 Node, #71 replay, #60 OCR, #67 부분월 급여 통합 회귀, staging D1/R2, 공식 D5103/D5110/D5111 DOCX 바이트·서식 동등성·법원 및 변호사 승인은 모두 미인증.
- **A2 ID 3건 [ ] 유지, RELEASE_READY 0건**. 실제 고객 데이터·비공개 정답·키/.env 저장 없음. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 실행 없음.
