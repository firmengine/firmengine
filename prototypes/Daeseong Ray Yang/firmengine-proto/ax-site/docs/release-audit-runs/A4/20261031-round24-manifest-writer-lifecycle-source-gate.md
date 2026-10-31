# FirmEngine A4 24차 — 관찰된 Manifest/Writer 판본·파일 수명주기 복구 증빙 감사

2026-10-31 KST · A4 실행 흐름/예외/동시성/복구 · 합성 fixture 전용 · 제품 최종 인수 **0건**

## 기준/범위
- 읽기 시작 `main` HEAD: `5b3e2ad5e3fff8ceba2fc11e9082e0d5812570fd`; 변경 후 최초 확인 `main` HEAD: `804eb9fd996587eed6d4489505ea85e82a56267d`. 감사 기록 생성 직전 HEAD: `804eb9fd996587eed6d4489505ea85e82a56267d`.
- [중앙 인수 보드](../../PRODUCT_RELEASE_INTEGRATION_BOARD.md), [23차 영수증](20261031-round23-two-connections-object-key-alias-1144KST.md), 실제 `lib/export-recovery-evidence.mjs` (수정 전 blob `65e2e6af10a722532c3ebef65fa830d7b60b196e`), 합성 테스트 R20·R21·R22·R23, `lib/domain.ts` ExportManifest 계약, 미병합 [Draft PR #61](https://github.com/firmengine/firmengine/pull/61) source CAS·receipt 0023 스키마·route 및 `lib/export-request-replay.ts` 비교.
- 역할 순환: **IT → 서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자**. 대상 체크 ID: `A4-IT-005`, `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`, `A4-DATA-013`, `A4-AX-003`, `X-047`. 실행한 진단에 한정해 부분검증; 계산/사람승인/운영 워크플로는 미실행. 7개 모두 `[ ]`.
- 검증 대상은 **main에 존재하는 읽기 전용 진단 함수**다. PR #61의 실제 Export HTTP 경로와 혼동 금지. 개인정보·실제 의뢰인 문서·원본 OCR 사실값·비공개 정답·키 사용하지 않음.

## 재현 · 독립 오라클 · 변경
- 합성 기준값: `caseId=synthetic-case`, `requestId=request-aaaaaaaa`, `revision=3`, `sourceDataVersion=7`, `mode=draft`, `referenceSha256=a×64`, `artifactId=artifact-aaaaaaaa`, `R2 key=cases/synthetic-case/artifacts/artifact-aaaaaaaa`. SQL·R2 **검증되었다고 가정한 합성 SHA**·두 건 감사 이벤트·request manifest fingerprint가 상호 일치한다. 실제 R2 bytes GET/HEAD 아님.
- 이전 함수에서 관찰된 `manifest.files[].status='invalidated'` 또는 `archived`, writer `caseRevision=2`, writer reference SHA 불일치, 명시적 writer `null`, manifest `sourceDataVersionAtExport=6`, manifest 파일 ID 대체를 입력해도 **7/7 `evidence_consistent_review_required`로 거짓 일치**. 실행한 원본 함수의 V8 부정대조이며 실제 운영 데이터 오류 발생을 입증하지 않음.
- 독립 기대: 명시적으로 관찰된 manifest 원본판본·mode·file 목록·current 상태·file SQL hash·writer receipt case/revision/mode/reference SHA 중 상충이 있으면 `conflict`; 이전 축약 manifest projection에 없는 항목을 존재한 것으로 추론하지 않음. 어느 경우도 자동삭제/재실행/완료/법률승인 false.
- 수정: `MANIFEST_SOURCE_IDENTITY_CONFLICT`, `MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT`, `WRITER_RECEIPT_SOURCE_CONFLICT` 분기 추가. 새 필드를 **명시적으로 관찰한 경우에만** 검사하며 최소 projection 입력은 이전과 동일하게 '사람 검토 필요'로만 남음. 이는 자동 복구·승인 권한 추가가 아님.
- 코드 commit `e1d605a8a3619d6072baea9f713b61cd4f659db9`, 새 코드 blob `6600c09a9699a606f87a4837a50787a99cb8fd56`; 테스트 commit `804eb9fd996587eed6d4489505ea85e82a56267d`, 새 테스트 blob `5cdae8354c3acbf72e8a9a3692e55c69838289e6`.

## 실행 영수증

| 실행/입력 | 독립 기대 | 관찰 |
|---|---|---|
| 수정 전 GitHub 원본 함수 V8 실행, 정상 manifest 및 7개 상충 입력 | 상충 7건은 정상 아님 | **기존 거짓 정상 7/7 재현** |
| 수정 후 실제 GitHub blob을 다시 읽어 V8에서 `node:test` 단정 shim으로 테스트 파일 5개 실행 | 20차22·21차8·22차12·23차12·24차12 = 66 테스트 모두 기대값 | **66/66 PASS**, 각 파일 22/8/12/12/12 |
| R24: invalidated/archived, writer 구판본·SHA 변경·null, sourceVersion, 파일ID·hash, mode, 빈 파일, baseline/축약 projection | 상충은 conflict, 축약은 review-only, 4개 권한 항상 false | **12/12 PASS** (66에 포함) |
| 기존 R20–R23: NULL/[]/SQL 0행·R2 증빙 미관찰·429/503 error envelope·audit timeout·상충 probe·타 사건 R2 key alias | 예외 없이 미관찰/미존재/상충 구별, 자동삭제 false | **54/54 PASS** (66에 포함) |
| 실제 Node `node --test`, Next 빌드, 전체 CI | 별도 실행 필요 | **미실행**. V8 `new Function` shim 성공을 Node-native 또는 CI 성공으로 표시하지 않음 |
| 두 HTTP 워커/Cloudflare staging D1·R2·Cron, n8n 운영, 실제 Word, 직원/변호사 검수, 실제 법원 보정 | 별도 staging·사람 승인 영수증 필요 | **미실행** |

## 사건 단계·위험·제한
- 상담→서류→OCR→10분 quiet calculation→95법률→Word 초안→직원/변호사 검수→실제 보정 이벤트까지 전 구간의 stage/버전/CAS 승인 인계를 이번 회차에 실행하지 않았음. 기존 PR #61은 **Open/Draft/미병합**, 실행 중인 main Export 경로로 승인하지 않음.
- `manifest.files` 또는 `documentWriter` 자체가 제공되지 않은 **축약 projection**에서는 새 검사를 수행하지 않음. `evidence_consistent_review_required`는 **파일 수명주기·승인 완료 증명이 아님**. 소스만 존재(source-only)·미관찰(null)·관찰된 빈 값([])·0건·비해당·상충·승인전 각각 별도 상태.
- R2 성공→D1 실패/ACK 유실 및 서로 다른 UUID 두 워커가 생성물을 남기는 `orphan`은 여전히 자동 복구하지 않음. `claimed`/`uncertain`은 신뢰할 수 있는 D1·R2 재조회 없이 재실행하거나 삭제 금지.
- 운영 배포·운영 D1 migration·실제 전자제출·법원 인가 확정 **실행하지 않음**. 공식 서식 및 실무자 승인 미인증. 제품 최종 인수 0건.

## 다음 체크 ID
1. `A4-DATA-013` + `X-047`: 실제 증빙조회 어댑터/오류 영수증 계약을 정의하고 R2 PUT→D1 실패/ACK 유실 합성 입력을 현행 PR #61 route와 교차 검증; staging 미접속이면 미실행.
2. `A4-IT-003` + `X-046`: 서로 다른 요청 UUID 2-worker 동시 선점/최종 CAS·고아 SQL/R2 보존 분리. Cloudflare HTTP 동시 실행은 별도 영수증 필요.
3. `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`: 원본 변경/갈음 철회/관할 변경 후 10분 quiet 계산 → 법률 95개 → Word 재생성 → 직원/변호사 기존 승인 무효화. 공식 검수·실제 법원 보정 이벤트는 별도 인수.
