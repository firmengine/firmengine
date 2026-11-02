# FirmEngine AX A1 — 91차 소득상태별 서류·채권양도 서식 행·OCR 복수행 감사 (2026-11-03 KST)

- 범위: `firmengine/firmengine` **main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만**; 이전 90차 IT→AX→CALC 다음 순서 **사용자·서류담당자(DOC) → 변호사(LAW) → 데이터담당자(DATA)**.
- 시작 시 관찰한 main HEAD: **`dbeb226cd06b11d0202f4fc80f69d16d41fc18e9`**. 최근 커밋·Draft PR 검색, 단일 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 90차/55차 감사 영수증, 원본 코드·`db/schema.ts`·기존 테스트를 읽음. 이전 55차의 동일 ID 미완료 근거를 재검증/확장함.
- 선택한 ID: **A1-DOC-004 / A1-LAW-005 / A1-DATA-004**. 모두 `[ ]` 유지. 표제에 언급되는 수치와 인명·금액은 **모두 합성**이며 고객 데이터·OCR 원본·키/비공개 정답 없음.
- 방법: 실제 GitHub 소스 함수(일부 TS 타입 표지만 제거)를 **V8 격리 실행**, 독립 기대값 비교. 입력 검증자/계산·DB·R2/LLM 의존성 일부는 합성 stub. 정적 계약 확인과 Node/CI/실제 저장소·화면 통합 검증은 별도. **Native Node 전체 프로젝트 테스트, CI/TypeScript/lint/build, 실제 D1/R2/Cron/브라우저·법원 공식 양식·사람 승인·배포는 실행하지 않음.**

## A1-DOC-004 [ ] — 근로/사업/겸업/무직/휴직 요구서류 상태의 분리

- main `lib/intake-engine.ts` blob `82ddba689ea6d107ba587235205feef45e058527`의 **`matchIntakeChecklist` 원본문**과 기준정보 `lib/reference-intake-catalog.json` blob `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99` (49 features, 54 rules, 85 document types). 기존 `tests/intake-engine.test.ts` blob `92fc9c734e02629446a364e915e08e37eb21c8b3` 확인.
- 합성 조건 12개(관할 seoul, asOf 2026-11-03; 현재 근로/사업, 현 근로+휴직·고용변동, 휴직 단독, 과거 근로, 미확정 휴직, 겸업과 복수 소득원 명시/미명시, 근로·사업 모두 명시적 부재, 과거 휴직, 서로 다른 소득주체 고용변동, 고용변동+급여 미확정). **최종 12/12 독립 기대 일치**.
- 관찰: 현 근로 → `employment_certificate`/`salary_withholding` requested; 사업 → `business_income_report` requested; 휴직·고용변동 → `employment_history` requested; 과거 근로·과거 고용변동/불확실 시 해당 서류의 **`qualification_needed`**이지 현재 제출의무 `requested`가 아님. 겸업 `case.multiple_income` 명시 시 `income_source_inventory` 요청, 명시 없으면 자동 복수소득 사실을 만들지 않음. 명시적 부재와 미관찰은 구분.
- **테스트 교정:** 최초 예상이 '과거 근로·휴직은 요구서류 목록에 아예 없어야 한다'여서 8/10이었다. 기존 코드가 `qualification_needed` 상태로 보류행을 보존하는 것이었으므로 해당 2조건은 `requested`와 구별하도록 기대값을 수정, **전체 12조건 다시 실행**. 최초 수치를 제품 결함으로 집계하지 않음.
- 경계: `validateIntakeCatalog`, `validateIntakeClaims`, 인용·주체 확인 helper는 합성 대체. 16개 법원 보강규칙, 실제 휴직기간/급여 법률 인정, 직원 편집 기준정보, 85문서 전체 UI/API/D1 결과는 미검증. 한 단어 '무직'만으로 소득없음 인정하지 않음.

## A1-LAW-005 [ ] — 채권양도 서식 ID의 공백 둘러싼 결측 토큰 반례

- main `lib/document-writer.ts` blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`; 기존 [Draft PR #134](https://github.com/firmengine/firmengine/pull/134)의 소스 blob `70709229b5c721f75d04e2dcc4be1ab86fe038e4`. 실제 `stableFormRowIds("assignment")` 함수 본문과 합성 `execution.assessment.calculation.debtRows`, `bindings.rows.creditor` 실행.
- 독립 기대 12조건: 미관찰 rows, undefined/null/빈문자/공백, 정확한 결측 `[확인 필요]`, **공백으로 둘러싼 ` [확인 필요] `**, 정상 양도 표시, '0' 문자열, 두 행 정상, 두 행 결측 등. **main 2/12, 기존 #134 11/12**. #134는 `assignmentOrder.trim().length>0 && assignmentOrder!==MISSING_FORM_VALUE`를 써서 공백으로 둘러싼 결측을 **양도행으로 오인**.
- **신규 P2 방어반례 수정:** PR #134 HEAD `29a6c80a9f168f5b61ea4d49206ebf4f79b3def0`에서만 **추가 브랜치** `audit/a1-r91-assignment-trimmed-sentinel-20261103` 생성. 비교 문자열도 trim: `assignmentOrder.trim()!==MISSING_FORM_VALUE`. 본문 V8 사전 합성 **12/12**, 커밋 후 GitHub 소스 재조회 **10/10** 기대 일치. 수정 blob **`e8fd8de1df8670f9cce1bd331afccd99c42f600a`**, 테스트 blob **`6427f18edefb07dd8dcf9ecfeaef3eb83194de1f`**.
- 신규 **[Draft stacked PR #206](https://github.com/firmengine/firmengine/pull/206)**, HEAD `2660943834a06413eb4fbb89344104d38928c910`, **base가 #134의 브랜치**임. 기존 PR #134 및 다른 `document-writer.ts` Draft와 통합·rebase 필요; PR #206만 main에 독립 병합 불가. Node 합성 회귀 **3개 test 블록 작성/커밋했으나 Node 실행하지 않음**. 원천이 공백 둘러싼 토큰을 실제 송신한 것을 확인하지 않았고 법원 채권자목록 오기재/채권양도 법률 인정은 입증하지 않음.
- 보증·원채무 중복, 승계인 진위, 개인 간 차용증 및 구상권 법률적 계산은 정적/선행 검토 상태로 유지. **사람 승인/법률상 확정값으로 승격하지 않음**.

## A1-DATA-004 [ ] — canonical field 여러 행과 단일합계 last-wins 경계

- main `lib/extraction-row-store.ts` blob `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`의 `persistPageExtractionRows` 내부 실제 `for(const [ri,record] ...)` loop를 독립적으로 V8 실행(실제 바인딩 helper는 합성). `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`: record별 `run_id,ordinal`; feature별 `record_id,ordinal` 유일성, canonical ID 전역 단수 unique 없음. 기존 `tests/extraction-row-store.test.ts` blob `adbb896c5bc69716e34ee82c5bfedc5555f677a2` 읽음.
- 별도 레코드 같은 canonical ID (100/200), 같은 레코드 동일 ID 2필드, 명시 0과 null, 충돌 100/200, 다른 canonical ID, 빈 행과 null, 3행 반복 **7/7** 독립 기대 일치. 각각 record 수, field 수, 값·행별 고유 ID, expected canonical coverage count를 직접 비교. last-wins 단수 덮어쓰기는 **검증한 원천행 생성 loop에서는 발생하지 않음**.
- 미검증: 실제 `bindField`, 전체 D1 `batch` 원자성, `listCaseExtractionRows` 읽기, OCR 모델/원문 85서류, typed 단수 투영·18계산·95법률·서식 합산. `source-only` 값·문자 0·null/미관찰·비해당·상충을 법률상 인정/단일합계로 승격한 적 없음.

## 회차 코드 조치·제품 인수·다음 ID

- **기존 main 변경 금지 준수:** 실행코드/스키마 변경 0, 새 Draft **#206은 기존 #134 위에 겹치지 않는 한 줄 추가 수정·회귀 테스트**. 추가 결함 후보는 PR #134의 경계사례이며 운영 실재 오기재 확정 아님.
- **세 체크 모두 [ ] 미인수**. 코드 존재 ≠ 함수 격리 12/12 ≠ Node 테스트 파일 존재 ≠ 전체 CI ≠ staging D1/R2 ≠ 공식 서식·변호사 승인 ≠ 사이트 배포.
- 다음 역할: **IT담당자 → AX담당자 → 계산사무장**. 권고 ID **A1-IT-004**(사건 생성/수정/삭제·감사), **A1-AX-004**(JSON Schema/도구 실패 복구), **A1-CALC-004**(동일 월 복수소득 중복/출처·상태 충돌).
- 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 없음. 실행 환경 Extra High 설정은 확인할 수 없음.
