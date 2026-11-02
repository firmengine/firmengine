# FirmEngine A4 — 80차: 직원 Word 인계 중 권한 철회 경합(승인 전)

작성일: **2026-11-02 KST**. 범위: **A4 실행 흐름/예외/동시성/복구**. 전부 가상 사건/독립 SQLite WAL. 실 의뢰인·원본 OCR·민감정보·키·.env/비공개 정답 없음.

## 1. 실행 전 최신 main·관련 증빙

- 시작 및 PR 생성 직전 `main` SHA: **`22333b00db1580436326a04bf7425dbbdfc6788d`**. 최근 A3/A2/A1 문서 커밋, A4 79차 보드 커밋 `f451040208b2ac6469914f03e0ee249b5fb4394e` 이후의 작업을 확인. 이전 79차 영수증 blob `a1d3ca4175dd3542c8fc9f884ab50cd617d2c0c8` 재독.
- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob **`db012481ee5016f01f3fa123bdae3d844235a442`**에서 A4 항목 및 X 경계 확인.
- 실제 `main` 코드: `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`; `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `lib/app-roles.ts` `a716bc17109d9bff7ff88c89606a49949e75a1df`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- `app/api/cases/[id]/automatic-draft-handoff/route.ts` blob `1ba46ee3d55c5a02560525a047cc91062e3e15a2`: `case_editor`→`caseworker_review` 두 사전 권한 검사. 호환 경로 `automatic-draft/adopt/route.ts` blob `d06e5cfb6e969877b3ba095d6d964d3b5587e327`는 같은 handler 재사용.
- `app_role_grants`는 `(actor_id,role,scope_id)` 복합 PK, `status/effective_from/effective_to/policy_revision` 존재. `rolesForActor()`는 role+actor+scope(`*` 또는 사건)+active+유효기간으로 판단. 반면 최종 `saveCase` SQL은 사건 token 및 계산/법률 Head만 CAS로 검사하고 **현재 권한 행을 재검사하지 않는다**.
- Draft PR #164·#167·#170·#174·#176의 미병합/동일 파일 충돌 가능 상태 확인. 79차에서 발견한 event 순서 문제와 별개인 이번 독립 권한 경합.

## 2. 신규 P1 *후보* — 사전 권한 승인 후 R2 검증 도중 철회

**합성 사건:** `syn-case` (revision 3/dataVersion 7, ref-A, calc-run/law-run, storage token `old-token`), 직원 `synthetic-staff`는 `case_editor` 및 `caseworker_review` scoped grant가 먼저 active. 워커 A가 POST 권한 두 개를 조회하고 R2 SHA/Writer를 확인하는 동안, DB 워커 B가 `caseworker_review`만 `revoked`로 변경. 이어 A가 이전 case token/Head 상태로 최종 manifest CAS 시도.

**독립 기대:** B의 철회가 *COMMIT 전에* 완료되면 직원 handoff manifest의 새 저장 0행. 단순 403 이후 유효한 실무 승인을 가정하지 않는다.

| 입력/고장 순서 | `main` 동등 최종 SQL (관찰) | 제한적 강화 CAS (관찰) | 판정 |
| --- | ---: | ---: | --- |
| 권한 2개 active, Head/Token 동일 | UPDATE 1 | UPDATE 1 | 정상 합성 |
| R2 읽기 중 `caseworker_review` 철회 | **UPDATE 1** | **UPDATE 0** | main 권한 TOCTOU 후보 |
| R2 읽기 중 `case_editor` 철회 | **UPDATE 1** | **UPDATE 0** | main 권한 TOCTOU 후보 |
| 유효기간 만료/미래 발효/다른 사건 grant | UPDATE 1 | UPDATE 0 | 후보 차단 |
| 별표 `*` 범위 grant와 현재 사건 grant | UPDATE 1 | UPDATE 1 | 정책 유지 |
| actor 교체/다른 사람 grant | UPDATE 1 | UPDATE 0 | 후보 차단 |
| 다른 워커의 사건 token 변경 | UPDATE 0 | UPDATE 0 | 기존 CAS 보존 |
| 다른 워커의 legal Head 또는 calc ref 변경 | UPDATE 0 | UPDATE 0 | 기존 CAS 보존 |
| A COMMIT 이후 B가 철회 | 현재 저장 보존 | 현재 저장 보존 | 역사적 성공 ≠ 현행 승인 |

이 시험은 **동일 스키마·SQL 조건을 전사한 독립 Node SQLite 두 연결의 합성 재현**이며, 실제 Sites HTTP 핸들러나 Cloudflare D1에서 철회 사고를 관찰한 것이 아니다.

## 3. 실행 증거/수정 후보

- 실제 Node.js `22.16.0`, SQLite WAL 두 독립 연결. **신규 17/17 조건의 독립 기대 관찰 일치**. 후보 helper를 실제 Node TS import(`--experimental-strip-types`)하여 재실행한 **17/17** 일치. r75~r80 합성 회귀 **71/71** 기대 관찰 일치. 일부는 의도된 안전 실패 부정대조이므로 제품 합격 71개가 아님.
- 로컬 합성 실행 파일: `staff_handoff_role_revocation_cas_sqlite.test.mjs`, 후보 helper 연결 `staff_handoff_role_revocation_cas_candidate.test.mjs`; 실행 명령 `node --test` 또는 `node --experimental-strip-types --test`. 로컬 출력 각각 `node-results.txt`, `candidate-node-results.txt`, `regression-r75-r80.txt`. (GitHub 공개 소스에는 실제 고객 정보 없음.)
- 별도 안전 검토 **[Draft PR #187](https://github.com/firmengine/firmengine/pull/187)**: `lib/automatic-draft-role-guard.ts` 신규, `server-store.ts` 최종 UPDATE에 active/actor/역할/관할/유효기간 SQL EXISTS×2, `automatic-draft-handoff.ts` actor 전달, 새 `tests/automatic-draft-handoff-role-revocation.test.mjs`. 브랜치 `audit/a4-r80-staff-role-revocation-cas-20261102`; 출발 main `22333b00`; PR HEAD `e100f871152b7307499b39731b9e260fb478f974`. 파일 4개 모두 허용 범위. **코드 PR 미병합**.
- 새 저장소 테스트는 **작성·GitHub 반영만 완료 / 실제 저장소 전체 모듈 환경에서 미실행**. 로컬 SQLite 시험은 새 본선 commit을 실행한 것이 아니라 후보 helper+전사 SQL을 실행. full TS/Next/CI, staging D1/R2/Cron, 실제 두 HTTP 워커, Word 바이트, lawyer 승인/공식 서식, 10분 quiet/95법률 종단 및 보정 이벤트는 **미실행**.
- 검사대상 6역할 순환: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**. 내용은 역할 관점 간접 검토이며 실제 직원·변호사 의사결정/승인을 뜻하지 않음.

## 4. 인수 ID: 5개 모두 `[ ]` 유지

- `A4-IT-003`: 두 워커 중 B grant revoke 후 A 최종 CAS 불변식. 실제 D1/HTTP worker 미검증.
- `A4-DOC-012`: 직원 인계 전 두 역할 check ≠ 저장 순간 승인. Word·변호사 순차 검수 미검증.
- `A4-CALC-016`: 산식/계산 Head CAS는 보존했으나 계산·Word 종단 없음.
- `A4-AX-013`: 사전 모델/검수 결과를 현 권한과 무관하게 인계하면 안 됨. 문안 재생성→직원/변호사 실제 승인 미검증.
- `X-046`: 두 DB 워커 경합 재현은 권한 grant 변경 시퀀스만; 실제 Cloudflare 2-worker/다른 사건 테넌트 유출 검증 아님.

변호사 `A4-LAW-013`, 데이터 `A4-DATA-012`는 이번 5개 밖의 교차 검토로만 다뤘고 ID 합격으로 기록하지 않음.

## 5. 남은 교차 충돌·복구·정책 게이트

- **기능상충**: #187은 `server-store.ts`, `automatic-draft-handoff.ts`를 건드리는 #167/#170/#174/#176 등과 그대로 병합할 수 없음. 향후 승인세대 CAS, Run/Artifact epoch, 원자적 감사 event, 증빙 read-only replay를 같은 UPDATE/동일 batch에 보존-병합해야 함.
- **인증 정책**: 소유자 fallback `case_editor`, wildcard와 사건 scoped role의 우선순위, 철회 효력 시각, 사후 재승인의 의미를 IT/서류/변호사 실무자 검토 필요. 사람 없는 서비스 actor는 승인되지 않음.
- **D1 권한 불명확**: D1 actor-role lookup 실패는 `UNOBSERVED`로 보류; 실제 저장 `0`행은 CAS 거절; grant `NULL` effectiveTo는 만기 없음; status `revoked`는 활성아님; historical event는 present/current approval과 다름.
- **n8n 설계** `docs/ax-n8n-e2e-scenario-matrix-20261030.md`와 운영 n8n 워크플로 실재/배포/실행 증빙은 별도. 운영 배포·D1 운영 migration·실제 전자제출·법원 인가 확정 전부 **실행하지 않음**.
- 다음 우선 체크: `A4-IT-003`→`A4-DOC-012`→`A4-LAW-013`→`A4-DATA-012`→`X-047`. 테스트할 연속 흐름: 직원 권한 변경→R2 읽기→Case/Run/Ref epoch 변경→D1 ACK 유실→재요청→Word 재생성→기존 승인 무효화; 실제 저장소/법률 검수 통합 전까지 **0건 인수 완료**.

**80차 신규 인수 완료 0/5, 제품 전체 최종 인수 완료 0.** PR·SQLite 계약 합격은 운영/법률/공식 서식 인수가 아님.
