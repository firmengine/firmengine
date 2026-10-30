# FirmEngine A2 11차 — D5110/D5111 확정본 숫자 오인식 통과 결함

작성일: **2026-10-30 KST** · 저장소 `firmengine/firmengine` · 변경 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 전용. 11차 역할 시작은 **변호사 → IT → 사용자·서류 → 계산사무장 → 데이터**, 이전 10차 AX 시작과 다르게 순환. 제품 인수 체크 완료 **0건**.

## 0. main·기존 작업 확인

- 최초 main HEAD **`c552abc352abd509e337b2880fc2b1216130f836`** (2026-10-30 13:56:09 UTC), 이 영수증 기록 직전 HEAD **`c552abc352abd509e337b2880fc2b1216130f836`**. 최근 main A1/A3/A4 변경, A2 10차 `8cc0980`/영수증 `463a0d9`, 현재 열린 A2 Draft PR #13/#18/#21/#25/#29/#33/#37/#38/#43/#47/#50 확인. **PR #21도 `lib/document-preflight.ts` 수정: 병합 충돌/상호 회귀 검사 필수**.
- 단일 인수 기준 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` A2 5개 ID를 우선 확인. 10차 `2026-10-30_r10_annex-money-failclosed.md` 및 D5110 숫자/총계 과거 회차를 읽고 이어서 감사.
- 실제 검사한 main 파일/blob: `lib/document-preflight.ts` **`dc771c0ff0497d24df19478b0366ebbb397bfbf2`**, `lib/legal-calculation-readiness.ts` **`9edab755df5adae5f143d15285c550feb0e0f6d5`**, `lib/template-token-catalog.json` **`899c4d564fcb1726861f89dcf04dbf1b7e372687`**, `lib/legal-form-field-policy.json`, `lib/form-contracts.ts`, 기존 `tests/legal-field-and-calculation.test.ts`, `tests/form-month-calculation-integrity.test.ts`.
- `lib/reference-decision-tables.json` blob **`6924e3977caf748ce8a3d617fae15aff7d2fe2ce`** 실제 JSON 파싱: 계산 모듈 **18**, 입력 선언 **91** / 고유 경로 **78**, 출력 선언 **42** / 고유 이름 **40**, resultPaths **42** / 고유 경로 **42**. 공개 템플릿 **18종**, D5110 등록 토큰 **55개**, D5111 **82개**. **선언 건수 확인은 18×91 산식의 실행·SQL 적재·Word 토큰 동등성을 증명하지 않음**.
- `drizzle/0011_case_calculation_features.sql` blob **`0caa359d250dce45765d269d271ab63170ec3efa`**: immutable calculation run/feature/head 별도 저장, `value_json`·`value_won`·`status`·`source_fact_ids_json` 등 개별 계약 존재 확인(정적). 실제 D1 저장/재독은 미실행.

## 1. P1 독립 재현 — 문자열은 존재하지만 정수 원/회차가 아님

`reviewLegalPlanArithmetic(formCode,input)`는 잘못된 숫자 문자열의 변환을 `null`로 반환하고 피연산자 3개가 갖춰지지 않으면 비교를 생략. `evaluateDocumentPreflight`는 등록된 D5110/D5111 숫자 scalar가 비어 있지 않으면 필드 존재 조건을 통과시키므로, **`BAD` 등의 비어 있지 않은 잘못된 숫자도 final `ready`로 표시할 수 있음**. 이는 법원 인가가 완료됐다는 뜻이 아니라 **내부 최종 문서 무결성 게이트**의 거짓 통과다.

합성 구조: `FormBindings.scalars`의 `approved_monthly_income="3000000"`, `recognized_living_cost="2000000"`, `monthly_disposable_income="1000000"`, `monthly_payment="1000000"`, `repayment_months="36"`, `total_repayment="36000000"`, `liquidation_value="10000000"`, `present_value="12000000"`, `monthly_trustee_fee="0"`; `rows.creditor`는 허구 채권자 1명 `principal="100000"`, `total_payment="3600"`, `monthly_payment="100"` 등. 기본액 산술 독립 기준: **3,000,000 − 2,000,000 = 1,000,000**, **1,000,000 × 36 = 36,000,000**. 각 경우 오직 해당 토큰만 변경해 독립 기대값과 비교함. 숫자는 실사건·실OCR 자료가 아님.

| 격리 합성 시나리오 | main 실제 final/draft | 독립 기대 | PR #53 실제 함수본문 재실행 |
|---|---|---|---|
| 기본 D5110 | ready | ready | ready |
| 실제 월액 0원 | ready | 숫자 정상 (별도 계획 검토) | ready |
| 거액 정수원 월액 `900719925474099312345` | ready | 숫자 파싱 정상 (산식 차이는 별도 검토) | ready |
| 월액 `BAD` | **ready** | final blocked | **blocked** |
| 변제기간 `36x` | **ready** | final blocked | **blocked** |
| 현재가치 `0x10` | **ready** | final blocked | **blocked** |
| 총 변제액 `12.5` | **ready** | final blocked | **blocked** |
| 인정 생계비 `unknown` | **ready** | final blocked | **blocked** |
| 현재가치 `[확인 필요]` | blocked | 기존 필수 미관찰 차단 유지 | blocked |
| draft 월액 `BAD` | draft_with_unresolved | 확정 차단 대신 추가 경고 | draft_with_unresolved + 새 경고 |
| D5111 처분총액 `error` | **ready** | final blocked | **blocked** |
| D5111 처분 현재가치 `bad` | **ready** | final blocked | **blocked** |
| D5111 실제 0원 금액 | ready | ready | ready |

**13/13 합성 기대 일치**, 잘못된 금액 문자열에서 기존 거짓 `ready` 7건 재현. 실행 방법: **GitHub 원본과 Draft PR #53의 실제 `evaluateDocumentPreflight` 함수본문**(원래 TypeScript를 타입 선언·import만 제거) 및 실제 `reviewLegalPlanArithmetic` 함수를 V8에서 격리 실행. `FORM_CONTRACTS`만 main 템플릿 카탈로그 + 등록 필수도 규칙으로 재구성, contractHash 계산용 WebCrypto/TextEncoder는 **dummy stub**. 이 시험은 **프로젝트 Node 테스트/실제 템플릿 처리/Word 바이트·D1이 아님**. 위 `ready`는 preflight 값일 뿐 법원 판단 아님.

## 2. 수정안과 회귀 영수증

- **Draft [PR #53](https://github.com/firmengine/firmengine/pull/53)**, 신규 브랜치 `audit/a2-d5110-scalar-numeric-r11-20261030`; 시작 main `c552abc...`. 수정 파일 `lib/document-preflight.ts` blob **`6f032ff6215269658da6230d37e0503a05a92ca1`**, 신규 `tests/a2-plan-form-numeric-preflight.test.ts` blob **`a5e6bb6417a205aff64e477db92afb55a733e2dc`**. PR에서 경로 **2개 모두 ax-site 하위**임을 재확인.
- D5110/D5111의 원·회차 scalar가 **명시적으로 존재하면서 숫자가 불완전**하면 최종 문서 `PLAN_SCALAR_NUMERIC_INVALID`로 차단, 초안은 경고. **명시적 0은 0**, 미관찰 `[확인 필요]`는 기존 `FIELD_UNRESOLVED`로 별도 처리, 음수·거액은 정수 파싱 후 **법률·회계 인정과 독립적으로** 검토. 법정 회차·세액·인가 승인·준칙 자동적용은 고치지 않음.
- 신규 Node 회귀 **4개 test 그룹 작성**. GitHub Actions PR head `83fd82fd699d5219dade179d15eb32ed04fb7627`: 상태 체크 **0개**, workflow run **0개 관찰**. **신규 Node 회귀/전체 프로젝트 CI/typecheck/build는 이번에 실행하지 못함**.
- **주의**: PR #21과 같은 `document-preflight.ts` 파일에 병렬 수정 존재. 별도 Draft·실무자 독립 검토 후 충돌해소/combined Node regression 선행 필요. main 제품 코드는 본 회차에서 변경하지 않음.

## 3. 공식 출처 및 법률상 승인 경계

- 국가법령정보센터 [채무자 회생 및 파산에 관한 법률 제589조](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018130103) 실제 웹 열람: **[시행 2026.10.2.] 법률 제21490호 2026.3.24 타법개정**, 신청서 첨부 채권자목록(원인·금액), 재산목록, 수입·지출목록, 급여·영업소득 증명 확인. 법 시행판이 특정 사건에 자동 채택되는 것 아님.
- [서울회생법원 2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 제424호 제2조제2항 **제7호 신설** 확인. 기존 2차 영수증에 2026.9.23 개정/2026.10.1 시행/이후 최초 접수 사건 적용 부칙을 기록했으나 **이번 회차 공식 상세 PDF 열기 timeout**으로 조항·부칙을 새로 확인했다고 표기하지 않음. 승인 없는 자동 규칙 갱신 금지.
- [국세청 공식 부가가치세 개요](https://sc.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272) 실제 웹 확인: 일반과세 `매출세액−매입세액`과 간이과세 별도 산식을 구분. VAT/종소세 수치와 법원에서 인정할 가용소득은 별개. **이번 수정은 세무 계산에 영향 없음**.
- D5110/D5111 최신 법원 전자소송 원본 DOCX·관할별 실무서식·변호사 승인·법률 적용일별 근거 검토는 **미인증**.

## 4. A2 역할별 체크 ID (전원 [ ] 유지)

| 체크 ID | 이번 실제 검증 | 미인증·다음 단계 |
|---|---|---|
| **A2-LAW-024** 변호사 | PV/월액/기간 오인식이 최종 내부 문서 ready로 통과하는 7 반례, 법 제589조 시행판/서울 공지 확인 | 제611·614조 사건별 법적 판단, 변호사 승인, 법원 인가 자동 확정 금지 |
| **A2-IT-020** IT | 실제 TypeScript 원본문 숫자 파서·문자열 경계, PR 분기 V8 총 13/13 | 정식 Node/TS 빌드·API typed/D1 저장 재조회 |
| **A2-DOC-018** 사용자·서류 | D5110/D5111 55·82 등록 토큰, 무효 scalar final 차단·draft 경고 | 공식 문서 layout/token 바이트 동등성·실제 DOCX 출력 |
| **A2-CALC-030** 계산사무장 | 3,000,000−2,000,000/36회 독립 검산; 잘못된 정수·0·거액/미관찰 상태 분리 | 18 산식·91 입력/42 출력 전수 계산 및 청산가치/PV/36·48·60 계획 검산 |
| **A2-DATA-018** 데이터 | `FormBindings` 스칼라↔등록 토큰, scalar validation 경계/42 출력 선언 정적 대조 | 원문 Fact→typed→SQL 피처→calc run→서식 토큰→Word SHA lineage E2E |

최종 제품 인수 완료 0건. 실제 고객자료·원본 OCR·키/env·비공개 정답 등 공개 Git 기록 없음. 운영 배포·D1 migration·전자제출·법원 인가 확정 **미실행**.

## 5. 다음 A2

1. PR #21/#53 문서 preflight 충돌해소 및 **실제 Node 22 테스트**, 파일형식·공식 템플릿 동등성.
2. PR #25/#29/#37/#43/#47/#50 통합 36·48·60회 날짜·잔여원·채권·월예산·D5110 월액을 독립 검산.
3. 18산식/91입력/42출력의 source/Fact/typed/SQL run·행 미관찰/0/비해당/상충 및 D5110/D5111 생성 Word 재독.
4. 제424호 시행일/관할·법 제611/614조 법률상 승인 **실무자/변호사 검토**, 이후에도 인가 확정 자동승격 불가.
