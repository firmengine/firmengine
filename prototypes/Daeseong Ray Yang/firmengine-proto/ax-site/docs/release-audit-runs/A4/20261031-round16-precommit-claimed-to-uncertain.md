# A4 16차 — R2/SQL 사전 커밋 실패 후 영속 Export claim 잔류

- 기준: 2026-10-31 KST, 본 회차의 읽기 당시 GitHub **main** 최근 HEAD `bf8a301d9e650adbf968796ba76b06b4df94df62`; 단일 기준 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`.
- 변경 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`에 한정. 제안된 동작 수정은 **Draft [PR #61](https://github.com/firmengine/firmengine/pull/61)**의 기존 격리 브랜치에서만 수행. main 운영 Export HTTP 코드는 변경하지 않음.
- 사전 검토: main 최근 커밋/보드, A4 15차 영수증, PR #61의 Export route, 요청 원장 SQL, `commitExportArtifactTransaction`, 작성된 Node 회귀 테스트. 소스 blob: 원장 `630acbcbaf5e08ad484e9b717a40065b5114eda4`, route 변경 전 `02ff39d63367a0186f47f899ed449e047e87d183`.
- 집중 체크 ID(모두 미완 `[ ]`): `A4-IT-006`, `A4-DOC-011`, `A4-CALC-016`, `A4-DATA-014`, `A4-AX-003`; 교차 `X-046`. 변호사 `A4-LAW-013`은 연관 단계로 정적 확인만 했으며 Word/사람 승인 테스트 미실행. 계산사무장 및 변호사 역할은 이번 검증을 계산/법률 인가 합격으로 간주하지 않는다.

## 관찰한 결함 (PR #61 통합안에 한정)

통합안은 `claimExportRequest()`로 D1 영속 receipt를 `claimed`로 기록한 뒤 R2 PUT→artifact SQL batch→manifest CAS를 진행한다. 기존 `commitExportArtifactTransaction`은 manifest COMMIT을 시도한 이후 실패 시에만 `onCommitUncertain`을 호출했다. **R2 PUT이 429/503/timeout으로 실패하거나 D1 artifact SQL 적재가 실패하여 manifest 시도 전 예외가 발생하면, 베스트에포트 파일 정리는 실행하지만 영속 receipt는 계속 `claimed`** 상태였다. 따라서 작업이 종료된 후에도 동일 UUID 재전달은 `in_flight_do_not_reclaim`/503으로 보류되며, worker가 진행 중이라는 상태와 복구 필요 상태가 구분되지 않는다. 장애 조건은 코드 제어 흐름으로 확인했으며 실제 staging 429/503 사건을 관찰한 것은 아니다.

- 합성 사건 입력: `case=synthetic-precommit`, `revision=7`, `sourceDataVersion=4`, `requestId=a4-synthetic-request-001`, `claimToken=claim-token-1`, `referenceSha256=b×64`; 독립 SQLite fixture에는 고객 정보·OCR 데이터·문서 원문 없음.
- 독립 기대: claim은 최초 1회만 성공; manifest 이전 429/503/timeout/SQL 실패는 **committed가 아니라 uncertain/수동 대조**. 다른 claimToken/해시의 상태 변경 0건. 실제 manifest COMMIT 뒤 ACK만 유실한 영수증은 `committed`를 유지. 재시도/파일 삭제 자동 허용 없음.
- 수정 전 관찰: PR route의 실패 `catch`는 외부 `errorResponse`뿐이었으며 manifest 이전 경로에 receipt 상태 전환이 없었다. 이 결함이 운영 배포되어 발생했다고 주장하지 않는다.

## 변경·검증 영수증

- Draft PR #61 route 파일에 **transaction 범위 catch** 추가: 어떤 transaction 예외에서도 `markExportUncertain({...claim,at:now()})`을 최선노력 실행하고 **원래 예외를 다시 던짐**. SQL 자체가 `status='claimed'` 및 case/request/hash/claimToken 조건을 강제하므로 COMMIT 성공/ACK 유실 이후 `committed`를 `uncertain`으로 강등하지 않음. 불확실/보류 상태의 자동 재개·삭제·승인은 금지. 오류 시 D1이 다시 실패하면 보류 이력 갱신도 실패할 수 있으므로 수동 조사 필요.
- route 변경 커밋 `793fb309b27cb9769d32c965219e7aafc20b757f`, 새 blob `a9ebf663507c672dfee6bf9f179581e3cd2ea099`.
- 신규 회귀 소스 `tests/export-precommit-uncertain-r16.test.ts` 커밋 `1ee097b6c1c86b31117aee0f61ee6a4c31908fe6`, blob `c994598456c54f2284011a799c9957acbb1a9283`.
- **실제 실행 A:** Python 3.13 SQLite 독립 합성 `/mnt/data/firmengine-a4/round16_precommit_ledger.py` **9/9 PASS** — 기존 claimed 잔류 부정대조, 429/503/timeout에 상응하는 uncertain 전환, SQL 일부 성공, 중복 UUID, 타 claimToken/hash, ACK 유실 후 committed 불변, 반복 transition, 별개 요청 격리. SQL은 PR #61 원장의 claim/mark 문구를 따라 별도 실행한 것. Cloudflare D1이 아니다.
- **실제 실행 B:** GitHub PR의 실제 `markExportUncertain`/`claimExportRequest` 함수 본문에서 TypeScript 단언부를 제거하여 V8 격리 실행, route/test blob 정적 순서 및 결합 검증 **8/8 PASS**. source SHA를 재조회했다.
- **미실행:** 신규 Node `tests/export-precommit-uncertain-r16.test.ts` **작성만, 저장소 경유 실제 Node 실행 미실행**. 최신 main 전체 Node/TypeScript/build/CI, 실제 Export HTTP 2-worker, staging D1/R2/Cron·429/503/timeout 주입, Word 문서 바이트, 실제 변호사 검수/법원서식/배포 모두 미실행. `claimed`→`uncertain`은 **상태 가시성 개선이지 자동 장애복구 구현 완료가 아니다.**

## 단계·판본·승인 경계

상담→서류→OCR→10분 quiet calculation→95 법률 위험 검토→Word 초안→직원/변호사 순차 승인→실제 보정 이벤트의 전 단계 source/ref/revision/CAS는 **이번 실험에서 단일 end-to-end로 실행하지 않았다.** `null`/미관찰/0/비해당/상충/source-only/승인전은 구분 유지. `claimed` 및 `uncertain` 영수증은 법률 인가나 문서 생성 성공이 아니다. n8n 연결은 설계 문서와 운영 실행을 분리하며 운영 워크플로 입증되지 않았다.

## 다음 실행 대상

1. `A4-DATA-014`, `A4-IT-005`: `claimed/uncertain` receipt에 대한 실제 읽기 전용 증빙 수집, SQL/R2 byte SHA/manifest 및 event 여부 대조; 안전한 관리자 복구·outbox/DLQ 계약은 별도 PR과 승인 필요.
2. `A4-IT-003`, `X-046`: **서로 다른 UUID** 두 HTTP worker 실경합, R2 성공/D1 CAS 실패 후 SQL/R2 고아 증거 보존, current 판본 1개 확인.
3. `A4-DOC-012`, `A4-CALC-014`, `A4-LAW-013`: 원본/갈음/관할 판본 갱신으로 10분 계산·95 검토·Word 새 바이트 생성·직원/변호사 승인 무효화/재승인.
4. 통합 Draft PR #61의 현재 main과 병합충돌·Node/TS/CI 및 staging D1/R2 확인 전 병합·운영 migration 0023·배포·전자제출 금지.

**이번 제품 인수 PASS 0건.** 본 문서와 보드 기록은 실제 실행한 합성 시험/정적 연결만 부분 검증으로 기록하며, 운영 D1/R2/고객 데이터는 변경하지 않았다.
