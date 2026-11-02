# FirmEngine A4 — 82차: Word 직원 인계의 권한·원자감사·ACK 유실 결합 검증 (합성)

작성: 2026-11-02 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 A4 실행 흐름/예외/동시성/복구. **실제 사건·개인정보·OCR 원문·키·.env·법률 인정값 없음.**

## 1. 먼저 확인한 원천·상태

- GitHub main 시작 SHA `9053933b500f24416a05b38e5c9deb1326dae93f`; 최근 main 4개 커밋은 A3 r82(`9053933b`, `c5f74677`)와 A2 r82(`72b00cae`, `de6e181e`). 중앙 보드 blob `706836decd64dab367eaa6ed3c8d8b9ad7261808`, 기존 81차 영수증 blob `54b3954b418115ff0aaae6501b858d175d8c9b08`를 읽고 미완료 항목을 보존했다.
- 실제 main 소스 blob: `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`; `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `lib/app-roles.ts` `a716bc17109d9bff7ff88c89606a49949e75a1df`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `drizzle/0000_chunky_cardiac.sql` `8dfc207156013820c41def90e787c781c34acf6d` (`events.id TEXT PRIMARY KEY NOT NULL`).
- PR #164/#167/#170/#174/#176/#187 모두 **Open Draft·미병합** 조회. PR #187의 실제 `automatic-draft-role-guard.ts` blob `600cf9683c8cb879337eb45c8cbb9f3f89d10de6`를 독립 테스트 파일로 복사해 `git hash-object` 동일성 확인. PR #170의 D1 batch 내부 event INSERT 패치를 실제 diff와 비교.
- 운영 플로우와 `docs/ax-n8n-e2e-scenario-matrix-20261030.md` (blob `3eb51044ee906704fb1deaa9e9760f05e1b9fbe2`)는 별개. WF01~08은 **향후 설계·수용시나리오**이며 실제 n8n 구동 영수증이 아니다.

## 2. 합성 입력/독립 기대/관찰

환경: Node.js 22.16.0 / `node:sqlite` 파일 WAL **독립 두 연결 A/B** / 사건 `syn-case`, actor `syn-staff`, 사건 revision 3, storage token `tok0`, 역할 `case_editor`·`caseworker_review` v1, 가상 Word `word-A`, 기준판 `ref-A`. 실제 문서/R2 파일 없음.

| 입력·B 변경 | 독립 기대(정책 미승인 시 보수 상태) | 합성 관찰 | 분류 |
|---|---|---|---|
| 정상 권한·동시 token 경쟁 | A 저장·감사·receipt 각 1, B 0 | 1/1/1, B=0 | 합성 통과 |
| A R2 대기 중 B 검수권한 revoke v2 | 최종 인계 거부 | main 동등 CAS 1, PR #187 CAS 0 | 후보 보호 |
| B revoke v2→regrant v3, 옛 A 요청 | 허용 정책 미확정, 승인전 보류 | PR #187 + #170 합성 결합도 저장1/감사1; 동일-grant 승인세대 비교 후보는 0 | **정책 위험 미해소** |
| B regrant 후 **신규** A 요청 | 현 v3 권한으로 시작하면 가능 | epoch 비교 후보 저장1 | 합성 통과 |
| 단일 D1 트랜잭션 안 audit INSERT 오류 | manifest·receipt·event 전부 rollback | 0/0/0 | 합성 통과 |
| 기존 main식 저장 후 독립 audit 오류 | manifest는 성공, event=0 | 저장1/event0 | **부분성공 결함 재현** |
| D1 COMMIT 후 ACK 유실·그외 변경 없음 | 과거 성공 증거 1/1 및 현재 연결 유효 | receipt1/event1, 현재=true | 합성 통과 |
| ACK 유실 뒤 B 원문/Word/법률 기준판 각각 변경 | 과거 성공과 현재 유효성을 구분 | 3종 모두 historical receipt=true, current=false | **복구계약 미해소** |
| A 저장→B 원문 변경→A 지연 event | 현재 event 순서 역전 금지 | main 동등: B→A 역전, PR #170 원자결합: A→B | 후보 보호 |
| R2 429/503/timeout 응답 가정 | `UNOBSERVED`, 결측/0/현재 유효 아님 | 각각 D1 변화0·audit0 | 합성 주입 |

**독립 판정:** PR #170 원자감사와 PR #187 최종 active-role 검사를 **각각 결합한 설계만으로는** 권한 v1→v2→v3 ABA도, D1 ACK 유실 후 최신 문서/기준정보 재확인도 해결하지 못한다. 승인세대 선택·법률판본 확정·재승인 의미는 실무자 승인 전 자동 변경하지 않는다. 여기의 결합은 **실제 PR 병합 코드가 아닌 별도 SQLite 합성 SQL**이다.

## 3. 실제 실행/한계/실패복구

- 신규 `handoff_grant_audit_ack_integrated_sqlite.test.mjs` Node 13/13 기대 관찰 일치; SHA-256 `31c5fda54cbc9fc563d6be5de393f7ad8f571097701435cc547fb254e9900f58`. 재현용 공유파일명 판본의 단독 Node도 13/13; SHA-256 `37f4aac8df7eccca38f7d942032f31ac370a5a996272a1c33064a6b310a92518`. PR #187 helper blob hash 동일. 기존 75~82차 로컬 합성 회귀 **96/96 기대 관찰 일치**, 결과 SHA-256 `8c4f121bc3b01ef2c6623eb6a59c8a36b442dd67cec4a7951db2552c713d8fb5`. **기존 결함의 의도적 재현(부정대조)이 포함되므로 안전성 96건 합격 아님**.
- 첫 실행에서는 신규 SQLite fixture의 `events.id TEXT PRIMARY KEY`에 `NOT NULL` 누락으로 감사 실패 주입이 실패(11/13). 실제 `drizzle/0000_chunky_cardiac.sql`의 `PRIMARY KEY NOT NULL`을 재대조하여 fixture를 수정, **13/13 재실행 및 96/96 회귀 완료**. 이것은 **시험 fixture 오류**이고 제품 코드 변경·운영 결함으로 표시하지 않는다.
- 테스트에서 실행한 것: 로컬 Node+SQLite WAL 2연결, 원문 변경/권한 revoke-regrant, 원자감사 실패·ROLLBACK, COMMIT ACK 유실을 제어흐름으로 가정한 재독, 이벤트 순서 대조, 비가동 R2 응답 가정. **실행하지 않은 것:** 실제 PR 결합 빌드/TypeScript/Next CI, 실제 n8n, staging D1/R2/Cron, R2 PUT/GET 실제 바이트, HTTP 두 워커, 공식 Word·법원 서식·변호사 승인·전자제출·보정명령 실제 사건.
- 상태는 `UNOBSERVED`(503/429/timeout) / `null`(자료 없음) / `0`(실행 결과 0건) / 비해당 / source-only / 승인전 / 다른 세대 충돌을 서로 구분한다. COMMIT receipt의 존재는 현재 문서 유효나 법률승인 근거가 아니다.

## 4. 이번 5개 ID 및 6역할 순환

**내부 검토 순서: 계산사무장 → 변호사 → 데이터 → AX → IT → 사용자·서류.** 다음 회차는 **변호사**부터 시작하여 동일 역할 우선 반복 금지. 실제 직원·사무장·변호사의 업무승인 미실행.

- `A4-IT-005` [ ]: D1 ACK 유실시 historical/current 분리 합성, 실 D1 readback 미실행.
- `A4-CALC-016` [ ]: 원본/기준 세대가 바뀌면 과거 Word-계산 증빙 재사용 금지, 실제 quiet 계산·두 writer 미실행.
- `A4-LAW-013` [ ]: 기준판 변경/Word 재생성은 사람 재검수, 실제 바이트·변호사 승인 미실행.
- `A4-AX-013` [ ]: 모델 초안 인계 후 순차 사람검수/재생성 계약만 대조, 종단 실행 미실행.
- `X-047` [ ]: ACK 유실·R2 오류 **합성 경계**만, 실제 R2 성공→D1 실패 주입 미실행.

## 5. 복구 상태/다음

- **이번 수정:** 실제 GitHub 실행 코드 수정 0; 원래 Draft PR들 충돌 없이 보존, 법적 의미 변경 없이 감사 증거만 기록. `[x]` 신규 0/5, 제품 전체 최종 인수 0.
- 다음: (1) actor/role/scope/승인세대 보존과 owner fallback을 IT·서류·변호사가 정책 확정, (2) PR #167/#170/#174/#176/#187의 동일 파일 충돌·원자 CAS·읽기전용 증빙 계약을 브랜치에서 실행, (3) staging D1/R2/Cron에서 2 worker·ACK 유실·R2 503 재현, (4) 실제 Word 최신 R2 바이트 재검증·직원/변호사 분리·보정 이벤트/마감기한 미확정 경계 검증. 운영배포·운영 DB migration·전자제출·법원인가 확정 없음.
