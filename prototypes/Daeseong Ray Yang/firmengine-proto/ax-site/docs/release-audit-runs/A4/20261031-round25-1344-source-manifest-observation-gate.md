# FirmEngine A4 25차 — D1 현재 원본·Manifest 조회오류와 미관찰 분리 (읽기 전용)

2026-10-31 KST · A4 실행 흐름/예외/동시성/복구만 · **합성 입력** · 제품 최종 인수 **0건**.

## 시작 기준·분리
- 시작 GitHub `main` HEAD: `000bb525ed23e85364a8b13f51ca4b271617ca3d`; 감사 영수증 기록 직전 관찰 HEAD: `3d9ef03e505211f2513c2e820f66c6db1aa9c775`. 최근 커밋 A3 r25·A2 r25 및 이전 A4 r24를 대조.
- 우선 문서: [중앙 인수 보드](../../PRODUCT_RELEASE_INTEGRATION_BOARD.md), [A4 24차](20261031-round24-manifest-writer-lifecycle-source-gate.md); 관련 실코드 `lib/export-recovery-evidence.mjs`, 20–24차 tests, PR #61 `app/api/cases/[id]/export/route.ts`, `lib/export-request-ledger.ts`, `lib/export-artifact-transaction.ts`, `drizzle/0023_case_export_request_receipts.sql`, `lib/domain.ts`.
- PR #61 재조회: `e1a10be1e83516fa383d91f08dfdb62c7b530a5b`, `open` / Draft=`true` / merged=`false`. **미병합 통합 제안**이며 `main` Export 실행 경로가 아님. 0023 migration 운영 반영 금지.
- 순환 역할: **데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사**. 실제 실행 대상 4개: `A4-DATA-013`, `A4-AX-023`, `A4-IT-005`, `X-047`. 후속 승인 경계 `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`은 **실행 미검증**. 전체 [ ] 유지.

## 독립 기대·오류 재현
- 동일 synthetic receipt: `case=synthetic-case`, `request=request-aaaaaaaa`, `revision=3`, `sourceDataVersion=7`, `SHA=a×64`, `artifact=artifact-aaaaaaaa`; SQL 생성물·R2 byte-verified **가정 증빙**·감사 두 이벤트·Manifest 축약 projection을 테스트에만 공급. 실제 D1 SQL 조회나 R2 GET/HEAD가 아니다.
- 이전 코드가 `caseSnapshot={}`를 `CASE_ID_CONFLICT`+원본 구판본으로, `revision:null`을 `stale`로, `revision:0` 또는 `referenceSha256:"bad"`를 `stale`로 잘못 표기함. `manifest={error:"read timeout",status:503}`를 `historical`, `requestId`가 누락/null인 Manifest를 `historical`로 오인함. **수정 전 9개 잘못된 분류 재현**; 실제 운영에서 장애가 발생한 증거가 아님.
- 독립 오라클: 현재 원본의 `null`/미관찰/부분 projection ⇒ `inconclusive`; 원본의 0·잘못된 SHA·D1 429/503 오류 객체 ⇒ `conflict`; **완전하고 유효한** 원본 revision 차이 ⇒ `stale`; 다른 사건 ID ⇒ `conflict`. Manifest 요청 ID 누락은 `inconclusive`, 명시적 다른 요청 ID는 `historical`, malformed/timeout 객체는 `conflict`로 분리.
- 저장된 PR #61 `ExportManifest`는 `exportRequestId`를 사용하고 축약 진단 `manifest.requestId`/`fingerprint`를 직접 제공하지 않음. **실제 ExportManifest를 진단 투영으로 사용하는 어댑터는 아직 없음**. `exportRequestId`만 있는 원본형 입력을 **historical로 거짓 확정하지 않고 미관찰로 차단**하는 시험을 추가. 식별자·해시를 추정해 생성하지 않음.

## 변경·실행 영수증
- 변경 코드: `lib/export-recovery-evidence.mjs`; 이전 blob `6600c09a9699a606f87a4837a50787a99cb8fd56` → 현재 blob `306daa4c445766b409b7d1f1d9b8e7f3bb20cffe`; commit `2d622abf3fa6b11afed04afe70bad6e24bdf5e1b`.
- 새 회귀 테스트: `tests/export-recovery-evidence-r25-source-manifest-states.test.mjs`, blob `0d906de735abd102f3540f188c3c05b892b77671`, commit `3d9ef03e505211f2513c2e820f66c6db1aa9c775`.
- 직접 확인: 수정 전 GitHub 원본 함수 V8 실행으로 부정대조 9건, 수정한 함수 대상 16/16 기대 일치. GitHub 반영 blob 재조회 후 **기존 r20–r24 테스트 66 + 신규 r25 16 = V8 격리 단정 shim 82/82 PASS** (6개 `.test.mjs` 소스). 4개 권한 `canDelete/canReplay/canMarkCommitted/canApprove` 항상 false.
- 이 V8 shim은 `node:test`를 네이티브 Node 러너로 실행한 증거가 아니다. **Node-native, TypeScript 전체, Next build, CI 미실행**. SQL/R2 증빙은 합성·가정값이며 실제 바이트 확인, D1/R2/Cron staging, 실 HTTP 두 워커, timeout/429/503 fault-injection 운영 경로, n8n 운영 워크플로 **미실행**. n8n 설계 문서는 실행 증빙이 아님.

## 현재 운영 계약·제약
- 읽기 전용 진단의 오분류를 수정한 **source-only 개선**이다. `claimed`/`uncertain` 원장을 자동으로 `committed`로 승격하거나 삭제·재실행하지 않음. `null`/미관찰, 명시적 0/무효, 관찰된 빈 결과, 실제 상충, 승인 전을 구분.
- 상담→서류→OCR→10분 quiet 계산→95법률→Word 초안→직원/변호사 검수→실제 보정 단계의 판본/CAS/승인 인계는 이번 회차 E2E로 실행하지 않았음. 운영 배포·D1 운영 migration·실제 전자제출·법원 인가 확정·고객 데이터 처리 **실행하지 않음**. 공식 서식·변호사 검수 미인증.

## 다음 체크 ID 및 미해결
1. `A4-DATA-013`+`X-047`: SQL artifact·D1 request receipt·실제 바이트 검증된 R2 증빙·현행 ExportManifest에 대한 **읽기 전용 어댑터의 계약** (원본 키 `exportRequestId`, 별도 계산된 fingerprint, 지연 응답/부분성공); 원본 누락은 자동 복구하지 않음.
2. `A4-IT-003`+`X-046`: 서로 다른 UUID 두 HTTP 워커 CAS와 패자 orphan SQL/R2에 대한 staging fault injection. CI/실제 D1/R2/Cron 권한이 없으면 미실행 유지.
3. `A4-DOC-011`+`A4-CALC-016`+`A4-LAW-013`: 원본 변경·갈음 철회·관할판본 변경→quiet 재계산·95법률검토·Word 재생성·직원/변호사 승인 무효화; 법원 보정 실제 이벤트·공식서식 검토 별도.
