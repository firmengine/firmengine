# FirmEngine A4 — 71차: 직원 Word 인계 COMMIT 이후 감사 이벤트 유실 / 재시도 무영수증

- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **내부만**. 작성일 2026-11-02 KST. 합성 사건 ID 외 실제 고객자료, 원본 OCR 인용, 키, .env, 비공개 정답 없음.
- 감사 시작 `main`: `33e9e1ed6a569a4a89c29f983b0e09b694111b14` (직전 A4 70차 이후 추가 커밋 확인). 관련 Open Draft: [#17](https://github.com/firmengine/firmengine/pull/17), [#24](https://github.com/firmengine/firmengine/pull/24), [#161](https://github.com/firmengine/firmengine/pull/161), [#164](https://github.com/firmengine/firmengine/pull/164), [#167](https://github.com/firmengine/firmengine/pull/167). 전부 별개 후보·main 미병합. 70차 [이전 영수증](20261102-round70-1043KST-staff-handoff-active-reference-epoch-cas.md)에서 승인세대 CAS 미해결 확인.
- 먼저 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `ce304016a1a6b84b06ef0a325defd74041500e36`, 원본 소스 `lib/automatic-draft-handoff.ts` blob `a525e3c12672966c993f83021d5f169b170bebe9`, `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/automatic-draft-handoff-contract.ts` blob `43cd0e0245bb74d396879880161654cf80a2978e`, 기존 `tests/automatic-draft-handoff-contract.test.ts` blob `01724a1f0e214701fdc89458ef776c2606c0f1ee`, 법률 작업 스키마 `drizzle/0017_legal_reanalysis_orchestration.sql` blob `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d` 확인. `docs/ax-n8n-e2e-scenario-matrix-20261030.md`는 설계/인수시험 정의로서 운영 n8n 실행 영수증이 아님.

## P1 후보 — Manifest와 staff-handoff 이벤트의 별도 트랜잭션

현재 `adoptAutomaticDraftForReview()`는 모든 SQL artifact/R2 검사를 거쳐 `saveCase(..., {mutationCategory:'artifact_only',expectedHeads})`로 Manifest를 COMMIT한 **다음** `event('automatic_draft.linked_to_staff_workbench', ...).catch(()=>{})`를 실행한다. 이 독립 INSERT가 503/DB 오류로 실패하면 저장된 Manifest는 `linked`인데 감사 이벤트는 0건이다. 다음 동일 요청은 `alreadyLinked` 조기 반환으로 들어가서 누락 이벤트를 재작성하지 않는다. `saveCase` 자체의 후속 derived evaluation 예외도 post-COMMIT 간극이 될 수 있다. 기존 실행 코드의 경계 관찰이며 실제 고객 사건 장애 증거는 아니다.

독립 기대 계약: 손실된 event는 **null/0건**으로 남기고 승인 완료로 해석하지 않는다. 단순 HTTP 성공·기존 Manifest 존재는 변호사 검수·Word 최종 바이트·법원 수리 증거가 아니다.

## 실제 합성 재현 / 독립 비교

Node 22.16.0, 파일 기반 `node:sqlite` WAL 두 독립 연결, 가상 `case-A` source/revision 3, worker token-old/new를 사용. 테스트: `round71_staff_handoff_audit_atomicity_sqlite.test.mjs` (SHA256 `1f0c4a16d16c502eb27558194cf1429f60651a03e6424c33333769b3a6bde9e4`, 격리 로컬 산출). **7/7 기대 관찰 일치**:

1. **기존 main 부정대조**: manifest 저장 1행 후 audit INSERT에 503 주입 → 링크 저장, 이벤트 **0건**, 응답 경로는 오류를 삼킴.
2. **기존 main 부정대조**: 다시 POST하였으나 `already_linked` 분기 → 이벤트 **계속 0건**.
3. **후보 SQL**: manifest UPDATE + evaluation + audit INSERT 동일 SQLite 트랜잭션 → **1/1/1**.
4. **후보 SQL**: audit INSERT 실패 → 트랜잭션 ROLLBACK → manifest 0·evaluation 0·event 0.
5. **후보 SQL**: 두 연결 A가 claim/COMMIT 후 B는 stale CAS UPDATE 0행, 이벤트 INSERT 0행 → 최종 이벤트 1건.
6. **후보 SQL**: COMMIT 후 ACK 소실 주입 → 다른 연결에서 manifest + audit 모두 관찰(응답유실 = 미확정 성공, 외부 ACK 확인 필요).
7. **후보 SQL**: 이벤트 종류는 `automatic_draft.linked_to_staff_workbench`, `courtApprovalInferred:false`이며 법률 확정 이벤트가 아님.

69~71차 격리 합성시험을 재실행한 총 **32/32**는 기대 관찰과 일치(13+12+7, 기존 결함 재현 부정대조 포함), **제품 안전성 합격 32건이 아니다**. 7개 테스트와 PR의 회귀 파일은 서로 다른 산출이다.

## 개선 후보 / 통합 조건

- **[Draft PR #170](https://github.com/firmengine/firmengine/pull/170)**: `saveCase`의 event insert를 기존 CAS/derived evaluation과 동일 D1 batch에 넣고, route에서 확인된 사람 actor를 비교하여 동작하도록 구성. 코드·테스트 3개 변경 파일 모두 범위 내부. **미병합/실무 검토 전**. 기존 69차 `alreadyLinked` SQL/R2 증빙 재검사 누락, 70차 승인세대 A→B→A CAS 누락은 **해결하지 못한다**.
- `lib/server-store.ts`는 [Draft #167](https://github.com/firmengine/firmengine/pull/167)도 수정하므로 **두 PR diff 병합·회귀 충돌**을 먼저 검토해야 함. Writer receipt/Word byte proof, 직원-변호사 순차 승인, 법률 95항목 및 실제 보정 이벤트는 여전히 미인증. 기존에 빠진 이벤트를 무증거로 자동 backfill 금지.
- 신규 저장소 `tests/automatic-draft-handoff-atomic-audit.test.mjs` 작성·커밋은 했으나 **저장소 Node 실행 미실행**. TypeScript/Next/전체 CI, 실제 D1 트랜잭션·R2/Cron, 503/timeout/429 실장애, 운영 n8n, HTTP 두 워커, 실제 DOCX 생성·변호사 승인·법원 보정 이벤트도 **미실행**. Cloudflare D1 batch 원자성은 staging 실증 전 승인불가. 운영 배포·D1 운영 migration·실제 전자제출·법원 인가 확정 미수행.

## 6역할 회전 및 보드 체크 (직접 5개, 모두 [ ] 유지)

회전: **변호사 → 데이터 → AX → IT → 사용자·서류 → 계산사무장**. 원칙상 역할을 전부 한 번씩 검토하되 직접 합성 검증한 5개만 부분 근거 기록.

- `A4-IT-005` [ ]: COMMIT 후 audit INSERT 503/ACK loss, 재시도 사건 문서 링크는 유지되나 event 0건 부정대조.
- `A4-DOC-012` [ ]: 직원 Word 인계 event와 링크 영속 상태의 불일치; 이후 독립 변호사 인계/승인 미실행.
- `A4-LAW-013` [ ]: 감사 이벤트는 Word 바이트 최종검수·사람 서명·인가의 동의어가 아님. 수기·변호사 승인 미실행.
- `A4-DATA-012` [ ]: 누락 event와 중복 retry 판본의 순서/0/null 분류, 후보 원자 batch stale CAS 0행 확인; 실 DB replay 미실행.
- `X-046` [ ]: 두 SQLite 연결의 1승1패/사후 ACK 소실 합성; 실 HTTP/Cloudflare D1 두 워커 미실행.
- 간접 인계: `A4-CALC-016` [ ] 계산 Run의 완료/중복 승격 검사는 수행하지 않음. `A4-AX-013` [ ] 직원→변호사 및 Word 재생성 E2E 미실행.

## 다음 검증 ID / 실패 복구

다음 `A4-IT-005`, `A4-DOC-012`, `A4-LAW-013`, `A4-DATA-012`, `X-046`부터 시작. PR #170과 #167을 미병합 경계에서 조합해 사건 revision/참조 승인세대/Head와 동일 batch 감사의 정합성 확인. 별도로 기존 링크의 503/timeout 미관찰·R2 404 missing·증빙 상충·기존 승인 무효화를 분리. R2 성공 후 D1 실패/응답유실 복구, 중복 웹훅, 10분 quiet, 95개 법률 검토, Word 재생성, 실제 보정 이벤트 staging 종단 인수 필요. **이번 회차 최종 인수 0/5, 전체 최종 인수 0**.
