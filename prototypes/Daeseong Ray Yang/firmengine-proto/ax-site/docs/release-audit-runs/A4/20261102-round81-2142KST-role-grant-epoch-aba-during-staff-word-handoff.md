# FirmEngine A4 — 81차: 직원 Word 인계 중 권한 철회→재부여(ABA) 및 역할 승인세대 CAS 감사

작성: **2026-11-02 KST** · 대상은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 **A4 실행 흐름/예외/동시성/복구**뿐. 전부 합성 사건·로컬 SQLite WAL. 고객 문서·개인정보·원본 OCR 사실값·키·.env·비공개 정답 미사용.

## 1. 선행조회 / 소스·스키마·영수증

- 이번 조사 시작/기록 전 **GitHub main**: `024c23070b57325db4d379bb2fc6b5ac80699e56`. 최근 커밋은 A3 r81 `024c2307`, A3 `6aeb457b`, A2 `077687cd`, A1 `91c5e9a9`, A4 80차 `898db3ad`. 기존 실행 파일 변경 여부를 구분.
- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `da9dd8de5a16fd63ee7a5eca32a149fc019c8bd5`를 먼저 읽고 기존 80차 미인수 ID 확인.
- 실제 main `lib/automatic-draft-handoff.ts` blob `a525e3c12672966c993f83021d5f169b170bebe9`, `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/app-roles.ts` `a716bc17109d9bff7ff88c89606a49949e75a1df`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; 실제 POST route `1ba46ee3d55c5a02560525a047cc91062e3e15a2`.
- `app_role_grants`에는 `(actor_id, role, scope_id)` PK, `status/effective_from/effective_to/policy_revision` 존재. `updateRoleGrant()`는 revoke/regrant마다 `policy_revision`을 증가시키지만, `requireAppRole()`의 읽기 결과는 **role 명칭만** 제공. 저장 전 그때 관찰한 특정 grant row/revision을 고정하지 않는다.
- **Draft PR #187**: HEAD `68e40cb96ccac64dd0ef0933caab729238bb36b9`, base `22333b00db1580436326a04bf7425dbbdfc6788d`, 미병합. 후보 `lib/automatic-draft-role-guard.ts` blob `600cf9683c8cb879337eb45c8cbb9f3f89d10de6` **Git blob SHA를 로컬 `git hash-object`로 일치 확인한 내용 그대로** import. `app_role_grants`의 현시점 active/actor/role/scope/time을 최종 UPDATE SQL로 검증하나 **policy_revision은 비교하지 않는다**.
- 선행 [80차](20261102-round80-staff-role-revocation-final-cas.md), [79차](20261102-round79-1944KST-late-staff-audit-after-ack-supersession.md), [78차](20261102-round78-1844KST-ack-proof-historical-vs-current-link.md) 영수증, #170(감사 batch), #174(재사용 증빙), #176(읽기전용), #167(법률 승인세대) 후보 확인. 모두 **코드 존재/미병합 후보**이지 main 배포가 아니다.
- `docs/ax-n8n-e2e-scenario-matrix-20261030.md`는 n8n **설계/수용시험 시나리오**이며 실제 운영 n8n workflow 실행 증빙이 아니다.

## 2. 검증 의문 및 합성 입력

A 직원 `syn-staff`가 사건 `syn-case`에 대해 편집/서류검수 권한을 **각 policy_revision=1**로 사전 통과하고 R2/Writer 조회 중 대기. B 관리자 워커가 같은 행을 `active(v1)→revoked(v2)→active(v3)`로 바꿈. A가 *과거 인증정보*로 다시 검사하지 않고 D1 Word Manifest를 UPDATE.

**질문:** 현재 다시 active이기만 하면 이전 v1의 미완료 요청도 승인되는가? 또는 안전한 작업 인계에는 원래 관찰한 grant의 identity/role/scope/policy_revision 보존이 필요한가? 이 법적·실무적 정책은 확정되지 않았으므로 **P1 보안 결함 확정이 아니라 고위험 승인세대 정책 공백 후보**이다. 재승인 후 새 요청 자체는 정상 허용될 수 있다.

로컬 실행은 Node.js **22.16.0**, 파일 기반 SQLite **WAL 독립 2연결**; 실제 PR #187 helper의 SHA가 동일한 파일을 Node `--experimental-strip-types`로 import. 사건 `revision=3, storage_token=token-A`, 승인전 합성 Word `syn-file-A`, 프로덕션 데이터 없음. **원본 SQL 동등 CAS / #187 최종 역할 검사 / 독립적인 동일-grant-epoch 비교**를 서로 다른 SQLite fixture에서 실행. epoch 비교는 설계 대안 대조이며 제품 패치/실무 승인된 계약 아님.

| 입력 / B 작업 | 독립적인 안전 기대(정책 후보) | main 동등 token CAS | PR #187 role CAS | 동일-grant epoch 대조 |
| --- | --- | ---: | ---: | ---: |
| 두 권한 v1 유지 | 인계 허용 | 1 | 1 | 1 |
| `caseworker_review` revoke v2 | 인계 차단 | **1** | 0 | 0 |
| `case_editor` revoke v2 | 인계 차단 | **1** | 0 | 0 |
| review revoke v2 → grant v3, **기존 A 요청** | **재승인 필요 여부 사람 결정** | 1 | **1** | 0 |
| editor revoke v2 → grant v3, 기존 A | 동일 정책 검토 | 1 | **1** | 0 |
| v3 재부여 **후 신규 요청** | 현행 grant와 일치하면 허용 | — | 1(동일 계약) | **1** |
| 활성 상태 유지·policy_revision 1→2 | 기존 요청 유지 여부 정책 검토 | 1 | **1** | 0 |
| 사건 scoped revoke, 신규 wildcard grant | 현재 새 권한은 존재·기존 scope는 상실 | 1 | **1** | 0 |
| B가 사건 token 먼저 변경 | 오래된 요청 0 | 0 | 0 | 0 |
| 서비스 pseudo-actor/빈 actor | 403 성격의 사전 차단 | 해당 없음 | helper throw | 해당 없음 |

**해석:** #187은 **철회된 채 남은 권한**을 최종 SQL에서 잘 차단하지만, 철회 후 *다시 부여된 권한*의 **같은 권한세대**까지 비교하지 않아 A의 과거 요청을 통과시킬 수 있다. 이것이 업무상 허용 가능한지는 **IT/서류/변호사 승인정책 판단 전에는 결정하지 않는다.** 단순히 모든 재부여를 차단하는 수정을 임의로 하지 않는다.

## 3. 실행 영수증 / 한계 / 해결 상태

- 신규 Node SQLite **12/12 기대 관찰 일치** (실제 부정대조 포함). `staff_handoff_role_policy_epoch_aba.test.mjs` SHA-256 `099f9b02c5cfa068c91f0865c1781e666347a02fa5f2ac0ae9cf3088866b1d20`, Node 실행 출력 SHA-256 `165d59fba192d48fdac50750b894f7da90c3a760fb42bf2956558460801d8dea`.
- 기존 75~80차 로컬 합성 회귀 + 신규 81차 = **83/83 기대 관찰 일치** (결함 부정대조/정책 비교 포함), 출력 SHA-256 `377001d03bed79056278a7f480a916618739ca1684448731d3dfc78aa1259521`; **제품 인수 83건 합격 아님**.
- **실행한 것:** Node/SQLite WAL 두 연결, 직접 SQL UPDATE, 권한 revoke/grant revision 증분, 실제 PR helper import. **실행하지 않은 것:** 원본 Cloudflare D1·R2·Cron, 운영/staging, 실제 Next/HTTP 두 워커, PR 저장소의 전체 Node·TypeScript·Next CI, Word 실바이트, 공식 법원 서식, 직원·변호사의 실승인, 상담→OCR→10분 quiet→95개 법률→실제 보정 이벤트 종단.
- **상태 구분:** grant 행 미조회 `null`/DB 응답 미관찰 `UNOBSERVED`/CAS `0`행/검증 대상 비해당/두 판본 상충/단순 source-only/승인전 상태는 서로 다르며, 이 실험은 DB 응답 유실이나 D1 NULL을 주입하지 않았다.
- **수정:** 승인세대의 업무 의미가 달라질 수 있으므로 이번에는 **실행 코드 미수정**, PR #187에 정책/병합 보류 의견 남길 예정. #170 감사 이벤트 원자성, #167 기준 release CAS, #174·#176 증빙 재사용과 결합 검증은 아직 없다.
- **보수적 설계 후보:** 사전 권한 확인 단계에서 양 role에 대해 실제로 매칭된 `actor_id/role/scope_id/policy_revision`와 세대별 허가 영수증을 확보하고, 마지막 사건 CAS와 같은 D1 statement에서 **원래 관찰한 grant row/revision**을 비교. 정책에서 새 권한으로 계속 진행해도 된다고 승인한다면 새 인증요청을 별도로 기록. scope wildcard→사건 grant 변동, 만료, owner fallback, 경합 중 event 원자성까지 통합 검증 필요.

## 4. 중앙 보드 선택 5개 ID (전부 `[ ]` 유지)

- `A4-IT-003`: 두 워커 권한 revoke/regrant 동시성·CAS **부분 시험**, 실 D1/HTTP 워커 미실행.
- `A4-DOC-012`: 직원→변호사 순차 인계에서 직원 역할 승인세대의 의미 정책 미결. 실제 직원·변호사 검수 없음.
- `A4-LAW-013`: 원문/Word 재생성 시 현재 승인과 과거 인계 구별, 실제 Word 바이트/변호사 서명 없음.
- `A4-DATA-012`: grant 이벤트 순서(활성 v1→철회 v2→재승인 v3) 합성; 실제 이벤트 발행/중복 webhook/outbox 순서 미실행.
- `X-046`: A/B WAL 워커 권한세대 경합만, Cloudflare 두 워커 및 타 사건 교차 검증 미실행.

**6역할 순환:** 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX → IT. 6개 전문 관점의 **내부 코드 감사**이며 실무자 사람 승인 아님. 계산사무장: 기존 계산 Head CAS 계약을 이번 권한 SQL이 대체하지 않음. AX: 모델→사람 승인전 인계에서 권한 세대/멱등성 구별. 미선정 `A4-CALC-016/A4-AX-013`도 간접 관점만 확인, 합격 미기록.

## 5. 복구 / 다음 확인

철회가 **최종 UPDATE보다 앞서고 재부여되지 않았다면** #187의 0행 차단 후보는 유효. 철회→재부여가 끼어든 옛 요청은 현 #187에서 1행 가능(정책 확정 전 미승인). 다음 우선 `A4-IT-003`, `A4-DOC-012`, `A4-LAW-013`, `A4-DATA-012`, `X-047`: 권한세대→최종 CAS+원자 감사 event→D1 ACK 유실→R2 현재 증빙→Word 재생성/승인 무효화. 10분 quiet·95법률 및 실제 보정 이벤트 E2E 별도 게이트.

**81차 최종 인수 완료 0/5, 제품 전체 최종 인수 0.** 운영 배포/운영 D1 migration/실제 전자제출/법원 인가 확정 **실행하지 않음**.
