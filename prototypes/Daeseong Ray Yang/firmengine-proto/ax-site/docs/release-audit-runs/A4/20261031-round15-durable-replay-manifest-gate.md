# A4 15차 — 영속 Export 영수증 재사용 시 구판본 manifest 거짓 정상 차단

- 기준(2026-10-31 KST): GitHub `main` HEAD `f45f7d7395edbfee742f1818114245ee12533bb6`; 통합 [Draft PR #61](https://github.com/firmengine/firmengine/pull/61)에서만 동작 코드 수정, **운영/인수/배포 미반영**.
- 선행 이력: [A4 14차](20261031-round14-export-five-pr-integration-draft.md) 통합 초안, 이전 #24/#31/#35/#40/#45. PR #61은 변경 19개 파일 모두 `ax-site/` 내부; 새 15차 수정 2개 파일(라우트 및 합성 테스트). 기존 PR들은 병합하지 않음.
- 선택 ID(모두 [ ] 부분): `A4-IT-005`(영수증 재조회), `A4-DOC-011`(초안/편집 재생성), `A4-LAW-013`(현재 Word 바이트 검수), `A4-DATA-020`(artifact 상태), `A4-AX-003`(동일 stage 요청 정체성). 교차 `X-046`과 계산사무장 `A4-CALC-014`는 **연관성만 검토, 계산/2-worker 실제 실행하지 않아 통과 처리 금지**.

## 현행 코드에서 관찰한 P1 후보 결함 (Draft PR #61에 한정)

`app/api/cases/[id]/export/route.ts`의 `existing` 영속 영수증 재생 분기는 `inspectExportReceipt`가 `verify_sql_and_r2_before_reuse`를 반환하면, 현 `exportManifest`의 `files` ID/hash와 R2 실제 바이트 해시만 검사하고 응답한다. **모든 파일이 `archived` 또는 `invalidated`여도** 상태와 `documentWriter` 현재 증명, 원본/기준/서식 모드 일치를 검사하지 않았다. 이전 `inspectExportRequestReplay`에는 이미 이런 차단 검사가 있었으나 새 영속 원장 라우트가 호출하지 않았다.

- 합성 입력: 사건 `synthetic`, 요청 ID `11111111-2222-4333-8444-555555555555`, revision=7, OCR sourceVersion=4, reference SHA `a×64`, artifact `artifact-a`, byte hash `b×64`. 영수증 status=`committed`, current `manifestFingerprint` 동일. 단, 파일 status=`archived` / `invalidated`, 작성 영수증 null, mode/revision/source/reference 드리프트를 각각 주입. **실제 의뢰인·OCR 값·문서 바이트 없음.**
- 독립 기대: 변형 없는 `current`만 안전한 재사용 사전조건을 충족한다. status가 `archived`/ `invalidated`거나 writer/source/reference/경계 중 하나가 어긋나면 **409/수동 대조, 승인 복원 금지**; R2 존재는 법률/검수 current 증명이 아니다.
- 관찰(수정 전): 실제 GitHub blob `lib/export-request-ledger.ts@630acbcb...`의 `inspectExportReceipt` 함수 본문을 V8 격리 실행한 결과, archived 등 변형도 모두 `verify_sql_and_r2_before_reuse`를 반환. 실제 라우트 blob `41610864...`는 `inspectExportRequestReplay` 호출이 없어 그 검사를 생략. **전 HTTP 요청 또는 Cloudflare D1/R2 재현 아님**.
- 수정: 기존 `inspectExportRequestReplay` 검증을 해당 영수증 재생 분기 첫 단계에 연결; `reuse`가 아니면 409. 그 다음에야 기존 SQL 소속/revision/hash/R2 바이트 SHA 확인을 수행. `manifest` current 판단만 바꾸며 과거 파일의 자동삭제·사람 승인 자동복원 없음.
- 변경 커밋: `7c11226cb555679e49f099737f3beaf387011f93`(새 `tests/export-durable-replay-r15.test.ts`), `25d41f4f9627d1f0d2ea64dbff7a6fc5080a8dce`(route import+gate). 적용한 라우트 blob `02ff39d63367a0186f47f899ed449e047e87d183`.

## 실제 재현·검증과 제한

1. **V8 격리 계약 실행 9/9 기대 일치**: 실제 PR 파일의 두 순수함수 본문(`inspectExportReceipt`, `inspectExportRequestReplay`)을 읽어 타입 전용 `as const`만 제거한 뒤 실행. current 1개 `reuse`; archived, invalidated, writer 누락, mode/revision/source/reference 불일치, 파일 0개 각 `conflict`. 이때 영속 receipt 단독 판정은 동일하게 `verify_sql_and_r2_before_reuse`였으며 새 라우트의 사전 게이트로 차단될 조합임을 확인.
2. **GitHub 수정 라우트 정적 연결 검증 PASS**: `inspectExportRequestReplay` import 존재, replay 분기 진입 < 공동 current 검증 < SQL/R2 proof 검사 순서. PR 파일 SHA를 재조회했다.
3. **이전 SQL 실험 스크립트 재실행 10/10**: `/mnt/data/firmengine-a4/sql_atomic_contract.py`의 SQLite **합성 계약**. 동일 UUID claim/2 writer CAS/누락·타사건·구 revision artifact/원본 version 드리프트/감사오류 롤백/ACK 소실/중복 COMMIT을 검사. **이 스크립트는 이전 14차의 SQL 복제계약**이며 실제 Cloudflare D1·Word/http 경로가 아니다.
4. Node 22/TypeScript 신규 테스트 `tests/export-durable-replay-r15.test.ts`는 저장소에 **작성만 함, 실행 미실행**. 최신 main 빌드/CI, 실제 2 HTTP 워커, staging D1/R2/Cron, 실제 Word 파일 해시·직원/변호사 검수·보정 이벤트, n8n 운영 실행 **전부 미실행**. 설계 문서로 실제 n8n 워크플로 존재를 추정하지 않는다.

## 사건 단위 단계·복구/승인 경계

상담→서류→OCR→quiet calculation(10분)→95 법률→Word→직원 검수→변호사 검수→실제 법원 보정의 전 단계 source/revision/reference/actor/CAS E2E는 여전히 **미인증**. 이 수정은 **이미 작성된 수동 Export의 idempotent 응답 재생 한 구간**만 막는다. `unobserved/null`은 `0`이 아니며, `archived`는 `current`가 아니고, `source-only` 및 승인 전 결과는 법률적 확정값이 아니다. 응답 유실 후 `claimed/uncertain`은 미확정으로 보존하며 삭제 금지; `committed`에도 최신 writer/서류 상태 재검증 필요.

### 다음 A4 체크/미해결 P0-P1

- `A4-IT-003` / `X-046`: Cloudflare staging의 **서로 다른 UUID 2 워커** 동시 claim·커밋·고아 SQL/R2 보존, 실제 D1 CAS receipt 0건/1건 비교.
- `A4-DATA-014` / `X-047`: R2 성공→D1 실패/ACK 유실 시 `claimed/uncertain` 안전 read-only 복구, outbox/DLQ·인수자 확인.
- `A4-DOC-012`, `A4-LAW-013`, `A4-CALC-014`: 원본 변경→재계산→95 법률→Word 재생성→직원/변호사 순차 승인 무효화. 소스 교체·갈음 철회·관할 판본·법원 기한 null과 함께 검증.
- 병합 전 Draft PR #61의 **실제 Node/TS/lint/Next build/전체 CI 및 staging D1/R2 계약** 필수. 운영 migration 0023 및 배포·전자제출·법원 인가 확정 실행 금지.

**최종 제품 인수 0건, 통과로 격상한 체크 ID 0건.**
