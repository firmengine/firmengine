# FirmEngine A4 89차 — 문서등록 COMMIT 이후 감사 이벤트 유실·ACK 불확정·멱등 재시도

작성 기준: 2026-11-03 KST. **범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 의 A4 실행 흐름/예외/동시성/복구만. 모든 사건·문서·SHA·시간은 합성. 공개 Git에 개인정보·고객 PDF·OCR 사실값·키/.env·비공개 정답을 저장하지 않는다.

## 1. 선행 조회·실제 소스

- 시작 `main` HEAD `5ca68cce80b042aff9b56a0fda2ea0ddb0e71968`; 최근 A3 r89, A2 r89, A1 r88, A4 r88의 커밋과 중앙 보드 상태를 확인했다.
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 조회 당시 blob `0c2a2f831762affcca0c95dab0278a5b8a5bf005`, A4 최종 체크 131개는 [ ] 유지. 88차 `20261103-round88-0440KST-document-registration-postcommit-cleanup-r2-ack.md`와 87차 관련 영수증을 읽고 이어서 진행.
- 실제 main POST `app/api/cases/[id]/documents/route.ts` blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`. 로컬 함수본문 원본 바이트 `git hash-object` 일치.
- 실제 `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`: `saveCase()`가 사건 CAS batch/후속 evaluation을 수행한 뒤 복귀; 별도 `event()`는 `events` 테이블에 독립 `INSERT`.
- 실제 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`: `cases`, `documents`, `page_jobs`, `events` 스키마 확인.
- Draft [#201](https://github.com/firmengine/firmengine/pull/201) `49e39f22aeff8f04eca9b0ef973c9126ea6fc7bc` 및 Draft [#23](https://github.com/firmengine/firmengine/pull/23) `537c6b671ec533e6810ea2fcb3f84f09dcc649d5` open·미병합. #201의 POST 후보 파일 blob `59a29303dacccdf3ac1dbef98da396b4285b5930`; 로컬 재구성 파일 `git hash-object` 일치. #23은 R2 원본 pointer COMMIT ACK 유실 보존 후보이며 이번 신규 이벤트 결함을 직접 해결하지 않는다.

## 2. 신규 조건부 P1 후보 — 사건은 COMMIT, 감사 이벤트는 유실

현재 POST 제어흐름은 다음과 같이 분리된다.

1. `documents` 와 `page_jobs` 선등록.
2. `await saveCase(n,expected,c)` 로 사건 활성 문서 CAS 저장.
3. try 블록 밖에서 `await event(id,"document.registered",...)` 별도 INSERT.
4. 응답 `201` 반환.

**재현 입력 A:** `saveCase`는 COMMIT, 이후 `event` D1 INSERT가 **COMMIT 전 503**. **독립 기대:** HTTP 실패와 실제 저장완료/미완료를 구분, 감사 0건을 정상 인수로 취급하지 않음. **관찰:** HTTP 500, 사건 문서 active=1 / SQL 원본=1 / OCR page_jobs=2 / events(document.registered)=0. 동일 SHA POST 재요청은 기존 활성 문서 분기로 HTTP 200 `idempotent=true`를 반환하며 audit event를 재등록하지 않음. 즉 최초 실패가 지속적으로 감사 누락 상태로 남을 수 있다.

**재현 입력 B:** `event` INSERT는 COMMIT하였으나 ACK만 분실. **관찰:** HTTP 500, 사건/SQL/페이지는 A와 같지만 events=1; 재요청 HTTP 200/idempotent=true. 동일 HTTP 500은 이벤트 0과 1을 구분하지 못함. 이 사건이 실제 운영에서 발생했다는 증빙은 없다.

**재현 입력 C:** 별도 DB 워커 B가 사건 revision 1→2를 갱신한 후 A가 지연된 `event()`를 기록. **관찰:** 이벤트 1건 INSERT 가능하지만 `document.registered` detail의 `caseRevision`/`storageToken` 필드가 없어 어느 source 세대를 가리키는지 불명확. 실제 운영 2워커 HTTP는 실행하지 않음.

**비교용 원자성 대조:** SQLite `BEGIN IMMEDIATE` 안에서 사건 CAS + 이벤트 INSERT가 실패하면 사건 UPDATE는 롤백한다. 하지만 이미 선등록한 documents/page_jobs는 남으므로, 이벤트 배치만 원자화하는 수정은 #201의 미참조 선등록 정리 문제까지 해결하지 않는다.

## 3. 실제 실행·독립 기대/관찰

환경 Node.js v22.16.0, `node:test`, `node:vm`의 **실제 POST 함수본문**(import/TS 서명만 제거하고 synthetic D1 어댑터 주입), 별도 `node:sqlite` 파일 WAL 독립 연결 A/B. 실제 Cloudflare D1·R2·Next HTTP 런타임을 호출한 결과가 아니다.

| 합성 입력 | 독립 기대 | 실제 관찰 |
|---|---|---|
| POST 정상 후 감사 성공 | HTTP 201 / active1 / SQL1 / jobs2 / event1 | 일치 |
| POST 페이지 SQL batch 선행 오류 | 문서0/job0, 사건 비커밋 | 일치 |
| POST saveCase COMMIT 후 throw | **기존 main 부정대조**: OCR job 유실 | 일치; #201 후보는 보존 |
| POST 후 event 503(precommit) | HTTP 500 / source 성공 / audit0 | 일치 |
| event 503 뒤 동일 SHA POST | HTTP 200 멱등 / audit0 잔류 | 일치 |
| event COMMIT 후 ACK 유실 | HTTP 500 / audit1 | 일치 |
| 두 event 오류 모두 HTTP 500 | event0와 event1은 구분 필요 | 일치 |
| WAL B가 source revision 변경 후 A의 지연 감사 | source revision2 / event1 / event 세대 미결속 | 일치 |
| CAS+이벤트 SQL 트랜잭션 INSERT 실패 대조 | CAS rollback, 선등록 원본·jobs 보존 | 일치 |

- 실제 main blob 함수본문 테스트 **10/10** 기대관찰 일치(기존 결함 부정대조 포함). `A4_EXPECT_BASELINE=1`.
- #201 후보 blob 함수본문 테스트 **10/10** 기대관찰 일치(이번 event 경로는 여전히 audit0 또는 ACK 500 가능). `A4_EXPECT_BASELINE=0`.
- 독립 파일 SQLite WAL A/B 시험 **6/6** 기대관찰 일치.
- r84~r89 `main` 부정대조 포함 실제 재실행 **86/86** 기대관찰 일치. 이 숫자는 **제품 86건 합격이나 CI 통과가 아니다**.
- 로컬 테스트 SHA256: `document_registration_event_commit_replay.test.mjs` `aa1586af17c2d3a66bb6a05936b0368a6a86f971ea605599db3d819a31a74ae8`, `document_registration_event_atomicity_sqlite.test.mjs` `8a6eee330e5fbe3f5d31cc4ec78ba5db21697f38b12693867feee5ce8bf1fbab`. 로컬 영수증 로그 `regression-r84-r89-main-and-wal.txt` SHA256 `0c4b9956110572127e8a53f9029749a3f023f4cea1df45335154b812766192ee`. **테스트 코드·로그는 이 회차 작업환경의 대화 산출물이며 GitHub main CI 증빙이 아니다.**

## 4. 6역할 순환 및 선택 ID 5개 — 전부 [ ] 미완료

역할 검토 순서: **서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자**. 실제 사람 승인/법원 확인 0건. 5개 ID만 보드에 부분 결과를 추가하고 기존 기록을 보존한다.

- `A4-IT-002 [ ]`: 이벤트 중복 재전달/멱등성의 감사 0건 잔류 반례. 기존 #31 Export 이벤트와 별개의 document.registered 경로.
- `A4-IT-006 [ ]`: #201 POST 저장 후 예외 오삭제 / #23 PUT의 R2 COMMIT ACK 유실은 독립 미병합; 이번 감사 이벤트 commit/ack 구분까지 원자적으로 통합되지 않음.
- `A4-DOC-013 [ ]`: 원본 active/SQL/jobs 상태가 일치하더라도 `document.registered` 감사 누락 가능. 후속 OCR·10분 계산·직원/변호사 Word 검수 재생성을 실제 실행하지 않음.
- `A4-DATA-012 [ ]`: event COMMIT 전 503과 COMMIT 후 ACK 유실 및 지연 이벤트의 판본 미결속을 관찰. 실제 중복 webhook/outbox staging 재생 없음.
- `X-047 [ ]`: R2/D1/응답 유실 조합의 검증 범위 연장; #23의 R2 pointer 손실 시험은 이전 r88 부정대조, 이번에는 독립 `event()` 미확정 추가. 실제 D1/R2 장애 주입은 미실행.

계산사무장 관점에서는 원본 업로드 완료·OCR 접수 확정이 계산 가동 조건이라는 인계만 검토; 18 계산/quiet 10분 계산 실제 미실행. 변호사 관점에서는 audit 0/1/미관찰 구분, 법적 인정 미승격; 법원기한/보정명령 실제 검수 미실행. AX 관점에서는 95 법률→Word→직원/변호사 승인이 source/event 불명확 상태에서 자동 진입하지 않아야 하는 인수조건만 검토, 실제 AI/n8n 호출 미실행.

## 5. 결함 처리·복구 방침·다음 단계

- **신규 수정 코드를 main에 넣지 않음.** 이벤트의 사건 세대 결속과 트랜잭션 원자성은 감사·권한·인계 의미를 바꿀 수 있으므로 보수적으로 P1 후보로 분류하여 별도 설계/PR·실제 IT/데이터/변호사 검수 필요.
- 재시도에서는 `documentId + source revision/token + event receipt`를 권위 있는 DB에서 조회해 **문서가 살아있다는 사실과 이벤트가 COMMIT했다는 사실을 별도로** 검증해야 한다. 이벤트 0행/null/미관찰/ACK 유실/실제 실패를 혼합해 성공 처리 금지. 단순 중복 `event()` 재호출은 중복 감사 위험; 고유 요청키/제약/원자적 기록 설계 후 검증.
- `#201`의 선등록 자료 고아행 가능성, `#23`의 원본 R2 실존·SHA, 2워커의 case source CAS를 함께 통합하되 서로의 변경을 덮어쓰지 않는다.
- 다음 체크 후보: `A4-IT-005`(commit receipt 재조회), `A4-IT-006`, `A4-DATA-012`, `A4-CALC-014`, `X-047`.
- **미실행:** 최신 main 전체 npm ci/TS/lint/build/CI, 실제 staging D1/R2/Cron, 운영 n8n(설계만), 실 HTTP 두 워커/429·503·timeout 강제주입, 실제 상담·PDF/OCR·법률 95·Word·직원/변호사 승인·법원 보정명령·접수증. 운영 배포·운영 D1 migration·전자제출·인가확정 없음.
- 이번 선택 ID **최종 인수 0/5**, 제품 출시 게이트 통과 증빙 0. 코드 존재/합성 테스트/전체 CI/staging/실무 승인/사이트 배포를 동일시하지 않는다.
