# FirmEngine A4 88차 — 문서등록 POST 저장 후 실패·R2 후속 업로드·OCR job 삭제 경합

작성 기준: 2026-11-03 04:40 KST. **범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` A4 실행흐름/예외·동시성·복구. 이하 사건/문서/R2 key/기한은 모두 합성. 고객 원본·OCR 진실값·.env·인증키·법률상 확정값 없음.

## 1. 먼저 조회한 GitHub 출처 / 이전 회차

- 시작 `main` HEAD: `c8c5e4c960997f28801d47f51e820987f7779500` (A3 88차 문서 병합 직후). 최근 커밋 A3 r88, A2 r88, A1 r87, A4 r87의 순서와 Draft PR #19/#196/#23(각각 보정명령 매핑/스냅샷/원본 PUT 포인터 응답유실)을 확인. 이 문서 작성 당시 #19/#196/#23 모두 open/draft/미병합.
- 단일 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 초기 blob `9294ce4be2e290c5bfb0a11c93bd1143ca908c2c`, A4 131개 최종 체크 [ ] 유지. r87 [감사 영수증](20261103-round87-0340KST-correction-final-cas-doc-sha-head-composition.md) 읽음.
- 실제 `main` 소스: 문서 등록 POST `app/api/cases/[id]/documents/route.ts` blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`; 원본 PUT/GET `app/api/cases/[id]/documents/[doc]/route.ts` blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`; `lib/server-store.ts::saveCase` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 보정 기한·법원 항목 별도 코드 `lib/preapproval-correction-item-store.ts` blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`, migration `drizzle/0022_preapproval_court_correction_items.sql` blob `bec8b19780eaa951c4994530060c916f903a40fe`, 기존 테스트 `tests/preapproval-correction-item-store.test.ts` blob `b78fa006c9c003b72b79fd79f74630e342b97238` 확인.

## 2. 발견: POST와 PUT 경합에서 OCR 작업행이 사라지는 조건부 P0 후보

`POST documents`는 별도 D1 호출로 `documents`(ready=0)와 `page_jobs`를 삽입하고, 이후 `saveCase(n,...)`로 사건 JSON의 활성 문서 목록을 저장한다. 그런데 저장 호출이 throw하면 catch는 **무조건** `DELETE FROM page_jobs WHERE document_id=? AND case_id=?`부터 실행하고 `DELETE FROM documents ... ready=0`만 조건부 실행한다.

`saveCase`는 D1 batch COMMIT 뒤 ACK를 분실해도 권한 있는 저장 영수증 재조회로 복구를 시도하지만, **재조회 또한 미관찰**이거나 COMMIT 이후 `finishDerivedEvaluation`이 오류를 던지는 경우 호출자에게 throw될 수 있다. 따라서 **일반적인 복구 성공 ACK 유실을 POST 오류라고 주장하지 않는다.**

다음 순서를 합성 재현했다.

1. A 신규 등록: SQL `documents.ready=0` + `page_jobs=2`.
2. A `saveCase`가 사건 활성 문서를 D1에 COMMIT; 이어서 ACK/복구 재조회 실패 또는 후처리 오류를 가정. A catch는 아직 대기.
3. B는 저장된 활성 문서를 읽고 R2 원본 업로드 + SQL `ready=1,original_key=K`를 성공.
4. A catch는 `page_jobs` 두 행을 삭제하고 `documents`는 `ready=1`이므로 남김.
5. 관찰: 사건 JSON 문서는 active, SQL 문서 ready=1, R2 원본 K 존재, **OCR 페이지 작업 0개**. 동일 SHA 신규 등록 POST는 active JSON만 보고 `idempotent=true`를 반환하므로 작업행을 재생성하지 않는다.

B가 업로드하기 전 A catch라면 SQL 원본과 job 모두 삭제돼 **사건 JSON active와 SQL 원본 0건**이 상충한다. 이는 R2 PUT의 기존 PR #23(원본 포인터 COMMIT 후 ACK 유실로 R2를 삭제하는 문제)과 다른, **최초 등록 POST의 복구 경계**다. 실제 서비스에서 장애가 발생한 기록은 확인하지 않았음.

## 3. 검증 환경, 입력, 독립 기대값·관찰

환경: Node.js v22.16.0, SQLite 파일 WAL **독립 연결 A/B**, R2는 합성 `Map`/key 집합. `db/schema.ts`의 cases/documents/page_jobs 핵심 컬럼과 실제 라우트 `INSERT/DELETE/UPDATE` SQL을 독립 전사. 추가로 **원본 POST blob과 로컬 파일 `git hash-object` 일치**를 확인하고, import/TypeScript 함수 인수만 제거한 **실제 POST 함수 본문**을 Node V8에서 합성 `db/getCase/saveCase` 어댑터로 실행했다. 후보 본문은 별도 Draft PR에서만 변경. 원본 서버 런타임·Cloudflare D1·R2 HTTP 자체 실행이 아니다.

| 합성 입력 | 독립 기대 | 실제 관찰 |
|---|---|---|
| 정상 POST→PUT | active / SQL ready=1 / OCR 2 / R2 원본1 | 일치 |
| 페이지 job batch 중 실패(saveCase 진입 전) | SQL 문서·부분 job 모두 안전 정리 | 0/0, 일치 |
| saveCase **COMMIT 후 throw**, B 미업로드 | main catch는 불안전 삭제라는 부정대조 | active JSON + SQL 문서0/job0 재현 |
| saveCase COMMIT 후 throw, B PUT 성공 | main에서 job 삭제/ready 문서 보존이라는 부정대조 | SQL ready1/R2 존재/job0 재현 |
| 이 상태에서 같은 SHA POST 재요청 | main 멱등 200으로 job 미복구 | 200/idempotent=true/job0 |
| B 원본 PUT R2 성공 후 D1 COMMIT ACK 유실 | main PUT finally가 참조 R2 key 삭제 | SQL ready1/R2 객체0 재현 (#23 범위) |
| 직후 B PUT 동일 원본 재시도 | 기존 SQL 포인터만 보고 성공 오판 가능 | `idempotent=true`/R2 객체0 재현 |
| R2 503, D1 미커밋 | ready0/job 보존/새 key 정리 | 일치 |
| R2 성공·D1 확정 무커밋 503 | 미참조 key만 정리, SQL 원본 ready0 | 일치 |
| 원본 PUT 두 워커 동일 SHA | 포인터 승자1, 지연 후보 R2 정리 | 일치 |
| SQL 조회 미관찰 vs 실제 원본 0건 vs ready0 | 서로 다른 상태 유지 | 일치 |
| 법원기한 Fact 인정 철회·날짜 변경 | source-bound predicate false, 법원충족 false | 일치(함수 전사 합성) |
| 법원기한 NULL | 확정일이나 숫자0 아님, 자동 승인 없음 | 일치 |

**실제 실행 숫자:**
- 신규 SQLite WAL/R2 상태 합성 **16/16 기대 관찰 일치**. 결함을 예상대로 드러낸 부정대조 포함.
- 실제 POST 함수본문 V8 **main 6/6 기대 관찰 일치**(부정대조), Draft 후보 6/6 기대 관찰 일치. 최신 main 바이트 기준 `git hash-object` = `274f7a6e...`.
- A4 r84~r88 SQL 합성 70/70, 위 POST 함수본문 6개를 포함한 **회귀 76/76 기대 관찰 일치**(다수 부정대조 포함). 제품 합격률을 의미하지 않음.
- 합성 원문 시험: `/mnt/data/firmengine-a4/r88/document_registration_ack_r2_pagejob_race.test.mjs` SHA256 `22130a071e78ceba5abb479ba7937ca828dc81182a631c2194ae7f09d851bc13`, 실행 로그 `r88-node-results.txt` SHA256 `48e65d93b38c338b3027fc209ea6a09cd244b34ea4dbaeae82eda849e919c7cf`.
- 함수본문 VM 시험: `document-registration-postcommit-route.test.mjs` SHA256 `d72754b40eef1bfef0d3fbba0b83b6ef763ef0d3fbba0b1afae64108ff487972bbfd137`; baseline TAP `route-baseline-negative-control.txt` SHA256 `99d0dc789501855cf3b85aa1577ee318d4c2c36883879cde22d414600152403a`, 후보 TAP `route-candidate-results.txt` SHA256 `bea449ae08bcdabcb0dabb775c64c3d9a40199c59b7fca31ccc75dd42c856ef8`, 회귀 TAP `regression-r84-r88-with-route.txt` SHA256 `7f3cab0cd6b4dde578a8dd2d283557771497c8b66af76fa1363ed9e7c8949333`.

## 4. 수정 후보와 실제 해소 수준

- **[Draft PR #201](https://github.com/firmengine/firmengine/pull/201)**: 별도 `audit/a4-r88-postcommit-registration-evidence-guard-20261103` 브랜치, 실제 POST 라우트에 `caseSaveStarted`가 참이면 catch에서 OCR job/SQL 원본을 자동 삭제하지 않는 **작은 보존 가드** 삽입; V8 원본문 회귀 6건 신규 추가. 후보 blob `59a29303dacccdf3ac1dbef98da396b4285b5930`. **main 미병합/운영 미배포.**
- 새 후보는 post-commit 증빙 오삭제를 막는 보수적 보호만 제안한다. **명백한 saveCase 선행 409/사전실패라도 saveCase 진입 후라면 임시 문서·OCR job이 잔존할 수 있다**는 새로운 트레이드오프가 있으므로, 권위 있는 저장 영수증/해시로 정상 참조 여부를 판별하고 고아 행을 안전하게 정리하는 별도 복구 작업이 필요. Draft 병합·제품 합격 금지.
- 원본 PUT의 기존 ACK 유실은 **[Draft PR #23](https://github.com/firmengine/firmengine/pull/23)**와 함께 통합해야 한다. 정상 멱등 재요청에도 R2 파일 실존·SHA 재확인이 없어 `stored:true`만으로 실제 원본 건전성을 확정할 수 없다.

## 5. 6역할 순환·체크 ID 5건 (모두 [ ] 미완료)

순환: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**. 역할별 엔지니어링 검토 관점만 적용했으며 실제 담당자/법률전문가 승인 0건.

- `A4-IT-006 [ ]`: SQL 등록/CAS 이후 실패 및 R2 원본 PUT ACK 유실·2워커 경합. 새 POST 결함 후보 재현, #201 미병합, #23 기존 수정 후보. 실제 D1/R2 장애주입/HTTP 미실행.
- `A4-DOC-013 [ ]`: 원본 문서 active인데 페이지 OCR 작업 0건이 될 수 있는 조건 재현. 실제 직원 문서 검수 무효화·Word 재생성·UI 검증 **미실행**.
- **계산사무장**: 신규 증빙 이후 10분 quiet window/18 산식/청산가치/변제계획의 실재계산을 **미실행**. 소실된 OCR job이 해당 단계로 전파될 수 있는 경계만 관찰.
- `A4-LAW-008 [ ]`: 법원 기한 Fact accepted→unreviewed/날짜 변경 시 read predicate는 구 기한을 보류하는 합성 확인. 실제 법원 원문·기한/답변·접수증·변호사 검토/인정 없음; #19 복수 명령 답변 식별 미병합.
- `A4-DATA-012 [ ]`: A POST 커밋→B PUT→A 예외 cleanup 순서와 재전달 시 idempotent 오인 합성. 운영 이벤트/outbox/중복 webhook 리플레이 **미실행**.
- **AX**: 95 법률 검토·Word·직원→변호사 승인 연계는 코드 존재/단위 재현과 무관하며 이번 종단 실행 **미실행**.
- `X-044 [ ]`: 보정기한 인정 Fact 철회/변경/NULL 합성 판단; 원문 OCR/법원 실제 보정명령/접수증 및 사람이 승인한 기한 **미실행**.

## 6. 미실행·다음 체크 ID 및 인수 불변식

- **실행하지 않음:** 최신 main 전체 TS/Node/lint/build/CI, staging D1/R2/Cron 및 운영 n8n 워크플로, 실제 두 HTTP 워커, 실제 R2 응답유실/429/503/timeout, 중복 webhook, 실제 OCR·PDF·Word, 법률 위험 95, 10분 계산, 공식 법원 서식·담당자/변호사 검수, 실제 보정 이벤트/전자제출. n8n 설계/정적 구조만으로 실행 확인 취급 금지.
- **다음:** (1) PR #201과 #23의 POST/PUT 원본 증빙 인수 계약·미참조 SQL/R2 retention·재조회 복구 결합, (2) R2 HEAD와 SQL ready1/hash 간 실제 건전성 검증, (3) 2워커 최신 storage token/CAS 및 D1 실패/ACK 소실 staging, (4) 상담→문서→OCR→quiet 계산→95법률→Word 재생성/검수→보정명령의 인계로 확대. 후속 체크 후보 `A4-IT-005`, `A4-IT-006`, `A4-DOC-013`, `A4-DATA-012`, `X-047`.
- `UNOBSERVED` / SQL 관찰된 0행 / `NULL` / ready0 / ready1 / source-only / 승인전/상충은 각각 분리. 사람 승인 없는 법률상 확정 금지.
- **이번 최종 인수 완료 0/5**, 운영 출시 게이트 승인 0. 운영 배포·운영 D1 migration·실제 법원 제출·법원 인가확정 수행하지 않음.
