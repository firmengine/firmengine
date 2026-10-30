# FirmEngine AX A1 — 5차 인수 영수증: 이중 역할 검수, 법원 상태 원장, D1 스키마

- **시점**: 2026-10-30 16:58 KST
- **검증 대상**: `firmengine/firmengine` **main `97d85db0b156eb16b43a918f750c8148124876e0`** (시작 시 `89cbd8...`; 사이에 A4 최신 문서 2건 반영을 확인). 변경·검수 범위는 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- **역할 순환**: 전 회차 IT/AX/계산사무장 → 이번 **사용자·서류담당(A1-DOC-016) / 변호사(A1-LAW-018) / 데이터담당(A1-DATA-016)**. 3개 항목 모두 **부분검증 / [ ] 유지**.
- **사전 확인**: 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, A1 1~4차 영수증, 최근 main 커밋/PR #12, #17, #20, #23, #24, 타 스트림 PR #25~#27을 확인. 기존 PR과 코드 파일 직접 충돌 없음. `lib/domain.ts` 원본 SHA `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/case-procedure-events.ts` `7c61fdfb6e79becc415a8b1385a1580bd8aa6ab2`, `lib/approval-readiness.ts` `d3aecf05688d3146ecff94a3795bb3da8a215d35`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.

## A1-DOC-016 — 동일인이 담당자·변호사 모두 검수한 것으로 인정되는 P0 후보

**현재 main 경로**: `app/api/cases/[id]/commands/route.ts` → `case-command-store.ts` 서버 신원·권한·CAS → `case-commands.ts`의 `document.review` → `lib/domain.ts::reviewExport` / `currentExportReviews`. 권한부여 자체는 `app-roles.ts` `caseworker_review`와 `lawyer_review`를 각각 검사하지만 **동일 로그인에 두 역할이 함께 있는 경우**도 가능하다.

**합성 입력**: `context.revision=7`, `exportManifest.mode="final"`, `application` 현재 파일 1개/일치하는 fingerprint, staff actor `actor-a`, 변호사 actor `actor-a` 또는 `actor-b`. 고객/실제 문서 내용은 없다.

**독립 기대값**: 서로 다른 2명이 현재 생성물에 순서대로 서명할 때만 최종 법률 검수가 current. 동일인이 두 역할을 행사하거나 기존 같은 actor가 남은 경우 법률 검수는 current가 아니어야 한다. 파일 판본 변경/초안은 계속 차단되어야 한다.

**실제 main 재현**: GitHub의 `manifestFingerprint/manifestIssues/currentExportReviews/reviewExport` **실제 함수 본문**에서 TypeScript 타입 표기만 제거해 V8 격리 실행. 7조건 중 **5건 기대 일치**, **2건 불일치**: (1) 동일 actor의 두 검수가 그대로 accepted, (2) 기존 같은 actor의 과거 변호사 검수도 current로 노출. 별도 actor, 선행 직원검수 누락, stale fingerprint, draft, 직원 재검수에 의한 승인 무효화는 정상.

**수정 후보 [Draft PR #28](https://github.com/firmengine/firmengine/pull/28)**: `audit/a1-two-person-final-review-20261030-r05`에서 `lib/domain.ts`만 최소 변경. 법률 최종 검수 actor와 선행 담당자 actor가 다르도록 강제하고, 과거 두 승인이 같은 actor인 경우 raw 역사 기록은 보존하면서 **읽기 current 법률 검수에서 제외**. 신규 `tests/document-review-independent-actors.test.ts`에 회귀 3건 추가. 별도 브랜치 2커밋, 변경 파일 2개. 기존 동작/비밀키/운영 저장소 불변.

**수정 브랜치 실제 실행**: 같은 V8 원본 함수 본문 7조건 **7/7 기대 일치**. 커밋 `9d2f2d2ae326a7f63b21f41f82a5756e9472456c`. **저장소 Node 원본 테스트·타입·빌드·D1/Word/변호사 실제 승인 미실행**이므로 미병합 Draft 유지.

## A1-LAW-018 — 실제 법원 결정 상태의 증거종류 검증 공백 (P0 후보)

**현재 main 경로**: `case-commands.ts::procedure.record`는 사람의 `case_editor` + `caseworker_review` 권한과 `isSynthetic(data)` 거부 조건 이후, 현행 활성 문서 ID·임의 courtReference와 사유를 `validateProcedureEvent`에 전달. `case-procedure-events.ts`에는 **원본이 실제 법원 보정/인가/면책 결정문인지** 검증하는 타입/문서 내용·접수증빙의 독립 검사가 없다. 원문 `sourceDocumentIds` 1개만 있으면 `approved`도 가능하다.

**합성 입력/실행**: 단지 활성 목록에 있는 `"bank-statement"` 문서 ID, 법원 참조 텍스트 `"any-text"`, `state="approved"` → **V8 실제 함수 `validateProcedureEvent`에서 accepted=true**. 동일 자료 `correction_requested`도 accepted=true. 다른 사건 문서 ID, `courtReference=null`, 증빙문서 배열 빈칸 세 조건은 rejected로 정상.

**소비처 충돌**: `approval-readiness.ts`에서 `AFTER_APPROVAL={"approved","discharged"}`, `outOfScope=procedureEvents.some(...)`이므로 이처럼 법원 원문 여부가 독립 확인되지 않은 승인 기록 **1건만으로 인가 전 보완업무가 평가대상 밖으로 처리될 수 있음**. 이는 실제 법원 결정을 위조했다고 단정하는 것이 아니라 현재 코드 계약이 허용하는 **반례**다.

**조치**: 위험을 기존 [P0-09 GitHub 이슈 #11 댓글](https://github.com/firmengine/firmengine/issues/11#issuecomment-6517859973)에 재현입력/영향/분리 권고로 등록. 실제 법원 결정 원본의 분류·해시·사건번호·발령/접수 영수증·권한·정정/역행 계약이 없는 상태에서 단순 역할 하드코딩/마이그레이션 변경은 하지 않았다. **별도 법률전문가 검토·설계 PR 필요**, main 법원 판정 수정 없음.

## A1-DATA-016 — DB Drizzle 선언과 migration 0017~0022 정적 대조 (부분 일치)

**실제 점검 자료**: `db/schema.ts`, `drizzle/0017...0022.sql`, `drizzle/meta/_journal.json`의 GitHub main blob. `_journal.json`은 **23개 엔트리(0000~0022)**를 갖고 신규 6개 마이그레이션 파일과 모두 대응함. 확인한 신규 CREATE TABLE 5개: `case_legal_automation_jobs` **20/20열**, `case_legal_automation_events` **7/7열**, `case_calculation_poll_jobs` **11/11열**, `case_court_correction_item_versions` **12/12열**, `case_court_correction_item_heads` **7/7열**. 실제 TypeScript `sqliteTable` 선언과 SQL DDL 컬럼명 집합이 **각각 동일**. 0018·0019·0021은 트리거/ALTER 변경이라 위 컬럼 비교에 해당하지 않음.

**검사 방식/한계**: GitHub 파일에서 런타임 AST를 사용하지 않는 정적 구문 파싱으로 테이블명과 열 이름의 대칭성만 비교. **NOT NULL/DEFAULT/FK/인덱스/트리거의 전체 의미론·실제 D1 마이그레이션 적용·롤백·SQLite 전체 실행은 미검증**. 일치한 5개 신규 테이블이 제품/운영 DB 검증 통과를 의미하지 않는다.

## 검증층 구분 및 다음 회차

| 검증층 | 실제 수행 | 남은 일 |
|---|---|---|
| 최신 GitHub main/최근 PR·기존 영수증·코드 읽기 | **수행** | 다음 회차 SHA 재조회 |
| V8 원본 함수 합성 | **main 리뷰 7조건 중 2 결함 / PR 수정 7/7, 법원 상태 5조건 중 2 위험** | 실제 전체 API/Node 회귀 |
| Drizzle/SQL 정적 5테이블·23 migration journal | **컬럼명 5/5 집합 일치** | D1 실제 적용 및 트리거 검증 |
| 신규 Node 회귀 작성 | **3 test 추가, 저장 확인** | Node 22+에서 `node --test` 실제 실행 |
| 전체 Node/test/type/lint/build, staging D1/R2/Cron, 실제 Word·변호사·공식 법원 서식 | **모두 미실행 / 미인증** | 별도 합격증빙 |
| main 제품 소스 변경·운영 배포·법원 제출 | **없음** | 허가 없는 자동 실행 금지 |

**현재 인수 상태**: 세 체크 ID 모두 **[ ] 유지**. 신규 결함 2건(P0 후보), 코드 수정 Draft PR 1건, 이슈 기록 1건, 운영/법률 인수 완료 0건. 다음 역할 **IT/AX/계산사무장** 관점으로 순환하여 `A1-IT-015`(API 성공/실패 상태), `A1-AX-011`(사람 승인 우회), `A1-CALC-016`(서식·계산 출력 금액 동등성)의 기존 미검증 ID 및 이번 법원 상태/원본변경 영향 재점검. 기존 PR #12/#17/#20/#23/#24를 합치지 않음.
