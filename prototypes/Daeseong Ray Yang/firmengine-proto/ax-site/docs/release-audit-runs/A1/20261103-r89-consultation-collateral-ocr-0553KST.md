# FirmEngine AX A1 — 89차 상담·채권분류·OCR 상태 독립 감사 (2026-11-03 KST)

- 저장소 `firmengine/firmengine`, 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **내부만 변경**. 운영 배포/운영 D1 migration/실제 법원 전자제출·인가 확정 금지.
- **시작 main** `1749ee2cb6f130e256a7eca80138fbb62e69322c` (`compare main...HEAD` 동일 검증). 영수증 갱신 직전 main `1749ee2cb6f130e256a7eca80138fbb62e69322c`. 최근 9개 커밋/열린 PR 및 선행 88차 영수증, 53차 동일 ID 영수증, 중앙 보드, migration, 함수·테스트를 읽음. 회차 종료 최종 main은 뒤따르는 중앙 보드 커밋에서 재조회하여 기록할 것.
- 역할 순환 **사용자·서류담당자 → 변호사 → 데이터담당자**. 감사 ID **A1-DOC-003 / A1-LAW-004 / A1-DATA-003** 모두 `[ ]` 유지. 개인정보·실제 OCR 문구·법원 원본·키/.env·비공개 정답을 사용하거나 공개 Git에 기록하지 않음.
- **실행 매체 구분**: Github 실제 TS 파일에서 함수 본문/채무 cap 구간을 추출하여 타입 문법만 제거한 V8 격리 실행. 문서/법률 외부 의존성과 OCR 필드 바인더는 명시적 합성 객체로 대체. *Node 프로젝트 테스트, CI, Next 화면, Cloudflare D1/R2는 이번 회차에서 실행하지 않음*.

## A1-DOC-003 [ ] — 추가 상담→필수/권장 요구서류 재계산

- 원본: `lib/intake-store.ts` blob `c0bdea9443a018a46c080a8e39a74a0daf62759f`, `lib/case-document-requirement-store.ts` blob `a670cb4e6a38aa6e782e898b5ed30aad80619c6d`.
- 연결 조회: `drizzle/0009_case_document_requirements.sql` blob `050c53dd1d9bf1a49c0d8afc8d2821530b4cd078`; `drizzle/0019_consultation_revision_watch.sql` blob `356fd6787560be34e38652191da1a8a07d7301d7`; 기존 테스트 `tests/intake-store.test.ts` blob `6665cca7659ee4bfae5a474bfc1d2873b46c03a2` 읽음.
- **실제 V8 함수** `activeConsultationNotes` 독립 입력 7개: 빈 배열→[], A→[A], A+B→[A,B], B가 A 정정→[B], A→B→C 연속 정정→[C], B 정정+독립 C→[B,C], 두 병렬 상담의 각각 정정→[C,D]. **7/7 기대 일치**.
- 코드/SQL **정적 연결**: `appendConsultation`은 존재하는 현재 상담만 supersede 허용, 상담 revision CAS와 active_run_id 해제. 새 `analyzeConsultation`은 상담+기준정보 판본을 검사. 요구서류 SELECT는 `consultation_heads.active_run_id`와 동일 사건의 complete run, requirement, field-plan을 조인하며 빈 활성 조회와 `pendingReanalysis`를 구분. 기존 53차 합성 SQLite 7/7은 *과거 영수증*이지 이번 실행 수치가 아님.
- **미검증**: 실제 85개 종류 중 추가 상담 전후 필수/권장/개별 법원 서류 차이, 실제 D1 CAS 경합/트랜잭션, OCR 준비·UI stale 차단 E2E, 직원 승인. 보드 미완료.

## A1-LAW-004 [ ] — 담보/일반/우선/별제권/분쟁 채권

- 실제 `lib/assessment.ts` main blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`의 채권 한도 분류 `capDateMatchesApplication` ~ `DEBT_PRIORITY_TREATMENT_REQUIRED` loop를 V8 격리 실행. 가상 단일 채권 amount 120원, asOf=applicationDate, 원천 한도계산 complete, 개별 `classification/secured/legalReview` 변경. **코드 구간의 검증이며 `calculateCase` 전체 또는 법원 분류 확정 검증 아님.**
- 독립 기대: `secured/yes`→secured120/unsecured0; `ordinary/no`→0/120; `secured/no`·`ordinary/yes` 상충→분류 `null/null` + 검토; tax 미승인/승인→차단/무담보120; disputed 미승인/승인→차단/무담보120; unknown/unknown 및 원천금액 null→차단. **main 8/10 기대 일치**, 2개의 담보 플래그/법적 class 상충을 분류에 잘못 반영.
- 기존 [Draft PR #132](https://github.com/firmengine/firmengine/pull/132), `lib/assessment.ts` PR blob `3e7411a039be527d837f31ac623715c1617bc42c`를 읽어 같은 **10/10** 합성 입력 기대 일치. PR은 **Draft·미병합**이고 코드 구간 `capComplete=false` 반환 전 수치 0n은 최종 법적 `0원` 아님. 총채무 원천액·보증/우선/별제권/분쟁 승인 의미는 별도 검토 대상.
- 고위험 의미 변경이라 기존 PR을 중복 구현하거나 병합하지 않음. 계산사무장·변호사 실무 검토, full Node/D1/공식 서식 미검증.

## A1-DATA-003 [ ] — 원천 숫자·0·미관찰·명시 비해당·상충 보존

- `lib/field-observation.ts` main blob `c96954c09fa426e0dba5db2e5f787e2f3b880f19`, 기존 `tests/field-observation.test.ts` blob `290ba62fd31b263dee82a285117c1d96486a9fed`.
- **새 P1 후보**: OCR `sourceState=explicit_none`와 원문 숫자 `100`, 명시적 `0`, `1,200원`, `-100`, `20%`가 동시 존재하면 본문 `observeField`는 유효 앵커가 있는 경우 전부 `source_empty + not_applicable`로 수용. 또한 `recordIndex=null`인 미관찰 catalog gap에서도 `explicit_none`/직접 `applicable` 주장을 수용. 16개 독립 합성 조건 중 **main 9/16 기대 일치**. 법적 비해당으로 자동승격된 사실은 발견하지 않았고 `caseDecision=unreviewed`는 유지.
- **Draft PR #204** https://github.com/firmengine/firmengine/pull/204, 브랜치 `audit/a1-r89-ocr-explicit-none-numeric-20261103-0553`: 숫자/0 토큰과 명시 없음 상태의 상충은 `unknown`+issue, catalog gap도 관측/해당 주장 보류. `rawValue` 보존, 실제 `해당 없음` 또는 null의 앵커 있는 source-only 주장, 관측 0·blank·masked·conflicting·not_seen 및 사람 검토 전 상태는 보존.
- PR 수정 code blob `81cc87d80afb175c00ca829def8fd70076b00a6f`; 새 `tests/a1-ocr-absence-source-state.test.ts` blob `4881d13050b373705f6a1a00d09b4bde55d42c2f`. **브랜치 GitHub 재조회 후 실제 함수 본문 V8 16/16 독립 기대 일치**. 4개 native Node 회귀 test 블록(16 fixture)을 Git에 작성했으나 *Node 테스트 실행은 하지 않았음*.
- 주의: 이 차단은 OCR `source-only` 의미 변경이라 합성 통과만으로 병합하지 않는다. 예외 문구/숫자 서식 다국어·기준정보·레거시 데이터, 기존 A3 PR #99와 조합, `projectPage`/OCR 저장/typed Fact→18계산→95법률→서식의 staging 실검증, 데이터·변호사 실무 승인이 필요. main 제품 코드 변경 없음.

## 인수 결과 및 다음 순환
- **현재 세 ID 인수 완료 0 / [ ] 유지**. 신규 재현된 P1 후보 1개 경계, 수정안 **Draft PR #204**, 기존 P1 class 충돌 **Draft PR #132** 미병합. 전체 Node/TypeScript/lint/build/CI, 브라우저, staging D1/R2/Cron, 85종 OCR/18계산/95법률 E2E, 공식 서식·변호사 승인, 사이트 배포는 미검증.
- 출처 의존 상태는 `미관찰`, `null`, 명시 `0`, `비해당`, `상충`, `source-only`, `승인 전`을 별도로 유지.
- **다음 회차**: IT담당자 → AX담당자 → 계산사무장, `A1-IT-003` 사건간 읽기/쓰기/파일 권한, `A1-AX-003` OCR 독립 검증 span 결속, `A1-CALC-003` 복수 사업자·월별 원천 분리.
