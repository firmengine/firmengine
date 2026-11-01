# FirmEngine A1 55차 — 소득유형 서류 · 보증/채권양도 · OCR 복수행

- 기준: 2026-11-01 18:54 KST, 관찰 GitHub `main` SHA **`5096cebcacf38f82fb8d4cb57a8e5502dff00ccd`**.
- 직전 54차 IT/AX/CALC에서 역할을 **사용자·서류담당자(DOC) / 변호사(LAW) / 데이터담당자(DATA)**로 전환.
- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` ID **A1-DOC-004 / A1-LAW-005 / A1-DATA-004**만 선택. 모두 **[ ] 미완료**.
- main 최신 HEAD·최근 8개 커밋·최근 변경 PR·54차 영수증·보드·`db/schema.ts`·관련 원본 함수·기존 테스트를 조회. 모든 값·이름·ID는 합성; 실제 고객정보/키/원본 OCR/실무 인정값 사용 금지.
- 구별: 원본 소스 본문을 JavaScript로 타입 표지만 제거한 V8 실행, 합성 의존성/어댑터, 정적 소스 연결, 프로젝트 Node 테스트, 실제 D1/R2/브라우저, 법원 서식·법률 인정은 **각각 다른 증거**. 프로젝트 Node/CI/브라우저/실 D1 실행은 이 회차 **0건**.

## A1-DOC-004 [ ] — 근로·사업·겸업·무직·휴직별 요구서류

- `lib/intake-engine.ts` blob **`82ddba689ea6d107ba587235205feef45e058527`**, seed `lib/reference-intake-catalog.json` blob **`ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`**. 기존 `tests/intake-engine.test.ts`, `tests/intake-court-coverage.test.ts` 읽음.
- **실제 실행:** `matchIntakeChecklist` 원본 함수 본문을 타입 표지만 제거하고 V8 호출. 카탈로그 입력은 실제 base seed **49개 feature / 54개 rule**. 인수 검증자·날짜·텍스트 등 외부 도우미는 합성 stub이므로 전체 `validateIntakeCatalog`·`validateIntakeClaims`/AI·DB 경로를 통과한 게 아님. 관할 `seoul`, asOf `2026-11-01`, 모든 claim은 가상 note·인용.
- 사전 독립 기대 / 관찰:
  1. 현 급여소득 1개: 근로증명(`employment_certificate`), 원천징수(`salary_withholding`) 요청 — **일치**.
  2. 현 사업소득 1개: `business_status_evidence`, `business_income_report` 등 사업서류 요청, 근로서류는 요청하지 않음 — **일치**.
  3. 겸업(급여+사업+복수소득 명시): 양쪽 서류와 `income_source_inventory` 요청 — **일치**.
  4. 과거 직장만 present/past: 현재 근로서류를 자동 요구하지 않으며 과거·현재 확인 경고 — **일치**.
  5. 근로·사업 모두 명시적 absent: 공통서류만, 소득 없음의 법률상 인정은 하지 않음 — **일치**.
  6. 현 근로+고용변경: `employment_history` 추가 — **일치**.
  7. 동일 근로대상에 present/absent 충돌: 근로서류를 무단 확정하지 않고 질문/검토로 유지 — **일치**.
- **7/7 독립 기대 일치 (seed 원본 함수 격리 범위)**. 추가 코드 `lib/intake-court-coverage.ts` rule #69의 `income.employment_changed` → `income_household_change_evidence`는 정적 확인만 했고, 16개 보강규칙·85종 현행 DB 편집본·실제 휴직 상담 AI/사건 등록/요구서류 D1 저장은 **실행하지 않음**. 무직이라는 라벨만으로 무소득 확정 금지.

## A1-LAW-005 [ ] — 보증·채권양도·개인 간 대여와 채권자목록

- `lib/domain.ts` blob **`39ab41856f6d7a379aca7217d24b28f7f5f7616a`**: 보증의 주채무 연결·구상/대위·청구 성격·capTreatmentReviewed는 명시적 사람 검토 값. `lib/assessment.ts` blob **`ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`**: 검토 전 보증/주채무 겹침을 cap 완결로 승격하지 않음. `lib/extraction.ts` blob **`75931aad3fc7871395e62276bb5533e24b15d1a5`**: 보증 OCR은 원천·경고까지만. 기존 `tests/calculation-audit.test.ts`의 겹침 테스트 읽음. 이 항목들은 **정적 코드 확인**이며 이번에 법적 검수/금액 전체 함수를 실행한 것은 아님.
- **새 P2 방어 결함 후보**: `lib/document-writer.ts` main blob **`42dc797739784b6d4354bdf377c5afe6e8fc3e5a`**의 `stableFormRowIds("assignment")`는 `assignment_order !== "[확인 필요]"` 하나로 행을 선택. 값이 미관찰 `undefined`, `null`, 빈 문자열, 공백이거나 `bindings.rows.creditor` 자체 누락돼도 **true**가 되어 미신고 채권자의 반복행 ID를 포함함. `buildDocumentFieldBases`가 stable ID를 편집 필드 인가의 기반으로 소비함(`lib/document-field-bases.ts` blob `26789b9d1af8aa0582d5b9f0499445bce3e775db`).
- 실제 원본 함수본문 V8 합성 입력 사전 기대 7조건: 정상 미할당, 정상 d2만 양도, 채권자 row 배열 미관찰, d1 필드 undefined, d1 공백, d1 null, 일반 creditor 그룹. **main 3/7**, 초소형 predicate 수정안 **7/7**. 브랜치에 커밋된 실제 함수 재조회 후 합성 재실행 **8/8** 기대 일치(빈 배열·정상 할당 등 경계 추가). 외부 보조함수는 합성 stub.
- 중요 반례 범위: 정규 `lib/form-mapping.ts` blob **`514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`**의 `buildFormBindings`는 보통 해당 필드 누락시 문자열 `[확인 필요]`를 채워 이 결함을 가린다. 따라서 **부분/유실/레거시 FormBindings 방어 결함**, 실제 법원 채권자목록의 오기재나 승인 우회를 재현했다고 주장하지 않는다.
- **코드 조치:** `audit/a1-r55-assignment-missing-guard-20261101-1854` 브랜치, 새 **[Draft PR #134](https://github.com/firmengine/firmengine/pull/134)**. `lib/document-writer.ts` 수정 blob **`70709229b5c721f75d04e2dcc4be1ab86fe038e4`**, 신규 `tests/assignment-row-id-missing-r55.test.ts` blob **`002c39247ae9ad60ac4362463c98520a5d31fa22`**. 3개 Node test 블록 작성·커밋했으나 **Node는 실행하지 않음**. PR HEAD **`29a6c80a9f168f5b61ea4d49206ebf4f79b3def0`**, Draft·미병합, main 제품코드 미변경. `lib/document-writer.ts`는 기존 Draft PR #108/#119/#129와 경로 중복 → 병합 통합·TypeScript·실무자 검토 전 유지.
- 채권양도 승계인 진정성/개인차용 이체/보증 청구액/법원 서식 공식 필드는 별도 미검증, 자동 승인 없음.

## A1-DATA-004 [ ] — 동일 canonical ID의 복수 OCR 행/last-wins

- `lib/extraction-row-store.ts` main blob **`ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`**의 원본 `read.records`→`records/features/coverage` loop를 타입 주석만 제거하고 합성 `bindField`/JSON으로 V8 실행. `db/schema.ts` blob **`933f8686845ac14669312dd21bf85e02c62ed5e6`**의 record(run,ordinal)/field(record,ordinal) unique 키 정적 확인, canonical_field_id 중복을 global single value로 강제하지 않음.
- 독립 기대 / 관찰: (1) 서로 다른 2기록에 동일 canonical ID 서로 다른 100/200 → records 2, features 2, 별도 ID/원문값 보존 **일치**; (2) 한 기록 같은 canonical ID 두 개 상충 100/200 → feature 2개 보존 **일치**; (3) 명시적 0과 미관찰 null → 두 값을 서로 다른 원천행으로 유지 **일치**; (4) 서로 다른 canonical ID 각각 100/90 → 2개 feature/고유 ID/coverage 분리 **일치**. **4/4 기대 일치.**
- `lib/extraction.ts` blob **`75931aad3fc7871395e62276bb5533e24b15d1a5`** `projectPage` record index와 fact id 분리는 정적 코드 검토, 13차 본문 테스트 근거를 참고. 이번에는 OCR 모델·원본 PDF·실제 D1 INSERT/SELECT·typed 단수 집계/18계산·법률95·법원 서식 전 연결을 **실행하지 않음**. `source-only`, `unknown`, `null`, 숫자 `0`, 충돌을 동등한 상태로 취급하지 않음.

## 이번 조치/범위/다음

- 이번 회차 실제 원본/브랜치 함수 기반 V8 격리 재현: DOC 7/7, LAW main 3/7 및 수정안 7/7, 브랜치 재검증 8/8, DATA 4/4. 신규 Draft PR 1, 신규 방어 결함 후보 P2 1, 본문 Node 회귀 작성 3블록(미실행). 모든 A1 체크 ID **[ ]**.
- main의 제품 실행코드 수정 0; Draft PR의 변경 경로 2개 모두 허용 `ax-site/` 내부. 중앙 보드와 본 영수증 외 타 파일 main 변경 금지.
- 전체 Node·TS·lint·CI·build·staging D1/R2/Cron·브라우저·실제 원본·Word/공식 법원 서식·직원/변호사 승인·운영 배포/DB migration·전자제출·법원 인가확정: **미실행/미인증**. 모델 Extra High 실제 설정 확인 불가.
- **56차 순환: IT/AX/CALC**, 우선 **A1-IT-003**(타사건 ID 접근 차단), **A1-AX-016**(n8n 설계와 현재 실행모듈 분리), **A1-CALC-014**(직원 금액 제안/출처/승인 구별). 본 문서는 법적 승인이나 제품 인수 영수증 아님.
